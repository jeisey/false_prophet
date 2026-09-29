/**
 * Pooled projectiles for both sides.
 *  - Player shots: lead bolts (chain), cymbal discs (ricochet), bass orbs
 *    (detonate + pull), scream arcs (piercing crescent), solo notes.
 *  - Enemy shots: seeds, jingles (can orbit their owner), orbs, notes,
 *    shards, bubbles. All share a dark outline + hot core silhouette.
 */
import Phaser from 'phaser';
import type { MemberId } from '../../data/band';
import { BAND } from '../../data/band';
import { T } from '../art/atlas';
import { INV_RES } from '../sceneUtil';
import type { Enemy } from '../enemies/Enemy';
import { DEPTH } from '../systems/Fx';
import type { GameScene } from '../scenes/GameScene';

export type PlayerShotKind = 'bolt' | 'disc' | 'orb' | 'arc' | 'note';

export interface PlayerShot {
  active: boolean;
  kind: PlayerShotKind;
  owner: MemberId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  radius: number;
  pierce: number;
  chains: number;
  bounces: number;
  /** orb: detonation target; arc: origin */
  tx: number;
  ty: number;
  /** arc: travel distance + angular half-width */
  dist: number;
  halfAngle: number;
  maxDist: number;
  power: number;
  hit: Set<number>;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  color: number;
  scale: number;
}

export type EnemyShotKind = 'p_seed' | 'p_jingle' | 'p_orb' | 'p_note' | 'p_shard' | 'p_bubble';

export interface EnemyShot {
  active: boolean;
  kind: EnemyShotKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  accel: number;
  life: number;
  dmg: number;
  radius: number;
  grazed: boolean;
  /** weak shots can be deleted by NOISE GATE / WALL OF SOUND */
  weak: boolean;
  orbitOwner: Enemy | null;
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  spin: number;
  burstAt: number;
  sprite: Phaser.GameObjects.Image;
}

const MAX_PLAYER = 220;
const MAX_ENEMY = 360;

export class Projectiles {
  player: PlayerShot[] = [];
  enemy: EnemyShot[] = [];
  private tmp: Enemy[] = [];

  constructor(private gs: GameScene) {}

  // ------------------------------------------------------------------ player shots

  firePlayer(kind: PlayerShotKind, owner: MemberId, x: number, y: number, angle: number, speed: number, dmg: number, opts: Partial<PlayerShot> = {}): PlayerShot | null {
    let s = this.player.find((p) => !p.active);
    if (!s) {
      if (this.player.length >= MAX_PLAYER) return null;
      const sprite = this.gs.add.image(0, 0, ...T('fx_bolt')).setDepth(DEPTH.shots).setBlendMode(Phaser.BlendModes.ADD);
      const glow = this.gs.add.image(0, 0, ...T('fx_glow')).setDepth(DEPTH.shots - 1).setBlendMode(Phaser.BlendModes.ADD);
      s = {
        active: false, kind, owner, x, y, vx: 0, vy: 0, life: 0, dmg: 0, radius: 8, pierce: 0, chains: 0, bounces: 0,
        tx: 0, ty: 0, dist: 0, halfAngle: 0, maxDist: 0, power: 1, hit: new Set(), sprite, glow, color: 0xffffff, scale: 1,
      };
      this.player.push(s);
    }
    const color = BAND[owner].color;
    const frame = kind === 'bolt' ? 'fx_bolt' : kind === 'disc' ? 'fx_disc' : kind === 'orb' ? 'fx_orb' : kind === 'arc' ? 'fx_crescent' : 'fx_note';
    Object.assign(s, {
      active: true, kind, owner, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.2, dmg,
      radius: 9, pierce: 0, chains: 0, bounces: 0, tx: x, ty: y, dist: 0, halfAngle: 0.5, maxDist: 300, power: 1, color, scale: 1,
    });
    Object.assign(s, opts);
    s.hit.clear();
    s.sprite.setTexture(...T(frame)).setVisible(true).setPosition(x, y).setRotation(angle);
    s.sprite.setTint(kind === 'disc' ? 0xffffff : color).setAlpha(1);
    s.sprite.setScale(INV_RES * s.scale * (kind === 'arc' ? 1 : 1));
    s.glow.setVisible(kind !== 'arc').setPosition(x, y).setTint(color).setScale(INV_RES * 0.7 * s.scale).setAlpha(0.6);
    return s;
  }

