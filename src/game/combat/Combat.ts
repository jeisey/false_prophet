/**
 * Damage pipeline, kills/rewards and shared attack helpers.
 * Upgrades hook in here: crits (PITCH SHIFTER), sub-octave thumps (OCTAVER),
 * lingering fields (REVERB), echoes (DELAY), marks (DEATH GROWL).
 */
import Phaser from 'phaser';
import { BAND, type MemberId } from '../../data/band';
import { BREAKDOWN, PICKUPS, SOLO } from '../../config/gameConfig';
import { T } from '../art/atlas';
import { INV_RES } from '../sceneUtil';
import type { Enemy } from '../enemies/Enemy';
import { DEPTH } from '../systems/Fx';
import type { PlayerShot } from './Projectiles';
import type { GameScene } from '../scenes/GameScene';

export interface HitOpts {
  kx?: number;
  ky?: number;
  knock?: number;
  noCrit?: boolean;
  noOctave?: boolean;
  vocal?: boolean;
  silent?: boolean;
  /** extra multiplier vs bosses (BREAKDOWN on the core) */
  bossMul?: number;
}

interface Field {
  x: number;
  y: number;
  r: number;
  t: number;
  dur: number;
  dmg: number;
  owner: MemberId;
  tick: number;
  img: Phaser.GameObjects.Image;
}

export class Combat {
  private delayed: { t: number; fn: () => void }[] = [];
  private fields: Field[] = [];
  private tmp: Enemy[] = [];
  private tmp2: Enemy[] = [];
  private fieldPool: Phaser.GameObjects.Image[] = [];

  constructor(private gs: GameScene) {}

  /** Run `fn` after `seconds` of game time (pauses with the game). */
  after(seconds: number, fn: () => void): void {
    this.delayed.push({ t: seconds, fn });
  }

  clear(): void {
    this.delayed.length = 0;
    for (const f of this.fields) f.img.setVisible(false);
    this.fields.length = 0;
  }

  // ------------------------------------------------------------------ damage

  damageEnemy(e: Enemy, amount: number, src: MemberId | null, opts: HitOpts = {}): number {
    if (!e.active || amount <= 0) return 0;
    const gs = this.gs;
    const run = gs.run;
    if (e.invulnerable) {
      if (Math.random() < 0.08) gs.fx.sparks(e.x, e.y - e.radius, 0xaaaaaa, 2);
      return 0;
    }
    let dmg = amount * e.damageTaken;
    if (e.markT > 0) dmg *= 1.35;
    if (e.kind === 'boss' && opts.bossMul) dmg *= opts.bossMul;
    let crit = false;
    if (!opts.noCrit && run.mods.critChance > 0 && Math.random() < run.mods.critChance) {
      crit = true;
      dmg *= 2;
      gs.audio('pickup', { volume: 0.25, rate: 2 });
    }
    const dealt = Math.min(dmg, e.hp);
    e.hp -= dmg;
    e.flashT = 0.06;
    e.lastHitBy = src;
    if (src) run.recordDamage(src, dealt);
    e.brain?.onDamaged?.(e, dealt);
    if (!opts.silent) gs.fx.number(e.x, e.y - e.radius * 1.4, dmg, src ? BAND[src].color : 0xffffff, crit);
    if (e.elite || e.kind === 'boss') run.addBreakdown(BREAKDOWN.perEliteHit * Math.min(3, dmg / 20));

    const knock = (opts.knock ?? 0) * run.mods.knockbackMul;
    if (knock > 0 && (opts.kx || opts.ky)) {
      const k = knock * (1 - e.mass);
      e.kx += (opts.kx ?? 0) * k;
      e.ky += (opts.ky ?? 0) * k;
    }
    // NYX passive: wounded elites get staggered by vocal hits
    if ((opts.vocal || src === 'vocals') && e.elite && e.hp < e.maxHp * 0.4 && e.staggerCd <= 0) {
      e.stunT = 0.7;
      e.staggerCd = 3;
      gs.fx.floatText(e.x, e.y - e.radius * 2, 'STAGGER', '#ff9ae6', 16, 0.7);
    }
    // OCTAVER: sub-octave thump
    if (!opts.noOctave && run.mods.octaverChance > 0 && Math.random() < run.mods.octaverChance) {
      const r = run.mods.octaverRadius;
      const x = e.x;
      const y = e.y;
      this.after(0.06, () => {
        gs.fx.ring(x, y, src ? BAND[src].color : 0xffffff, 6, r, 0.25, 'fx_ring_thick', 0.8);
        this.areaDamage(x, y, r, amount * 0.6, src, { noOctave: true, noCrit: true, silent: true, knock: 60 });
      });
    }
    if (e.hp <= 0) this.kill(e, src);
    return dealt;
  }

