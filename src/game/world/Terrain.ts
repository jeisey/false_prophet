/**
 * Terrain: collision/terrain grid + painted base map, both derived from the
 * handcrafted island data so visuals and collision always agree.
 */
import {
  CELL,
  CLIFFS,
  ISLAND_OUTLINE,
  REGIONS,
  SIPHON_PAD_RADIUS,
  SITES,
  SOLIDS,
  SPIRE,
  START,
  TRAILS,
  WATER,
  WORLD,
  MAP_SCALE_K,
  type RegionId,
  type Vec,
} from '../../data/island';

export const T_OCEAN = 0;
export const T_LAND = 1;
export const T_BOG = 2;
export const T_ROCK = 3;
export const T_DEEP = 4;
export const T_BARRIER = 5;
export const T_GATE = 6;

const REGION_IDS: RegionId[] = ['beach', 'rattlewood', 'brassmire', 'ridge', 'crater', 'spire'];

export function pointInPoly(x: number, y: number, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}

export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function distToPolyline(px: number, py: number, pts: Vec[]): number {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distToSegment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}

export class Terrain {
  readonly cols = Math.ceil(WORLD.width / CELL);
  readonly rows = Math.ceil(WORLD.height / CELL);
  readonly grid: Uint8Array;
  readonly region: Uint8Array;
  readonly trailDist: Float32Array;
  barrierClosed = true;
  gateLocked = true;

  constructor() {
    const n = this.cols * this.rows;
    this.grid = new Uint8Array(n);
    this.region = new Uint8Array(n);
    this.trailDist = new Float32Array(n);
    this.build();
  }

  private build(): void {
    const { cols, rows } = this;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        const x = cx * CELL + CELL / 2;
        const y = cy * CELL + CELL / 2;
        let tdist = Infinity;
        for (const tr of TRAILS) tdist = Math.min(tdist, distToPolyline(x, y, tr));
        this.trailDist[i] = tdist;
        if (!pointInPoly(x, y, ISLAND_OUTLINE)) {
          this.grid[i] = T_OCEAN;
          continue;
        }
        let t = T_LAND;
        for (const w of WATER) {
          const d = ((x - w.x) / w.rx) ** 2 + ((y - w.y) / w.ry) ** 2;
          if (d < 1) t = w.kind === 'deep' ? T_DEEP : T_BOG;
        }
        for (const c of CLIFFS) if (distToPolyline(x, y, c.pts) < c.w / 2) t = T_ROCK;
        for (const s of SOLIDS) if (Math.hypot(x - s.x, y - s.y) < s.r) t = T_ROCK;
        // keep site pads and the start area clear
        for (const s of SITES) if (Math.hypot(x - s.x, y - s.y) < SIPHON_PAD_RADIUS) t = T_LAND;
        if (Math.hypot(x - START.x, y - START.y) < 90) t = T_LAND;
        const dSpire = Math.hypot(x - SPIRE.x, y - SPIRE.y);
        if (Math.abs(dSpire - SPIRE.barrierRadius) < SPIRE.barrierThickness / 2) {
          const ang = Math.atan2(y - SPIRE.y, x - SPIRE.x);
          const diff = Math.abs(normAngle(ang - SPIRE.gateAngle));
          t = diff < SPIRE.gateHalfWidth ? T_GATE : T_BARRIER;
        }
        // the spire itself is solid
        if (Math.hypot(x - SPIRE.x, (y - (SPIRE.y - 70)) * 1.6) < 70) t = T_ROCK;
        this.grid[i] = t;
        this.region[i] = this.regionIndexAt(x, y);
      }
    }
  }

  private regionIndexAt(x: number, y: number): number {
    if (Math.hypot(x - SPIRE.x, y - SPIRE.y) < SPIRE.barrierRadius) return REGION_IDS.indexOf('spire');
    for (let k = REGIONS.length - 1; k >= 0; k--) {
      if (pointInPoly(x, y, REGIONS[k].poly)) return REGION_IDS.indexOf(REGIONS[k].id);
    }
    return REGION_IDS.indexOf('crater');
  }

  cellIndex(x: number, y: number): number {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return -1;
    return cy * this.cols + cx;
  }

  typeAt(x: number, y: number): number {
    const i = this.cellIndex(x, y);
    return i < 0 ? T_OCEAN : this.grid[i];
  }

  regionAt(x: number, y: number): RegionId {
    const i = this.cellIndex(x, y);
    return REGION_IDS[i < 0 ? 4 : this.region[i]];
  }

  isWalkable(x: number, y: number): boolean {
    const t = this.typeAt(x, y);
    if (t === T_LAND || t === T_BOG) return true;
    if (t === T_BARRIER) return !this.barrierClosed;
    if (t === T_GATE) return !this.barrierClosed || !this.gateLocked;
    return false;
  }

  /** 0.55 in bog, 1 elsewhere. */
  speedFactor(x: number, y: number): number {
    return this.typeAt(x, y) === T_BOG ? 0.6 : 1;
  }

  /** Move a circle with sliding collision. Returns the new position. */
  move(x: number, y: number, dx: number, dy: number, r: number): [number, number] {
    const ok = (px: number, py: number) =>
      this.isWalkable(px, py) &&
      this.isWalkable(px + r * 0.7, py) &&
      this.isWalkable(px - r * 0.7, py) &&
      this.isWalkable(px, py + r * 0.5) &&
      this.isWalkable(px, py - r * 0.5);
    const nx = x + dx;
    const ny = y + dy;
    if (ok(nx, ny)) return [nx, ny];
    if (dx !== 0 && ok(nx, y)) return [nx, y];
    if (dy !== 0 && ok(x, ny)) return [x, ny];
    if (!ok(x, y)) {
      // stuck inside something (e.g. a barrier just closed): nudge out
      const p = this.nearestWalkable(x, y, 200);
      return p ?? [x, y];
    }
    return [x, y];
  }

  /** Cheap single-point move for enemies. */
  moveSimple(x: number, y: number, dx: number, dy: number): [number, number] {
    const nx = x + dx;
    const ny = y + dy;
    if (this.isWalkable(nx, ny)) return [nx, ny];
    if (this.isWalkable(nx, y)) return [nx, y];
    if (this.isWalkable(x, ny)) return [x, ny];
    return [x, y];
  }

  nearestWalkable(x: number, y: number, maxR = 400): [number, number] | null {
    if (this.isWalkable(x, y)) return [x, y];
    for (let r = CELL; r <= maxR; r += CELL) {
      const steps = Math.max(8, Math.floor((r * Math.PI * 2) / CELL));
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (this.isWalkable(px, py)) return [px, py];
      }
    }
    return null;
  }

  /** Straight-line walkability check (coarse). */
  lineWalkable(x1: number, y1: number, x2: number, y2: number): boolean {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(d / CELL);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.isWalkable(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
  }
}