  private killPlayer(s: PlayerShot): void {
    s.active = false;
    s.sprite.setVisible(false);
    s.glow.setVisible(false);
  }

  // ------------------------------------------------------------------ enemy shots

  fireEnemy(kind: EnemyShotKind, x: number, y: number, angle: number, speed: number, dmg: number, opts: Partial<EnemyShot> = {}): EnemyShot | null {
    let s = this.enemy.find((p) => !p.active);
    if (!s) {
      if (this.enemy.length >= MAX_ENEMY) return null;
      const sprite = this.gs.add.image(0, 0, ...T('p_seed')).setDepth(DEPTH.shots + 5);
      s = {
        active: false, kind, x, y, vx: 0, vy: 0, accel: 0, life: 0, dmg: 0, radius: 6, grazed: false, weak: true,
        orbitOwner: null, orbitAngle: 0, orbitRadius: 0, orbitSpeed: 0, spin: 0, burstAt: -1, sprite,
      };
      this.enemy.push(s);
    }
    const radius = kind === 'p_bubble' ? 10 : kind === 'p_orb' ? 8 : kind === 'p_note' ? 8 : 6;
    Object.assign(s, {
      active: true, kind, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, accel: 0, life: 5, dmg, radius,
      grazed: false, weak: true, orbitOwner: null, orbitAngle: 0, orbitRadius: 0, orbitSpeed: 0, spin: 0, burstAt: -1,
    });
    Object.assign(s, opts);
    s.sprite.setTexture(...T(kind)).setVisible(true).setPosition(x, y).setScale(INV_RES).setRotation(angle).setAlpha(1);
    return s;
  }

  killEnemyShot(s: EnemyShot, pop = true): void {
    if (!s.active) return;
    s.active = false;
    s.sprite.setVisible(false);
    if (pop) this.gs.fx.sparks(s.x, s.y, 0xff6a3a, 3);
  }

  /** Delete weak hostile shots in a radius (noise gate, wall of sound). */
  clearEnemyShots(x: number, y: number, r: number, onlyWeak = true): number {
    let n = 0;
    for (const s of this.enemy) {
      if (!s.active || (onlyWeak && !s.weak) || s.orbitOwner) continue;
      if ((s.x - x) ** 2 + (s.y - y) ** 2 < r * r) {
        this.killEnemyShot(s);
        n++;
      }
    }
    return n;
  }

  clearAllEnemyShots(): void {
    for (const s of this.enemy) if (s.active) this.killEnemyShot(s, false);
  }

  // ------------------------------------------------------------------ update

