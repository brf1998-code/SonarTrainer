// ---------------------------------------------------------------------------
// Target Motion Analysis: solution residuals (dot stack), bearing-only
// least-squares auto-TMA (Gauss-Newton), leg detection, Ekelund ranging.
// All methods are open-literature (bearings-only TMA, the "1934 rule",
// Ekelund ranging from two-leg bearing rates).
// ---------------------------------------------------------------------------

import { BearingMark, OwnshipLegSummary, Solution, Tracker, Vec2 } from './types';
import { DEG, EKELUND_K, MIN_LEG_TIME, YDS_PER_SEC_PER_KT } from './constants';
import { bearingTo, courseVec, norm180, norm360, speedAcrossLos } from './geo';

/** predicted target position at time t for a solution (constant velocity) */
export function solutionPosAt(sol: Solution, t: number): Vec2 {
  const v = courseVec(sol.course);
  const s = sol.speed * YDS_PER_SEC_PER_KT;
  const dt = t - sol.t;
  return { x: sol.pos.x + v.x * s * dt, y: sol.pos.y + v.y * s * dt };
}

export interface Residual {
  t: number;
  /** observed - predicted bearing, deg (-180..180) */
  resid: number;
  bearing: number;
}

/** dot-stack residuals: observed bearings vs solution-predicted bearings */
export function residuals(marks: BearingMark[], sol: Solution): Residual[] {
  return marks.map((m) => {
    const tp = solutionPosAt(sol, m.t);
    const pred = bearingTo(m.ownPos, tp);
    return { t: m.t, resid: norm180(m.bearing - pred), bearing: m.bearing };
  });
}

export function rmsResidual(marks: BearingMark[], sol: Solution): number {
  const rs = residuals(marks, sol);
  if (rs.length === 0) return 0;
  const ss = rs.reduce((a, r) => a + r.resid * r.resid, 0);
  return Math.sqrt(ss / rs.length);
}

/**
 * Bearings-only Gauss-Newton least squares for target state [x,y,vx,vy] at tRef.
 * Requires ownship maneuver across the data span for observability; without it
 * the range dimension is weak and the fit will drift — which is itself a
 * teaching point surfaced in the UI.
 */
export function autoTMA(
  marks: BearingMark[],
  tRef: number,
  init: Solution | null,
): Solution | null {
  if (marks.length < 8) return null;
  // initial state: from provided solution, else 10 kyd down current bearing
  let x: number, y: number, vx: number, vy: number;
  if (init) {
    const p = solutionPosAt(init, tRef);
    const v = courseVec(init.course);
    x = p.x;
    y = p.y;
    vx = v.x * init.speed * YDS_PER_SEC_PER_KT;
    vy = v.y * init.speed * YDS_PER_SEC_PER_KT;
  } else {
    const last = marks[marks.length - 1];
    const b = last.bearing * DEG;
    x = last.ownPos.x + 10000 * Math.sin(b);
    y = last.ownPos.y + 10000 * Math.cos(b);
    vx = 0;
    vy = 0;
  }

  for (let iter = 0; iter < 25; iter++) {
    // normal equations: JtJ (4x4), Jtr (4)
    const JtJ = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const Jtr = [0, 0, 0, 0];
    for (const m of marks) {
      const dt = m.t - tRef;
      const tx = x + vx * dt;
      const ty = y + vy * dt;
      const dx = tx - m.ownPos.x;
      const dy = ty - m.ownPos.y;
      const r2 = dx * dx + dy * dy;
      if (r2 < 1) continue;
      const pred = Math.atan2(dx, dy); // rad, bearing convention
      const obs = m.bearing * DEG;
      let res = obs - pred;
      while (res > Math.PI) res -= 2 * Math.PI;
      while (res < -Math.PI) res += 2 * Math.PI;
      // d(bearing)/d(state): bearing = atan2(dx,dy)
      const db_dx = dy / r2;
      const db_dy = -dx / r2;
      const J = [db_dx, db_dy, db_dx * dt, db_dy * dt];
      for (let i = 0; i < 4; i++) {
        Jtr[i] += J[i] * res;
        for (let j = 0; j < 4; j++) JtJ[i][j] += J[i] * J[j];
      }
    }
    // Levenberg damping for stability
    for (let i = 0; i < 4; i++) JtJ[i][i] *= 1.02;
    const delta = solve4(JtJ, Jtr);
    if (!delta) break;
    x += delta[0];
    y += delta[1];
    vx += delta[2];
    vy += delta[3];
    const step = Math.hypot(delta[0], delta[1]);
    if (step < 1 && Math.hypot(delta[2], delta[3]) < 0.005) break;
  }

  const speedKts = Math.hypot(vx, vy) / YDS_PER_SEC_PER_KT;
  if (!isFinite(x) || !isFinite(speedKts) || speedKts > 45) return null;
  const course = norm360(Math.atan2(vx, vy) / DEG);
  return { pos: { x, y }, course, speed: speedKts, t: tRef };
}

