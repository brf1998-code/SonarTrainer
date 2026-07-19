// ---------------------------------------------------------------------------
// Platform database — real-world classes, OPEN-SOURCE DATA ONLY.
// Hull/speed/depth/propulsor facts and relative quieting assessments are from
// public sources (Covert Shores/hisutton.com, Wikipedia, FAS, USNI, CRS,
// naval-technology, GlobalSecurity) — see `sources` per platform.
// ACOUSTIC NUMBERS (source levels, tonal frequencies/levels) ARE NOT PUBLIC
// for any real platform: everything acoustic here is a GAMEPLAY VALUE derived
// only from the public *relative* quieting assessments (quietingTier) and
// generic engineering relationships (blade rate = RPM x blades / 60, etc.).
// Nothing in this file encodes actual measured signatures.
// ---------------------------------------------------------------------------

import { ContactClass, Signature, Tonal } from './types';

export type Nation = 'US' | 'RU' | 'CN' | 'CIV';
export type PlatformType =
  | 'SSN'
  | 'SSGN'
  | 'SSBN'
  | 'SSK'
  | 'CG'
  | 'DD'
  | 'FFG'
  | 'MERCHANT'
  | 'FISHING';

export type Propulsion =
  | 'nuclear'
  | 'diesel-electric'
  | 'diesel-electric-aip'
  | 'gas-turbine'
  | 'codog'
  | 'codad'
  | 'diesel';

export interface Platform {
  id: string;
  name: string;
  shortName: string;
  nation: Nation;
  type: PlatformType;
  displacementTons: number;
  lengthM: number;
  maxSpeedKts: number;
  /** public estimate; null for surface ships */
  testDepthFt: number | null;
  propulsion: Propulsion;
  propulsor: {
    kind: 'screw' | 'pumpjet';
    /** publicly reported blade count, or null if not public */
    blades: number | null;
    shafts: number;
    note: string;
  };
  /** 1 (loud) .. 5 (quietest) — synthesis of PUBLIC relative assessments */
  quietingTier: number;
  quietingNote: string;
  sonarFit: string[];
  notes: string;
  sources: string[];
  /** gameplay-only: shaft turns per knot (generic training value, not real) */
  tpk: number;
}

