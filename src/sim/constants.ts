// ---------------------------------------------------------------------------
// Physical constants and gameplay-tuned acoustic parameters.
// The dB bookkeeping is internally consistent and produces tactically
// realistic detection ranges; individual values are TUNABLE and are chosen
// from open-literature orders of magnitude (Urick ch. 7-12), then adjusted
// so the passive sonar equation yields sensible gameplay.
// ---------------------------------------------------------------------------

/** yards per nautical mile */
export const YDS_PER_NM = 2025.37;
/** yards per second per knot */
export const YDS_PER_SEC_PER_KT = YDS_PER_NM / 3600;
/** yards per minute per knot */
export const YDS_PER_MIN_PER_KT = YDS_PER_NM / 60; // 33.756

/**
 * The "Ekelund constant": R(yds) = EKELUND_K * dSpeedAcross(kts) / dBearingRate(deg/min)
 * Derivation: w(rad/min) = Vperp(yd/min)/R  =>  R = dV/dw = 33.756*(180/PI)*dV/dw_degmin
 */
export const EKELUND_K = (YDS_PER_MIN_PER_KT * 180) / Math.PI; // ~1934

export const DEG = Math.PI / 180;

/** detection threshold, dB (tuned) */
export const DT = 10;

/** signal excess of exactly 0 => 50% detection; fluctuation sigma dB */
export const FLUCTUATION_SIGMA = 3.5;

/** broadband waterfall row period, sim seconds */
export const BB_ROW_PERIOD = 10;
/** narrowband gram row period, sim seconds */
export const NB_ROW_PERIOD = 20;
/** tracker auto-mark period, sim seconds */
export const AUTO_MARK_PERIOD = 15;

/** ownship kinematics */
export const TURN_RATE_BASE = 0.9; // deg/s at 5 kts
export const SPEED_TAU = 60; // s time constant to ordered speed
export const DEPTH_RATE = 2.0; // ft/s at 10 kts, scales w/ speed

/** towed array settle behavior */
export const TOWED_SETTLE_TIME = 180; // s after steadying up to full stability
export const TOWED_DEPLOY_TIME = 300; // s to stream

/** simulation step */
export const SIM_DT = 1.0; // s

export const TIME_SCALES = [1, 5, 15, 30];

/** minimum length of a steady leg to be usable for Ekelund, s */
export const MIN_LEG_TIME = 150;

/** bearing history cap per tracker */
export const MAX_MARKS = 400;