  update(dt: number): void {
    const gs = this.gs;
    const enemies = gs.enemies;
    const combat = gs.combat;

    for (const s of this.player) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        if (s.kind === 'orb') combat.orbDetonate(s);
        this.killPlayer(s);
        continue;
      }
      if (s.kind === 'arc') {
        // expanding crescent: advance its front, hit everything in the band
        const speed = Math.hypot(s.vx, s.vy);
        s.dist += speed * dt;
        const ang = Math.atan2(s.vy, s.vx);
        s.x = s.tx + Math.cos(ang) * s.dist;
        s.y = s.ty + Math.sin(ang) * s.dist;
        const width = s.dist * Math.sin(s.halfAngle) * 2;
        s.sprite.setPosition(s.x, s.y).setRotation(ang + Math.PI / 2);
        s.sprite.setScale(Math.max(0.3, width / 90) * INV_RES * 1.05, INV_RES * (0.9 + s.scale * 0.2));
        s.sprite.setAlpha(Math.min(1, (s.maxDist - s.dist) / 60));
        enemies.queryRadius(s.tx, s.ty, s.dist + 16, this.tmp);
        for (const e of this.tmp) {
          if (s.hit.has(e.id) || !e.targetable) continue;
          const dx = e.x - s.tx;
          const dy = e.y - s.ty;
          const d = Math.hypot(dx, dy);
          if (d < s.dist - 26 - e.radius) continue;
          let da = Math.atan2(dy, dx) - ang;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) > s.halfAngle + e.radius / Math.max(40, d)) continue;
          s.hit.add(e.id);
          combat.damageEnemy(e, s.dmg, s.owner, { kx: dx / (d || 1), ky: dy / (d || 1), knock: 60, vocal: s.owner === 'vocals' });
        }
        if (s.dist >= s.maxDist) this.killPlayer(s);
        continue;
      }

      if (s.kind === 'orb') {
        const dx = s.tx - s.x;
        const dy = s.ty - s.y;
        const d = Math.hypot(dx, dy);
        const step = Math.hypot(s.vx, s.vy) * dt;
        s.sprite.rotation += dt * 8;
        if (d <= step + 2) {
          s.x = s.tx;
          s.y = s.ty;
          combat.orbDetonate(s);
          this.killPlayer(s);
          continue;
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.sprite.setPosition(s.x, s.y);
      s.glow.setPosition(s.x, s.y);
      if (s.kind === 'disc') s.sprite.rotation += dt * 20;

      // collision
      enemies.queryRadius(s.x, s.y, s.radius, this.tmp);
      for (const e of this.tmp) {
        if (!s.active) break;
        if (s.hit.has(e.id) || !e.targetable) continue;
        s.hit.add(e.id);
        const d = Math.hypot(s.vx, s.vy) || 1;
        if (s.kind === 'orb') {
          combat.orbDetonate(s);
          this.killPlayer(s);
          break;
        }
        combat.damageEnemy(e, s.dmg, s.owner, { kx: s.vx / d, ky: s.vy / d, knock: s.kind === 'disc' ? 90 : 40 });
        if (s.kind === 'bolt' && s.chains > 0) combat.chainLightning(e, s.chains, s.dmg * 0.7, s.owner, s.hit);
        if (s.kind === 'disc' && s.bounces > 0) {
          s.bounces--;
          const next = enemies.nearest(s.x, s.y, 220, (o) => !s.hit.has(o.id) && o.targetable);
          if (next) {
            const a = Math.atan2(next.y - s.y, next.x - s.x);
            s.vx = Math.cos(a) * d;
            s.vy = Math.sin(a) * d;
            s.life = Math.max(s.life, 0.6);
            gs.audio('snare', { volume: 0.12, rate: 1.6 });
            continue;
          }
        }
        if (s.pierce > 0) {
          s.pierce--;
          continue;
        }
        this.killPlayer(s);
      }
    }

    // enemy shots vs the leader
    const L = gs.band.leader;
    const lr = 12;
    for (const s of this.enemy) {
      if (!s.active) continue;
      if (s.orbitOwner) {
        const o = s.orbitOwner;
        if (!o.active) {
          this.killEnemyShot(s);
          continue;
        }
        s.orbitAngle += s.orbitSpeed * dt;
        s.x = o.x + Math.cos(s.orbitAngle) * s.orbitRadius;
        s.y = o.y + Math.sin(s.orbitAngle) * s.orbitRadius;
      } else {
        s.life -= dt;
        if (s.life <= 0) {
          this.killEnemyShot(s, false);
          continue;
        }
        if (s.accel) {
          const sp = Math.hypot(s.vx, s.vy) || 1;
          const ns = Math.max(20, sp + s.accel * dt);
          s.vx = (s.vx / sp) * ns;
          s.vy = (s.vy / sp) * ns;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.burstAt >= 0 && s.life <= s.burstAt) {
          // brass bubble bursts into a ring of seeds
          for (let k = 0; k < 6; k++) this.fireEnemy('p_seed', s.x, s.y, (k / 6) * Math.PI * 2 + s.spin, 130, s.dmg * 0.7);
          this.gs.fx.ring(s.x, s.y, 0xffcf3a, 4, 40, 0.3);
          this.killEnemyShot(s, false);
          continue;
        }
      }
      s.sprite.setPosition(s.x, s.y);
      if (s.kind === 'p_jingle' || s.kind === 'p_shard') s.sprite.rotation += dt * 10;
      const dx = s.x - L.x;
      const dy = s.y - (L.y - 14);
      const d2 = dx * dx + dy * dy;
      const hitR = s.radius + lr;
      if (d2 < hitR * hitR) {
        if (gs.hurtPlayer(s.dmg, s.x, s.y, s.kind)) this.killEnemyShot(s);
        else if (!s.orbitOwner) this.killEnemyShot(s);
      } else if (!s.grazed && d2 < (hitR + 22) * (hitR + 22)) {
        s.grazed = true;
        gs.onGraze(s.x, s.y);
      }
      // off-screen cull
      if (!s.orbitOwner && (Math.abs(dx) > 900 || Math.abs(dy) > 1100)) this.killEnemyShot(s, false);
    }
  }
}
