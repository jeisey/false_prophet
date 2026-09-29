/**
 * The handcrafted island. All coordinates are world units (1 unit = 1 logical
 * pixel at zoom 1). The map is compact: every region is reachable in well
 * under a minute of running, and routes are guided by trails, compass signals
 * and landmarks. Challenge comes from combat + the clock, not navigation.
 */
import type { EnemyKind, MinibossKind } from './enemies';

export type Vec = [number, number];

/** Global position scale for the handcrafted layout (tunes travel time). */
export const MAP_SCALE_K = 1.55;
const K = MAP_SCALE_K;
const P = (v: number) => Math.round(v * K);
const PV = (pts: Vec[]): Vec[] => pts.map(([x, y]) => [P(x), P(y)] as Vec);

export const WORLD = { width: P(3600), height: P(5600) };
/** Collision/terrain grid resolution (units per cell). */
export const CELL = 16;

export type RegionId = 'beach' | 'rattlewood' | 'brassmire' | 'ridge' | 'crater' | 'spire';

export interface RegionDef {
  id: RegionId;
  name: string;
  /** Painted ground colors [base, highlight]. */
  ground: [string, string];
  poly: Vec[];
  /** Enemy mix weights while the band is in this region. */
  mix: Partial<Record<EnemyKind, number>>;
  decor: { kind: string; density: number }[];
}

export const ISLAND_OUTLINE: Vec[] = PV([
  [1800, 180], [2300, 230], [2800, 420], [3200, 760], [3420, 1250], [3450, 1800], [3380, 2400], [3450, 2950],
  [3400, 3600], [3250, 4200], [3000, 4650], [2700, 5000], [2350, 5300], [1900, 5430], [1450, 5360], [1050, 5150],
  [750, 4800], [450, 4350], [250, 3800], [200, 3200], [250, 2600], [180, 2000], [260, 1400], [500, 900], [900, 500],
  [1350, 260],
]);

export const REGIONS: RegionDef[] = [
  {
    id: 'crater',
    name: 'THE SILENT CRATER',
    ground: ['#1d1a22', '#2c2735'],
    poly: PV([[1250, 300], [2300, 200], [3250, 700], [3480, 1800], [3450, 2780], [1900, 2780], [1450, 2300], [1350, 1300]]),
    mix: { metronome: 2, mantis: 2, tambourine: 2, castanet: 2, tuba: 0.6, tick: 4, maraca: 3 },
    decor: [{ kind: 'obelisk', density: 0.5 }, { kind: 'ashrock', density: 1.2 }, { kind: 'cable', density: 0.6 }, { kind: 'bones', density: 0.3 }],
  },
  {
    id: 'ridge',
    name: 'FEEDBACK RIDGE',
    ground: ['#17161f', '#262334'],
    poly: PV([[150, 1000], [650, 520], [1300, 330], [1400, 1300], [1480, 2300], [1850, 2800], [150, 2800]]),
    mix: { metronome: 3, mantis: 4, tick: 4, maraca: 2, castanet: 2 },
    decor: [{ kind: 'crystal', density: 1.3 }, { kind: 'spike', density: 1.6 }, { kind: 'fork', density: 0.4 }],
  },
  {
    id: 'rattlewood',
    name: 'RATTLEWOOD',
    ground: ['#121a14', '#1d2a1f'],
    poly: PV([[150, 2780], [1850, 2780], [1760, 3300], [1700, 4500], [1150, 4620], [700, 4550], [150, 3900]]),
    mix: { maraca: 6, tick: 6, tambourine: 3, mantis: 1 },
    decor: [{ kind: 'palm', density: 1.2 }, { kind: 'fern', density: 2.4 }, { kind: 'drumtree', density: 0.6 }, { kind: 'pod', density: 0.8 }],
  },
  {
    id: 'brassmire',
    name: 'BRASSMIRE',
    ground: ['#171a12', '#262a18'],
    poly: PV([[1850, 2780], [3480, 2780], [3450, 3700], [3250, 4350], [2750, 4600], [2000, 4520], [1880, 3300]]),
    mix: { tuba: 1.4, castanet: 4, tick: 5, maraca: 3, tambourine: 2 },
    decor: [{ kind: 'horn', density: 1.0 }, { kind: 'reed', density: 2.0 }, { kind: 'pipe', density: 0.5 }, { kind: 'palm', density: 0.4 }],
  },
  {
    id: 'beach',
    name: 'CRASH BEACH',
    ground: ['#2a221d', '#3b2f26'],
    poly: PV([[700, 4500], [1150, 4600], [1700, 4480], [2000, 4500], [2750, 4580], [3100, 4600], [2500, 5500], [1300, 5500], [600, 4900]]),
    mix: { tick: 6, maraca: 4, castanet: 1 },
    decor: [{ kind: 'debris', density: 1.2 }, { kind: 'luggage', density: 0.9 }, { kind: 'amp', density: 0.4 }, { kind: 'palm', density: 0.5 }, { kind: 'barrel', density: 0.35 }],
  },
];

/** The Resonance Spire: final arena inside the Silent Crater. */
export const SPIRE = {
  x: P(1950),
  y: P(1260),
  /** Silence barrier ring radius (blocked until the full band assembles). */
  barrierRadius: 540,
  barrierThickness: 44,
  /** Opening in the barrier (radians, centered on "south"). */
  gateAngle: Math.PI / 2,
  gateHalfWidth: 0.34,
  portal: { x: P(1950), y: P(560) },
};

export const START = { x: P(1800), y: P(4990) };

export interface SiteDef {
  id: 'A' | 'B' | 'C' | 'D';
  region: RegionId;
  x: number;
  y: number;
  miniboss: MinibossKind;
  /** Number of rescues required before this signal appears. */
  unlockAfter: number;
}

