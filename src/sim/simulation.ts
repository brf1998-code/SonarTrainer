// ---------------------------------------------------------------------------
// World simulation: ownship + contacts kinematics, array management,
// detection snapshots, waterfall row synthesis, trackers, event log.
// Runs entirely client-side in v1; designed to be host-agnostic so it can be
// moved server-side for phase-2 head-to-head multiplayer.
// ---------------------------------------------------------------------------

import {
  ArrayType,
  ContactClass,
  Detection,
  Environment,
  Scenario,
  Ship,
  Solution,
  SonarArray,
  Tracker,
  Vec2,
} from './types';
import {
  AUTO_MARK_PERIOD,
  BB_ROW_PERIOD,
  MAX_MARKS,
  NB_ROW_PERIOD,
  SIM_DT,
  SPEED_TAU,
  TOWED_DEPLOY_TIME,
  TOWED_SETTLE_TIME,
  TURN_RATE_BASE,
  DEPTH_RATE,
} from './constants';
import { advance, bearingTo, clamp, gaussian, norm180, norm360, rangeYds } from './geo';
import { makeSignature, liveTonals, bladeRateHz, isSnorkeling } from './signatures';
import { evaluateDetection, makeSphere, makeTowed, totalNL } from './sonar';
import { computePaths } from './propagation';
import {
  Platform,
  contactClassFor,
  platformById,
  selfNoiseDelta,
  signatureForPlatform,
} from './platforms';

export const BB_BINS = 720; // 0.5 deg per bin
export const NB_BINS = 256;

export interface BBRow {
  t: number;
  data: Float32Array; // 0..1 intensity per bearing bin
}

export interface NBRow {
  t: number;
  data: Float32Array; // 0..1 intensity per freq bin
}

export interface SimEvent {
  t: number;
  text: string;
}

export interface NBInfo {
  /** measured blade rate if narrowband holds it, Hz */
  bladeRateHz: number | null;
  harmonics: number;
  strongestTonals: { freq: number; label: string; snr: number }[];
}

interface ContactState {
  ship: Ship;
  seed: number;
  nextZigT: number;
}

export class Simulation {
  t = 0;
  env: Environment;
  own: Ship;
  contacts: ContactState[] = [];
  sphere: SonarArray = makeSphere();
  towed: SonarArray = makeTowed();
  trackers: Tracker[] = [];
  events: SimEvent[] = [];
  scenario: Scenario;
  ownPlatform: Platform;

  /** latest detection snapshot per array */
  detections: Record<ArrayType, Detection[]> = { sphere: [], towed: [] };
  /** waterfall history per array */
  bbRows: Record<ArrayType, BBRow[]> = { sphere: [], towed: [] };
  /** narrowband gram history per tracker id */
  nbRows: Map<string, NBRow[]> = new Map();

  ownHistory: { t: number; course: number; speed: number; pos: Vec2 }[] = [];
  private lastBBRow = -1e9;
  private lastNBRow = -1e9;
  private towedDeployProgress = 0; // 0..1
  private towedOrdered = false;
  private nextTrackerNum = 1;
  private prevTurning = false;

  constructor(scenario: Scenario, ownPlatformId?: string) {
    this.scenario = scenario;
    this.env = scenario.env;
    this.ownPlatform = platformById(ownPlatformId ?? scenario.ownPlatformId ?? 'virginia');
    this.own = {
      id: 'ownship',
      name: 'OWNSHIP',
      contactClass: 'submarine',
      pos: { x: 0, y: 0 },
      course: scenario.ownCourse,
      speed: scenario.ownSpeed,
      depth: scenario.ownDepth,
      orderedCourse: scenario.ownCourse,
      orderedSpeed: scenario.ownSpeed,
      orderedDepth: scenario.ownDepth,
      signature: signatureForPlatform(this.ownPlatform, 0.5),
    };
    let i = 0;
    for (const c of scenario.contacts) {
      const rad = (c.bearing * Math.PI) / 180;
      const pos = {
        x: Math.sin(rad) * c.rangeYds,
        y: Math.cos(rad) * c.rangeYds,
      };
      const seed = (i + 1) * 0.173;
      const hullSeed = (seed * 7.13) % 1;
      const platform = c.platformId ? platformById(c.platformId) : null;
      this.contacts.push({
        ship: {
          id: `c${i}`,
          name: c.name,
          contactClass: platform ? contactClassFor(platform) : c.contactClass,
          pos,
          course: c.course,
          speed: c.speed,
          depth: c.depth,
          orderedCourse: c.course,
          orderedSpeed: c.speed,
          orderedDepth: c.depth,
          signature: platform
            ? signatureForPlatform(platform, hullSeed)
            : makeSignature(c.contactClass, hullSeed),
        },
        seed,
        nextZigT: 600 + Math.random() * 600,
      });
      i++;
    }
    this.log(`Scenario: ${scenario.name}`);
    this.log(`Ownship: ${this.ownPlatform.name}`);
    this.log(`Environment: ${this.env.name}`);
    this.snapshotDetections();
    this.pushBBRow();
  }

