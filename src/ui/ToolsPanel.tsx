import { useState } from 'react';
import { Simulation } from '../sim/simulation';
import { Tracker } from '../sim/types';
import { bearingRate, detectLegs } from '../sim/tma';
import { ekelundExplained } from '../sim/assist';
import { EKELUND_K } from '../sim/constants';
import { fmtTime } from '../sim/geo';

interface Props {
  sim: Simulation;
  tick: number;
  tracker: Tracker | null;
}

/** nominal open-literature-style reference values per class for turn-count work */
const CLASS_REF: Record<string, { blades: number; tpk: number }> = {
  merchant: { blades: 5, tpk: 7.5 },
  warship: { blades: 5, tpk: 11 },
  submarine: { blades: 7, tpk: 16 },
  fishing: { blades: 3, tpk: 22 },
};

export default function ToolsPanel({ sim, tick, tracker }: Props) {
  // manual Ekelund calculator state
  const [sa1, setSa1] = useState(8);
  const [sa2, setSa2] = useState(-6);
  const [bd1, setBd1] = useState(0.6);
  const [bd2, setBd2] = useState(1.4);
  // turn count calculator
  const [brHz, setBrHz] = useState(6);
  const [cls, setCls] = useState('merchant');

  const legs = detectLegs(sim.ownHistory);
  const ek = tracker ? ekelundExplained(sim, tracker) : null;

  const manualR = (EKELUND_K * (sa1 - sa2)) / (bd2 - bd1);
  const ref = CLASS_REF[cls];
  const shaftRpm = (brHz * 60) / ref.blades;
  const estSpeed = shaftRpm / ref.tpk;

  // live bearing rate over the last 3 minutes for selected tracker
  const liveBr = tracker ? bearingRate(tracker.marks, sim.t - 180, sim.t) : null;

  return (
    <div>
      <div className="panel">
        <h3>BEARING RATE</h3>
        {tracker && liveBr ? (
          <>
            <div className="kv">
              <span className="k">{tracker.label} mean brg (3 min)</span>
              <span className="v">{Math.round(liveBr.mean)}°</span>
            </div>
            <div className="kv">
              <span className="k">bearing rate</span>
              <span className="v green">
                {liveBr.rate >= 0 ? 'RIGHT' : 'LEFT'} {Math.abs(liveBr.rate).toFixed(2)}°/min
              </span>
            </div>
            <div className="help-block">
              Bearing rate ∝ relative speed across the LOS ÷ range. A high rate means close and/or fast-crossing.
              Near-zero rate with closing signature = constant-bearing collision (or trail) geometry.
            </div>
          </>
        ) : (
          <div className="dim">Select a tracker with ≥3 bearings.</div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 8 }}>
        <h3>EKELUND RANGE — FROM YOUR LEGS</h3>
        {ek ? (
          <div className="explain small">
            {ek.lines.map((l, i) => (
              <div key={i} className={l.startsWith('R ') ? 'formula' : ''}>
                {l}
              </div>
            ))}
          </div>
        ) : (
          <div className="dim">Select a tracker.</div>
        )}
        <div className="help-block">
          Steady legs detected: {legs.length}
          {legs.length > 0 &&
            ` (latest: ${fmtTime(legs[legs.length - 1].startT)}–${fmtTime(legs[legs.length - 1].endT)}, course ${Math.round(
              legs[legs.length - 1].course,
            )})`}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 8 }}>
        <h3>EKELUND — MANUAL CALCULATOR</h3>
        <div className="row">
          <label>Sa₁ kts</label>
          <input type="number" value={sa1} onChange={(e) => setSa1(Number(e.target.value))} />
          <label>Ḃ₁ °/min</label>
          <input type="number" step="0.1" value={bd1} onChange={(e) => setBd1(Number(e.target.value))} />
        </div>
        <div className="row">
          <label>Sa₂ kts</label>
          <input type="number" value={sa2} onChange={(e) => setSa2(Number(e.target.value))} />
          <label>Ḃ₂ °/min</label>
          <input type="number" step="0.1" value={bd2} onChange={(e) => setBd2(Number(e.target.value))} />
        </div>
        <div className="explain">
          R = 1934 × (Sa₁ − Sa₂) / (Ḃ₂ − Ḃ₁) ={' '}
          <span className="formula">
            {isFinite(manualR) && Math.abs(bd2 - bd1) > 1e-6 ? `${(manualR / 1000).toFixed(1)} kyd` : '—'}
          </span>
        </div>
        <div className="help-block">
          Sa = own speed across the line of sight on each leg (positive toward increasing bearing). The 1934
          constant converts kts and °/min into yards. Valid only if the target held course and speed.
        </div>
      </div>

      <div className="panel" style={{ marginTop: 8 }}>
        <h3>TURN COUNT → SPEED</h3>
        <div className="row">
          <label>blade rate</label>
          <input type="number" step="0.1" value={brHz} onChange={(e) => setBrHz(Number(e.target.value))} />
          <span className="dim">Hz</span>
          <select value={cls} onChange={(e) => setCls(e.target.value)}>
            {Object.keys(CLASS_REF).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="kv">
          <span className="k">shaft RPM = 60×BR/blades ({ref.blades} blades)</span>
          <span className="v">{shaftRpm.toFixed(0)} rpm</span>
        </div>
        <div className="kv">
          <span className="k">est. speed @ {ref.tpk} turns/kt</span>
          <span className="v green">{estSpeed.toFixed(1)} kts</span>
        </div>
        <div className="help-block">
          Read blade rate off the narrowband gram (fundamental of the harmonic family). Class reference values
          here are generic training numbers — classification drives which line you use.
        </div>
      </div>

      <div className="panel" style={{ marginTop: 8 }}>
        <h3>QUICK REFERENCE</h3>
        <div className="help-block">
          <div>• Ekelund: R = 1934 × ΔSa / ΔḂ (yds; kts; °/min)</div>
          <div>• Bearing rate: Ḃ = 1934⁻¹ × (rel. speed across LOS / R)… i.e. Ḃ(°/min) ≈ 1934 × Vacross(kts) / R(yds)</div>
          <div>• Speed across LOS: Sa = S·sin(course − bearing)</div>
          <div>• CZ: first zone ≈ 30–35 nm in deep water w/ depth excess; annulus ~3–5 nm; near-zero D/E</div>
          <div>• Bottom bounce: steep D/E, mid ranges, weaker over mud</div>
          <div>• Cross-layer contacts fade with range much faster; go where the target is</div>
          <div>• Towed array: low-freq narrowband + port/stbd ambiguity; resolve with a maneuver</div>
          <div>• Own speed ↑ → self noise ↑ → every array gets worse; slow to listen</div>
        </div>
      </div>
    </div>
  );
}
