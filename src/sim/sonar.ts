// ---------------------------------------------------------------------------
// Sonar model: arrays, ambient + self noise, passive sonar equation,
// per-path detection with signal excess, bearing measurement error.
//   SE = SL - TL - (NL - DI) - DT      (Urick, open literature)
// ---------------------------------------------------------------------------

import { Detection, DetectionPath, Environment, Ship, SonarArray } from './types';
import { computePaths } from './propagation';
import { broadbandSLAt, isSnorkeling } from './signatures';
import { DT, FLUCTUATION_SIGMA } from './constants';
import { bearingTo, clamp, gaussian, norm360, rangeYds, relBearing } from './geo';

export function makeSphere(): SonarArray {
  return {
    type: 'sphere',
    label: 'SPHERE',
    bandLo: 300,
    bandHi: 5000,
    di: 22,
    baffleHalfAngle: 60,
    ambiguous: false,
    deployed: true,
    stability: 1,
  };
}

export function makeTowed(): SonarArray {
  return {
    type: 'towed',
    label: 'TB TOWED',
    bandLo: 10,
    bandHi: 800,
    di: 18,
    baffleHalfAngle: 0,
    ambiguous: true,
    deployed: false,
    stability: 1,
  };
}

/** ambient noise spectrum level near band center, dB (Wenz-style approximation) */
export function ambientNL(env: Environment, arrType: 'sphere' | 'towed'): number {
  // sea-state (wind) noise dominates mid-freq; shipping dominates low-freq
  const seaNoise = 44 + env.seaState * 5; // ~500Hz-5kHz band
  const shipNoise = 52 + env.shippingLevel * 4; // ~10-800Hz band
  return arrType === 'sphere' ? seaNoise : Math.max(shipNoise, seaNoise - 6);
}

/** ownship self noise at speed for an array, dB.
 *  `platformDelta`: quieting-tier adjustment for the ownship platform. */
export function selfNoise(speedKts: number, arrType: 'sphere' | 'towed', platformDelta = 0): number {
  // flow noise rises sharply with speed; towed array is quieter (away from hull)
  const base = (arrType === 'sphere' ? 48 : 40) + platformDelta;
  const knee = arrType === 'sphere' ? 8 : 10;
  const excess = Math.max(0, speedKts - knee);
  return base + speedKts * 0.7 + excess * excess * 0.28;
}

export function totalNL(
  env: Environment,
  speedKts: number,
  arrType: 'sphere' | 'towed',
  ownBelowLayer: boolean,
  platformDelta = 0,
): number {
  let amb = ambientNL(env, arrType);
  // below the layer, surface-generated noise is somewhat attenuated
  if (ownBelowLayer && env.layerDepthFt > 0) amb -= 3;
  const self = selfNoise(speedKts, arrType, platformDelta);
  // power sum
  return 10 * Math.log10(Math.pow(10, amb / 10) + Math.pow(10, self / 10));
}

/** bearing sigma (deg) as a function of signal excess and array */
export function bearingSigma(se: number, arrType: 'sphere' | 'towed', stability: number): number {
  const base = arrType === 'sphere' ? 0.7 : 1.1;
  const snrTerm = clamp(8 / Math.max(1, se + 6), 0.15, 4);
  const stabTerm = arrType === 'towed' ? 1 + (1 - stability) * 6 : 1;
  return base * snrTerm * stabTerm;
}

/** slow per-contact fluctuation (time-correlated, deterministic per id) */
export function fluctuation(t: number, contactSeed: number): number {
  return (
    FLUCTUATION_SIGMA *
    0.6 *
    (Math.sin(t / 47 + contactSeed * 13) + 0.7 * Math.sin(t / 131 + contactSeed * 29))
  );
}

/**
 * Evaluate detection of one contact on one array.
 * Returns null if no path yields positive-ish signal excess or in baffles.
 */
export function evaluateDetection(
  own: Ship,
  contact: Ship,
  arr: SonarArray,
  env: Environment,
  t: number,
  contactSeed: number,
  ownNoiseDelta = 0,
): Detection | null {
  if (!arr.deployed) return null;
  const truthBearing = bearingTo(own.pos, contact.pos);
  const r = rangeYds(own.pos, contact.pos);

  // sphere baffles: stern sector blocked
  if (arr.baffleHalfAngle > 0) {
    const rb = Math.abs(relBearing(own.course, truthBearing));
    if (rb > 180 - arr.baffleHalfAngle) return null;
  }

  const freqKhz = arr.type === 'sphere' ? 1.5 : 0.15;
  const paths = computePaths({
    env,
    srcDepthFt: contact.depth,
    rcvDepthFt: own.depth,
    rangeYds: r,
    freqKhz,
  });
  if (paths.length === 0) return null;

  let sl = broadbandSLAt(contact.signature, contact.speed);
  // quiet submarines radiate little high-frequency broadband: the sphere
  // (mid/high-freq) sees them much weaker than the low-freq towed array does
  if (contact.contactClass === 'submarine' && arr.type === 'sphere') sl -= 8;
  // diesel boats snorkeling are dramatically louder
  if (isSnorkeling(contact.signature, contact.depth)) sl += 16;
  const ownBelow = own.depth > env.layerDepthFt;
  const nl = totalNL(env, own.speed, arr.type, ownBelow, ownNoiseDelta);
  const fluc = fluctuation(t, contactSeed);
  // towed-array low-freq narrowband processing credit against tonal-rich sources
  const dtEff = arr.type === 'towed' && contact.signature.tonals.length > 0 ? DT - 12 : DT;

  const detPaths: DetectionPath[] = [];
  for (const p of paths) {
    const se = sl - p.tl - (nl - arr.di) - dtEff + fluc;
    if (se > -6) detPaths.push({ path: p.path, se, deAngle: p.deAngle });
  }
  if (detPaths.length === 0) return null;
  detPaths.sort((a, b) => b.se - a.se);
  const best = detPaths[0];
  if (best.se < -3) return null; // marginal — below trace threshold

  const sigma = bearingSigma(best.se, arr.type, arr.stability);
  const bearing = norm360(truthBearing + gaussian(sigma));

  let ambiguousBearing: number | undefined;
  if (arr.ambiguous) {
    // mirror about the array axis (ownship course while stable)
    ambiguousBearing = norm360(2 * own.course - bearing);
  }

  return {
    contactId: contact.id,
    arrayType: arr.type,
    bearing,
    ambiguousBearing,
    signalExcess: best.se,
    paths: detPaths,
    truthBearing,
    truthRangeYds: r,
  };
}
