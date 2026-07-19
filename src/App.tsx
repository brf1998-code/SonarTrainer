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

type Tab = 'sonar' | 'geo' | 'tools';

export default function App() {
  const [scenarioId, setScenarioId] = useState('tut-bearing-rate');
  const [simVersion, setSimVersion] = useState(0);
  const simRef = useRef<Simulation | null>(null);
  if (!simRef.current) {
    simRef.current = new Simulation(scenarioById(scenarioId));
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

  const resetScenario = (id: string) => {
    simRef.current = new Simulation(scenarioById(id));
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
        <select value={scenarioId} onChange={(e) => resetScenario(e.target.value)}>
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
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
            {(['sonar', 'geo', 'tools'] as Tab[]).map((t) => (
              <button key={t} className={t === tab ? 'active' : ''} onClick={() => setTab(t)}>
                {t === 'sonar' ? 'SONAR' : t === 'geo' ? 'GEO PLOT' : 'TOOLS'}
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
        </div>

        <div className="col right">
          <TMAPanel sim={sim} tick={tick} tracker={selectedTracker} truthMode={truthMode} />
        </div>
      </div>
    </div>
  );
}
