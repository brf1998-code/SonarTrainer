// ---------------------------------------------------------------------------
// Instructor-assist features: recommended maneuvers, recommended solutions,
// and worked-calculation explanations. Pure open-literature TMA doctrine:
// change your speed-across-the-LOS between legs, keep the array out of the
// baffles, steady long enough for clean bearing rates.
// ---------------------------------------------------------------------------

import { Simulation } from './simulation';
import { Tracker } from './types';
import { autoTMA, bearingRate, detectLegs, ekelundRange, EkelundResult, rmsResidual } from './tma';
import { norm180, norm360, relBearing } from './geo';

export interface ManeuverRec {
  course: number;
  speed: number;
  reason: string[];
}

/** Recommend the next TMA leg for a tracker. */
export function recommendManeuver(sim: Simulation, tr: Tracker): ManeuverRec | null {
  const brg = sim.trackerBearing(tr);
  if (brg === null) return null;
  const own = sim.own;
  const legs = detectLegs(sim.ownHistory);
  const lastLeg = legs[legs.length - 1];

  // Current geometry
  const rb = relBearing(own.course, brg);
  const reason: string[] = [];

  // Aim: big change in speed-across-LOS while keeping contact out of baffles
  // Standard practice: put the contact ~40-50 deg off the bow on the other side.
  const side = rb >= 0 ? -1 : 1; // swing across the LOS
  let recCourse = norm360(brg + side * 45);

  // keep towed array effective: avoid pointing directly at/away for ambiguity
  if (tr.arrayType === 'towed') {
    const aspect = Math.abs(norm180(recCourse - brg));
    if (aspect < 25) recCourse = norm360(brg + side * 45);
    reason.push('Towed array: expect ~3 min settle time after steadying before bearings are reliable.');
  } else {
    // sphere: keep out of stern baffles
    const rbNew = Math.abs(relBearing(recCourse, brg));
    if (rbNew > 120) recCourse = norm360(brg + side * 60);
  }

  reason.unshift(
    `Turn to put the contact ~45° off the ${side > 0 ? 'port' : 'starboard'} bow on the opposite side of the line of sight. This maximizes the change in your speed-across-the-LOS, which is what drives bearing-rate change for ranging.`,
  );
  if (lastLeg && lastLeg.endT - lastLeg.startT < 180) {
    reason.push('Note: your current leg is short — steady up at least ~3 minutes per leg for a clean bearing rate.');
  }

  const recSpeed = Math.max(5, Math.min(12, own.speed));
  if (own.speed > 12) {
    reason.push('Consider slowing: above ~12 kts flow noise starts to wash out your own arrays.');
  }

  return { course: Math.round(recCourse), speed: recSpeed, reason };
}

export interface SolutionRec {
  ok: boolean;
  text: string[];
  solution: ReturnType<typeof autoTMA>;
  rms: number | null;
}

/** Run auto-TMA for a tracker and explain the result. */
export function recommendSolution(sim: Simulation, tr: Tracker): SolutionRec {
  const text: string[] = [];
  if (tr.marks.length < 10) {
    return { ok: false, text: ['Not enough bearing history yet — hold the tracker for a few more minutes.'], solution: null, rms: null };
  }
  const legs = detectLegs(sim.ownHistory);
  const span = tr.marks[tr.marks.length - 1].t - tr.marks[0].t;
  const legsInSpan = legs.filter((l) => l.endT > tr.marks[0].t);
  if (legsInSpan.length < 2) {
    text.push(
      'Warning: you have not maneuvered during this track. Bearings-only TMA is unobservable without an ownship maneuver — the computed range will be unreliable. Turn across the line of sight and let bearings accumulate on a second leg.',
    );
  }
  const sol = autoTMA(tr.marks, sim.t, tr.solution);
  if (!sol) {
    text.push('Least-squares fit failed to converge — geometry is too weak. Maneuver and try again.');
    return { ok: false, text, solution: null, rms: null };
  }
  const rms = rmsResidual(tr.marks, sol);
  text.push(
    `Least-squares bearings-only fit over ${(span / 60).toFixed(0)} min of data (${tr.marks.length} bearings), RMS residual ${rms.toFixed(2)}°.`,
  );
  if (rms > 1.5) text.push('Residuals are high — the contact may have maneuvered during the track. Consider restarting the stack after the zig.');
  return { ok: true, text, solution: sol, rms };
}

/** Ekelund with a full worked explanation for the tools panel. */
export interface EkelundExplained {
  result: EkelundResult | null;
  lines: string[];
}

export function ekelundExplained(sim: Simulation, tr: Tracker): EkelundExplained {
  const legs = detectLegs(sim.ownHistory);
  const res = ekelundRange(tr.marks, legs);
  const lines: string[] = [];
  if (!res) {
    lines.push('Need two steady legs (≥ ~3 min each, ≥ 3 bearings per leg) on this tracker before an Ekelund range can be computed.');
    return { result: null, lines };
  }
  const { leg1, leg2 } = res;
  lines.push(`Leg 1: course ${fmt3(leg1.course)}, ${leg1.speed.toFixed(0)} kts → Ḃ₁ = ${leg1.bearingRate!.toFixed(2)}°/min, speed across LOS Sa₁ = ${leg1.speedAcross!.toFixed(1)} kts`);
  lines.push(`Leg 2: course ${fmt3(leg2.course)}, ${leg2.speed.toFixed(0)} kts → Ḃ₂ = ${leg2.bearingRate!.toFixed(2)}°/min, speed across LOS Sa₂ = ${leg2.speedAcross!.toFixed(1)} kts`);
  lines.push(`R = 1934 × (Sa₁ − Sa₂) / (Ḃ₂ − Ḃ₁) = 1934 × ${res.dSpeedAcross.toFixed(1)} / ${res.dBearingRate.toFixed(2)}`);
  if (res.caveat) {
    lines.push(res.caveat);
  } else {
    lines.push(`R ≈ ${(res.rangeYds / 1000).toFixed(1)} kyd`);
    lines.push('Assumes the target held course and speed across both legs.');
  }
  return { result: res, lines };
}

function fmt3(c: number): string {
  return Math.round(norm360(c)).toString().padStart(3, '0');
}

export { bearingRate, detectLegs };