export function normAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ------------------------------------------------------------------ painting

const MAP_SCALE = 4;

export function paintBaseMap(): HTMLCanvasElement {
  const w = WORLD.width / MAP_SCALE;
  const h = WORLD.height / MAP_SCALE;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.scale(1 / MAP_SCALE, 1 / MAP_SCALE);
  const path = (pts: Vec[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
  };
  const rnd = mulberry(42);

  // ocean
  ctx.fillStyle = '#03060b';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.strokeStyle = 'rgba(47,230,255,0.05)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 260; i++) {
    const x = rnd() * WORLD.width;
    const y = rnd() * WORLD.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 40, y - 10, x + 90, y);
    ctx.stroke();
  }
  // shallows glow
  path(ISLAND_OUTLINE);
  ctx.lineWidth = 160;
  ctx.strokeStyle = 'rgba(20,90,110,0.35)';
  ctx.stroke();
  ctx.lineWidth = 70;
  ctx.strokeStyle = 'rgba(47,230,255,0.18)';
  ctx.stroke();

  // land
  ctx.save();
  path(ISLAND_OUTLINE);
  ctx.clip();
  ctx.fillStyle = '#16141a';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (const r of REGIONS) {
    ctx.save();
    ctx.shadowColor = r.ground[0];
    ctx.shadowBlur = 60;
    path(r.poly);
    ctx.fillStyle = r.ground[0];
    ctx.fill();
    ctx.restore();
    // mottled texture
    ctx.save();
    path(r.poly);
    ctx.clip();
    for (let i = 0; i < 900; i++) {
      const x = rnd() * WORLD.width;
      const y = rnd() * WORLD.height;
      ctx.fillStyle = i % 3 ? r.ground[1] : 'rgba(0,0,0,0.35)';
      ctx.globalAlpha = 0.25 + rnd() * 0.3;
      ctx.beginPath();
      ctx.ellipse(x, y, 20 + rnd() * 60, 12 + rnd() * 40, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  // beach sand toward the shore
  ctx.save();
  path(ISLAND_OUTLINE);
  ctx.lineWidth = 120;
  ctx.strokeStyle = 'rgba(70,58,46,0.55)';
  ctx.stroke();
  ctx.restore();

  // crater bowl
  const cg = ctx.createRadialGradient(SPIRE.x, SPIRE.y, 100, SPIRE.x, SPIRE.y, 900);
  cg.addColorStop(0, 'rgba(10,6,12,0.95)');
  cg.addColorStop(0.55, 'rgba(18,12,22,0.7)');
  cg.addColorStop(1, 'rgba(18,12,22,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(SPIRE.x, SPIRE.y, 900, 0, Math.PI * 2);
  ctx.fill();
  // arena floor: obsidian with rune rings
  ctx.fillStyle = '#0b080e';
  ctx.beginPath();
  ctx.arc(SPIRE.x, SPIRE.y, SPIRE.barrierRadius - 20, 0, Math.PI * 2);
  ctx.fill();
  for (const [rr, a] of [[200, 0.35], [320, 0.25], [440, 0.3]] as [number, number][]) {
    ctx.strokeStyle = `rgba(255,42,42,${a})`;
    ctx.lineWidth = 6;
    ctx.setLineDash([40, 26]);
    ctx.beginPath();
    ctx.arc(SPIRE.x, SPIRE.y + 60, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // bog + deep water
  for (const wtr of WATER) {
    ctx.save();
    ctx.translate(wtr.x, wtr.y);
    ctx.scale(1, wtr.ry / wtr.rx);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, wtr.rx);
    if (wtr.kind === 'bog') {
      g.addColorStop(0, 'rgba(70,100,18,0.95)');
      g.addColorStop(0.7, 'rgba(38,52,14,0.95)');
      g.addColorStop(1, 'rgba(30,40,14,0)');
    } else {
      g.addColorStop(0, 'rgba(4,10,18,1)');
      g.addColorStop(0.85, 'rgba(8,30,40,1)');
      g.addColorStop(1, 'rgba(47,230,255,0.2)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, wtr.rx * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // trails
  for (const tr of TRAILS) {
    ctx.beginPath();
    ctx.moveTo(tr[0][0], tr[0][1]);
    for (const [x, y] of tr.slice(1)) ctx.lineTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 86;
    ctx.strokeStyle = 'rgba(66,52,40,0.55)';
    ctx.stroke();
    ctx.lineWidth = 40;
    ctx.strokeStyle = 'rgba(96,78,58,0.4)';
    ctx.stroke();
  }

  // crash gouge on the beach
  ctx.lineWidth = 90;
  ctx.strokeStyle = 'rgba(10,8,8,0.65)';
  ctx.beginPath();
  const K = MAP_SCALE_K;
  ctx.moveTo(2250 * K, 5250 * K);
  ctx.quadraticCurveTo(1900 * K, 5050 * K, 1520 * K, 4880 * K);
  ctx.stroke();

  // cliffs: dark rock ridges with a lit edge
  for (const cl of CLIFFS) {
    ctx.beginPath();
    ctx.moveTo(cl.pts[0][0], cl.pts[0][1]);
    for (const [x, y] of cl.pts.slice(1)) ctx.lineTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = cl.w + 30;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    ctx.lineWidth = cl.w;
    ctx.strokeStyle = '#1b1822';
    ctx.stroke();
    ctx.lineWidth = cl.w * 0.35;
    ctx.strokeStyle = '#2d2838';
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(180,85,255,0.25)';
    ctx.stroke();
  }

  // siphon site pads
  for (const s of SITES) {
    ctx.fillStyle = 'rgba(12,6,10,0.85)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, SIPHON_PAD_RADIUS - 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,42,42,0.35)';
    ctx.lineWidth = 8;
    ctx.setLineDash([30, 20]);
    ctx.beginPath();
    ctx.arc(s.x, s.y, SIPHON_PAD_RADIUS - 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  return c;
}

export const BASE_MAP_SCALE = MAP_SCALE;

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
