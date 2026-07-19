// Headless smoke test of the simulation + TMA math.
// Run: npx esbuild scripts/smoke.ts --bundle --format=esm --outfile=/tmp/smoke.mjs && node /tmp/smoke.mjs
import { Simulation } from '../src/sim/simulation';
import { scenarioById } from '../src/sim/scenarios';
import { detectLegs, ekelundRange, autoTMA, gradeSolution } from '../src/sim/tma';
import { rangeYds, bearingTo } from '../src/sim/geo';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail}`);
  if (!ok) failures++;
}

// ---- 1. Open ocean: detections exist at sane ranges -----------------------
{
  const sim = new Simulation(scenarioById('open-ocean'));
  sim.step(60);
  const dets = sim.detections.sphere;
  check('open-ocean: sphere holds >=1 contact', dets.length >= 1, `held ${dets.length}`);
  for (const d of dets) {
    check(
      `  bearing accuracy contact ${d.contactId}`,
      Math.abs(d.bearing - d.truthBearing) < 6 || Math.abs(d.bearing - d.truthBearing) > 354,
      `obs ${d.bearing.toFixed(1)} truth ${d.truthBearing.toFixed(1)}`,
    );
  }
}

// ---- 2. Ekelund ranging end-to-end ----------------------------------------
{
  const sim = new Simulation(scenarioById('tut-ekelund'));
  sim.step(30);
  const det = sim.detections.sphere[0];
  check('ekelund scenario: contact detected', !!det);
  if (det) {
    const tr = sim.designate('sphere', det.bearing)!;
    check('tracker designated', !!tr);
    // leg 1: 5 min steady
    sim.step(300);
    // maneuver 70 deg
    sim.orderCourse(sim.own.course + 70);
    sim.step(120); // turn + settle
    // leg 2: 6 min steady
    sim.step(360);
    const legs = detectLegs(sim.ownHistory);
    check('two+ legs detected', legs.length >= 2, `legs=${legs.length}`);
    const ek = ekelundRange(tr.marks, legs);
    const truth = sim.truthFor(tr)!;
    const trueRange = rangeYds(sim.own.pos, truth.pos);
    if (ek && isFinite(ek.rangeYds)) {
      const err = Math.abs(ek.rangeYds - trueRange) / trueRange;
      check('ekelund within 40% of truth', err < 0.4, `ek=${(ek.rangeYds / 1000).toFixed(1)}k truth=${(trueRange / 1000).toFixed(1)}k err=${(err * 100).toFixed(0)}%`);
    } else {
      check('ekelund produced a range', false, ek?.caveat ?? 'null');
    }

    // ---- 3. auto-TMA on same data ----
    const sol = autoTMA(tr.marks, sim.t, null);
    check('autoTMA converged', !!sol);
    if (sol) {
      const g = gradeSolution(sol, truth.pos, truth.course, truth.speed, sim.own.pos, sim.t);
      check(
        'autoTMA range err < 25%',
        g.rangeErrPct < 25,
        `rangeErr=${g.rangeErrPct.toFixed(0)}% courseErr=${g.courseErrDeg.toFixed(0)} speedErr=${g.speedErrKts.toFixed(1)}`,
      );
    }
  }
}

// ---- 4. CZ scenario: contact appears via CZ path --------------------------
{
  const sim = new Simulation(scenarioById('cz'));
  sim.step(120);
  const all = [...sim.detections.sphere, ...sim.detections.towed];
  const czDet = all.find((d) => d.paths.some((p) => p.path === 'cz'));
  check('cz scenario: CZ-path detection exists', !!czDet, czDet ? `SE=${czDet.signalExcess.toFixed(1)} range=${(czDet.truthRangeYds / 1000).toFixed(0)}k` : 'none');
}

// ---- 5. Towed array: ambiguity + quiet contact ----------------------------
{
  const sim = new Simulation(scenarioById('tut-towed'));
  sim.toggleTowed();
  sim.step(320); // deploy
  check('towed deployed', sim.towed.deployed);
  sim.step(240); // settle
  const dets = sim.detections.towed;
  check('towed holds submarine', dets.length >= 1, `n=${dets.length}`);
  if (dets.length) {
    check('towed detection has mirror bearing', dets[0].ambiguousBearing !== undefined);
  }
  const sphereHolds = sim.detections.sphere.length;
  console.log(`  (sphere holds ${sphereHolds} — quiet sub expected mostly towed-only)`);
}

// ---- 6. Layer effect sanity: cross-layer TL > same-side TL ----------------
{
  const { computePaths } = await import('../src/sim/propagation');
  const env = scenarioById('open-ocean').env;
  const same = computePaths({ env, srcDepthFt: 400, rcvDepthFt: 500, rangeYds: 12000, freqKhz: 1.5 });
  const cross = computePaths({ env, srcDepthFt: 25, rcvDepthFt: 500, rangeYds: 12000, freqKhz: 1.5 });
  const dSame = same.find((p) => p.path === 'direct')!;
  const dCross = cross.find((p) => p.path === 'direct')!;
  check('cross-layer direct TL higher', dCross.tl > dSame.tl + 5, `same=${dSame.tl.toFixed(1)} cross=${dCross.tl.toFixed(1)}`);
}

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
