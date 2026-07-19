import { Vec2 } from './types';
import { DEG, YDS_PER_SEC_PER_KT } from './constants';

/** normalize degrees to [0,360) */
export function norm360(d: number): number {
  return ((d % 360) + 360) % 360;
}

/** normalize degrees to (-180,180] */
export function norm180(d: number): number {
  const n = norm360(d);
  return n > 180 ? n - 360 : n;
}

/** true bearing from a to b, degrees */
export function bearingTo(a: Vec2, b: Vec2): number {
  return norm360((Math.atan2(b.x - a.x, b.y - a.y) / DEG));
}

export function rangeYds(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** unit velocity vector for a course (deg true) */
export function courseVec(course: number): Vec2 {
  return { x: Math.sin(course * DEG), y: Math.cos(course * DEG) };
}

/** velocity in yards/sec */
export function velocity(course: number, speedKts: number): Vec2 {
  const u = courseVec(course);
  const s = speedKts * YDS_PER_SEC_PER_KT;
  return { x: u.x * s, y: u.y * s };
}

/** project a point along course/speed for dt seconds */
export function advance(pos: Vec2, course: number, speedKts: number, dt: number): Vec2 {
  const v = velocity(course, speedKts);
  return { x: pos.x + v.x * dt, y: pos.y + v.y * dt };
}

/** relative bearing (deg, -180..180) of true bearing from a heading */
export function relBearing(heading: number, trueBearing: number): number {
  return norm180(trueBearing - heading);
}

/** own speed across a line of sight: component of velocity perpendicular to LOS, kts.
 *  Sign convention: positive in the direction of increasing bearing. */
export function speedAcrossLos(course: number, speedKts: number, losBearing: number): number {
  // perpendicular-to-LOS unit vector in the +bearing direction is LOS rotated +90deg
  const a = (losBearing + 90) * DEG;
  const perp = { x: Math.sin(a), y: Math.cos(a) };
  const v = courseVec(course);
  return speedKts * (v.x * perp.x + v.y * perp.y);
}

/** own speed along a line of sight (+ = closing toward the bearing), kts */
export function speedAlongLos(course: number, speedKts: number, losBearing: number): number {
  const a = losBearing * DEG;
  const along = { x: Math.sin(a), y: Math.cos(a) };
  const v = courseVec(course);
  return speedKts * (v.x * along.x + v.y * along.y);
}

/** gaussian random via Box-Muller */
export function gaussian(sigma = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return sigma * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** format sim seconds as HH:MM:SS */
export function fmtTime(t: number): string {
  const s = Math.floor(t % 60);
  const m = Math.floor((t / 60) % 60);
  const h = Math.floor(t / 3600);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

export function fmtRange(yds: number): string {
  if (yds >= 10000) return `${(yds / 1000).toFixed(1)} kyd`;
  return `${Math.round(yds)} yd`;
}
