import { Environment, Scenario } from './types';

const deepAtlantic: Environment = {
  name: 'Deep Atlantic — surface duct, depth excess',
  waterDepthFt: 15000,
  layerDepthFt: 300,
  svp: 'surface-duct',
  seaState: 3,
  shippingLevel: 4,
  bottomLossDb: 8,
  depthExcess: true,
};

const medSummer: Environment = {
  name: 'Mediterranean summer — strong negative gradient',
  waterDepthFt: 8000,
  layerDepthFt: 120,
  svp: 'negative-gradient',
  seaState: 2,
  shippingLevel: 6,
  bottomLossDb: 6,
  depthExcess: false,
};

const shallowShelf: Environment = {
  name: 'Continental shelf — shallow, mud bottom',
  waterDepthFt: 900,
  layerDepthFt: 150,
  svp: 'surface-duct',
  seaState: 4,
  shippingLevel: 6,
  bottomLossDb: 12,
  depthExcess: false,
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'open-ocean',
    name: 'Open Ocean Contact Management',
    brief:
      'Deep water transit at 12 kts. Multiple surface contacts. Build and maintain solutions on all contacts of interest. Watch the layer: you start above it.',
    env: deepAtlantic,
    ownCourse: 45,
    ownSpeed: 12,
    ownDepth: 200,
    contacts: [
      { name: 'M1', contactClass: 'merchant', rangeYds: 26000, bearing: 30, course: 235, speed: 14, depth: 25 },
      { name: 'M2', contactClass: 'merchant', rangeYds: 34000, bearing: 95, course: 300, speed: 16, depth: 25 },
      { name: 'F1', contactClass: 'fishing', rangeYds: 15000, bearing: 320, course: 120, speed: 7, depth: 15 },
    ],
  },
  {
    id: 'trail',
    name: 'Submerged Contact Trail',
    brief:
      'A quiet submerged contact is somewhere to the north below the layer. Gain contact on the towed array, resolve ambiguity, and work a firing-quality solution without counter-detection. Own noise discipline matters.',
    env: deepAtlantic,
    ownCourse: 0,
    ownSpeed: 8,
    ownDepth: 450,
    contacts: [
      { name: 'S1', contactClass: 'submarine', rangeYds: 11000, bearing: 350, course: 90, speed: 6, depth: 500 },
      { name: 'M1', contactClass: 'merchant', rangeYds: 30000, bearing: 200, course: 20, speed: 13, depth: 25 },
    ],
  },
  {
    id: 'cz',
    name: 'Convergence Zone Detection',
    brief:
      'Deep water with depth excess. A loud contact will appear in the first CZ (~30 nm). Recognize the CZ signature — strong trace, near-zero D/E, fades as the annulus is crossed — and estimate range from zone geometry.',
    env: deepAtlantic,
    ownCourse: 270,
    ownSpeed: 10,
    ownDepth: 400,
    contacts: [
      { name: 'M1', contactClass: 'merchant', rangeYds: 63000, bearing: 285, course: 100, speed: 18, depth: 25 },
      { name: 'W1', contactClass: 'warship', rangeYds: 58000, bearing: 250, course: 70, speed: 15, depth: 20 },
    ],
  },
  {
    id: 'shallow',
    name: 'Shallow Water Knife Fight',
    brief:
      'Continental shelf, heavy shipping, poor sonar conditions. Short detection ranges, no CZ, bottom bounce degraded by mud. Rapid TMA on close contacts.',
    env: shallowShelf,
    ownCourse: 90,
    ownSpeed: 6,
    ownDepth: 300,
    contacts: [
      { name: 'M1', contactClass: 'merchant', rangeYds: 12000, bearing: 70, course: 280, speed: 12, depth: 20 },
      { name: 'F1', contactClass: 'fishing', rangeYds: 8000, bearing: 150, course: 340, speed: 6, depth: 10 },
      { name: 'S1', contactClass: 'submarine', rangeYds: 9000, bearing: 110, course: 200, speed: 5, depth: 250 },
    ],
  },
  {
    id: 'med',
    name: 'Med Gradient Problem',
    brief:
      'Strong negative gradient strips away direct-path range. Use depth changes across the layer to hold contact, and expect bottom bounce to carry further than direct path.',
    env: medSummer,
    ownCourse: 180,
    ownSpeed: 9,
    ownDepth: 350,
    contacts: [
      { name: 'W1', contactClass: 'warship', rangeYds: 21000, bearing: 160, course: 10, speed: 14, depth: 20 },
      { name: 'M1', contactClass: 'merchant', rangeYds: 17000, bearing: 220, course: 45, speed: 13, depth: 25 },
    ],
  },
  // Tutorial-bound scenarios
  {
    id: 'tut-bearing-rate',
    name: 'Tutorial: Bearings & Bearing Rate',
    brief: 'Single cooperative merchant for learning the broadband display, trackers, and bearing rate.',
    env: deepAtlantic,
    ownCourse: 0,
    ownSpeed: 10,
    ownDepth: 200,
    contacts: [
      { name: 'M1', contactClass: 'merchant', rangeYds: 18000, bearing: 45, course: 270, speed: 12, depth: 25 },
    ],
    tutorialId: 'bearing-rate',
  },
  {
    id: 'tut-ekelund',
    name: 'Tutorial: Ekelund Ranging',
    brief: 'Two-leg Ekelund range on a steady merchant.',
    env: deepAtlantic,
    ownCourse: 30,
    ownSpeed: 10,
    ownDepth: 200,
    contacts: [
      { name: 'M1', contactClass: 'merchant', rangeYds: 16000, bearing: 80, course: 300, speed: 13, depth: 25 },
    ],
    tutorialId: 'ekelund',
  },
  {
    id: 'tut-dotstack',
    name: 'Tutorial: Dot-Stack TMA',
    brief: 'Full manual TMA with the dot stack on a steady contact.',
    env: deepAtlantic,
    ownCourse: 315,
    ownSpeed: 10,
    ownDepth: 200,
    contacts: [
      { name: 'M1', contactClass: 'merchant', rangeYds: 20000, bearing: 350, course: 180, speed: 14, depth: 25 },
    ],
    tutorialId: 'dotstack',
  },
  {
    id: 'tut-towed',
    name: 'Tutorial: Towed Array & Ambiguity',
    brief: 'Stream the towed array, hold a quiet contact, and resolve the port/starboard ambiguity with a maneuver.',
    env: deepAtlantic,
    ownCourse: 90,
    ownSpeed: 7,
    ownDepth: 400,
    contacts: [
      { name: 'S1', contactClass: 'submarine', rangeYds: 9000, bearing: 30, course: 210, speed: 6, depth: 480 },
    ],
    tutorialId: 'towed',
  },
];

export function scenarioById(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown scenario ${id}`);
  return s;
}
