/**
 * Enemy pool, AI and queries. Regular enemies share one update loop with
 * per-species behaviors; minibosses, the final boss and siphon structures
 * plug in a `brain`.
 */
import Phaser from 'phaser';
import { ENEMIES, type EnemyKind } from '../../data/enemies';
import { ENEMY_SCALING as SCALE } from '../../config/gameConfig';
import { T } from '../art/atlas';
import { INV_RES, setFrame } from '../sceneUtil';
import { SpatialHash } from '../systems/SpatialHash';
import { DEPTH } from '../systems/Fx';
import { Enemy, type Brain } from './Enemy';
import type { GameScene } from '../scenes/GameScene';

const POOL_MAX = 210;
const TELE_RED = 0xff3a1a;

export interface SpawnOpts {
  elite?: boolean;
  hpMul?: number;
}

export class EnemySystem {
  list: Enemy[] = [];
  hash = new SpatialHash<Enemy>(80);
  private tmp: Enemy[] = [];
  aliveCount = 0;
  regularAlive = 0;
  seenKinds = new Set<string>();

  constructor(private gs: GameScene) {}

  private obtain(): Enemy | null {
    let e = this.list.find((q) => !q.active);
    if (!e) {
      if (this.list.length >= POOL_MAX) return null;
      e = new Enemy();
      e.shadow = this.gs.add.image(0, 0, ...T('shadow')).setDepth(DEPTH.shadow);
      e.sprite = this.gs.add.image(0, 0, ...T('e_tick_0'));
      this.list.push(e);
    }
    e.reset();
    e.active = true;
    e.sprite.setVisible(true).setAlpha(1).clearTint().setAngle(0).setFlipX(false);
    e.shadow.setVisible(true);
    return e;
  }

  /** Current HP multiplier from elapsed time + surge. */
  hpScale(): number {
    const run = this.gs.run;
    return 1 + (run.elapsed / 60) * SCALE.hpPerMinute + (run.surgeTriggered ? SCALE.surgeHpBonus : 0);
  }

  dmgScale(): number {
    return 1 + (this.gs.run.elapsed / 60) * SCALE.damagePerMinute;
  }

  spawn(kind: EnemyKind, x: number, y: number, opts: SpawnOpts = {}): Enemy | null {
    const e = this.obtain();
    if (!e) return null;
    const def = ENEMIES[kind];
    e.kind = kind;
    e.def = def;
    e.x = x;
    e.y = y;
    e.elite = !!opts.elite;
    const hpMul = this.hpScale() * (opts.hpMul ?? 1) * (e.elite ? 5 : 1);
    e.maxHp = e.hp = Math.round(def.hp * hpMul);
    e.speed = def.speed * (e.elite ? 0.9 : 1) * (0.92 + Math.random() * 0.16);
    e.radius = def.radius * (e.elite ? 1.35 : 1);
    e.contact = def.contactDamage;
    e.xp = def.xp * (e.elite ? 6 : 1);
    e.mass = e.elite ? Math.min(0.95, def.mass + 0.4) : def.mass;
    e.flying = !!def.flying;
    e.frameBase = `e_${kind}`;
    e.scaleBase = def.scale * (e.elite ? 1.35 : 1);
    e.gore = def.gore;
    e.atkCd = def.attackCooldown * (0.4 + Math.random() * 0.8);
    e.d.strafe = Math.random() < 0.5 ? -1 : 1;
    e.d.strafeT = 1 + Math.random();
    setFrame(e.sprite, `${e.frameBase}_0`);
    e.sprite.setOrigin(0.5, kind === 'metronome' ? 0.9 : 0.62);
    e.sprite.setScale(e.scaleBase * INV_RES);
    e.shadow.setScale((e.radius / 18) * INV_RES * (e.flying ? 0.7 : 1));
    if (e.elite) {
      if (!e.aura) e.aura = this.gs.add.image(0, 0, ...T('elite_aura')).setBlendMode(Phaser.BlendModes.ADD);
      e.aura.setVisible(true).setScale(((e.radius * 2.6) / 72) * INV_RES).setAlpha(0.8);
    } else if (e.aura) e.aura.setVisible(false);
    if (kind === 'metronome') {
      if (!e.extra) e.extra = this.gs.add.image(0, 0, ...T('e_pendulum'));
      e.extra.setVisible(true).setOrigin(0.5, 0.05).setScale(e.scaleBase * INV_RES);
    } else if (e.extra) e.extra.setVisible(false);
    if (kind === 'tambourine') this.gs.combat.growJingles(e, 4);
    if (e.markIcon) e.markIcon.setVisible(false);
    this.aliveCount++;
    this.regularAlive++;
    if (!this.seenKinds.has(kind)) {
      this.seenKinds.add(kind);
      this.gs.onFirstSight(kind, e);
    }
    return e;
  }

