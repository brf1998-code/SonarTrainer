// ---------------------------------------------------------------------------
// Core types for the sonar / TMA simulation.
// Coordinate system: x = east (yards), y = north (yards). Bearings are TRUE,
// degrees clockwise from north. Speeds in knots, depths in feet.
// All acoustic modeling is from open literature (Urick, Principles of
// Underwater Sound; standard passive-sonar-equation formulations).
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

export type PathType = 'direct' | 'bottom-bounce' | 'cz';

export interface PropPathResult {
  path: PathType;
  /** one-way transmission loss, dB */
  tl: number;
  /** arrival depression/elevation angle at own ship, degrees (+down) */
  deAngle: number;
  valid: boolean;
}

export type SvpType = 'surface-duct' | 'negative-gradient' | 'deep-isothermal';

export interface Environment {
  name: string;
  /** water depth, feet */
  waterDepthFt: number;
  /** sonic layer depth, feet (0 = no layer) */
  layerDepthFt: number;
  svp: SvpType;
  /** sea state 0-6 */
  seaState: number;
  /** shipping noise level 1(low)-7(heavy) */
  shippingLevel: number;
  /** bottom loss per bounce, dB (sand ~6, mud ~12, rock ~4) */
  bottomLossDb: number;
  /** true if water depth exceeds critical depth => CZ propagation exists */
  depthExcess: boolean;
}

export type ContactClass =
  | 'merchant'
  | 'warship'
  | 'submarine'
  | 'fishing'
  | 'biologic';

export interface Tonal {
  /** Hz */
  freq: number;
  /** source level of the tonal, dB//1uPa@1yd */
  level: number;
  /** label used in narrowband classification (e.g. '60Hz electrical') */
  label: string;
  /** true if freq scales with shaft speed (blade-rate family) */
  speedScaled: boolean;
}

export interface Signature {
  contactClass: ContactClass;
  /** broadband source level at reference speed, dB */
  broadbandSL: number;
  /** dB change in broadband SL per knot away from reference speed */
  slPerKnot: number;
  referenceSpeedKts: number;
  /** number of propeller blades */
  blades: number;
  /** shaft turns (RPM) per knot of speed */
  turnsPerKnot: number;
  tonals: Tonal[];
}

export interface Ship {
  id: string;
  name: string;
  contactClass: ContactClass;
  pos: Vec2;
  /** degrees true */
  course: number;
  /** knots */
  speed: number;
  /** feet */
  depth: number;
  orderedCourse: number;
  orderedSpeed: number;
  orderedDepth: number;
  signature: Signature;
}

export type ArrayType = 'sphere' | 'towed';

export interface SonarArray {
  type: ArrayType;
  label: string;
  /** processing band, Hz */
  bandLo: number;
  bandHi: number;
  /** directivity index, dB */
  di: number;
  /** half-angle of stern baffle sector, deg (0 = none) */
  baffleHalfAngle: number;
  /** true bearing ambiguity about array axis */
  ambiguous: boolean;
  deployed: boolean;
  /** 0..1, towed array washes out during/after own-ship turns */
  stability: number;
}

export interface DetectionPath {
  path: PathType;
  /** signal excess, dB */
  se: number;
  deAngle: number;
}

export interface Detection {
  contactId: string;
  arrayType: ArrayType;
  /** true bearing w/ measurement noise applied, deg */
  bearing: number;
  /** mirror bearing for ambiguous arrays, deg (undefined for sphere) */
  ambiguousBearing?: number;
  /** best-path signal excess, dB */
  signalExcess: number;
  paths: DetectionPath[];
  /** truth bearing without noise (used internally + instructor mode) */
  truthBearing: number;
  truthRangeYds: number;
}

export interface BearingMark {
  /** sim time, s */
  t: number;
  /** deg true */
  bearing: number;
  arrayType: ArrayType;
  /** own ship position at mark time */
  ownPos: Vec2;
  ownCourse: number;
  ownSpeed: number;
}

export interface Solution {
  /** target position at solution time */
  pos: Vec2;
  course: number;
  speed: number;
  /** sim time solution refers to (always "now" when edited) */
  t: number;
}

export interface Tracker {
  id: string;
  /** designated contact (nearest truth contact at designation) */
  contactId: string | null;
  label: string; // e.g. "S1", "T2"
  arrayType: ArrayType;
  /** which lobe of an ambiguous pair the operator selected */
  ambiguitySide: 'primary' | 'mirror';
  marks: BearingMark[];
  solution: Solution | null;
  /** operator classification */
  classification: ContactClass | 'unknown';
  lastAutoMark: number;
  lost: boolean;
}

export interface OwnshipLegSummary {
  startT: number;
  endT: number;
  course: number;
  speed: number;
  /** mean bearing rate to a given tracker during leg, deg/min */
  bearingRate?: number;
  meanBearing?: number;
  /** own speed across the line of sight, kts */
  speedAcross?: number;
}

export interface ScenarioContactDef {
  name: string;
  contactClass: ContactClass;
  /** initial range from ownship, yards */
  rangeYds: number;
  /** initial true bearing from ownship, deg */
  bearing: number;
  course: number;
  speed: number;
  depth: number;
}

export interface Scenario {
  id: string;
  name: string;
  brief: string;
  env: Environment;
  ownCourse: number;
  ownSpeed: number;
  ownDepth: number;
  contacts: ScenarioContactDef[];
  /** if set, scenario is the practical portion of this tutorial */
  tutorialId?: string;
}
