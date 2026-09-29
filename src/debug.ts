/**
 * Test hooks (enabled with ?debug) and a simple autopilot (?autopilot) used
 * by the automated browser tests to play a run end-to-end.
 * Neither is active in normal play.
 */
import { App } from './app';
import { BAND, MEMBER_ORDER, type MemberId } from './data/band';
import { STEM_IDS } from './config/audioConfig';
import { UPGRADE_IDS, type UpgradeId } from './data/upgrades';
import { startRun } from './flow';
import { SPIRE, WORLD } from './data/island';
import type { GameScene } from './game/scenes/GameScene';

function game(): GameScene | null {
  const g = App.game?.scene.getScene('game') as GameScene | null;
  return g && App.game.scene.isActive('game') ? g : null;
}

export function installDebugHooks(): void {
  const api = {
    startRun(member: MemberId = 'lead', skipIntro = true) {
      startRun(member, skipIntro);
    },
    state() {
      const g = game();
      const run = App.run;
      return {
        ui: App.ui?.current,
        scenes: App.game.scene.getScenes(true).map((s) => s.scene.key),
        started: g?.started ?? false,
        phase: run?.phase,
        clock: run?.clockText,
        timeRemaining: run?.timeRemaining,
        elapsed: run?.elapsed,
        hp: run?.hp,
        maxHp: run?.maxHp,
        level: run?.level,
        band: run?.band.slice(),
        fullBand: run?.isFullBand,
        breakdownMeter: run?.breakdownMeter,
        upgrades: run ? { ...run.upgrades } : {},
        objective: g?.objectives.text,
        spire: g?.objectives.spire,
        sites: g?.objectives.sites.map((s) => ({ id: s.def.id, member: s.member, state: s.state })),
        enemies: g?.enemies.aliveCount,
        player: g ? { x: Math.round(g.band.leader.x), y: Math.round(g.band.leader.y) } : null,
        fps: Math.round(App.game.loop.actualFps),
        updateMs: g ? Math.round(g.perfMs * 100) / 100 : null,
        prof: g ? (() => { const p = Object.fromEntries(Object.entries(g.prof).map(([k, v]) => [k, Math.round(v * 10) / 10])); g.prof = {}; return p; })() : null,
        kills: run?.stats.kills,
        dmgBy: run ? Object.fromEntries(Object.entries(run.stats.damageByMember).map(([k, v]) => [k, Math.round(v)])) : null,
      };
    },
    damage() {
      const g = game();
      if (!g) return null;
      const sums: Record<string, number> = {};
      for (const d of g.damageLog) sums[d.src] = (sums[d.src] ?? 0) + d.dmg;
      g.damageLog = [];
      return sums;
    },
    pickups() {
      const g = game();
      if (!g) return null;
      const L = g.band.leader;
      return g.pickups.list.filter((p) => p.active).map((p) => ({ k: p.kind, d: Math.round(Math.hypot(p.x - L.x, p.y - L.y)), m: p.magnet, age: Math.round(p.age * 10) / 10 }));
    },
    bosses() {
      const g = game();
      if (!g) return null;
      return g.enemies.list.filter((e) => e.active && !e.def).map((e) => ({ label: e.label, hp: Math.round(e.hp), max: e.maxHp, inv: e.invulnerable, x: Math.round(e.x), y: Math.round(e.y) }));
    },
    audio() {
      const a = App.audio;
      return {
        status: a.status,
        running: a.transportRunning,
        ctxState: a.ctx?.state ?? null,
        origin: a.origin,
        now: a.schedulerNow(),
        beat: a.getCurrentBeat(),
        bar: a.getCurrentBar(),
        audible: STEM_IDS.filter((s) => a.isStemAudible(s)),
        active: [...a.activeStems],
        suppressed: [...a.suppressedStems],
        error: a.lastError,
      };
    },
    /** Force-rescue a member through the real rescue flow (for stem tests). */
    rescue(member?: MemberId) {
      const g = game();
      if (!g || !App.run) return false;
      const id = member ?? App.run.missing[0];
      if (!id) return false;
      return g.objectives.forceRescue(id);
    },
    setTime(seconds: number) {
      if (App.run) App.run.timeRemaining = seconds;
    },
    give(id: UpgradeId) {
      App.run?.chooseUpgrade(id);
    },
    addXp(n: number) {
      App.run?.addXp(n);
    },
    heal() {
      if (App.run) App.run.hp = App.run.maxHp;
    },
    god(on = true) {
      (App as any).god = on;
    },
    teleport(x: number, y: number) {
      const g = game();
      if (!g) return;
      g.band.leader.x = x;
      g.band.leader.y = y;
      for (const m of g.band.members) {
        m.x = x + (Math.random() - 0.5) * 60;
        m.y = y + (Math.random() - 0.5) * 60;
      }
    },
    killAll() {
      const g = game();
      if (!g) return;
      for (const e of g.enemies.list) if (e.active && e.targetable && !e.invulnerable) g.combat.kill(e, null);
    },
    spirePos() {
      return { x: SPIRE.x, y: SPIRE.y };
    },
    portalPos() {
      return { ...SPIRE.portal };
    },
    killAnchors() {
      const g = game();
      if (!g) return;
      for (const e of g.enemies.list) if (e.active && e.kind === 'structure' && !e.invulnerable) g.combat.kill(e, null);
    },
    damageBoss(frac: number) {
      const g = game();
      const b = g?.objectives.boss?.boss;
      if (g && b?.active) g.combat.damageEnemy(b, b.maxHp * frac, g.band.leader.id, { noCrit: true });
    },
    breakdown() {
      const g = game();
      if (g && App.run) {
        App.run.addBreakdown(1);
        g.input2.breakdown = true;
      }
    },
    _g: () => game(),
    members: MEMBER_ORDER,
    upgrades: UPGRADE_IDS,
    names: Object.fromEntries(MEMBER_ORDER.map((m) => [m, BAND[m].name])),
  };
  (window as any).__FP__ = api;
}