  /** Bosses and structures: fully custom via brain. */
  spawnCustom(frame: string, x: number, y: number, hp: number, radius: number, brain: Brain, opts: { kind?: 'boss' | 'structure'; scale?: number; originY?: number; frames?: number; contact?: number; mass?: number } = {}): Enemy | null {
    const e = this.obtain();
    if (!e) return null;
    e.kind = opts.kind ?? 'boss';
    e.def = null;
    e.x = x;
    e.y = y;
    e.maxHp = e.hp = hp;
    e.radius = radius;
    e.speed = 0;
    e.contact = opts.contact ?? 0;
    e.xp = 0;
    e.mass = opts.mass ?? 1;
    e.brain = brain;
    e.frameBase = frame;
    e.frameCount = opts.frames ?? 1;
    e.scaleBase = opts.scale ?? 1;
    e.gore = 0xff2a2a;
    e.showHp = true;
    setFrame(e.sprite, e.frameCount > 1 ? `${frame}_0` : frame);
    e.sprite.setOrigin(0.5, opts.originY ?? 0.75).setScale(e.scaleBase * INV_RES);
    e.shadow.setScale((radius / 16) * INV_RES);
    if (e.aura) e.aura.setVisible(false);
    if (e.extra) e.extra.setVisible(false);
    this.aliveCount++;
    return e;
  }

  remove(e: Enemy): void {
    if (!e.active) return;
    e.active = false;
    e.sprite.setVisible(false);
    e.shadow.setVisible(false);
    e.aura?.setVisible(false);
    e.extra?.setVisible(false);
    e.markIcon?.setVisible(false);
    if (e.tele) e.tele.alive = false;
    e.tele = null;
    this.aliveCount--;
    if (e.def) this.regularAlive--;
  }

  // ------------------------------------------------------------------ queries

  queryRadius(x: number, y: number, r: number, out: Enemy[]): Enemy[] {
    return this.hash.query(x, y, r, out);
  }