  areaDamage(x: number, y: number, r: number, amount: number, src: MemberId | null, opts: HitOpts = {}, exclude?: Set<number>): number {
    this.gs.enemies.queryRadius(x, y, r, this.tmp);
    const list = this.tmp.slice();
    let n = 0;
    for (const e of list) {
      if (!e.targetable || (exclude && exclude.has(e.id))) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      this.damageEnemy(e, amount, src, { ...opts, kx: opts.kx ?? dx / d, ky: opts.ky ?? dy / d });
      n++;
    }
    return n;
  }

  coneDamage(x: number, y: number, angle: number, half: number, range: number, amount: number, src: MemberId | null, opts: HitOpts = {}): number {
    this.gs.enemies.queryRadius(x, y, range, this.tmp);
    const list = this.tmp.slice();
    let n = 0;
    for (const e of list) {
      if (!e.targetable) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = Math.hypot(dx, dy) || 1;
      let da = Math.atan2(dy, dx) - angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > half + e.radius / Math.max(30, d)) continue;
      this.damageEnemy(e, amount, src, { ...opts, kx: dx / d, ky: dy / d });
      n++;
    }
    return n;
  }

  /** Lead guitar: arc lightning from `from` to up to `chains` more enemies. */
  chainLightning(from: Enemy, chains: number, dmg: number, src: MemberId, hit: Set<number>, range = 120): void {
    let cur: { x: number; y: number } = { x: from.x, y: from.y - from.radius * 0.5 };
    const color = BAND[src].color;
    for (let i = 0; i < chains; i++) {
      const next = this.gs.enemies.nearest(cur.x, cur.y, range, (o) => !hit.has(o.id) && o.targetable);
      if (!next) break;
      hit.add(next.id);
      const ny = next.y - next.radius * 0.5;
      this.gs.fx.lightning(cur.x, cur.y, next.x, ny, color, 2.2, 0.12, 10);
      this.damageEnemy(next, dmg, src, { noOctave: i > 0 });
      cur = { x: next.x, y: ny };
      dmg *= 0.85;
    }
  }

  /** Bass orb arrival: low-frequency ring that pulls enemies inward. */
  orbDetonate(s: PlayerShot): void {
    const gs = this.gs;
    const r = 72 * gs.run.mods.areaMul * (s.scale || 1);
    gs.fx.ring(s.x, s.y, BAND[s.owner].color, 10, r, 0.35, 'fx_ring_thick', 0.9);
    gs.fx.ring(s.x, s.y, BAND[s.owner].color, r * 0.4, r * 1.15, 0.45, 'fx_ring', 0.6);
    gs.enemies.queryRadius(s.x, s.y, r, this.tmp);
    const list = this.tmp.slice();
    for (const e of list) {
      if (!e.targetable) continue;
      const dx = s.x - e.x;
      const dy = s.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      this.damageEnemy(e, s.dmg, s.owner, { kx: dx / d, ky: dy / d, knock: 150 * (s.power || 1) });
      e.slowT = Math.max(e.slowT, 1.2);
      e.slowMul = Math.min(e.slowMul, 0.7);
    }
    this.reverbField(s.x, s.y, s.owner, s.dmg);
    gs.audio('bassPulse', { volume: 0.22 * (s.power || 1) });
  }

  // ------------------------------------------------------------------ REVERB fields

  reverbField(x: number, y: number, owner: MemberId, baseDmg: number): void {
    const rv = this.gs.run.mods.reverb;
    if (!rv || this.fields.length > 24) return;
    const img = this.fieldPool.pop() ?? this.gs.add.image(0, 0, ...T('fx_field')).setBlendMode(Phaser.BlendModes.ADD);
    img.setVisible(true).setPosition(x, y).setDepth(DEPTH.telegraph + 1).setTint(BAND[owner].color).setScale(((rv.radius * 2) / 96) * INV_RES).setAlpha(0.5);
    this.fields.push({ x, y, r: rv.radius, t: 0, dur: rv.duration, dmg: Math.max(3, baseDmg * 0.18), owner, tick: 0, img });
  }

  // ------------------------------------------------------------------ kills

  kill(e: Enemy, src: MemberId | null): void {
    if (!e.active) return;
    const gs = this.gs;
    const run = gs.run;
    const big = e.elite || e.kind === 'boss' || (e.def?.hp ?? 0) >= 90;
    gs.fx.death(e.x, e.y - e.radius * 0.5, e.gore, big);
    if (e.def) {
      gs.audio(big ? 'killBig' : 'kill', { volume: big ? 0.5 : 0.22, rate: 0.85 + Math.random() * 0.35 });
      run.recordKill(e.elite);
      run.addBreakdown(BREAKDOWN.perKill * (e.elite ? 4 : 1));
      run.refundSolo(SOLO.killRefund * (e.elite ? 5 : 1));
      gs.pickups.dropXp(e.x, e.y, e.xp);
      const r = Math.random();
      if (e.elite) {
        if (r < PICKUPS.eliteHealChance) gs.pickups.drop('water', e.x + 12, e.y);
        else if (r < PICKUPS.eliteHealChance + 0.25) gs.pickups.drop('amp', e.x + 12, e.y);
        gs.fx.shake(0.006, 140);
        gs.hitStop(0.05);
      } else if (r < PICKUPS.healDropChance) gs.pickups.drop('water', e.x, e.y);
      else if (r < PICKUPS.healDropChance + PICKUPS.ampDropChance) gs.pickups.drop('amp', e.x, e.y);
      else if (r < PICKUPS.healDropChance + PICKUPS.ampDropChance + PICKUPS.gearDropChance) gs.pickups.drop('gear', e.x, e.y);
      gs.band.onKill(src);
    }
    e.brain?.onDeath?.(e);
    gs.enemies.remove(e);
  }

  // ------------------------------------------------------------------ tambourine jingles

  growJingles(e: Enemy, n: number): void {
    e.d.jingles = (e.d.jingles ?? 0) + n;
    for (let i = 0; i < n; i++) {
      this.gs.shots.fireEnemy('p_jingle', e.x, e.y, 0, 0, (e.def?.projectileDamage ?? 8) * 0.6, {
        orbitOwner: e,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitRadius: e.radius + 14,
        orbitSpeed: 3,
        weak: false,
        life: 999,
      });
    }
  }

  spinJingles(e: Enemy, speed: number): void {
    for (const s of this.gs.shots.enemy) if (s.active && s.orbitOwner === e) s.orbitSpeed = speed;
  }

  launchJingles(e: Enemy, speed: number, dmg: number): void {
    for (const s of this.gs.shots.enemy) {
      if (!s.active || s.orbitOwner !== e) continue;
      s.orbitOwner = null;
      s.vx = Math.cos(s.orbitAngle) * speed;
      s.vy = Math.sin(s.orbitAngle) * speed;
      s.life = 2.2;
      s.dmg = dmg;
      s.weak = true;
    }
    e.d.jingles = 0;
    this.gs.audio('rattle', { volume: 0.35, rate: 1.6 });
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const d = this.delayed[i];
      d.t -= dt;
      if (d.t <= 0) {
        this.delayed.splice(i, 1);
        d.fn();
      }
    }
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const f = this.fields[i];
      f.t += dt;
      f.tick -= dt;
      f.img.setAlpha(0.45 * (1 - f.t / f.dur));
      if (f.tick <= 0) {
        f.tick = 0.25;
        this.gs.enemies.queryRadius(f.x, f.y, f.r, this.tmp2);
        for (const e of this.tmp2.slice()) {
          if (e.targetable) this.damageEnemy(e, f.dmg, f.owner, { noCrit: true, noOctave: true, silent: true });
        }
      }
      if (f.t >= f.dur) {
        f.img.setVisible(false);
        this.fieldPool.push(f.img);
        this.fields.splice(i, 1);
      }
    }
  }
}
