// ---------------------------------------------------------------------------
// Ray-PATH propagation model (not full ray tracing).
// Models the tactically relevant paths analytically:
//   - direct path w/ sonic-layer effects (cross-layer penalty, surface duct)
//   - bottom bounce (single bounce, bottom loss, steep D/E)
//   - convergence zones (placed by depth-excess formula, annulus gain)
// Each path returns one-way TL (dB) and arrival D/E.
// References: Urick, "Principles of Underwater Sound", chs. 5-6 (open lit).
// The module interface is swappable for a precomputed Bellhop TL grid later.
// ---------------------------------------------------------------------------

import { Environment, PropPathResult } from './types';
import { clamp } from './geo';

const FT_PER_YD = 3;

/** Thorp absorption, dB/km, f in kHz (open literature) */
export function thorpAbsorption(fKhz: number): number {
  const f2 = fKhz * fKhz;
  return (
    (0.11 * f2) / (1 + f2) +
    (44 * f2) / (4100 + f2) +
    2.75e-4 * f2 +
    0.003
  );
}

/** spherical spreading TL at range in yards (plus absorption) */
function spreadTL(rYds: number, fKhz: number): number {
  const rM = Math.max(1, rYds * 0.9144);
  const spread = 20 * Math.log10(rM);
  const absorb = thorpAbsorption(fKhz) * (rM / 1000);
  return spread + absorb;
}

/**
 * First CZ range for the environment, yards. Deep-water CZs occur when depth
 * excess exists; classic first-zone range ~ 30-35 nm in Atlantic-type water,
 * scaled here with water depth (open-literature approximation).
 */
export function czRangeYds(env: Environment): number | null {
  if (!env.depthExcess) return null;
  const depthFactor = clamp(env.waterDepthFt / 15000, 0.6, 1.3);
  return 61000 * depthFactor; // ~30 nm nominal
}

/** CZ annulus half-width, yards (~5-10% of zone range) */
export function czAnnulusYds(env: Environment): number {
  const r = czRangeYds(env);
  return r ? r * 0.06 : 0;
}

export interface PathInputs {
  env: Environment;
  srcDepthFt: number;
  rcvDepthFt: number;
  rangeYds: number;
  freqKhz: number;
}

/** direct path with sonic layer effects */
function directPath(inp: PathInputs): PropPathResult {
  const { env, srcDepthFt, rcvDepthFt, rangeYds, freqKhz } = inp;
  let tl = spreadTL(rangeYds, freqKhz);

  const layer = env.layerDepthFt;
  if (layer > 0) {
    const srcAbove = srcDepthFt < layer;
    const rcvAbove = rcvDepthFt < layer;
    if (srcAbove !== rcvAbove) {
      // cross-layer: shadow-zone penalty grows with range past ~2 kyd
      const kyd = rangeYds / 1000;
      tl += clamp(6 + 1.1 * (kyd - 2), 0, 28);
    } else if (srcAbove && rcvAbove && env.svp === 'surface-duct') {
      // both in the duct: partial cylindrical spreading bonus at range
      const kyd = rangeYds / 1000;
      tl -= clamp((kyd - 4) * 0.9, 0, 12);
    } else if (!srcAbove && !rcvAbove) {
      // both below layer: modest shielding from surface noise handled in NL;
      // slight below-layer focusing
      tl -= 2;
    }
  }

  if (env.svp === 'negative-gradient') {
    // strong downward refraction shortens direct path ranges
    const kyd = rangeYds / 1000;
    tl += clamp((kyd - 3) * 0.8, 0, 20);
  }

  // depression/elevation: shallow grazing for direct path
  const dz = (srcDepthFt - rcvDepthFt) / FT_PER_YD; // + means source deeper
  const de = (Math.atan2(dz, rangeYds) * 180) / Math.PI;
  return { path: 'direct', tl, deAngle: de, valid: rangeYds > 50 };
}

/** single bottom-bounce path */
function bottomBounce(inp: PathInputs): PropPathResult {
  const { env, srcDepthFt, rcvDepthFt, rangeYds, freqKhz } = inp;
  const depthYds = env.waterDepthFt / FT_PER_YD;
  const srcYds = srcDepthFt / FT_PER_YD;
  const rcvYds = rcvDepthFt / FT_PER_YD;
  // reflected-image geometry
  const vert = (depthYds - srcYds) + (depthYds - rcvYds);
  const pathLen = Math.hypot(vert, rangeYds);
  const grazing = (Math.atan2(vert, rangeYds) * 180) / Math.PI;
  // BB usable in a window: too close = too steep is fine, but too far = grazing
  // angle too shallow and bottom loss blows up
  const valid =
    env.waterDepthFt > 1200 && grazing > 8 && rangeYds > 2000 && rangeYds < depthYds * 24;
  const grazingPenalty = grazing < 15 ? (15 - grazing) * 1.2 : 0;
  const tl = spreadTL(pathLen, freqKhz) + env.bottomLossDb + grazingPenalty;
  // arrival comes up from below at roughly the grazing angle
  return { path: 'bottom-bounce', tl, deAngle: grazing, valid };
}

/** convergence zone path (1st, 2nd, 3rd zones) */
function czPath(inp: PathInputs): PropPathResult {
  const { env, rangeYds, freqKhz } = inp;
  const r1 = czRangeYds(env);
  if (!r1) return { path: 'cz', tl: 999, deAngle: 0, valid: false };
  const annulus = czAnnulusYds(env);
  let best: { tl: number; zone: number } | null = null;
  for (let zone = 1; zone <= 3; zone++) {
    const zr = r1 * zone;
    const d = Math.abs(rangeYds - zr);
    if (d < annulus * zone) {
      // inside the annulus: CZ gain ~ +12 dB over spherical at zone center,
      // rolls off toward annulus edges; each successive zone weaker
      const edge = d / (annulus * zone); // 0 center .. 1 edge
      const gain = (12 - 4 * (zone - 1)) * (1 - edge * edge);
      const tl = spreadTL(rangeYds, freqKhz) - gain;
      if (!best || tl < best.tl) best = { tl, zone };
    }
  }
  if (!best) return { path: 'cz', tl: 999, deAngle: 0, valid: false };
  return { path: 'cz', tl: best.tl, deAngle: 0, valid: true };
}

/** Compute all candidate propagation paths between two depths at a range. */
export function computePaths(inp: PathInputs): PropPathResult[] {
  return [directPath(inp), bottomBounce(inp), czPath(inp)].filter((p) => p.valid);
}
