import { useEffect, useRef, useState } from 'react';
import { Simulation } from '../sim/simulation';
import { ContactClass, Solution, Tracker } from '../sim/types';
import { gradeSolution, residuals, rmsResidual } from '../sim/tma';
import { recommendManeuver, recommendSolution } from '../sim/assist';
import { bearingTo, fmtRange, norm360, rangeYds } from '../sim/geo';
import { DEG } from '../sim/constants';

const STACK_W = 300;
const STACK_H = 260;

interface Props {
  sim: Simulation;
  tick: number;
  tracker: Tracker | null;
  truthMode: boolean;
}

/** build a Solution from operator range/course/speed anchored on current bearing */
function makeSolution(sim: Simulation, tr: Tracker, rangeYd: number, course: number, speed: number): Solution {
  const b = sim.trackerBearing(tr) ?? 0;
  return {
    pos: {
      x: sim.own.pos.x + Math.sin(b * DEG) * rangeYd,
      y: sim.own.pos.y + Math.cos(b * DEG) * rangeYd,
    },
    course: norm360(course),
    speed,
    t: sim.t,
  };
}

export default function TMAPanel({ sim, tick, tracker, truthMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rangeIn, setRangeIn] = useState(10000);
  const [courseIn, setCourseIn] = useState(90);
  const [speedIn, setSpeedIn] = useState(10);
  const [scaleDeg, setScaleDeg] = useState(3);
  const [assistText, setAssistText] = useState<string[]>([]);

  // when tracker changes, load its solution into the inputs
  useEffect(() => {
    if (tracker?.solution) {
      const p = tracker.solution;
      const r = rangeYds(sim.own.pos, p.pos);
      setRangeIn(Math.round(r));
      setCourseIn(Math.round(p.course));
      setSpeedIn(Math.round(p.speed * 10) / 10);
    }
    setAssistText([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracker?.id]);

  const apply = (r: number, c: number, s: number) => {
    if (!tracker) return;
    setRangeIn(r);
    setCourseIn(c);
    setSpeedIn(s);
    sim.setSolution(tracker.id, makeSolution(sim, tracker, r, c, s));
  };

  // dot stack rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#040a0e';
    ctx.fillRect(0, 0, STACK_W, STACK_H);
    ctx.strokeStyle = 'rgba(120,160,140,0.35)';
    ctx.beginPath();
    ctx.moveTo(STACK_W / 2, 0);
    ctx.lineTo(STACK_W / 2, STACK_H);
    ctx.stroke();
    // scale gridlines each degree
    ctx.strokeStyle = 'rgba(120,160,140,0.12)';
    ctx.fillStyle = 'rgba(150,190,170,0.5)';
    ctx.font = '9px monospace';
    for (let d = -scaleDeg; d <= scaleDeg; d++) {
      if (d === 0) continue;
      const x = STACK_W / 2 + (d / scaleDeg) * (STACK_W / 2 - 8);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, STACK_H);
      ctx.stroke();
      ctx.fillText(`${d > 0 ? '+' : ''}${d}°`, x - 8, STACK_H - 3);
    }
    if (!tracker || !tracker.solution || tracker.marks.length === 0) {
      ctx.fillStyle = 'rgba(150,190,170,0.6)';
      ctx.fillText(tracker ? 'enter a solution to see residuals' : 'no tracker selected', 70, STACK_H / 2);
      return;
    }
    const rs = residuals(tracker.marks, tracker.solution);
    const t0 = rs[0].t;
    const t1 = rs[rs.length - 1].t;
    const span = Math.max(60, t1 - t0);
    for (const r of rs) {
      const y = 8 + ((r.t - t0) / span) * (STACK_H - 20);
      const x = STACK_W / 2 + (r.resid / scaleDeg) * (STACK_W / 2 - 8);
      const clipped = Math.abs(r.resid) > scaleDeg;
      ctx.fillStyle = clipped ? 'rgba(255,95,86,0.9)' : 'rgba(60,233,126,0.9)';
      ctx.beginPath();
      ctx.arc(Math.max(4, Math.min(STACK_W - 4, x)), y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [tick, tracker, scaleDeg, sim]);

  if (!tracker) {
    return (
      <div className="panel">
        <h3>TMA — DOT STACK</h3>
        <div className="dim">Designate a contact on a waterfall, then select its tracker chip.</div>
      </div>
    );
  }

  const rms = tracker.solution ? rmsResidual(tracker.marks, tracker.solution) : null;
  const truth = truthMode ? sim.truthFor(tracker) : null;
  const grade =
    truth && tracker.solution
      ? gradeSolution(tracker.solution, truth.pos, truth.course, truth.speed, sim.own.pos, sim.t)
      : null;

  const doRecommendManeuver = () => {
    const rec = recommendManeuver(sim, tracker);
    if (!rec) return setAssistText(['No bearing history yet.']);
    setAssistText([`RECOMMENDED LEG: course ${String(rec.course).padStart(3, '0')}, ${rec.speed} kts.`, ...rec.reason]);
  };
  const doAutoTMA = () => {
    const rec = recommendSolution(sim, tracker);
    setAssistText(rec.text);
    if (rec.ok && rec.solution) {
      const r = rangeYds(sim.own.pos, rec.solution.pos);
      const b = bearingTo(sim.own.pos, rec.solution.pos);
      setAssistText([
        ...rec.text,
        `AUTO-TMA: brg ${Math.round(b)}, range ${fmtRange(r)}, course ${Math.round(rec.solution.course)}, speed ${rec.solution.speed.toFixed(1)} kts. Applied to tracker ${tracker.label}.`,
      ]);
      sim.setSolution(tracker.id, rec.solution);
      setRangeIn(Math.round(r));
      setCourseIn(Math.round(rec.solution.course));
      setSpeedIn(Math.round(rec.solution.speed * 10) / 10);
    }
  };

  const nudge = (field: 'r' | 'c' | 's', d: number) => {
    if (field === 'r') apply(Math.max(500, rangeIn + d), courseIn, speedIn);
    if (field === 'c') apply(rangeIn, norm360(courseIn + d), speedIn);
    if (field === 's') apply(rangeIn, courseIn, Math.max(0, Math.round((speedIn + d) * 10) / 10));
  };

  return (
    <div className="panel">
      <h3>
        TMA — {tracker.label} ({tracker.arrayType.toUpperCase()})
      </h3>
      <div className="row">
        <label>range</label>
        <button onClick={() => nudge('r', -1000)}>−1k</button>
        <button onClick={() => nudge('r', -200)}>−200</button>
        <input
          type="number"
          value={rangeIn}
          onChange={(e) => apply(Number(e.target.value), courseIn, speedIn)}
        />
        <button onClick={() => nudge('r', 200)}>+200</button>
        <button onClick={() => nudge('r', 1000)}>+1k</button>
      </div>
      <div className="row">
        <label>course</label>
        <button onClick={() => nudge('c', -10)}>−10</button>
        <button onClick={() => nudge('c', -2)}>−2</button>
        <input type="number" value={courseIn} onChange={(e) => apply(rangeIn, Number(e.target.value), speedIn)} />
        <button onClick={() => nudge('c', 2)}>+2</button>
        <button onClick={() => nudge('c', 10)}>+10</button>
      </div>
      <div className="row">
        <label>speed</label>
        <button onClick={() => nudge('s', -1)}>−1</button>
        <button onClick={() => nudge('s', -0.5)}>−.5</button>
        <input type="number" value={speedIn} onChange={(e) => apply(rangeIn, courseIn, Number(e.target.value))} />
        <button onClick={() => nudge('s', 0.5)}>+.5</button>
        <button onClick={() => nudge('s', 1)}>+1</button>
      </div>

      <div className="dotstack-wrap canvas-wrap" style={{ marginTop: 6 }}>
        <canvas ref={canvasRef} width={STACK_W} height={STACK_H} style={{ height: STACK_H }} />
        <div className="canvas-label">DOT STACK (obs − sol)</div>
        <div className="canvas-sub">newest at bottom</div>
      </div>
      <div className="row">
        <span className="dim">stack scale</span>
        {[1, 3, 6, 12].map((s) => (
          <button key={s} className={s === scaleDeg ? 'active' : ''} onClick={() => setScaleDeg(s)}>
            ±{s}°
          </button>
        ))}
        <span className="spacer" />
        {rms !== null && (
          <span className={rms < 0.5 ? 'green' : rms < 1.5 ? 'amber' : 'red'}>RMS {rms.toFixed(2)}°</span>
        )}
      </div>

      <div className="row">
        <button onClick={doRecommendManeuver}>RECOMMEND MANEUVER</button>
        <button onClick={doAutoTMA}>AUTO-TMA</button>
        {tracker.arrayType === 'towed' && (
          <button className="warn" onClick={() => sim.flipAmbiguity(tracker.id)}>
            AMBIG FLIP
          </button>
        )}
      </div>
      <div className="row">
        <label>class</label>
        <select
          value={tracker.classification}
          onChange={(e) => {
            tracker.classification = e.target.value as ContactClass | 'unknown';
          }}
        >
          {['unknown', 'merchant', 'warship', 'submarine', 'fishing', 'biologic'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button onClick={() => sim.dropTracker(tracker.id)} className="warn">
          DROP
        </button>
      </div>

      {assistText.length > 0 && (
        <div className="explain small" style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>
          {assistText.map((t, i) => (
            <div key={i}>{t}</div>
          ))}
        </div>
      )}

      {grade && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 4 }}>
          <div className="kv">
            <span className="k">TRUTH range err</span>
            <span className="v">{grade.rangeErrPct.toFixed(0)}%</span>
          </div>
          <div className="kv">
            <span className="k">course err</span>
            <span className="v">{grade.courseErrDeg.toFixed(0)}°</span>
          </div>
          <div className="kv">
            <span className="k">speed err</span>
            <span className="v">{grade.speedErrKts.toFixed(1)} kts</span>
          </div>
          <div className="kv">
            <span className="k">SCORE</span>
            <span className={`v grade ${grade.score >= 80 ? 'green' : grade.score >= 50 ? 'amber' : 'red'}`}>
              {grade.score}/100
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