  log(text: string) {
    this.events.push({ t: this.t, text });
    if (this.events.length > 200) this.events.shift();
  }

  // ----- ownship / contact control -------------------------------------------

  orderCourse(c: number) {
    this.own.orderedCourse = norm360(c);
    this.log(`Ordered course ${Math.round(norm360(c)).toString().padStart(3, '0')}`);
  }
  orderSpeed(s: number) {
    this.own.orderedSpeed = clamp(s, 2, this.ownPlatform.maxSpeedKts);
    this.log(`Ordered speed ${this.own.orderedSpeed} kts`);
  }
  orderDepth(d: number) {
    const maxD = Math.min(this.ownPlatform.testDepthFt ?? 1500, this.env.waterDepthFt - 200);
    this.own.orderedDepth = clamp(d, 60, maxD);
    this.log(`Ordered depth ${this.own.orderedDepth} ft`);
  }
  toggleTowed() {
    this.towedOrdered = !this.towedOrdered;
    this.log(this.towedOrdered ? 'Streaming towed array…' : 'Retrieving towed array…');
  }
  get towedStatus(): string {
    if (this.towed.deployed) return 'DEPLOYED';
    if (this.towedOrdered) return `STREAMING ${(this.towedDeployProgress * 100).toFixed(0)}%`;
    return 'STOWED';
  }

  // ----- core tick -----------------------------------------------------------

  /** advance the world by dt sim-seconds (dt should be a multiple of SIM_DT) */
  step(dt: number) {
    let remaining = dt;
    while (remaining > 0) {
      const h = Math.min(SIM_DT, remaining);
      this.tick(h);
      remaining -= h;
    }
  }

  private tick(dt: number) {
    this.t += dt;
    this.moveShip(this.own, dt);
    for (const c of this.contacts) {
      this.maybeZig(c);
      this.moveShip(c.ship, dt);
    }
    this.updateTowed(dt);

    // history at 5 s cadence
    if (this.ownHistory.length === 0 || this.t - this.ownHistory[this.ownHistory.length - 1].t >= 5) {
      this.ownHistory.push({ t: this.t, course: this.own.course, speed: this.own.speed, pos: { ...this.own.pos } });
      if (this.ownHistory.length > 2000) this.ownHistory.shift();
    }

    this.snapshotDetections();

    if (this.t - this.lastBBRow >= BB_ROW_PERIOD) {
      this.pushBBRow();
      this.lastBBRow = this.t;
    }
    if (this.t - this.lastNBRow >= NB_ROW_PERIOD) {
      for (const tr of this.trackers) this.pushNBRow(tr);
      this.lastNBRow = this.t;
    }
    for (const tr of this.trackers) this.autoMark(tr);
  }

  private moveShip(s: Ship, dt: number) {
    // course
    const dc = norm180(s.orderedCourse - s.course);
    if (Math.abs(dc) > 0.05) {
      const rate = TURN_RATE_BASE * clamp(s.speed / 5, 0.4, 3); // deg/s
      const stepC = clamp(dc, -rate * dt, rate * dt);
      s.course = norm360(s.course + stepC);
    } else {
      s.course = s.orderedCourse;
    }
    // speed (first-order lag)
    s.speed += ((s.orderedSpeed - s.speed) / SPEED_TAU) * dt * 3;
    // depth
    const dd = s.orderedDepth - s.depth;
    if (Math.abs(dd) > 1) {
      const rate = DEPTH_RATE * clamp(s.speed / 10, 0.3, 2);
      s.depth += clamp(dd, -rate * dt, rate * dt);
    }
    s.pos = advance(s.pos, s.course, s.speed, dt);
  }