export const PLATFORMS: Platform[] = [
  // ======================= UNITED STATES (ownship pool) ====================
  {
    id: 'la-flight1',
    name: 'Los Angeles-class Flight I (SSN-688)',
    shortName: '688 Flt I',
    nation: 'US',
    type: 'SSN',
    displacementTons: 6927,
    lengthM: 110,
    maxSpeedKts: 32,
    testDepthFt: 950,
    propulsion: 'nuclear',
    propulsor: { kind: 'screw', blades: 7, shafts: 1, note: 'Single 7-blade highly-skewed screw (publicly reported)' },
    quietingTier: 2,
    quietingNote: 'Baseline 1970s US quieting; publicly assessed louder than 688i, Seawolf, Virginia. Speed/depth are public estimates (official: 25+ kts, >800 ft).',
    sonarFit: ['AN/BQQ-5 suite (A-RCI/BQQ-10 upgrades)', 'BQS-13 bow sphere', 'conformal hull array', 'TB-16 fat-line towed'],
    notes: 'SSN-688..718; no VLS; fairwater planes.',
    sources: [
      'https://en.wikipedia.org/wiki/Los_Angeles-class_submarine',
      'https://man.fas.org/dod-101/sys/ship/ssn-688.htm',
      'https://www.armscontrolwonk.com/archive/201626/secret-screws/',
    ],
    tpk: 16,
  },
  {
    id: 'la-688i',
    name: 'Los Angeles-class Improved (688i)',
    shortName: '688i',
    nation: 'US',
    type: 'SSN',
    displacementTons: 7147,
    lengthM: 110,
    maxSpeedKts: 32,
    testDepthFt: 950,
    propulsion: 'nuclear',
    propulsor: { kind: 'screw', blades: 7, shafts: 1, note: 'Retains the 7-blade skewback screw' },
    quietingTier: 3,
    quietingNote: 'SSN-751+ publicly described as markedly quieter than Flight I/II; still louder than Seawolf/Virginia.',
    sonarFit: ['AN/BSY-1 (later BQQ-10)', 'bow sphere', 'conformal hull array', 'TB-16 + TB-23/TB-29 thin-line towed'],
    notes: 'Retractable bow planes (under-ice), 12 VLS.',
    sources: [
      'https://en.wikipedia.org/wiki/Los_Angeles-class_submarine',
      'https://man.fas.org/dod-101/sys/ship/ssn-688.htm',
      'https://www.naval-technology.com/projects/la/',
    ],
    tpk: 16,
  },
  {
    id: 'seawolf',
    name: 'Seawolf-class (SSN-21)',
    shortName: 'Seawolf',
    nation: 'US',
    type: 'SSN',
    displacementTons: 9138,
    lengthM: 108,
    maxSpeedKts: 35,
    testDepthFt: 1600,
    propulsion: 'nuclear',
    propulsor: { kind: 'pumpjet', blades: null, shafts: 1, note: 'First US SSN pumpjet; internals not public' },
    quietingTier: 5,
    quietingNote: 'Publicly cited as quieter at 20-25 kts than a 688 at pierside; benchmark for quiet-at-speed. Speed/depth are public estimates.',
    sonarFit: ['AN/BSY-2 (later BQQ-10)', 'enlarged bow sphere', 'Wide Aperture Arrays (flank)', 'TB-16 + TB-29 towed'],
    notes: '3 boats; HY-100 hull; 8 x 26.5" tubes.',
    sources: [
      'https://en.wikipedia.org/wiki/Seawolf-class_submarine',
      'https://www.hisutton.com/SSN-23.html',
      'https://www.naval-technology.com/projects/seawolf/',
    ],
    tpk: 15,
  },
  {
    id: 'virginia',
    name: 'Virginia-class (SSN-774)',
    shortName: 'Virginia',
    nation: 'US',
    type: 'SSN',
    displacementTons: 7900,
    lengthM: 115,
    maxSpeedKts: 34,
    testDepthFt: 1600,
    propulsion: 'nuclear',
    propulsor: { kind: 'pumpjet', blades: null, shafts: 1, note: 'Single-shaft pumpjet; blade config not public' },
    quietingTier: 5,
    quietingNote: 'Public statements put Virginia at or near Seawolf acoustic levels (later blocks claimed quieter). Official: 25+ kts, >800 ft.',
    sonarFit: ['AN/BQQ-10 (A-RCI)', 'LAB water-backed bow array (Blk III+)', 'LWWAA fiber-optic flank arrays', 'HF chin/sail arrays', 'TB-16 + TB-29 towed'],
    notes: 'Blk III: LAB array + Virginia Payload Tubes; Blk V adds VPM.',
    sources: [
      'https://en.wikipedia.org/wiki/Virginia-class_submarine',
      'https://www.naval-technology.com/projects/nssn/',
      'https://www.hisutton.com/SSNs.html',
    ],
    tpk: 15,
  },
  {
    id: 'ohio-ssgn',
    name: 'Ohio-class SSGN (SSGN-726)',
    shortName: 'Ohio SSGN',
    nation: 'US',
    type: 'SSGN',
    displacementTons: 18750,
    lengthM: 171,
    maxSpeedKts: 25,
    testDepthFt: 800,
    propulsion: 'nuclear',
    propulsor: { kind: 'screw', blades: 7, shafts: 1, note: 'Single shaft, 7-blade screw (publicly reported)' },
    quietingTier: 4,
    quietingNote: 'Extremely quiet at patrol speeds by design; public sources rank it among the quietest ever, below Seawolf/Virginia broadband at speed.',
    sonarFit: ['AN/BQQ-6 (later BQQ-10)', 'BQS-13 bow sphere', 'BQR-25 conformal', 'TB-16 towed'],
    notes: '154 Tomahawk max; SOF lockout chambers.',
    sources: [
      'https://en.wikipedia.org/wiki/Ohio-class_submarine',
      'https://nuke.fas.org/guide/usa/slbm/ssbn-726.htm',
      'https://www.naval-technology.com/projects/ohio/',
    ],
    tpk: 14,
  },

  // ============================== RUSSIA ===================================
  {
    id: 'kilo-877',
    name: 'Kilo-class SSK (Project 877)',
    shortName: 'Kilo 877',
    nation: 'RU',
    type: 'SSK',
    displacementTons: 3075,
    lengthM: 73,
    maxSpeedKts: 17,
    testDepthFt: 790,
    propulsion: 'diesel-electric',
    propulsor: { kind: 'screw', blades: 6, shafts: 1, note: 'Single slow-turning 6-blade screw (publicly reported)' },
    quietingTier: 4,
    quietingNote: 'Very quiet on battery ("black hole" reputation, partly myth per Covert Shores); loud discrete diesel lines when snorkeling; must snorkel regularly (no AIP).',
    sonarFit: ['MGK-400 Rubikon (Shark Gill)', 'MG-519 Arfa mine-avoidance'],
    notes: '1980s DE attack boat; anechoic tiles.',
    sources: [
      'https://en.wikipedia.org/wiki/Kilo-class_submarine',
      'https://www.hisutton.com/Kilo-Class-Submarine.html',
      'https://www.globalsecurity.org/military/world/russia/877-specs.htm',
    ],
    tpk: 12,
  },
  {
    id: 'kilo-636',
    name: 'Improved Kilo-class SSK (Project 636.3)',
    shortName: 'Kilo 636.3',
    nation: 'RU',
    type: 'SSK',
    displacementTons: 3950,
    lengthM: 74,
    maxSpeedKts: 20,
    testDepthFt: 790,
    propulsion: 'diesel-electric',
    propulsor: { kind: 'screw', blades: 7, shafts: 1, note: '7-blade skewed screw at lower shaft RPM than 877 (publicly reported)' },
    quietingTier: 5,
    quietingNote: 'Publicly assessed among the quietest diesel boats in service on battery at slow speed; improved rafting/coatings vs 877; loud when snorkeling.',
    sonarFit: ['MGK-400EM digital Rubikon', 'MG-519 Arfa'],
    notes: 'Kalibr-capable per Covert Shores.',
    sources: [
      'https://en.wikipedia.org/wiki/Kilo-class_submarine',
      'https://www.hisutton.com/Kilo-Class-Submarine.html',
      'https://www.naval-technology.com/projects/kilo877/',
    ],
    tpk: 11,
  },
  {
    id: 'akula-971',
    name: 'Akula-class SSN (Project 971)',
    shortName: 'Akula',
    nation: 'RU',
    type: 'SSN',
    displacementTons: 12770,
    lengthM: 110,
    maxSpeedKts: 33,
    testDepthFt: 1570,
    propulsion: 'nuclear',
    propulsor: { kind: 'screw', blades: 7, shafts: 1, note: '7-blade screw + retractable low-speed electric thrusters' },
    quietingTier: 3,
    quietingNote: 'First Soviet SSN broadly matching US quieting; Akula II publicly reported first Russian boat quieter than improved 688.',
    sonarFit: ['MGK-540 Skat-3 bow suite', 'flank arrays', 'towed array'],
    notes: 'OK-650B plant, ~43k shp.',
    sources: [
      'https://en.wikipedia.org/wiki/Akula-class_submarine',
      'https://www.globalsecurity.org/military/world/russia/971.htm',
    ],
    tpk: 14,
  },
  {
    id: 'oscar2-949a',
    name: 'Oscar II-class SSGN (Project 949A)',
    shortName: 'Oscar II',
    nation: 'RU',
    type: 'SSGN',
    displacementTons: 19400,
    lengthM: 155,
    maxSpeedKts: 32,
    testDepthFt: 1970,
    propulsion: 'nuclear',
    propulsor: { kind: 'screw', blades: 7, shafts: 2, note: 'RARE twin-shaft nuclear design: two 7-blade screws — distinctive two-shaft signature' },
    quietingTier: 2,
    quietingNote: 'Better than early Akula I but inferior to Akula II/4th-gen; big twin-screw twin-reactor plant = noisiest Russian nuke in this set.',
    sonarFit: ['MGK-540 Skat-3', 'flank arrays', 'towed array'],
    notes: 'Carrier-killer SSGN (Granit→Kalibr/Oniks refits).',
    sources: [
      'https://en.wikipedia.org/wiki/Oscar-class_submarine',
      'https://www.naval-technology.com/projects/oscar-submarine/',
    ],
    tpk: 13,
  },
  {
    id: 'yasen-885m',
    name: 'Yasen-M-class SSGN (Project 885M)',
    shortName: 'Yasen-M',
    nation: 'RU',
    type: 'SSGN',
    displacementTons: 13800,
    lengthM: 130,
    maxSpeedKts: 35,
    testDepthFt: 1475,
    propulsion: 'nuclear',
    propulsor: { kind: 'screw', blades: null, shafts: 1, note: 'Low-noise skewed screw (blade count not public); NOT a pumpjet per public imagery' },
    quietingTier: 5,
    quietingNote: 'Publicly assessed quietest Russian boat, approaching Western SSN quieting; natural-circulation reactor cooling at low speed cuts pump noise.',
    sonarFit: ['MGK-600 Irtysh-Amfora — first Russian spherical bow array', 'flank arrays', 'towed array'],
    notes: 'Torpedo tubes amidships; silent speed publicly claimed ~20-28 kts.',
    sources: [
      'https://en.wikipedia.org/wiki/Yasen-class_submarine',
      'https://www.hisutton.com/Pr885_Severodvinsk_Class.html',
      'https://www.rusi.org/explore-our-research/publications/rusi-defence-systems/yasen-m-and-future-russian-submarine-forces',
    ],
    tpk: 14,
  },
  {
    id: 'borei-a',
    name: 'Borei-A-class SSBN (Project 955A)',
    shortName: 'Borei-A',
    nation: 'RU',
    type: 'SSBN',
    displacementTons: 24000,
    lengthM: 170,
    maxSpeedKts: 29,
    testDepthFt: 1300,
    propulsion: 'nuclear',
    propulsor: { kind: 'pumpjet', blades: null, shafts: 1, note: 'First Russian nuclear class with pumpjet propulsion' },
    quietingTier: 4,
    quietingNote: 'Publicly claimed ~5x quieter than Akula; Western reporting notes hydraulic pump noise grows with service time.',
    sonarFit: ['MGK-600B Irtysh-Amfora-B', 'flank arrays', 'towed array'],
    notes: '16 Bulava SLBM.',
    sources: [
      'https://en.wikipedia.org/wiki/Borei-class_submarine',
      'https://www.navalnews.com/naval-news/2024/02/russia-rolled-out-the-new-ssbn-borey-a-class/',
    ],
    tpk: 13,
  },
  {
    id: 'slava-cg',
    name: 'Slava-class cruiser (Project 1164)',
    shortName: 'Slava CG',
    nation: 'RU',
    type: 'CG',
    displacementTons: 11490,
    lengthM: 186,
    maxSpeedKts: 32,
    testDepthFt: null,
    propulsion: 'gas-turbine',
    propulsor: { kind: 'screw', blades: null, shafts: 2, note: 'Twin shaft COGAG w/ exhaust-recovery steam — strong turbine + gearing tonals' },
    quietingTier: 1,
    quietingNote: 'Large Cold War gas-turbine cruiser: loud broadband, strong machinery/gearing lines, prominent twin-screw blade rate at speed.',
    sonarFit: ['MG-332 Bull Nose hull sonar', 'MF VDS'],
    notes: '16 P-500/P-1000 tubes.',
    sources: [
      'https://en.wikipedia.org/wiki/Slava-class_cruiser',
      'https://www.naval-technology.com/projects/slavaclassguidedmiss/',
    ],
    tpk: 9,
  },
  {
    id: 'udaloy-dd',
    name: 'Udaloy-class destroyer (Project 1155)',
    shortName: 'Udaloy DD',
    nation: 'RU',
    type: 'DD',
    displacementTons: 7570,
    lengthM: 163,
    maxSpeedKts: 29,
    testDepthFt: null,
    propulsion: 'gas-turbine',
    propulsor: { kind: 'screw', blades: null, shafts: 2, note: 'Twin shaft COGAG (~120k shp) — pure gas-turbine tonal character' },
    quietingTier: 1,
    quietingNote: 'ASW-optimized but still a loud twin-shaft gas-turbine combatant with clear blade-rate and turbine tonals.',
    sonarFit: ['MGK-355 Polinom (Horse Jaw bow + Horse Tail VDS)'],
    notes: 'Primary Russian ASW surface platform.',
    sources: [
      'https://en.wikipedia.org/wiki/Udaloy-class_destroyer',
      'https://www.naval-technology.com/projects/udaloy-class/',
    ],
    tpk: 9,
  },
  {
    id: 'gorshkov-ffg',
    name: 'Admiral Gorshkov-class frigate (Project 22350)',
    shortName: 'Gorshkov FFG',
    nation: 'RU',
    type: 'FFG',
    displacementTons: 5400,
    lengthM: 135,
    maxSpeedKts: 29,
    testDepthFt: null,
    propulsion: 'codog',
    propulsor: { kind: 'screw', blades: null, shafts: 2, note: 'CODAG: cruise diesels + boost gas turbines — diesel lines at cruise, turbine whine at boost' },
    quietingTier: 1,
    quietingNote: 'Modern frigate with some signature reduction, still loud vs any submarine; diesel-cruise lines are a good class discriminator.',
    sonarFit: ['Zarya-M bow sonar', 'Vinyetka LF towed array'],
    notes: 'Dual tonal character by speed regime.',
    sources: [
      'https://en.wikipedia.org/wiki/Admiral_Gorshkov-class_frigate',
      'https://www.naval-technology.com/projects/admiral-gorshkov/',
    ],
    tpk: 10,
  },

  // ============================== CHINA ====================================
  {
    id: 'yuan-039a',
    name: 'Type 039A/B/C Yuan SSK (AIP)',
    shortName: 'Yuan 039A',
    nation: 'CN',
    type: 'SSK',
    displacementTons: 3600,
    lengthM: 78,
    maxSpeedKts: 20,
    testDepthFt: 820,
    propulsion: 'diesel-electric-aip',
    propulsor: { kind: 'screw', blades: 7, shafts: 1, note: '7-blade asymmetric skewed screw (publicly reported); Stirling AIP' },
    quietingTier: 4,
    quietingNote: 'Publicly assessed very quiet on AIP/battery — among the hardest PLAN boats to detect at low speed; louder snorkeling. 039C adds stealth sail + reported towed array (Covert Shores).',
    sonarFit: ['flank arrays (039B+)', 'towed array (039C, reported)', 'anechoic coating'],
    notes: 'AIP = long fully-submerged endurance at low speed.',
    sources: [
      'https://en.wikipedia.org/wiki/Type_039A_submarine',
      'https://www.hisutton.com/Chinese-Type-039C-Yuan-Class-Submarine.html',
      'https://www.congress.gov/crs-product/RL33153',
    ],
    tpk: 12,
  },
  {
    id: 'shang-093',
    name: 'Type 093/093A Shang SSN',
    shortName: 'Shang 093A',
    nation: 'CN',
    type: 'SSN',
    displacementTons: 6675,
    lengthM: 108,
    maxSpeedKts: 30,
    testDepthFt: 1300,
    propulsion: 'nuclear',
    propulsor: { kind: 'screw', blades: null, shafts: 1, note: 'Skewed screw (blade count not public); 093B reported with pumpjet' },
    quietingTier: 2,
    quietingNote: 'Public assessments: baseline 093 ≈ Victor I/II-era noise; 093A nearer Victor III; still noisier than contemporary US/UK SSNs. Depth is an unconfirmed public guess.',
    sonarFit: ['bow sonar', 'flank arrays (reported)', 'towed array (reported)'],
    notes: '093B (Shang III) adds VLS + reported pumpjet.',
    sources: [
      'https://en.wikipedia.org/wiki/Type_093_submarine',
      'https://www.globalsecurity.org/military/world/china/type-93.htm',
      'https://www.congress.gov/crs-product/RL33153',
    ],
    tpk: 14,
  },
  {
    id: 'jin-094',
    name: 'Type 094/094A Jin SSBN',
    shortName: 'Jin 094',
    nation: 'CN',
    type: 'SSBN',
    displacementTons: 11000,
    lengthM: 137,
    maxSpeedKts: 24,
    testDepthFt: 1312,
    propulsion: 'nuclear',
    propulsor: { kind: 'screw', blades: null, shafts: 1, note: 'Conventional screw; blade count not public' },
    quietingTier: 1,
    quietingNote: '2009 ONI chart publicly assessed the 094 as noisier than late-1970s Soviet Delta III — strong LF tonals and flood-port flow noise; 094A modestly improved.',
    sonarFit: ['bow sonar', 'flank arrays (reported)'],
    notes: 'JL-2/JL-3 SLBM.',
    sources: [
      'https://en.wikipedia.org/wiki/Type_094_submarine',
      'https://www.armscontrolwonk.com/archive/202544/chinas-noisy-new-boomer/',
      'https://nuke.fas.org/guide/china/slbm/type_94.htm',
    ],
    tpk: 13,
  },
  {
    id: 'type-095',
    name: 'Type 095 (09V) SSN — PROJECTED',
    shortName: 'Type 095*',
    nation: 'CN',
    type: 'SSN',
    displacementTons: 8000,
    lengthM: 115,
    maxSpeedKts: 30,
    testDepthFt: 1300,
    propulsion: 'nuclear',
    propulsor: { kind: 'pumpjet', blades: null, shafts: 1, note: 'PROJECTED — pumpjet widely expected in open reporting; nothing confirmed' },
    quietingTier: 3,
    quietingNote: 'ALL VALUES SPECULATIVE: open reporting projects generational quieting improvement over the 093 series, possibly approaching Akula/early-Yasen levels. First hull only seen in satellite imagery.',
    sonarFit: ['(not publicly known)'],
    notes: 'Training placeholder for a modern quiet adversary SSN.',
    sources: [
      'https://www.janes.com/osint-insights/defence-news/sea/china-begins-outfitting-first-type-095-nuclear-attack-submarine',
      'https://www.congress.gov/crs-product/RL33153',
    ],
    tpk: 14,
  },
  {
    id: 'luyang-052d',
    name: 'Type 052D Luyang III destroyer',
    shortName: '052D',
    nation: 'CN',
    type: 'DD',
    displacementTons: 7500,
    lengthM: 157,
    maxSpeedKts: 30,
    testDepthFt: null,
    propulsion: 'codog',
    propulsor: { kind: 'screw', blades: null, shafts: 2, note: 'CODOG: 2 gas turbines + 2 diesels, twin shaft' },
    quietingTier: 1,
    quietingNote: 'Conventional twin-shaft CODOG combatant: diesel tonals on cruise plant, gas-turbine broadband at speed, strong cavitation.',
    sonarFit: ['SJD-9 family bow sonar (reported)', 'VDS + towed array (reported)'],
    notes: 'Backbone PLAN DDG, 25+ hulls.',
    sources: [
      'https://en.wikipedia.org/wiki/Type_052D_destroyer',
      'https://www.naval-technology.com/projects/luyang-052d-destroyers/',
    ],
    tpk: 9,
  },
  {
    id: 'renhai-055',
    name: 'Type 055 Renhai cruiser',
    shortName: '055 Renhai',
    nation: 'CN',
    type: 'CG',
    displacementTons: 12500,
    lengthM: 180,
    maxSpeedKts: 30,
    testDepthFt: null,
    propulsion: 'gas-turbine',
    propulsor: { kind: 'screw', blades: null, shafts: 2, note: 'COGAG: 4 QC-280 gas turbines, twin shaft, ~112 MW' },
    quietingTier: 1,
    quietingNote: 'Large all-gas-turbine combatant: turbine broadband + twin-screw cavitation = loud, long-range passive contact.',
    sonarFit: ['bulbous-bow sonar (assessed)', 'VDS + towed array (reported)'],
    notes: 'DDG per China, CG per US DoD.',
    sources: [
      'https://en.wikipedia.org/wiki/Type_055_destroyer',
      'https://www.usni.org/magazines/proceedings/2023/march/type-055-renhai-class-cruiser-chinas-premier-surface-combatant',
    ],
    tpk: 9,
  },
  {
    id: 'jiangkai-054a',
    name: 'Type 054A Jiangkai II frigate',
    shortName: '054A',
    nation: 'CN',
    type: 'FFG',
    displacementTons: 3963,
    lengthM: 134,
    maxSpeedKts: 27,
    testDepthFt: null,
    propulsion: 'codad',
    propulsor: { kind: 'screw', blades: null, shafts: 2, note: 'CODAD: 4 Pielstick diesels, twin shaft — strong diesel tonal families' },
    quietingTier: 2,
    quietingNote: 'All-diesel plant: distinct strong diesel lines + twin-screw broadband; slightly lower top-end broadband than GT ships.',
    sonarFit: ['MGK-335 hull sonar', 'H/SJG-206 towed array'],
    notes: 'Workhorse PLAN ASW escort.',
    sources: [
      'https://en.wikipedia.org/wiki/Type_054A_frigate',
      'https://www.naval-technology.com/projects/type-054a-jiangkai-ii-class-frigate/',
    ],
    tpk: 10,
  },

  // ============================ CIVILIAN ===================================
  {
    id: 'merchant-generic',
    name: 'Merchant (generic large motor vessel)',
    shortName: 'Merchant',
    nation: 'CIV',
    type: 'MERCHANT',
    displacementTons: 50000,
    lengthM: 250,
    maxSpeedKts: 22,
    testDepthFt: null,
    propulsion: 'diesel',
    propulsor: { kind: 'screw', blades: 5, shafts: 1, note: 'Large slow-turning single screw, direct-drive low-speed diesel' },
    quietingTier: 1,
    quietingNote: 'Loudest thing in the ocean short of seismic surveys: heavy broadband + strong blade-rate and diesel firing lines.',
    sonarFit: [],
    notes: 'Generic training signature.',
    sources: ['https://en.wikipedia.org/wiki/Merchant_ship'],
    tpk: 7.5,
  },
  {
    id: 'trawler-generic',
    name: 'Fishing trawler (generic)',
    shortName: 'Trawler',
    nation: 'CIV',
    type: 'FISHING',
    displacementTons: 800,
    lengthM: 40,
    maxSpeedKts: 12,
    testDepthFt: null,
    propulsion: 'diesel',
    propulsor: { kind: 'screw', blades: 3, shafts: 1, note: 'Small fast-turning screw, medium-speed diesel' },
    quietingTier: 1,
    quietingNote: 'Noisy little diesel; erratic courses and trawl gear noise.',
    sonarFit: [],
    notes: 'Generic training signature.',
    sources: ['https://en.wikipedia.org/wiki/Fishing_trawler'],
    tpk: 22,
  },
];