  nearest(x: number, y: number, maxR: number, filter?: (e: Enemy) => boolean): Enemy | null {
    this.hash.query(x, y, maxR, this.tmp);
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.tmp) {
      if (!e.targetable || (filter && !filter(e))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * Scored target pick: prefers enemies ahead of `angle`, and bosses/elites,
   * but never ignores something dangerous just because it is to the side.
   */
  bestTarget(x: number, y: number, angle: number, halfAngle: number, maxR: number): Enemy | null {
    this.hash.query(x, y, maxR, this.tmp);
    let best: Enemy | null = null;
    let bs = Infinity;
    for (const e of this.tmp) {
      if (!e.targetable || e.invulnerable) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      let da = Math.atan2(dy, dx) - angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      let score = Math.hypot(dx, dy);
      if (Math.abs(da) <= halfAngle) score *= 0.6;
      if (e.kind === 'boss') score *= 0.45;
      else if (e.kind === 'structure') score *= 0.3;
      else if (e.elite) score *= 0.7;
      if (score < bs) {
        bs = score;
        best = e;
      }
    }
    return best;
  }

  /** Nearest enemy inside a forward cone, else null. */
  nearestInCone(x: number, y: number, angle: number, halfAngle: number, maxR: number): Enemy | null {
    this.hash.query(x, y, maxR, this.tmp);
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.tmp) {
      if (!e.targetable) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      let da = Math.atan2(dy, dx) - angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > halfAngle) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** Direction (radians) with the most enemy weight within range, or null. */
  densestDirection(x: number, y: number, range: number): { angle: number; count: number } | null {
    this.hash.query(x, y, range, this.tmp);
    if (this.tmp.length === 0) return null;
    const bins = new Float32Array(12);
    for (const e of this.tmp) {
      if (!e.targetable) continue;
      const a = Math.atan2(e.y - y, e.x - x);
      const b = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12) % 12;
      const w = e.kind === 'boss' ? 7 : e.kind === 'structure' ? (e.invulnerable ? 0 : 8) : e.elite ? 3 : 1;
      bins[b] += w;
      bins[(b + 1) % 12] += w * 0.5;
      bins[(b + 11) % 12] += w * 0.5;
    }
    let bi = 0;
    for (let i = 1; i < 12; i++) if (bins[i] > bins[bi]) bi = i;
    if (bins[bi] <= 0) return null;
    return { angle: ((bi + 0.5) / 12) * Math.PI * 2 - Math.PI, count: bins[bi] };
  }

  /** Center of the densest cluster near (x,y) within range. */
  densestPoint(x: number, y: number, range: number, clusterR = 90): { x: number; y: number; n: number } | null {
    this.hash.query(x, y, range, this.tmp);
    const cands = this.tmp.filter((e) => e.targetable).slice(0, 40);
    let best: { x: number; y: number; n: number } | null = null;
    for (const c of cands) {
      let n = 0;
      let sx = 0;
      let sy = 0;
      for (const o of cands) {
        if ((o.x - c.x) ** 2 + (o.y - c.y) ** 2 < clusterR * clusterR) {
          const w = o.kind === 'boss' ? 7 : o.kind === 'structure' ? (o.invulnerable ? 0 : 8) : o.elite ? 3 : 1;
          n += w;
          sx += o.x * w;
          sy += o.y * w;
        }
      }
      if (n > 0 && (!best || n > best.n)) best = { x: sx / n, y: sy / n, n };
    }
    return best;
  }

  // ------------------------------------------------------------------ update

  update(dt: number): void {
    const gs = this.gs;
    const L = gs.band.leader;
    const beat = gs.beat.beat;
    this.hash.clear();
    for (const e of this.list) if (e.active) this.hash.insert(e);

    const cam = gs.cameras.main.worldView;
    for (const e of this.list) {
      if (!e.active) continue;
      // timers
      e.flashT -= dt;
      e.contactCd -= dt;
      e.staggerCd -= dt;
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slowMul = 1;
      }
      if (e.markT > 0) e.markT -= dt;

      const dx = L.x - e.x;
      const dy = L.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      let mvx = 0;
      let mvy = 0;

      if (e.stunT > 0) {
        e.stunT -= dt;
        if (e.tele) {
          e.tele.alive = false;
          e.tele = null;
        }
        if (e.state !== 'move') e.state = 'recover';
      } else if (e.brain) {
        e.brain.update(e, dt);
      } else {
        const r = this.behave(e, dt, dist, ux, uy);
        mvx = r[0];
        mvy = r[1];
      }

      // Grave's low-end field slows anything near the bassist
      const slow = e.slowMul * gs.band.lowEndSlowAt(e.x, e.y);
      const sp = e.speed * slow * (e.state === 'windup' ? 0.35 : 1);
      let vx = mvx * sp + e.kx;
      let vy = mvy * sp + e.ky;
      e.kx *= Math.pow(0.02, dt);
      e.ky *= Math.pow(0.02, dt);

      // soft separation
      if (!e.brain && (e.d.sepTick = ((e.d.sepTick ?? 0) + 1) % 2) === 0) {
        this.hash.query(e.x, e.y, e.radius + 6, this.tmp);
        for (const o of this.tmp) {
          if (o === e) continue;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const od = Math.hypot(ox, oy) || 0.01;
          const min = e.radius + o.radius;
          if (od < min) {
            const push = ((min - od) / min) * 90;
            vx += (ox / od) * push;
            vy += (oy / od) * push;
          }
        }
      }

      if (vx || vy) {
        if (e.flying || e.kind === 'boss') {
          e.x += vx * dt;
          e.y += vy * dt;
        } else {
          const p = gs.terrain.moveSimple(e.x, e.y, vx * dt * gs.terrain.speedFactor(e.x, e.y), vy * dt * gs.terrain.speedFactor(e.x, e.y));
          e.x = p[0];
          e.y = p[1];
        }
      }
      if (Math.abs(dx) > 4) e.facing = dx > 0 ? 1 : -1;

      // contact damage
      if (e.contact > 0 && e.contactCd <= 0 && dist < e.radius + 13 && e.state !== 'dive') {
        e.contactCd = 0.6;
        gs.hurtPlayer(e.contact * this.dmgScale() * (e.elite ? 1.4 : 1), e.x, e.y, 'contact:' + e.kind);
      }

      // recycle stragglers far from the band (keeps density where the action is)
      if (e.def && dist > 1300 && e.kind !== 'metronome') {
        gs.director.recycle(e);
      }

      // render
      const onScreen = e.x > cam.x - 120 && e.x < cam.right + 120 && e.y > cam.y - 160 && e.y < cam.bottom + 160;
      e.sprite.setVisible(onScreen);
      e.shadow.setVisible(onScreen);
      if (!onScreen) {
        e.aura?.setVisible(false);
        e.extra?.setVisible(false);
        continue;
      }
      if (e.frameCount > 1) {
        // animation frames step on 8th notes (musical cohesion)
        const f = Math.floor(beat * (e.kind === 'maraca' && e.state === 'windup' ? 8 : 2) + e.phase) % e.frameCount;
        const key = `${e.frameBase}_${f}`;
        if (key !== e.lastFrame) {
          e.lastFrame = key;
          setFrame(e.sprite, key);
        }
      }
      const hover = e.flying ? -14 + Math.sin(beat * Math.PI + e.phase) * 4 : 0;
      const shakeX = e.state === 'windup' ? (Math.random() - 0.5) * 3 : 0;
      e.sprite.setPosition(e.x + shakeX, e.y + hover).setDepth(e.y);
      e.sprite.setFlipX(e.facing < 0 && e.kind !== 'boss' && e.kind !== 'structure');
      e.shadow.setPosition(e.x, e.y + 2);
      if (e.flashT > 0) e.sprite.setTintFill(0xffffff);
      else if (e.stunT > 0) e.sprite.setTint(0x9a9aff);
      else if (e.markT > 0) e.sprite.setTint(0xffb0ea);
      else e.sprite.clearTint();
      if (e.aura) {
        e.aura.setVisible(e.elite);
        e.aura.setPosition(e.x, e.y - e.radius * 0.4 + hover).setDepth(e.y - 1).setRotation(beat * 0.8);
      }
      if (e.extra && e.kind === 'metronome') {
        // pendulum ticks: swings side to side, snapping on each beat
        const bf = beat % 2;
        const swing = bf < 1 ? -1 + 2 * easeTick(bf) : 1 - 2 * easeTick(bf - 1);
        e.extra.setVisible(true).setPosition(e.x, e.y - 50 * e.scaleBase).setRotation(swing * 0.55).setDepth(e.y + 1);
      }
      if (e.markT > 0) {
        if (!e.markIcon) e.markIcon = gs.add.image(0, 0, ...T('fx_mark')).setBlendMode(Phaser.BlendModes.ADD);
        e.markIcon.setVisible(true).setPosition(e.x, e.y - e.radius * 2 - 10).setDepth(DEPTH.fx).setScale(INV_RES * 0.8).setRotation(beat);
      } else e.markIcon?.setVisible(false);
    }
  }

