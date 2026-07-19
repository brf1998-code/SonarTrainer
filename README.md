# Sonar / TMA Trainer

An open-source sonar and contact-management (Target Motion Analysis) trainer for
submarine junior officers. Runs entirely in the browser; built with React +
TypeScript, deployable to Railway with zero configuration.

**Everything in this trainer is built exclusively from open, public literature**
(Urick's *Principles of Underwater Sound*, publicly documented TMA methods, and
standard maneuvering-board mathematics). No classified, controlled, or
proprietary information is used, and all tuning constants are generic training
values chosen for tactical plausibility, not fidelity to any real system.

## What it trains

- **Broadband bearing-time waterfalls** for a spherical (bow) array and a
  towed array, with baffles, port/starboard towed-array ambiguity, own-noise
  washout with speed, and array bands.
- **Narrowband LOFAR-style grams** per tracker: blade-rate harmonic families,
  shaft lines, electrical and machinery lines; turn-count speed estimation.
- **Ray-path propagation**: direct path with sonic-layer effects, bottom bounce
  (bottom loss, steep D/E), and convergence zones (depth-excess placement,
  annulus, near-zero D/E) — so contacts fade, pop, and multipath the way the
  ocean actually behaves tactically.
- **Ranging methods**: Ekelund ranging off two steady legs (the 1934 rule),
  bearing-rate analysis, CZ range estimation, and full bearings-only TMA with a
  **dot stack**, manual solution manipulation, and a Gauss-Newton **auto-TMA**
  you can ask for a recommended solution.
- **Instructor assists**: recommended maneuvers with the doctrine reasoning
  spelled out, worked Ekelund calculations, solution grading against truth.
- **Tutorials** that walk through bearing rate, Ekelund ranging, dot-stack TMA,
  and towed-array employment step by step, gated on you actually doing it.
- **Free-play scenarios**: open-ocean contact management, submerged trail,
  CZ detection, shallow-water knife fight, Med gradient problem.

## Running locally

```bash
npm install
npm run dev        # dev server on :5173
```

Production build + serve (what Railway runs):

```bash
npm run build
npm start          # Express serves dist/ on :3000 (or $PORT)
```

Headless physics/TMA smoke test:

```bash
npx esbuild scripts/smoke.ts --bundle --format=esm --outfile=/tmp/smoke.mjs && node /tmp/smoke.mjs
```

## Deploying to Railway

1. Push this repository to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**, select the repo.
3. Railway auto-detects Node (Nixpacks), runs `npm run build`, starts with
   `npm start` per `railway.json`. No environment variables required.

## How to use it (quick tour)

1. Pick a scenario (start with the tutorials in the dropdown).
2. **SONAR** tab: click a trace on a waterfall to designate a tracker.
   Bearings accumulate automatically. Use time compression (5×/15×/30×).
3. **TMA** panel (right): enter range/course/speed, then drive the **dot
   stack** residuals to a straight vertical line. RMS < 0.5° is firing quality.
4. **TOOLS** tab: bearing rate, worked Ekelund from your actual legs, a manual
   Ekelund calculator, and turn-count speed estimation.
5. **GEO PLOT**: your track, bearing fans, and solutions. The **TRUTH** toggle
   is instructor mode — grade yourself *after* committing to a solution.
6. Ship control (left): course/speed/depth orders, towed array stream/retrieve.
   Layer depth matters: cross-layer contacts fade fast; slow down to listen.

## Architecture

```
src/sim/          pure TypeScript simulation (no React imports)
  propagation.ts  ray-path model: direct/layer, bottom bounce, CZ
  sonar.ts        passive sonar equation, arrays, noise, detection
  signatures.ts   contact signatures: broadband + tonal families
  tma.ts          dot-stack residuals, Gauss-Newton auto-TMA, Ekelund, legs
  simulation.ts   world state, kinematics, trackers, waterfall synthesis
  assist.ts       recommended maneuvers/solutions with explanations
src/ui/           React canvas displays (waterfall, gram, geo, dot stack)
src/tutorials/    condition-gated lesson scripts
server.js         static Express host (Railway) — phase-2 multiplayer anchor
```

The simulation is deliberately isolated from the UI so it can move server-side
unchanged for the planned **phase 2: head-to-head duel mode** — two players on
separate submarines in the same ocean, each trying to build a firing solution
on the other first (WebSocket rooms on this same Express server).

## Physics references (all open literature)

- R.J. Urick, *Principles of Underwater Sound*, 3rd ed. — passive sonar
  equation, transmission loss, ambient noise (Wenz curves), convergence zones,
  bottom loss, surface ducts.
- Thorp absorption formula (open literature).
- Ekelund ranging & the 1934 rule: standard published bearings-only ranging
  (R = 1934 × ΔSa / ΔḂ with yards, knots, °/min — the constant is just unit
  conversion: 2025.37/60 × 180/π).
- Bearings-only TMA observability (ownship maneuver requirement) — standard
  published estimation theory.

## Roadmap

- [ ] Phase 2: competitive head-to-head mode (server-authoritative sim,
      WebSocket rooms, scoring by first firing-quality solution)
- [ ] Ekelund/Spiess leg planner overlay on the geo plot
- [ ] Contact zig detection drills (restart-the-stack discipline)
- [ ] Sound-velocity-profile editor + more environments
- [ ] Optional precomputed Bellhop TL grids as a drop-in propagation backend
- [ ] Scenario recorder / replay & debrief

## License

MIT — see LICENSE.