export const SITES: SiteDef[] = [
  { id: 'A', region: 'rattlewood', x: P(760), y: P(3500), miniboss: 'maracon', unlockAfter: 0 },
  { id: 'B', region: 'brassmire', x: P(2840), y: P(3440), miniboss: 'belcher', unlockAfter: 0 },
  { id: 'C', region: 'ridge', x: P(720), y: P(1620), miniboss: 'percussionist', unlockAfter: 1 },
  { id: 'D', region: 'crater', x: P(2900), y: P(1800), miniboss: 'warden', unlockAfter: 2 },
];

/** Impassable rock walls: polylines with thickness. */
export const CLIFFS: { pts: Vec[]; w: number }[] = [
  // The Spine — splits Rattlewood from Brassmire (two passes).
  { pts: PV([[1800, 2860], [1830, 3120]]), w: 110 },
  { pts: PV([[1840, 3400], [1790, 3700], [1770, 3960]]), w: 120 },
  { pts: PV([[1780, 4190], [1800, 4380]]), w: 100 },
  // Ridge escarpment above Rattlewood (pass near x=900).
  { pts: PV([[260, 2740], [620, 2700], [760, 2720]]), w: 90 },
  { pts: PV([[1060, 2730], [1350, 2690], [1560, 2560]]), w: 90 },
  // Brassmire north shelf (pass near x=2950).
  { pts: PV([[2100, 2700], [2500, 2740], [2760, 2720]]), w: 80 },
  { pts: PV([[3150, 2720], [3400, 2760]]), w: 80 },
  // Feedback ridge spines
  { pts: PV([[420, 1150], [640, 1080]]), w: 70 },
  { pts: PV([[1120, 1900], [1240, 2150]]), w: 80 },
  { pts: PV([[380, 2200], [560, 2320]]), w: 70 },
];

/** Deep water (impassable) and bog (slows). Ellipses. */
export const WATER: { x: number; y: number; rx: number; ry: number; kind: 'deep' | 'bog' }[] = [
  { x: P(1830), y: P(4460), rx: P(150), ry: P(70), kind: 'deep' },
  { x: P(2550), y: P(3700), rx: P(170), ry: P(110), kind: 'bog' },
  { x: P(3050), y: P(3150), rx: P(150), ry: P(120), kind: 'bog' },
  { x: P(2300), y: P(3150), rx: P(130), ry: P(90), kind: 'bog' },
  { x: P(3000), y: P(4000), rx: P(130), ry: P(100), kind: 'bog' },
  { x: P(2250), y: P(4150), rx: P(110), ry: P(70), kind: 'bog' },
];

/** Solid props stamped into the collision grid. */
export const SOLIDS: { x: number; y: number; r: number }[] = [
  // Plane fuselage (drawn as a landmark), wing
  { x: P(1480), y: P(4870), r: 60 }, { x: P(1560), y: P(4820), r: 60 }, { x: P(1400), y: P(4920), r: 55 }, { x: P(1330), y: P(4970), r: 45 },
  { x: P(2140), y: P(4930), r: 40 },
];

/** Trails painted on the ground to guide routes. */
export const TRAILS: Vec[][] = ([
  [[1800, 5000], [1800, 4700], [1700, 4600], [1400, 4400], [1150, 4150], [950, 3850], [800, 3560]],
  [[1800, 4700], [1950, 4600], [2250, 4420], [2550, 4150], [2750, 3800], [2830, 3500]],
  [[800, 3440], [850, 3100], [900, 2860], [920, 2640], [820, 2300], [740, 1950], [720, 1680]],
  [[2840, 3380], [2900, 3050], [2960, 2860], [2950, 2600], [2900, 2250], [2900, 1860]],
  [[1150, 3280], [1500, 3260], [1830, 3260], [2150, 3260], [2600, 3330]],
  [[780, 1600], [1100, 1680], [1500, 1860], [1950, 1880]],
  [[2850, 1820], [2500, 1900], [2150, 1880], [1950, 1850]],
  [[1150, 4100], [1450, 4070], [1860, 4070], [2250, 4100]],
] as Vec[][]).map(PV);

/** Breakable road cases (contain an upgrade or supplies). */
export const ROAD_CASES: Vec[] = PV([
  [1560, 4680], [520, 4100], [1250, 3020], [2480, 3000], [3180, 4050], [420, 2280], [1300, 1500], [3150, 2350],
  [2350, 2250], [1030, 900],
]);

export interface SignDef {
  x: number;
  y: number;
  text: string;
  style: 'region' | 'alien' | 'note';
}

export const SIGNS: SignDef[] = [
  { x: P(1180), y: P(4280), text: 'RATTLEWOOD', style: 'region' },
  { x: P(2400), y: P(4300), text: 'BRASSMIRE', style: 'region' },
  { x: P(900), y: P(2820), text: 'FEEDBACK RIDGE', style: 'region' },
  { x: P(2950), y: P(2560), text: 'THE SILENT CRATER', style: 'region' },
  { x: P(2080), y: P(5150), text: 'A skeleton clutching a kazoo. Alien glyph: “RANK: NEGLIGIBLE. RELEASED.”', style: 'note' },
  { x: P(1950), y: P(1940), text: 'HARVEST STATION 7 — MINIMUM RESONANCE: SOVEREIGN', style: 'alien' },
  { x: P(1500), y: P(3330), text: 'Glyph plaque: “ALL LIFE IS A NOTE. WE COLLECT THE LOUD ONES.”', style: 'alien' },
];

/** Radius of the cleared pad around each siphon site. */
export const SIPHON_PAD_RADIUS = 260;