// ------------------------------------------------------------------ autopilot

export class Autopilot {
  private path: [number, number][] = [];
  private pathT = 0;
  private lastX = 0;
  private lastY = 0;
  private stuckT = 0;
  private jiggle = 0;
  private jiggleA = 0;

  constructor(private gs: GameScene) {}

  steer(): { x: number; y: number; solo: boolean; breakdown: boolean } {
    const gs = this.gs;
    const L = gs.band.leader;
    const run = gs.run;
    const dt = gs.game.loop.delta / 1000;
    let vx = 0;
    let vy = 0;
    const tgt = gs.objectives.target;
    const boss = gs.objectives.spire === 'fight' ? gs.objectives.boss?.boss : null;
    const site = gs.objectives.activeSite();

    if (tgt) {
      let gx = tgt.x;
      let gy = tgt.y;
      const d = Math.hypot(gx - L.x, gy - L.y);
      const fighting = (boss && boss.active) || (site && tgt.kind === 'site' && site.state === 'guarded');
      if (site && site.state === 'release') {
        // circle the capsule inside the hold radius
        const ang = Math.atan2(L.y - gy, L.x - gx) + 0.6;
        gx += Math.cos(ang) * 110;
        gy += Math.sin(ang) * 110;
      } else if (fighting && d < 320) {
        // orbit the threat at a respectful range
        const want = boss ? 290 : 270;
        const ang = Math.atan2(L.y - gy, L.x - gx);
        const ox = gx + Math.cos(ang + 0.5) * want;
        const oy = gy + Math.sin(ang + 0.5) * want;
        gx = ox;
        gy = oy;
      }
      this.pathT -= dt;
      if (this.pathT <= 0 || this.path.length === 0) {
        this.pathT = 1.2;
        this.path = findPath(gs, L.x, L.y, gx, gy);
      }
      while (this.path.length > 1 && Math.hypot(this.path[0][0] - L.x, this.path[0][1] - L.y) < 40) this.path.shift();
      const wp = this.path[0] ?? [gx, gy];
      const wd = Math.hypot(wp[0] - L.x, wp[1] - L.y) || 1;
      if (Math.hypot(gx - L.x, gy - L.y) > 12) {
        vx += ((wp[0] - L.x) / wd) * 1.0;
        vy += ((wp[1] - L.y) / wd) * 1.0;
      }
    }
    // grab nearby resonance shards / supplies when it is safe-ish
    const hpFrac = run.hp / run.maxHp;
    let bestP: { x: number; y: number } | null = null;
    let bestD = hpFrac < 0.45 ? 400 : 230;
    for (const p of gs.pickups.list) {
      if (!p.active) continue;
      if (hpFrac < 0.45 && p.kind !== 'water' && p.kind !== 'xp') continue;
      const d = Math.hypot(p.x - L.x, p.y - L.y);
      if (d < bestD) {
        bestD = d;
        bestP = p;
      }
    }
    if (bestP) {
      const w = hpFrac < 0.45 ? 1.4 : 0.7;
      vx += ((bestP.x - L.x) / (bestD || 1)) * w;
      vy += ((bestP.y - L.y) / (bestD || 1)) * w;
    }
    // dodge: enemies, shots and telegraphs
    for (const e of gs.enemies.list) {
      if (!e.active) continue;
      const dx = L.x - e.x;
      const dy = L.y - e.y;
      const d = Math.hypot(dx, dy);
      if (!e.def) {
        const r = e.radius + 70;
        if (e.contact > 0 && d < r && d > 0) {
          vx += (dx / d) * 2.5;
          vy += (dy / d) * 2.5;
        }
        continue;
      }
      const avoidR = hpFrac < 0.35 ? 170 : 120;
      if (d < avoidR && d > 0) {
        const w = ((avoidR - d) / avoidR) * 1.6;
        vx += (dx / d) * w;
        vy += (dy / d) * w;
      }
    }
    for (const s of gs.shots.enemy) {
      if (!s.active) continue;
      const dx = L.x - s.x;
      const dy = L.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d < 90 && d > 0) {
        // step sideways relative to the shot's travel
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const px = -s.vy / sp;
        const py = s.vx / sp;
        const side = px * dx + py * dy > 0 ? 1 : -1;
        const w = ((90 - d) / 90) * 1.5;
        vx += px * side * w;
        vy += py * side * w;
      }
    }
    // stay out of telegraphed danger zones
    for (const t of gs.tele.list) {
      if (!t.alive) continue;
      const dx = L.x - t.x;
      const dy = L.y - t.y;
      const d = Math.hypot(dx, dy) || 1;
      if (t.kind === 'circle' || t.kind === 'ring') {
        if (d < t.r + 24) {
          vx += (dx / d) * 2.4;
          vy += (dy / d) * 2.4;
        }
      } else {
        const ca = Math.cos(t.angle);
        const sa = Math.sin(t.angle);
        const along = dx * ca + dy * sa;
        const perp = -dx * sa + dy * ca;
        const inside = t.kind === 'line' ? along > -10 && along < t.r + 10 && Math.abs(perp) < t.width + 20 : along > 0 && along < t.r + 20 && Math.abs(Math.atan2(perp, along)) < t.width + 0.15;
        if (inside) {
          const side = perp >= 0 ? 1 : -1;
          vx += -sa * side * 2.4;
          vy += ca * side * 2.4;
          if (t.kind === 'cone' && along < t.r * 0.6) {
            vx -= ca * 0.8;
            vy -= sa * 0.8;
          }
        }
      }
    }
    // unstick
    const moved = Math.hypot(L.x - this.lastX, L.y - this.lastY);
    this.lastX = L.x;
    this.lastY = L.y;
    if (moved < 0.5 && Math.hypot(vx, vy) > 0.3) this.stuckT += dt;
    else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 1) {
      this.jiggle = 1;
      this.jiggleA = Math.random() * Math.PI * 2;
      this.stuckT = 0;
      this.pathT = 0;
    }
    if (this.jiggle > 0) {
      this.jiggle -= dt;
      vx += Math.cos(this.jiggleA) * 1.5;
      vy += Math.sin(this.jiggleA) * 1.5;
    }
    const m = Math.hypot(vx, vy);
    if (m > 1) {
      vx /= m;
      vy /= m;
    }
    const near = gs.enemies.nearest(L.x, L.y, 220);
    const solo = run.soloReady && !!near;
    const crowd = gs.enemies.aliveCount;
    const breakdown = run.canBreakdown && (!!boss || crowd > 25);
    return { x: vx, y: vy, solo, breakdown };
  }
}

