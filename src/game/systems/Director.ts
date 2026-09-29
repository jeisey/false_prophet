/**
 * Spawn director: density, enemy mix and elites ramp with the clock, the
 * region, and the size of the band (louder band -> the island answers).
 * Swarm pulses and elite entrances land on bar lines.
 */
import { REGIONS } from '../../data/island';
import type { EnemyKind } from '../../data/enemies';
import { RUN_SECONDS, SPAWN } from '../../config/gameConfig';
import type { Enemy } from '../enemies/Enemy';
import type { GameScene } from '../scenes/GameScene';
import { layout } from '../Layout';

/** Minutes of elapsed run time before a species can appear. */
const UNLOCK_MIN: Record<EnemyKind, number> = {
  tick: 0,
  maraca: 0,
  castanet: 0.6,
  tambourine: 1.4,
  mantis: 2.2,
  tuba: 3.2,
  metronome: 4.5,
};

export class Director {
  private budget = 0;
  enabled = true;
  /** Scales spawn pressure (boss arena, escape). */
  pressure = 1;
  private pendingElite = false;

  constructor(private gs: GameScene) {}

  get progress(): number {
    return Math.min(1, this.gs.run.elapsed / RUN_SECONDS);
  }

  rate(): number {
    const run = this.gs.run;
    const p = this.progress;
    let r = SPAWN.rateStart + (SPAWN.rateEnd - SPAWN.rateStart) * p;
    if (run.surgeTriggered) r += SPAWN.surgeRateBonus;
    r += SPAWN.ratePerCompanion * run.companions.length;
    // a siphon fight brings its own guardians; ease off the ambient spawns
    if (this.gs.objectives.activeSite()) r *= 0.45;
    return r * this.pressure;
  }

  cap(): number {
    const p = this.progress;
    return Math.round(SPAWN.capStart + (SPAWN.capEnd - SPAWN.capStart) * p);
  }

  pickKind(): EnemyKind {
    const L = this.gs.band.leader;
    const region = this.gs.terrain.regionAt(L.x, L.y);
    const def = REGIONS.find((r) => r.id === region) ?? REGIONS[0];
    const minutes = this.gs.run.elapsed / 60;
    const entries = Object.entries(def.mix).filter(([k]) => minutes >= UNLOCK_MIN[k as EnemyKind]) as [EnemyKind, number][];
    if (entries.length === 0) return 'tick';
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of entries) {
      r -= w;
      if (r <= 0) return k;
    }
    return entries[0][0];
  }

  /** A walkable point just outside the camera view, biased ahead of travel. */
  spawnPoint(flying: boolean, biasAhead = 0.35): [number, number] | null {
    const L = this.gs.band.leader;
    const s = layout.state;
    const rx = s.W / 2 + SPAWN.ringPadding;
    const ry = s.H / 2 + SPAWN.ringPadding;
    for (let tries = 0; tries < 10; tries++) {
      let a = Math.random() * Math.PI * 2;
      if (L.moving && Math.random() < biasAhead) a = L.facing + (Math.random() - 0.5) * 1.6;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // distance to the view rectangle edge along this angle
      const t = Math.min(Math.abs(ca) > 1e-3 ? rx / Math.abs(ca) : Infinity, Math.abs(sa) > 1e-3 ? ry / Math.abs(sa) : Infinity);
      const x = L.x + ca * (t + Math.random() * 60);
      const y = L.y + sa * (t + Math.random() * 60);
      if (flying ? this.gs.terrain.typeAt(x, y) !== 0 || Math.random() < 0.3 : this.gs.terrain.isWalkable(x, y)) {
        if (!this.gs.objectives.inSealedArena(x, y)) return [x, y];
      }
    }
    return null;
  }

  update(dt: number): void {
    if (!this.enabled) return;
    const en = this.gs.enemies;
    this.budget += this.rate() * dt;
    let guard = 6;
    while (this.budget >= 1 && guard-- > 0) {
      if (en.regularAlive >= this.cap()) {
        this.budget = Math.min(this.budget, 2);
        break;
      }
      this.budget -= 1;
      const kind = this.pickKind();
      const flying = kind === 'mantis';
      const p = this.spawnPoint(flying);
      if (!p) continue;
      const p2 = this.progress;
      const eliteChance = SPAWN.eliteChanceStart + (SPAWN.eliteChanceEnd - SPAWN.eliteChanceStart) * p2 + (this.gs.run.surgeTriggered ? 0.02 : 0);
      const elite = this.pendingElite || (kind !== 'tick' && Math.random() < eliteChance);
      if (elite && !this.pendingElite) {
        // elites make their entrance on the next bar line
        this.pendingElite = true;
        this.budget += 1;
        continue;
      }
      en.spawn(kind, p[0], p[1], { elite: false });
      // packs: ticks and maracas come in groups
      if ((kind === 'tick' || kind === 'maraca') && Math.random() < 0.5) {
        const extra = kind === 'tick' ? 2 + Math.floor(Math.random() * 3) : 1;
        for (let i = 0; i < extra; i++) en.spawn(kind, p[0] + (Math.random() - 0.5) * 50, p[1] + (Math.random() - 0.5) * 50);
      }
    }
  }

  onBar(bar: number): void {
    if (!this.enabled) return;
    const gs = this.gs;
    if (this.pendingElite) {
      this.pendingElite = false;
      let kind = this.pickKind();
      if (kind === 'tick') kind = 'maraca';
      const p = this.spawnPoint(kind === 'mantis', 0.6);
      if (p) {
        const e = gs.enemies.spawn(kind, p[0], p[1], { elite: true });
        if (e) {
          gs.fx.ring(e.x, e.y, 0xffcf3a, 10, 90, 0.5, 'fx_ring_thick');
          gs.audio('crash', { volume: 0.25, rate: 0.8 });
        }
      }
    }
    // swarm pulse: a pack rolls in on the downbeat every N bars
    if (bar > 0 && bar % SPAWN.swarmEveryBars === 0 && this.gs.run.elapsed > 40) {
      const n = Math.round((6 + this.progress * 14) * this.pressure);
      const kind: EnemyKind = this.progress > 0.35 && Math.random() < 0.5 ? 'maraca' : 'tick';
      const p = this.spawnPoint(false, 0.7);
      if (!p) return;
      for (let i = 0; i < n; i++) gs.enemies.spawn(kind, p[0] + (Math.random() - 0.5) * 120, p[1] + (Math.random() - 0.5) * 120);
    }
  }

  /** Move a far-away straggler back to the edge of the action. */
  recycle(e: Enemy): void {
    const p = this.spawnPoint(e.flying, 0.8);
    if (!p) {
      if (!e.elite) this.gs.enemies.remove(e);
      return;
    }
    e.x = p[0];
    e.y = p[1];
    e.kx = e.ky = 0;
    e.state = 'move';
    if (e.tele) e.tele.alive = false;
    e.tele = null;
  }

  /** Spawn a local wave around a point (rescue sites). */
  waveAround(x: number, y: number, kinds: EnemyKind[], count: number, radius = 320): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.7 + Math.random() * 0.4);
      let px = x + Math.cos(a) * r;
      let py = y + Math.sin(a) * r;
      const kind = kinds[i % kinds.length];
      if (kind !== 'mantis' && !this.gs.terrain.isWalkable(px, py)) {
        const q = this.gs.terrain.nearestWalkable(px, py, 120);
        if (!q) continue;
        px = q[0];
        py = q[1];
      }
      this.gs.enemies.spawn(kind, px, py);
    }
  }
}