  onBeat(beatIndex: number): void {
    for (const e of this.list) {
      if (!e.active) continue;
      if (e.brain?.onBeat && e.stunT <= 0) e.brain.onBeat(e, beatIndex);
      else if (e.kind === 'metronome' && e.stunT <= 0) this.metronomeBeat(e, beatIndex);
    }
  }

  // ------------------------------------------------------------------ behaviors

  private behave(e: Enemy, dt: number, dist: number, ux: number, uy: number): [number, number] {
    const def = e.def!;
    const gs = this.gs;
    const L = gs.band.leader;
    e.stateT += dt;
    e.atkCd -= dt;
    const pref = def.preferredRange;
    const approach = (): [number, number] => {
      if (pref <= 0) return [ux, uy];
      if (dist > pref + 20) return [ux, uy];
      if (dist < pref - 40) return [-ux * 0.6, -uy * 0.6];
      return [0, 0];
    };
    const dmg = def.projectileDamage * this.dmgScale() * (e.elite ? 1.25 : 1);
    const cdMul = e.elite ? 0.8 : 1;

    switch (def.kind) {
      case 'tick':
        return [ux, uy];

      case 'maraca': {
        if (e.state === 'move') {
          if (e.atkCd <= 0 && dist < 240) {
            e.state = 'windup';
            e.stateT = 0;
            e.d.aim = Math.atan2(L.y - e.y, L.x - e.x);
            e.tele = gs.tele.add({ kind: 'cone', x: e.x, y: e.y, r: 110, angle: e.d.aim, width: 0.4, dur: def.telegraph, color: TELE_RED, owner: e });
            gs.audio('rattle', { volume: 0.25, rate: 0.9 + Math.random() * 0.3 });
          }
          return approach();
        }
        if (e.state === 'windup') {
          if (e.tele) {
            e.tele.x = e.x;
            e.tele.y = e.y;
          }
          if (e.stateT >= def.telegraph) {
            const n = e.elite ? 5 : 3;
            for (let i = 0; i < n; i++) {
              const a = e.d.aim + (i - (n - 1) / 2) * 0.2;
              gs.shots.fireEnemy('p_seed', e.x, e.y - 10, a, 190 + Math.random() * 20, dmg, { life: 1.6 });
            }
            gs.audio('enemyShot', { volume: 0.25 });
            e.state = 'recover';
            e.stateT = 0;
            e.atkCd = def.attackCooldown * cdMul;
            e.tele = null;
          }
          return [0, 0];
        }
        if (e.stateT > 0.4) e.state = 'move';
        return approach();
      }

      case 'castanet': {
        e.d.strafeT -= dt;
        if (e.d.strafeT <= 0) {
          e.d.strafe *= -1;
          e.d.strafeT = 1.2 + Math.random() * 0.8;
        }
        let mv = approach();
        if (dist < pref + 60) {
          // scuttle sideways
          mv = [mv[0] + -uy * e.d.strafe * 1.6, mv[1] + ux * e.d.strafe * 1.6];
        }
        if (e.state === 'move' && e.atkCd <= 0 && dist < 300) {
          e.state = 'windup';
          e.stateT = 0;
          e.d.aim = Math.atan2(L.y - e.y, L.x - e.x);
          e.tele = gs.tele.add({ kind: 'line', x: e.x, y: e.y, r: 200, angle: e.d.aim, width: 14, dur: def.telegraph, color: TELE_RED, owner: e });
          e.d.shots = 0;
        }
        if (e.state === 'windup') {
          if (e.tele) {
            e.tele.x = e.x;
            e.tele.y = e.y;
          }
          if (e.stateT >= def.telegraph) {
            e.state = 'attack';
            e.stateT = 0;
            e.tele = null;
          }
          return [0, 0];
        }
        if (e.state === 'attack') {
          if (e.stateT >= e.d.shots * 0.16) {
            const a = e.d.aim;
            for (const off of [-9, 9]) {
              gs.shots.fireEnemy('p_orb', e.x + -Math.sin(a) * off, e.y - 8 + Math.cos(a) * off, a, 270, dmg, { life: 1.5 });
            }
            gs.audio('tick', { volume: 0.35, rate: 1.3 });
            e.d.shots++;
            if (e.d.shots >= (e.elite ? 3 : 2)) {
              e.state = 'recover';
              e.stateT = 0;
              e.atkCd = def.attackCooldown * cdMul;
            }
          }
          return [0, 0];
        }
        if (e.state === 'recover' && e.stateT > 0.3) e.state = 'move';
        return mv;
      }

      case 'tambourine': {
        e.d.regrow = (e.d.regrow ?? 0) - dt;
        if (e.d.jingles < 4 && e.d.regrow <= 0 && e.state === 'move') {
          gs.combat.growJingles(e, 1);
          e.d.regrow = 0.6;
        }
        if (e.state === 'move' && e.atkCd <= 0 && dist < 260 && e.d.jingles >= 3) {
          e.state = 'windup';
          e.stateT = 0;
          e.tele = gs.tele.add({ kind: 'ring', x: e.x, y: e.y, r: 120, inner: 40, dur: def.telegraph, color: TELE_RED, owner: e });
          gs.audio('rattle', { volume: 0.3, rate: 1.4 });
          gs.combat.spinJingles(e, 9);
        }
        if (e.state === 'windup') {
          if (e.tele) {
            e.tele.x = e.x;
            e.tele.y = e.y;
          }
          if (e.stateT >= def.telegraph) {
            gs.combat.launchJingles(e, 170, dmg);
            e.state = 'recover';
            e.stateT = 0;
            e.atkCd = def.attackCooldown * cdMul;
            e.d.regrow = 1.6;
            e.tele = null;
          }
          return [0, 0];
        }
        if (e.state === 'recover' && e.stateT > 0.5) e.state = 'move';
        // rolls: slight wobble
        const w = Math.sin(e.stateT * 3 + e.phase) * 0.4;
        const mv = approach();
        return [mv[0] - uy * w, mv[1] + ux * w];
      }

      case 'mantis': {
        if (e.state === 'move') {
          // circle the band at hover range
          const tang = e.d.strafe;
          let mx = -uy * tang * 0.9;
          let my = ux * tang * 0.9;
          if (dist > pref + 30) {
            mx += ux;
            my += uy;
          } else if (dist < pref - 30) {
            mx -= ux;
            my -= uy;
          }
          if (e.atkCd <= 0 && dist < 330) {
            e.state = 'windup';
            e.stateT = 0;
            const tx = L.x + ux * 40;
            const ty = L.y + uy * 40;
            e.d.tx = tx;
            e.d.ty = ty;
            e.d.aim = Math.atan2(ty - e.y, tx - e.x);
            e.d.len = Math.hypot(tx - e.x, ty - e.y) + 30;
            e.tele = gs.tele.add({ kind: 'line', x: e.x, y: e.y, r: e.d.len, angle: e.d.aim, width: 20, dur: def.telegraph, color: TELE_RED, owner: e });
            gs.tele.add({ kind: 'circle', x: tx, y: ty, r: 64, dur: def.telegraph + 0.25, color: TELE_RED });
          }
          return [mx, my];
        }
        if (e.state === 'windup') {
          if (e.stateT >= def.telegraph) {
            e.state = 'dive';
            e.stateT = 0;
            e.tele = null;
            gs.audio('graze', { volume: 0.4, rate: 0.7 });
          }
          return [0, 0];
        }
        if (e.state === 'dive') {
          const step = 560 * dt;
          const rem = Math.hypot(e.d.tx - e.x, e.d.ty - e.y);
          if (rem <= step) {
            e.x = e.d.tx;
            e.y = e.d.ty;
            // cymbal clap shockwave
            gs.fx.ring(e.x, e.y, 0xffcf3a, 10, 75, 0.3, 'fx_ring_thick');
            gs.audio('crash', { volume: 0.35, rate: 1.4 });
            if (Math.hypot(L.x - e.x, L.y - e.y) < 64 + 8) gs.hurtPlayer(dmg * 0.75, e.x, e.y, 'mantis:clap');
            e.state = 'recover';
            e.stateT = 0;
            e.atkCd = def.attackCooldown * cdMul;
          } else {
            e.x += Math.cos(e.d.aim) * step;
            e.y += Math.sin(e.d.aim) * step;
          }
          return [0, 0];
        }
        if (e.stateT > 0.6) e.state = 'move';
        return [0, 0];
      }

      case 'tuba': {
        if (e.state === 'move') {
          if (e.atkCd <= 0 && dist < 250) {
            e.state = 'windup';
            e.stateT = 0;
            e.d.aim = Math.atan2(L.y - e.y, L.x - e.x);
            e.tele = gs.tele.add({ kind: 'cone', x: e.x, y: e.y, r: 240, angle: e.d.aim, width: 0.5, dur: def.telegraph, color: TELE_RED, owner: e });
            gs.audio('brass', { volume: 0.25, rate: 0.7 });
          }
          return approach();
        }
        if (e.state === 'windup') {
          // inhale: pull particles in
          if (Math.random() < 0.5) gs.fx.sparks(e.x + Math.cos(e.d.aim) * 120, e.y + Math.sin(e.d.aim) * 120, 0xffcf3a, 1);
          if (e.stateT >= def.telegraph) {
            gs.audio('brass', { volume: 0.55 });
            gs.fx.shake(0.004, 150);
            // cone blast hits instantly + visual note spray
            const la = Math.atan2(L.y - e.y, L.x - e.x);
            let da = la - e.d.aim;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            if (dist < 240 && Math.abs(da) < 0.5) {
              gs.hurtPlayer(dmg, e.x, e.y, 'tuba:blast');
              gs.band.shove(Math.cos(e.d.aim) * 170, Math.sin(e.d.aim) * 170);
            }
            for (let i = 0; i < 7; i++) {
              const a = e.d.aim + (i - 3) * 0.14;
              gs.shots.fireEnemy('p_note', e.x, e.y - 10, a, 230, dmg * 0.5, { life: 1.0 });
            }
            e.state = 'recover';
            e.stateT = 0;
            e.atkCd = def.attackCooldown * cdMul;
            e.tele = null;
          }
          return [0, 0];
        }
        if (e.stateT > 1.0) e.state = 'move';
        return [0, 0];
      }

      case 'metronome':
        return approach();
    }
    return [0, 0];
  }