/** Coarse BFS over the terrain grid (32-unit nodes). */
function findPath(gs: GameScene, sx: number, sy: number, tx: number, ty: number): [number, number][] {
  const S = 32;
  const t = gs.terrain;
  const cols = Math.ceil(WORLD.width / S);
  const rows = Math.ceil(WORLD.height / S);
  const idx = (c: number, r: number) => r * cols + c;
  const sc = Math.floor(sx / S);
  const sr = Math.floor(sy / S);
  let tc = Math.floor(tx / S);
  let tr = Math.floor(ty / S);
  if (!t.isWalkable(tc * S + S / 2, tr * S + S / 2)) {
    const q = t.nearestWalkable(tx, ty, 300);
    if (q) {
      tc = Math.floor(q[0] / S);
      tr = Math.floor(q[1] / S);
    }
  }
  const prev = new Int32Array(cols * rows).fill(-1);
  const queue = new Int32Array(cols * rows);
  let qh = 0;
  let qt = 0;
  const start = idx(sc, sr);
  prev[start] = start;
  queue[qt++] = start;
  const goal = idx(tc, tr);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false;
  let steps = 0;
  while (qh < qt && steps < 40000) {
    steps++;
    const cur = queue[qh++];
    if (cur === goal) {
      found = true;
      break;
    }
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = idx(nc, nr);
      if (prev[ni] !== -1) continue;
      if (!t.isWalkable(nc * S + S / 2, nr * S + S / 2)) continue;
      prev[ni] = cur;
      queue[qt++] = ni;
    }
  }
  if (!found) return [[tx, ty]];
  const path: [number, number][] = [];
  let cur = goal;
  while (cur !== start) {
    path.push([(cur % cols) * S + S / 2, Math.floor(cur / cols) * S + S / 2]);
    cur = prev[cur];
  }
  path.reverse();
  // keep every 3rd waypoint for smoother steering
  return path.filter((_, i) => i % 3 === 2 || i === path.length - 1);
}
