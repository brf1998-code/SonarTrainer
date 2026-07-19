// ---------------------------------------------------------------------------
// Tutorial framework: each tutorial is a list of steps; a step advances when
// its check() against the live simulation returns true. Techniques covered are
// all open-literature TMA fundamentals.
// ---------------------------------------------------------------------------

import { Simulation } from '../sim/simulation';
import { detectLegs, ekelundRange, gradeSolution } from '../sim/tma';
import { norm180 } from '../sim/geo';

export interface TutorialStep {
  title: string;
  text: string;
  hint?: string;
  check: (sim: Simulation) => boolean;
}

export interface Tutorial {
  id: string;
  name: string;
  steps: TutorialStep[];
}

const anyTracker = (sim: Simulation) => sim.trackers.find((t) => !t.lost);

export const TUTORIALS: Tutorial[] = [
  {
    id: 'bearing-rate',
    name: 'Bearings & Bearing Rate',
    steps: [
      {
        title: 'Read the waterfall',
        text:
          'The broadband waterfall shows bearing across the top and time scrolling downward. Bright traces are contacts; the fuzzy band astern is your baffles. There is one contact out there. Find its trace on the SPHERE display.',
        hint: 'Look in the right half of the display, around 045.',
        check: () => true,
      },
      {
        title: 'Designate a tracker',
        text:
          'Click on the contact trace in the SPHERE waterfall to designate a tracker. The system will begin taking automatic bearing marks every 15 seconds.',
        hint: 'Click directly on the bright trace.',
        check: (sim) => sim.trackers.length > 0,
      },
      {
        title: 'Accumulate bearings',
        text:
          'Let the tracker accumulate at least 2 minutes of bearing history. Use time compression (top bar) to speed things up. Watch how the trace slants — that slant IS the bearing rate.',
        check: (sim) => {
          const tr = anyTracker(sim);
          return !!tr && tr.marks.length >= 9;
        },
      },
      {
        title: 'Read the bearing rate',
        text:
          'Open TOOLS and look at the Bearing Rate readout for your tracker. A right-bearing drift (increasing bearing) means the contact is crossing to the right. Rule of thumb: at a given range, bearing rate is proportional to relative speed across the line of sight. High bearing rate = close and/or fast-crossing.',
        check: (sim) => {
          const tr = anyTracker(sim);
          if (!tr || tr.marks.length < 9) return false;
          return true;
        },
      },
      {
        title: 'Change the geometry',
        text:
          'Order a course change of at least 60° and watch the bearing rate change. You did not change the contact\'s motion — you changed YOUR speed across the line of sight. This is the heart of all bearings-only ranging.',
        check: (sim) => {
          const legs = detectLegs(sim.ownHistory);
          return legs.length >= 2;
        },
      },
      {
        title: 'Complete',
        text:
          'You can now read a waterfall, designate trackers, and interpret bearing rate. Next tutorial: turning two legs of bearing rate into a range (Ekelund).',
        check: () => false,
      },
    ],
  },
  {
    id: 'ekelund',
    name: 'Ekelund Ranging',
    steps: [
      {
        title: 'The idea',
        text:
          'Ekelund ranging: measure bearing rate on two ownship legs. The target\'s contribution to bearing rate is the same on both legs (if it holds course/speed), so the CHANGE in bearing rate is due only to YOUR change in speed-across-the-LOS. Range falls out: R = 1934 × ΔSa / ΔḂ (yards, knots, deg/min). Designate the contact on the SPHERE array.',
        check: (sim) => sim.trackers.length > 0,
      },
      {
        title: 'First leg',
        text:
          'Hold your current course steady for at least 3 minutes while the tracker accumulates bearings. Steady means STEADY — turn transients corrupt the bearing rate.',
        check: (sim) => {
          const tr = anyTracker(sim);
          if (!tr) return false;
          const legs = detectLegs(sim.ownHistory);
          const last = legs[legs.length - 1];
          return !!last && last.endT - last.startT >= 180 && tr.marks.length >= 8;
        },
      },
      {
        title: 'Maneuver across the LOS',
        text:
          'Now turn at least 60° to swing the contact to the other side of your bow — this maximizes the change in your speed across the line of sight. (Ask for a recommended maneuver in the TMA panel if unsure.)',
        check: (sim) => {
          const legs = detectLegs(sim.ownHistory);
          return legs.length >= 2;
        },
      },
      {
        title: 'Second leg',
        text: 'Steady up and hold the new course for at least 3 minutes.',
        check: (sim) => {
          const tr = anyTracker(sim);
          if (!tr) return false;
          const legs = detectLegs(sim.ownHistory);
          return legs.length >= 2 && legs[legs.length - 1].endT - legs[legs.length - 1].startT >= 180;
        },
      },
      {
        title: 'Compute the range',
        text:
          'Open TOOLS → Ekelund. The calculator shows both legs\' bearing rates and speeds-across, and works the 1934 rule for you. Compare against truth with the instructor (TRUTH) toggle. Within ~20% is a good first Ekelund.',
        check: (sim) => {
          const tr = anyTracker(sim);
          if (!tr) return false;
          const res = ekelundRange(tr.marks, detectLegs(sim.ownHistory));
          return !!res && isFinite(res.rangeYds) && res.rangeYds > 0;
        },
      },
      {
        title: 'Complete',
        text:
          'You have a paper range from bearings alone. Remember the assumptions: target steady on both legs, clean bearing rates, honest steady legs. Next: full solutions with the dot stack.',
        check: () => false,
      },
    ],
  },
  {
    id: 'dotstack',
    name: 'Dot-Stack TMA',
    steps: [
      {
        title: 'Designate and build history',
        text:
          'Designate the contact and accumulate ~4 minutes of bearings, then maneuver (60°+) and take ~4 more minutes. A dot stack without an ownship maneuver cannot resolve range.',
        check: (sim) => {
          const tr = anyTracker(sim);
          if (!tr) return false;
          const legs = detectLegs(sim.ownHistory).filter((l) => l.endT > (tr.marks[0]?.t ?? 0));
          return tr.marks.length >= 24 && legs.length >= 2;
        },
      },
      {
        title: 'Open the TMA panel',
        text:
          'Select your tracker in the TMA panel and enter an initial solution: take a guess at range (say 15 kyd), course, and speed. The dot stack shows the error between each observed bearing and where your solution says the bearing should have been. Dots left = solution bearing is too far right at that time.',
        check: (sim) => {
          const tr = anyTracker(sim);
          return !!tr && tr.solution !== null;
        },
      },
      {
        title: 'Zero the stack',
        text:
          'Adjust range, course, and speed until the dots form a straight vertical line down the center. A bowed stack = wrong range. A sloped stack = wrong course/speed. Get RMS under 0.5°.',
        hint: 'Work range first against the bow of the stack, then take out the slope with course/speed.',
        check: (sim) => {
          const tr = anyTracker(sim);
          if (!tr || !tr.solution) return false;
          const truth = sim.truthFor(tr);
          if (!truth) return false;
          const g = gradeSolution(tr.solution, truth.pos, truth.course, truth.speed, sim.own.pos, sim.t);
          return g.score >= 70;
        },
      },
      {
        title: 'Check against auto-TMA',
        text:
          'Ask for a recommended solution (AUTO-TMA button). Compare its answer and RMS to yours. The machine does least-squares on the same bearings — it is only as good as the geometry you gave it.',
        check: () => true,
      },
      {
        title: 'Complete',
        text:
          'That is manual TMA: bearings in, solution out, dot stack as the referee. In free play, grade yourself with the TRUTH toggle after committing to a solution — not before.',
        check: () => false,
      },
    ],
  },
  {
    id: 'towed',
    name: 'Towed Array & Ambiguity',
    steps: [
      {
        title: 'Stream the array',
        text:
          'The towed array hears low frequencies the sphere cannot, and it is away from own-ship noise — but it takes ~5 minutes to stream and it cannot tell port from starboard. Order the towed array streamed (SHIP panel).',
        check: (sim) => sim.towed.deployed,
      },
      {
        title: 'Gain the contact',
        text:
          'There is a quiet submerged contact out there that the sphere may not hold. Watch the TOWED waterfall — note that every real contact shows TWO traces, mirrored about your heading. Designate the trace you believe is real.',
        check: (sim) => sim.trackers.some((t) => t.arrayType === 'towed'),
      },
      {
        title: 'Resolve ambiguity',
        text:
          'Turn 60-90° and steady up. After the array settles (~3 min), the TRUE bearing stays continuous; the GHOST jumps to a new mirror position. If your tracker followed the ghost, its bearing history will show a step discontinuity — flip the tracker to the other lobe (AMBIG button) if needed.',
        hint: 'The lobe that moves smoothly through your turn is the real one.',
        check: (sim) => {
          const legs = detectLegs(sim.ownHistory);
          const tr = sim.trackers.find((t) => t.arrayType === 'towed');
          return legs.length >= 2 && !!tr && sim.towed.stability > 0.8;
        },
      },
      {
        title: 'Classify on narrowband',
        text:
          'Open the NARROWBAND display for your towed tracker. A submarine shows a sparse line structure: weak blade rate, a 60 Hz electrical line, a pump line — no heavy diesel or machinery lines like a merchant. Classify the tracker as SUBMARINE.',
        check: (sim) => sim.trackers.some((t) => t.arrayType === 'towed' && t.classification === 'submarine'),
      },
      {
        title: 'Complete',
        text:
          'You can now stream, hold, de-ghost, and classify on the towed array. In the Trail scenario, do all of this while keeping your own radiated noise down — speed discipline is detection discipline.',
        check: () => false,
      },
    ],
  },
];

export function tutorialById(id: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}