  private metronomeBeat(e: Enemy, beatIndex: number): void {
    const gs = this.gs;
    const L = gs.band.leader;
    const dist = Math.hypot(L.x - e.x, L.y - e.y);
    if (dist > 430) return;
    const inBar = ((beatIndex % 4) + 4) % 4;
    gs.audio('tick', { volume: 0.18, rate: inBar === 0 ? 1 : 1.5 });
    if (inBar === 3) {
      // warn one beat ahead: the ring fires exactly on the downbeat
      e.tele = gs.tele.add({ kind: 'ring', x: e.x, y: e.y - 30, r: 70, inner: 30, dur: 0.46875, color: 0x8a7cff, owner: e });
      e.flashT = 0.08;
    }
    if (inBar === 0) {
      const n = e.elite ? 12 : 8;
      const off = (beatIndex / 4) % 2 ? Math.PI / n : 0;
      const dmg = (e.def?.projectileDamage ?? 8) * this.dmgScale();
      for (let i = 0; i < n; i++) gs.shots.fireEnemy('p_shard', e.x, e.y - 30, off + (i / n) * Math.PI * 2, 135, dmg, { life: 3 });
      gs.fx.ring(e.x, e.y - 30, 0x8a7cff, 8, 60, 0.25);
      e.tele = null;
    }
  }
}

function easeTick(t: number): number {
  // fast snap early in the beat, then settle (a visible "tick")
  return 1 - Math.pow(1 - Math.min(1, t * 1.6), 3);
}