export function platformById(id: string): Platform {
  const p = PLATFORMS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown platform ${id}`);
  return p;
}

export const isSubmarineType = (t: PlatformType) => ['SSN', 'SSGN', 'SSBN', 'SSK'].includes(t);
export const isSurfaceCombatant = (t: PlatformType) => ['CG', 'DD', 'FFG'].includes(t);

export function contactClassFor(p: Platform): ContactClass {
  if (isSubmarineType(p.type)) return 'submarine';
  if (isSurfaceCombatant(p.type)) return 'warship';
  if (p.type === 'FISHING') return 'fishing';
  return 'merchant';
}

/** US ownship candidate platforms */
export const OWNSHIP_PLATFORMS = PLATFORMS.filter((p) => p.nation === 'US');

// ---------------------------------------------------------------------------
// GAMEPLAY acoustic synthesis from the public relative assessments.
// broadband SL: quieter tier => lower SL. These are training values only.
// ---------------------------------------------------------------------------

function subBroadbandSL(tier: number): number {
  return 145 - 5.5 * tier; // tier5 -> 117.5 ... tier1 -> 139.5
}

function surfaceBroadbandSL(p: Platform): number {
  const size = p.displacementTons > 10000 ? 4 : p.displacementTons > 6000 ? 2 : 0;
  return 166 + size - (p.quietingTier - 1) * 2;
}

/** electrical grid frequency by nation (publicly obvious: US 60 Hz, RU/CN 50 Hz) */
export function electricalHz(nation: Nation): number {
  return nation === 'US' ? 60 : nation === 'CIV' ? 60 : 50;
}

/**
 * Build a gameplay Signature for a platform.
 * `seed` in [0,1) adds per-hull jitter so no two contacts are identical.
 */
export function signatureForPlatform(p: Platform, seed = Math.random()): Signature {
  const j = (base: number, spread: number) => base + (seed - 0.5) * 2 * spread;
  const cls = contactClassFor(p);
  const sub = isSubmarineType(p.type);
  const elec = electricalHz(p.nation);
  const pumpjet = p.propulsor.kind === 'pumpjet';
  // pumpjet internals aren't public: use a generic 11-vane training value with
  // heavily suppressed discrete blade-rate content
  const blades = p.propulsor.blades ?? (pumpjet ? 11 : 5);

  const tonals: Tonal[] = [];
  const bb = sub ? j(subBroadbandSL(p.quietingTier), 2) : j(surfaceBroadbandSL(p), 2);

  // blade-rate family: suppressed for pumpjets (no strong discrete blade lines)
  tonals.push({
    freq: 0,
    level: bb - (pumpjet ? 16 : sub ? 8 : 12),
    label: pumpjet ? 'blade rate (pumpjet, suppressed)' : 'blade rate',
    speedScaled: true,
  });

  // electrical line — nation grid frequency; quieter boats have weaker lines
  tonals.push({ freq: elec, level: bb - (sub ? 4 : 14), label: `${elec}Hz electrical`, speedScaled: false });

  if (sub) {
    if (p.propulsion === 'nuclear') {
      // reactor coolant pump line: prominent on louder plants, nearly gone on
      // natural-circulation-capable quiet plants
      const pumpLevel = bb - (p.quietingTier >= 4 ? 14 : p.quietingTier === 3 ? 8 : 3);
      tonals.push({ freq: j(elec * 4, 8), level: pumpLevel, label: 'reactor pump', speedScaled: false });
      tonals.push({ freq: j(310, 40), level: bb - 10, label: 'turbine/gearing', speedScaled: false });
    } else {
      // diesel-electric on battery: sparse — motor + weak aux
      tonals.push({ freq: j(105, 15), level: bb - 8, label: 'main motor', speedScaled: false });
    }
  } else {
    switch (p.propulsion) {
      case 'gas-turbine':
        tonals.push({ freq: j(480, 60), level: bb - 8, label: 'GT gearing', speedScaled: false });
        tonals.push({ freq: j(1150, 120), level: bb - 14, label: 'turbine whine', speedScaled: false });
        break;
      case 'codog':
        tonals.push({ freq: j(55, 6), level: bb - 9, label: 'diesel firing (cruise)', speedScaled: false });
        tonals.push({ freq: j(480, 60), level: bb - 10, label: 'GT gearing (boost)', speedScaled: false });
        break;
      case 'codad':
        tonals.push({ freq: j(52, 5), level: bb - 6, label: 'diesel firing', speedScaled: false });
        tonals.push({ freq: j(104, 10), level: bb - 9, label: 'diesel harmonic', speedScaled: false });
        break;
      default: // merchant/trawler diesel
        tonals.push({ freq: j(50, 6), level: bb - 6, label: 'diesel firing', speedScaled: false });
        tonals.push({ freq: j(100, 12), level: bb - 9, label: 'diesel harmonic', speedScaled: false });
        tonals.push({ freq: j(300, 40), level: bb - 14, label: 'machinery', speedScaled: false });
    }
    if (p.propulsor.shafts === 2) {
      // twin-shaft: second, slightly offset blade-rate family
      tonals.push({ freq: 0, level: bb - 13, label: 'blade rate (2nd shaft)', speedScaled: true });
    }
  }

  return {
    contactClass: cls,
    broadbandSL: bb,
    slPerKnot: sub ? 1.6 : 0.7,
    referenceSpeedKts: sub ? 8 : 15,
    blades,
    turnsPerKnot: j(p.tpk, p.tpk * 0.08),
    tonals,
    pumpjet,
    dieselBoat: p.propulsion === 'diesel-electric' || p.propulsion === 'diesel-electric-aip',
    platformId: p.id,
  };
}

/** ownship self-noise adjustment (dB) from platform quieting tier */
export function selfNoiseDelta(p: Platform): number {
  return (3 - p.quietingTier) * 3; // Virginia/Seawolf -6, 688 Flt I +3
}