  private maybeZig(c: ContactState) {
    if (c.ship.contactClass !== 'warship') return;
    if (this.t >= c.nextZigT) {
      const turn = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 40);
      c.ship.orderedCourse = norm360(c.ship.orderedCourse + turn);
      c.nextZigT = this.t + 600 + Math.random() * 900;
    }
  }

  get isTurning(): boolean {
    return Math.abs(norm180(this.own.orderedCourse - this.own.course)) > 2;
  }

  private updateTowed(dt: number) {
    if (this.towedOrdered && !this.towed.deployed) {
      this.towedDeployProgress += dt / TOWED_DEPLOY_TIME;
      if (this.towedDeployProgress >= 1) {
        this.towed.deployed = true;
        this.towed.stability = 0.3;
        this.log('Towed array deployed.');
      }
    } else if (!this.towedOrdered && this.towed.deployed) {
      this.towed.deployed = false;
      this.towedDeployProgress = 0;
      this.log('Towed array retrieved.');
    }
    // stability: washes out during turns, settles afterwards
    if (this.towed.deployed) {
      if (this.isTurning) {
        this.towed.stability = Math.max(0.05, this.towed.stability - dt / 40);
        this.prevTurning = true;
      } else {
        if (this.prevTurning) this.prevTurning = false;
        this.towed.stability = Math.min(1, this.towed.stability + dt / TOWED_SETTLE_TIME);
      }
    }
  }

  // ----- detection + display synthesis --------------------------------------

  private snapshotDetections() {
    for (const arr of [this.sphere, this.towed]) {
      const prev = this.detections[arr.type];
      const now: Detection[] = [];
      const noiseDelta = selfNoiseDelta(this.ownPlatform);
      for (const c of this.contacts) {
        const d = evaluateDetection(this.own, c.ship, arr, this.env, this.t, c.seed, noiseDelta);
        if (d) now.push(d);
      }
      // gained/lost events
      for (const d of now) {
        if (!prev.find((p) => p.contactId === d.contactId)) {
          const via = d.paths[0].path;
          this.log(`Gained contact ${arr.label} brg ${Math.round(d.bearing)} (${via})`);
        }
      }
      for (const p of prev) {
        if (!now.find((d) => d.contactId === p.contactId)) {
          this.log(`Lost contact ${arr.label} brg ${Math.round(p.bearing)}`);
        }
      }
      this.detections[arr.type] = now;
    }
  }

  private pushBBRow() {
    for (const arr of [this.sphere, this.towed]) {
      const data = new Float32Array(BB_BINS);
      // background speckle; raise floor with ownship speed (self noise)
      const floor = clamp(0.06 + Math.max(0, this.own.speed - 8) * 0.012, 0.06, 0.3);
      for (let i = 0; i < BB_BINS; i++) {
        data[i] = floor + Math.random() * 0.09;
      }
      if (arr.deployed) {
        for (const det of this.detections[arr.type]) {
          const amp = clamp(0.25 + det.signalExcess * 0.045, 0.15, 1);
          this.paintTrace(data, det.bearing, amp, arr.type === 'sphere' ? 4 : 7);
          if (det.ambiguousBearing !== undefined) {
            this.paintTrace(data, det.ambiguousBearing, amp * 0.92, 7);
          }
        }
        // sphere baffle notch
        if (arr.baffleHalfAngle > 0) {
          for (let i = 0; i < BB_BINS; i++) {
            const b = (i / BB_BINS) * 360;
            const rb = Math.abs(norm180(b - this.own.course));
            if (rb > 180 - arr.baffleHalfAngle) data[i] *= 0.25;
          }
        }
      } else {
        for (let i = 0; i < BB_BINS; i++) data[i] = 0.02;
      }
      const rows = this.bbRows[arr.type];
      rows.push({ t: this.t, data });
      if (rows.length > 420) rows.shift();
    }
  }

  private paintTrace(data: Float32Array, bearing: number, amp: number, widthDeg: number) {
    const center = (norm360(bearing) / 360) * BB_BINS;
    const halfBins = (widthDeg / 360) * BB_BINS;
    const lo = Math.floor(center - halfBins * 2);
    const hi = Math.ceil(center + halfBins * 2);
    for (let i = lo; i <= hi; i++) {
      const idx = ((i % BB_BINS) + BB_BINS) % BB_BINS;
      const d = (i - center) / halfBins;
      const v = amp * Math.exp(-d * d * 2.2) * (0.85 + Math.random() * 0.3);
      data[idx] = Math.min(1, data[idx] + v);
    }
  }

  /** narrowband gram frequency span for an array */
  nbSpan(arrType: ArrayType): { lo: number; hi: number } {
    return arrType === 'towed' ? { lo: 0, hi: 400 } : { lo: 0, hi: 1600 };
  }

  private pushNBRow(tr: Tracker) {
    const arr = tr.arrayType === 'sphere' ? this.sphere : this.towed;
    const span = this.nbSpan(tr.arrayType);
    const data = new Float32Array(NB_BINS);
    for (let i = 0; i < NB_BINS; i++) data[i] = 0.05 + Math.random() * 0.08;

    const det = tr.contactId
      ? this.detections[tr.arrayType].find((d) => d.contactId === tr.contactId)
      : undefined;
    if (det && arr.deployed) {
      const c = this.contacts.find((x) => x.ship.id === tr.contactId)!;
      const tonals = liveTonals(c.ship.signature, c.ship.speed, isSnorkeling(c.ship.signature, c.ship.depth));
      const bestPathTL = this.pathTLFor(c.ship, det.paths[0].path);
      const ownBelow = this.own.depth > this.env.layerDepthFt;
      const nl = totalNL(this.env, this.own.speed, arr.type, ownBelow, selfNoiseDelta(this.ownPlatform));
      for (const tn of tonals) {
        if (tn.freq < arr.bandLo * 0.5 || tn.freq > arr.bandHi) continue;
        // narrowband processing gain: effective DT much lower than broadband
        const snr = tn.level - bestPathTL - (nl - arr.di) + 12;
        if (snr < 0) continue;
        const bin = Math.round(((tn.freq - span.lo) / (span.hi - span.lo)) * (NB_BINS - 1));
        if (bin < 0 || bin >= NB_BINS) continue;
        const amp = clamp(0.25 + snr * 0.05, 0.2, 1);
        data[bin] = Math.min(1, data[bin] + amp * (0.8 + Math.random() * 0.4));
        if (bin + 1 < NB_BINS) data[bin + 1] = Math.min(1, data[bin + 1] + amp * 0.4);
      }
    }
    let rows = this.nbRows.get(tr.id);
    if (!rows) {
      rows = [];
      this.nbRows.set(tr.id, rows);
    }
    rows.push({ t: this.t, data });
    if (rows.length > 300) rows.shift();
  }

  private pathTLFor(contact: Ship, pathType: string): number {
    const r = rangeYds(this.own.pos, contact.pos);
    const paths = computePaths({
      env: this.env,
      srcDepthFt: contact.depth,
      rcvDepthFt: this.own.depth,
      rangeYds: r,
      freqKhz: 0.1,
    });
    const p = paths.find((x) => x.path === pathType) ?? paths[0];
    return p ? p.tl : 120;
  }

  /** narrowband readout for a tracker (blade rate etc.) */
  nbInfo(tr: Tracker): NBInfo {
    const det = tr.contactId
      ? this.detections[tr.arrayType].find((d) => d.contactId === tr.contactId)
      : undefined;
    if (!det) return { bladeRateHz: null, harmonics: 0, strongestTonals: [] };
    const c = this.contacts.find((x) => x.ship.id === tr.contactId)!;
    const arr = tr.arrayType === 'sphere' ? this.sphere : this.towed;
    const tonals = liveTonals(c.ship.signature, c.ship.speed, isSnorkeling(c.ship.signature, c.ship.depth));
    const bestPathTL = this.pathTLFor(c.ship, det.paths[0].path);
    const ownBelow = this.own.depth > this.env.layerDepthFt;
    const nl = totalNL(this.env, this.own.speed, arr.type, ownBelow, selfNoiseDelta(this.ownPlatform));
    const strong = tonals
      .map((tn) => ({ freq: tn.freq, label: tn.label, snr: tn.level - bestPathTL - (nl - arr.di) + 12 }))
      .filter((x) => x.snr > 2 && x.freq <= arr.bandHi)
      .sort((a, b) => b.snr - a.snr)
      .slice(0, 5);
    const br = bladeRateHz(c.ship.signature, c.ship.speed);
    const brVisible = strong.some((s) => s.label.startsWith('blade rate'));
    const harmonics = strong.filter((s) => s.label.startsWith('blade rate')).length;
    return {
      bladeRateHz: brVisible ? br * (1 + gaussian(0.01)) : null,
      harmonics,
      strongestTonals: strong,
    };
  }

  // ----- trackers ------------------------------------------------------------

  /** designate a tracker at a clicked bearing on an array display */
  designate(arrType: ArrayType, bearing: number): Tracker | null {
    const dets = this.detections[arrType];
    let best: { det: Detection; side: 'primary' | 'mirror'; err: number } | null = null;
    for (const d of dets) {
      const e1 = Math.abs(norm180(d.bearing - bearing));
      if (!best || e1 < best.err) best = { det: d, side: 'primary', err: e1 };
      if (d.ambiguousBearing !== undefined) {
        const e2 = Math.abs(norm180(d.ambiguousBearing - bearing));
        if (!best || e2 < best.err) best = { det: d, side: 'mirror', err: e2 };
      }
    }
    if (!best || best.err > 8) return null;
    // don't double-designate same contact+array
    const existing = this.trackers.find(
      (t) => t.contactId === best!.det.contactId && t.arrayType === arrType && !t.lost,
    );
    if (existing) return existing;
    const label = `${arrType === 'sphere' ? 'S' : 'T'}${this.nextTrackerNum++}`;
    const tr: Tracker = {
      id: `${label}-${Math.round(this.t)}`,
      contactId: best.det.contactId,
      label,
      arrayType: arrType,
      ambiguitySide: best.side,
      marks: [],
      solution: null,
      classification: 'unknown',
      lastAutoMark: -1e9,
      lost: false,
    };
    this.trackers.push(tr);
    this.autoMark(tr, true);
    this.log(`Designated ${label} brg ${Math.round(bearing)} on ${arrType.toUpperCase()}`);
    return tr;
  }

  dropTracker(id: string) {
    const tr = this.trackers.find((t) => t.id === id);
    if (tr) {
      this.trackers = this.trackers.filter((t) => t.id !== id);
      this.nbRows.delete(id);
      this.log(`Dropped tracker ${tr.label}`);
    }
  }

  /** flip which lobe of an ambiguous towed contact the tracker follows */
  flipAmbiguity(id: string) {
    const tr = this.trackers.find((t) => t.id === id);
    if (!tr) return;
    tr.ambiguitySide = tr.ambiguitySide === 'primary' ? 'mirror' : 'primary';
    tr.marks = []; // marks on the wrong lobe are invalid
    tr.solution = null;
    this.log(`${tr.label}: ambiguity side flipped — bearing history reset`);
  }

  private autoMark(tr: Tracker, force = false) {
    if (!force && this.t - tr.lastAutoMark < AUTO_MARK_PERIOD) return;
    const det = tr.contactId
      ? this.detections[tr.arrayType].find((d) => d.contactId === tr.contactId)
      : undefined;
    if (!det) {
      if (this.t - tr.lastAutoMark > 180 && !tr.lost && tr.marks.length > 0) {
        tr.lost = true;
        this.log(`${tr.label}: track lost`);
      }
      return;
    }
    if (tr.lost) {
      tr.lost = false;
      this.log(`${tr.label}: track regained`);
    }
    tr.lastAutoMark = this.t;
    const bearing =
      tr.ambiguitySide === 'mirror' && det.ambiguousBearing !== undefined
        ? det.ambiguousBearing
        : det.bearing;
    tr.marks.push({
      t: this.t,
      bearing,
      arrayType: tr.arrayType,
      ownPos: { ...this.own.pos },
      ownCourse: this.own.course,
      ownSpeed: this.own.speed,
    });
    if (tr.marks.length > MAX_MARKS) tr.marks.shift();
  }

  /** current smoothed bearing for a tracker (last mark) */
  trackerBearing(tr: Tracker): number | null {
    if (tr.marks.length === 0) return null;
    return tr.marks[tr.marks.length - 1].bearing;
  }

  setSolution(id: string, sol: Solution | null) {
    const tr = this.trackers.find((t) => t.id === id);
    if (tr) tr.solution = sol;
  }

  /** truth state of the contact a tracker is on (instructor/grading use) */
  truthFor(tr: Tracker): Ship | null {
    return this.contacts.find((c) => c.ship.id === tr.contactId)?.ship ?? null;
  }

  /** counter-detection check: can the (submarine) contact hear US?
   *  Used for scoring in trail scenarios. */
  counterDetectionRisk(): number {
    let worst = -99;
    for (const c of this.contacts) {
      if (c.ship.contactClass !== 'submarine') continue;
      const arr = makeSphere();
      const fake: Ship = { ...c.ship };
      const det = evaluateDetection(fake, this.own, arr, this.env, this.t, 0.9);
      if (det) worst = Math.max(worst, det.signalExcess);
    }
    return worst;
  }
}