/** solve 4x4 linear system via Gaussian elimination */
function solve4(A: number[][], b: number[]): number[] | null {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 4; col++) {
    let piv = col;
    for (let r = col + 1; r < 4; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < 4; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c < 5; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [0, 1, 2, 3].map((i) => M[i][4] / M[i][i]);
}

// ---------------------------------------------------------------------------
// Leg analysis + Ekelund ranging
// ---------------------------------------------------------------------------

export interface OwnLeg {
  startT: number;
  endT: number;
  course: number;
  speed: number;
}

/** split ownship history into steady legs (course within +/-3 deg) */
export function detectLegs(
  hist: { t: number; course: number; speed: number }[],
): OwnLeg[] {
  const legs: OwnLeg[] = [];
  let cur: OwnLeg | null = null;
  for (const h of hist) {
    if (cur && Math.abs(norm180(h.course - cur.course)) < 3 && Math.abs(h.speed - cur.speed) < 1.5) {
      cur.endT = h.t;
    } else {
      if (cur && cur.endT - cur.startT >= MIN_LEG_TIME) legs.push(cur);
      cur = { startT: h.t, endT: h.t, course: h.course, speed: h.speed };
    }
  }
  if (cur && cur.endT - cur.startT >= MIN_LEG_TIME) legs.push(cur);
  return legs;
}

/** least-squares bearing rate (deg/min) over marks in a window */
export function bearingRate(marks: BearingMark[], t0: number, t1: number): { rate: number; mean: number; n: number } | null {
  const win = marks.filter((m) => m.t >= t0 && m.t <= t1);
  if (win.length < 3) return null;
  // unwrap bearings
  const ts: number[] = [];
  const bs: number[] = [];
  let prev = win[0].bearing;
  let acc = prev;
  for (const m of win) {
    let b = m.bearing;
    let d = norm180(b - prev);
    acc += d;
    prev = b;
    ts.push(m.t / 60); // minutes
    bs.push(acc);
  }
  const n = ts.length;
  const mt = ts.reduce((a, x) => a + x, 0) / n;
  const mb = bs.reduce((a, x) => a + x, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (ts[i] - mt) * (bs[i] - mb);
    den += (ts[i] - mt) * (ts[i] - mt);
  }
  if (den < 1e-9) return null;
  return { rate: num / den, mean: norm360(mb), n };
}

export interface EkelundResult {
  rangeYds: number;
  leg1: OwnshipLegSummary;
  leg2: OwnshipLegSummary;
  dSpeedAcross: number;
  dBearingRate: number;
  caveat: string | null;
}

/**
 * Ekelund range from the last two steady ownship legs:
 *   R = K * (Sa1 - Sa2) / (Bdot2 - Bdot1),  K ~= 1934 (yds per kt/(deg/min))
 * Assumes target course/speed constant across both legs.
 */
export function ekelundRange(
  marks: BearingMark[],
  legs: OwnLeg[],
): EkelundResult | null {
  if (legs.length < 2) return null;
  const l1 = legs[legs.length - 2];
  const l2 = legs[legs.length - 1];
  // trim leg edges to avoid turn transients
  const trim = 30;
  const br1 = bearingRate(marks, l1.startT + trim, l1.endT);
  const br2 = bearingRate(marks, l2.startT + trim, l2.endT);
  if (!br1 || !br2) return null;
  const sa1 = speedAcrossLos(l1.course, l1.speed, br1.mean);
  const sa2 = speedAcrossLos(l2.course, l2.speed, br2.mean);
  const dSa = sa1 - sa2;
  const dBdot = br2.rate - br1.rate;
  if (Math.abs(dBdot) < 0.02) {
    return {
      rangeYds: NaN,
      leg1: { startT: l1.startT, endT: l1.endT, course: l1.course, speed: l1.speed, bearingRate: br1.rate, meanBearing: br1.mean, speedAcross: sa1 },
      leg2: { startT: l2.startT, endT: l2.endT, course: l2.course, speed: l2.speed, bearingRate: br2.rate, meanBearing: br2.mean, speedAcross: sa2 },
      dSpeedAcross: dSa,
      dBearingRate: dBdot,
      caveat: 'Bearing-rate change too small — maneuver harder across the LOS.',
    };
  }
  const r = (EKELUND_K * dSa) / dBdot;
  return {
    rangeYds: r,
    leg1: { startT: l1.startT, endT: l1.endT, course: l1.course, speed: l1.speed, bearingRate: br1.rate, meanBearing: br1.mean, speedAcross: sa1 },
    leg2: { startT: l2.startT, endT: l2.endT, course: l2.course, speed: l2.speed, bearingRate: br2.rate, meanBearing: br2.mean, speedAcross: sa2 },
    dSpeedAcross: dSa,
    dBearingRate: dBdot,
    caveat: r <= 0 ? 'Negative/invalid result — check leg geometry (target may have maneuvered).' : null,
  };
}

/** grade a tracker solution against truth */
export interface SolutionGrade {
  rangeErrPct: number;
  courseErrDeg: number;
  speedErrKts: number;
  bearingErrDeg: number;
  score: number; // 0-100
}

export function gradeSolution(
  sol: Solution,
  truthPos: Vec2,
  truthCourse: number,
  truthSpeed: number,
  ownPos: Vec2,
  t: number,
): SolutionGrade {
  const sp = solutionPosAt(sol, t);
  const rTruth = Math.hypot(truthPos.x - ownPos.x, truthPos.y - ownPos.y);
  const rSol = Math.hypot(sp.x - ownPos.x, sp.y - ownPos.y);
  const rangeErrPct = (Math.abs(rSol - rTruth) / Math.max(500, rTruth)) * 100;
  const courseErrDeg = Math.abs(norm180(sol.course - truthCourse));
  const speedErrKts = Math.abs(sol.speed - truthSpeed);
  const bTruth = bearingTo(ownPos, truthPos);
  const bSol = bearingTo(ownPos, sp);
  const bearingErrDeg = Math.abs(norm180(bSol - bTruth));
  const score = Math.max(
    0,
    Math.round(
      100 - rangeErrPct * 1.2 - courseErrDeg * 0.6 - speedErrKts * 4 - bearingErrDeg * 2,
    ),
  );
  return { rangeErrPct, courseErrDeg, speedErrKts, bearingErrDeg, score };
}
