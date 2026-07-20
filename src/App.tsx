import { useEffect, useMemo, useRef, useState } from 'react';
import { Simulation } from './sim/simulation';
import { SCENARIOS, scenarioById } from './sim/scenarios';
import { TIME_SCALES } from './sim/constants';
import { fmtTime } from './sim/geo';
import { ArrayType } from './sim/types';
import { tutorialById } from './tutorials/tutorials';
import WaterfallDisplay from './ui/WaterfallDisplay';
import NarrowbandDisplay from './ui/NarrowbandDisplay';
import GeoPlot from './ui/GeoPlot';
import TMAPanel from './ui/TMAPanel';
import ToolsPanel from './ui/ToolsPanel';
import ShipControl from './ui/ShipControl';
import TutorialPanel from './ui/TutorialPanel';
import EventLog from './ui/EventLog';
import IntelPanel from './ui/IntelPanel';
import { OWNSHIP_PLATFORMS } from './sim/platforms';

type Tab = 'sonar' | 'geo' | 'tools' | 'intel';

export default function App() {
  const [scenarioId, setScenarioId] = useState('tut-bearing-rate');
  const [ownPlatformId, setOwnPlatformId] = useState('virginia');
  const [simVersion, setSimVersion] = useState(0);
  const simRef = useRef<Simulation | null>(null);
  if (!simRef.current) {
    simRef.current = new Simulation(scenarioById(scenarioId), ownPlatformId);
  }
  const sim = simRef.current;

  const [tick, setTick] = useState(0);
  const [timeScale, setTimeScale] = useState(5);
  const [paused, setPaused] = useState(false);
  const [truthMode, setTruthMode] = useState(false);
  const [tab, setTab] = useState<Tab>('sonar');
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [tutStep, setTutStep] = useState(0);

  const scenario = sim.scenario;
  const tutorial = useMemo(
    () => (scenario.tutorialId ? tutorialById(scenario.tutorialId) : undefined),
    [scenario],
  );

  // main loop
  useEffect(() => {
    const iv = setInterval(() => {
      if (!paused) {
        sim.step(0.25 * timeScale);
      }
      setTick((t) => t + 1);
    }, 250);
    return () => clearInterval(iv);
  }, [sim, timeScale, paused]);

  const resetScenario = (id: string, platformId = ownPlatformId) => {
    simRef.current = new Simulation(scenarioById(id), platformId);
    setScenarioId(id);
    setSimVersion((v) => v + 1);
    setSelectedTrackerId(null);
    setTutStep(0);
    setTruthMode(false);
    setTab('sonar');
  };

  const selectedTracker =
    sim.trackers.find((t) => t.id === selectedTrackerId) ??
    (sim.trackers.length > 0 ? sim.trackers[sim.trackers.length - 1] : null);

  const designate = (arrType: ArrayType) => (bearing: number) => {
    const tr = sim.designate(arrType, bearing);
    if (tr) setSelectedTrackerId(tr.id);
  };

  return (
    <div className="app" key={simVersion}>
      <div className="topbar">
        <span className="title">SONAR / TMA TRAINER</span>
        <span className="dim small" style={{ marginLeft: -4 }}>
          by Brendan Finn · Former Sub JO
        </span>
        <select value={scenarioId} onChange={(e) => resetScenario(e.target.value)}>
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={ownPlatformId}
          title="ownship platform (resets scenario)"
          onChange={(e) => {
            setOwnPlatformId(e.target.value);
            resetScenario(scenarioId, e.target.value);
          }}
        >
          {OWNSHIP_PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              OWN: {p.shortName}
            </option>
          ))}
        </select>
        <button onClick={() => resetScenario(scenarioId)}>RESET</button>
        <span className="spacer" />
        <span className="clock">{fmtTime(sim.t)}</span>
        <button className={paused ? 'warn' : ''} onClick={() => setPaused(!paused)}>
          {paused ? 'RESUME' : 'PAUSE'}
        </button>
        {TIME_SCALES.map((ts) => (
          <button key={ts} className={ts === timeScale ? 'active' : ''} onClick={() => setTimeScale(ts)}>
            {ts}×
          </button>
        ))}
        <button className={truthMode ? 'active' : ''} onClick={() => setTruthMode(!truthMode)}>
          TRUTH
        </button>
      </div>

      <div className="main">
        <div className="col left">
          <ShipControl sim={sim} tick={tick} />
          {tutorial && (
            <TutorialPanel
              sim={sim}
              tick={tick}
              tutorial={tutorial}
              stepIdx={tutStep}
              onAdvance={() => setTutStep((s) => Math.min(s + 1, tutorial.steps.length - 1))}
            />
          )}
          {!tutorial && (
            <div className="panel">
              <h3>MISSION</h3>
              <div className="tutorial-text small">{scenario.brief}</div>
            </div>
          )}
          <EventLog sim={sim} tick={tick} />
        </div>

        <div className="col center">
          <div className="tabs">
            {(['sonar', 'geo', 'tools', 'intel'] as Tab[]).map((t) => (
              <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
                {t === 'sonar' ? 'SONAR' : t === 'geo' ? 'GEO PLOT' : t === 'tools' ? 'TOOLS' : 'INTEL'}
              </button>
            ))}
            <span className="spacer" />
            <span className="dim small" style={{ alignSelf: 'center' }}>
              trackers:
              {sim.trackers.length === 0 && <span className="dim"> none — click a trace to designate</span>}
            </span>
            {sim.trackers.map((tr) => (
              <span
                key={tr.id}
                className={`tracker-chip ${tr === selectedTracker ? 'sel' : ''} ${tr.lost ? 'lost' : ''}`}
                onClick={() => setSelectedTrackerId(tr.id)}
              >
                {tr.label}
                {tr.lost ? ' (lost)' : ''}
              </span>
            ))}
          </div>

          {tab === 'sonar' && (
            <>
              <WaterfallDisplay
                sim={sim}
                arrType="sphere"
                tick={tick}
                onDesignate={designate('sphere')}
                height={210}
              />
              <WaterfallDisplay
                sim={sim}
                arrType="towed"
                tick={tick}
                onDesignate={designate('towed')}
                height={210}
              />
              <NarrowbandDisplay sim={sim} tracker={selectedTracker} tick={tick} />
            </>
          )}
          {tab === 'geo' && (
            <GeoPlot sim={sim} tick={tick} truthMode={truthMode} selectedTracker={selectedTracker} />
          )}
          {tab === 'tools' && <ToolsPanel sim={sim} tick={tick} tracker={selectedTracker} />}
          {tab === 'intel' && <IntelPanel />}
        </div>

        <div className="col right">
          <TMAPanel sim={sim} tick={tick} tracker={selectedTracker} truthMode={truthMode} />
        </div>
      </div>
    </div>
  );
}
