// ---------------------------------------------------------------------------
// Contact acoustic signatures — generic, open-literature archetypes.
// Tonal structures use the public DEMON/LOFAR relationships:
//   blade rate (Hz) = shaft RPM x blades / 60,  shaft RPM = TPK x speed(kts)
// Electrical hum (50/60 Hz), auxiliary lines, and gearing lines are generic.
// Source levels are order-of-magnitude values tuned for gameplay realism.
// ---------------------------------------------------------------------------

import { ContactClass, Signature, Tonal } from './types';

function t(freq: number, level: number, label: string, speedScaled = false): Tonal {
  return { freq, level, label, speedScaled };
}

/** Build a signature for a contact class with slight per-ship randomization. */
export function makeSignature(cls: ContactClass, seed = Math.random()): Signature {
  const jitter = (base: number, spread: number) => base + (seed - 0.5) * 2 * spread;

  switch (cls) {
    case 'merchant': {
      const blades = 4 + Math.round(seed * 2); // 4-6
      const tpk = jitter(7.5, 1.0); // slow-turning single screw
      return {
        contactClass: cls,
        broadbandSL: jitter(172, 3),
        slPerKnot: 0.6,
        referenceSpeedKts: 14,
        blades,
        turnsPerKnot: tpk,
        tonals: [
          t(0, 158, 'blade rate', true), // freq computed at runtime
          t(jitter(60, 4), 152, 'electrical/aux'),
          t(jitter(120, 6), 146, 'aux harmonic'),
          t(jitter(300, 40), 140, 'machinery'),
        ],
      };
    }
    case 'warship': {
      const blades = 5;
      const tpk = jitter(11, 1.5);
      return {
        contactClass: cls,
        broadbandSL: jitter(158, 3),
        slPerKnot: 0.9,
        referenceSpeedKts: 15,
        blades,
        turnsPerKnot: tpk,
        tonals: [
          t(0, 148, 'blade rate', true),
          t(60, 144, '60Hz electrical'),
          t(jitter(180, 20), 140, 'turbine/gearing'),
          t(jitter(400, 60), 136, 'machinery'),
        ],
      };
    }
    case 'submarine': {
      const blades = 7;
      const tpk = jitter(16, 2);
      return {
        contactClass: cls,
        broadbandSL: jitter(128, 3),
        slPerKnot: 1.6,
        referenceSpeedKts: 8,
        blades,
        turnsPerKnot: tpk,
        tonals: [
          t(0, 118, 'blade rate', true),
          t(60, 122, '60Hz electrical'),
          t(jitter(155, 25), 116, 'pump/aux'),
        ],
      };
    }
    case 'fishing': {
      const blades = 3;
      const tpk = jitter(22, 3); // small fast-turning screw
      return {
        contactClass: cls,
        broadbandSL: jitter(155, 4),
        slPerKnot: 0.8,
        referenceSpeedKts: 9,
        blades,
        turnsPerKnot: tpk,
        tonals: [
          t(0, 145, 'blade rate', true),
          t(jitter(50, 5), 138, 'diesel firing'),
          t(jitter(100, 10), 134, 'diesel harmonic'),
        ],
      };
    }
    case 'biologic':
      return {
        contactClass: cls,
        broadbandSL: 140,
        slPerKnot: 0,
        referenceSpeedKts: 0,
        blades: 0,
        turnsPerKnot: 0,
        tonals: [],
      };
  }
}

/** broadband SL at a given speed */
export function broadbandSLAt(sig: Signature, speedKts: number): number {
  return sig.broadbandSL + sig.slPerKnot * (speedKts - sig.referenceSpeedKts);
}

/** shaft rate in RPM at speed */
export function shaftRPM(sig: Signature, speedKts: number): number {
  return sig.turnsPerKnot * speedKts;
}

/** blade rate fundamental, Hz */
export function bladeRateHz(sig: Signature, speedKts: number): number {
  return (shaftRPM(sig, speedKts) * sig.blades) / 60;
}

/** resolved tonal list at speed: blade-rate family filled in with harmonics */
export interface LiveTonal {
  freq: number;
  level: number;
  label: string;
}

export function liveTonals(sig: Signature, speedKts: number): LiveTonal[] {
  const out: LiveTonal[] = [];
  for (const tn of sig.tonals) {
    if (tn.speedScaled) {
      const br = bladeRateHz(sig, speedKts);
      if (br > 0.5) {
        for (let h = 1; h <= 4; h++) {
          out.push({ freq: br * h, level: tn.level - (h - 1) * 4, label: h === 1 ? tn.label : `${tn.label} x${h}` });
        }
        // shaft-rate line (1/blades of blade rate) — weaker
        out.push({ freq: br / sig.blades, level: tn.level - 8, label: 'shaft rate' });
      }
    } else {
      out.push({ freq: tn.freq, level: tn.level, label: tn.label });
    }
  }
  return out.filter((x) => x.freq > 1 && x.freq < 2000);
}
