/**
 * The five instrument kits: automatic attacks, SOLO signatures, companion
 * specials and the full-band BREAKDOWN.
 *
 * All attacks are quantized to the master transport: the leader fires on
 * 16th notes, companions on 8th notes, drums on beats — so the band sounds
 * (and looks) like it is playing together without asking the player for any
 * rhythm input.
 */
import Phaser from 'phaser';
import { BAND, type MemberId } from '../../data/band';
import { ATTACKS, COMPANION_SPECIAL_POWER, SOLOS } from '../../data/attacks';
import { BREAKDOWN, COMPANION } from '../../config/gameConfig';
import { BAR_DURATION, BEAT_DURATION } from '../../config/audioConfig';
import { T } from '../art/atlas';
import { INV_RES } from '../sceneUtil';
import { DEPTH } from '../systems/Fx';
import type { Enemy } from '../enemies/Enemy';
import type { Musician } from '../entities/Band';
import type { GameScene } from '../scenes/GameScene';

interface Effect {
  update(dt: number): boolean;
  onSixteenth?(i: number): void;
  onBeat?(b: number): void;
  end?(): void;
}

const EIGHTH = BEAT_DURATION / 2;

export class Weapons {
  private effects: Effect[] = [];
  /** Heightened full-band state after a BREAKDOWN (seconds). */
  breakdownT = 0;
  private tmp: Enemy[] = [];
  private beamPool: Phaser.GameObjects.Image[] = [];

  constructor(private gs: GameScene) {}

  clear(): void {
    for (const e of this.effects) e.end?.();
    this.effects.length = 0;
    this.breakdownT = 0;
  }

  private dmg(m: Musician, base: number, power = 1): number {
    return base * power * this.gs.run.mods.damageMul * this.gs.band.damageMul(m);
  }

  // ------------------------------------------------------------------ clock hooks

  update(dt: number): void {
    const band = this.gs.band;
    this.breakdownT -= dt;
    for (const m of band.members) {
      if (m.frozen) continue;
      m.cd -= dt * band.attackSpeedMul(m);
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      if (!this.effects[i].update(dt)) {
        this.effects[i].end?.();
        this.effects.splice(i, 1);
      }
    }
  }

  onSixteenth(i: number): void {
    for (const e of this.effects) e.onSixteenth?.(i);
    if (!this.gs.run.isRunning) return;
    for (const m of this.gs.band.members) {
      if (m.frozen || m.cd > 0 || m.joinT > 0.2) continue;
      // leader on any 16th, companions on 8ths, drums on beats (or 8ths when hot)
      if (!m.isLeader && i % 2 !== 0) continue;
      if (m.id === 'drums' && i % (this.breakdownT > 0 || m.tempo >= 7 ? 2 : 4) !== 0) continue;
      const fired = this.fire(m, 1, false);
      const base = ATTACKS[m.id].cooldown * (m.isLeader ? 1 : 1.25);
      m.cd = fired ? base : 0.05;
    }
  }

  onBeat(b: number): void {
    for (const e of this.effects) e.onBeat?.(b);
    const gs = this.gs;
    const mods = gs.run.mods;
    const L = gs.band.leader;
    if (mods.tremolo) {
      const n = gs.combat.areaDamage(L.x, L.y - 10, mods.tremolo.radius, mods.tremolo.damage * mods.damageMul, L.id, { noOctave: true, silent: false, knock: 30 });
      gs.fx.ring(L.x, L.y - 10, BAND[L.id].color, mods.tremolo.radius * 0.6, mods.tremolo.radius, 0.2, 'fx_ring', n ? 0.7 : 0.3, DEPTH.telegraph + 2);
    }
    if (mods.noiseGate && b % mods.noiseGate.everyBeats === 0) {
      const cleared = gs.shots.clearEnemyShots(L.x, L.y, mods.noiseGate.radius);
      gs.fx.ring(L.x, L.y - 10, 0xff3c3c, mods.noiseGate.radius * 0.9, mods.noiseGate.radius, 0.18, 'fx_hex', cleared ? 0.8 : 0.25, DEPTH.telegraph + 2);
      if (cleared) gs.audio('gate', { volume: 0.3 });
    }
  }

  onBar(bar: number): void {
    // companion signatures, staggered so the band trades solos
    const comps = this.gs.band.members.filter((m) => !m.isLeader && !m.frozen);
    for (const m of comps) {
      const offset = (m.slot * 3 + 2) % COMPANION.specialEveryBars;
      if (bar % COMPANION.specialEveryBars === offset && this.gs.enemies.nearest(m.x, m.y, 320)) {
        this.special(m, COMPANION_SPECIAL_POWER);
      }
    }
  }

  // ------------------------------------------------------------------ basic attacks

  fire(m: Musician, power: number, echo: boolean): boolean {
    let ok = false;
    switch (m.id) {
      case 'lead':
        ok = this.fireLead(m, power, echo);
        break;
      case 'rhythm':
        ok = this.fireRhythm(m, power, echo);
        break;
      case 'bass':
        ok = this.fireBass(m, power, echo);
        break;
      case 'drums':
        ok = this.fireDrums(m, power, echo);
        break;
      case 'vocals':
        ok = this.fireVocals(m, power, echo);
        break;
    }
    if (ok && !echo) {
      m.atkT = 0.12;
      const echoK = this.gs.run.mods.echo;
      if (echoK > 0) this.gs.combat.after(0.28, () => this.fire(m, power * echoK, true));
    }
    return ok;
  }

  private chorus(): boolean {
    return Math.random() < this.gs.run.mods.chorusChance;
  }

  private fireLead(m: Musician, power: number, echo: boolean): boolean {
    const gs = this.gs;
    const A = ATTACKS.lead;
    const mods = gs.run.mods;
    const range = A.range * mods.rangeMul;
    const target = gs.enemies.bestTarget(m.x, m.y, m.facing, A.aimHalfAngle, range);
    if (!target) return false;
    const sx = m.x + Math.cos(m.facing) * 10;
    const sy = m.y - 24;
    const ang = Math.atan2(target.y - target.radius * 0.5 - sy, target.x - sx);
    const count = this.chorus() ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const a = ang + (count > 1 ? (k - 0.5) * 0.16 : 0);
      const s = gs.shots.firePlayer('bolt', m.id, sx, sy, a, A.speed * mods.rangeMul, this.dmg(m, A.damage, power), {
        chains: m.isLeader ? A.chains : 1,
        pierce: mods.pierce,
        scale: mods.sizeMul * (echo ? 0.8 : 1),
        life: (range / A.speed) * 1.3,
        radius: 9 * mods.sizeMul,
      });
      if (s && echo) s.sprite.setAlpha(0.55);
    }
    gs.audio('zap', { volume: m.isLeader ? 0.14 : 0.08, rate: 0.9 + Math.random() * 0.3 });
    return true;
  }

  private fireRhythm(m: Musician, power: number, echo: boolean): boolean {
    const gs = this.gs;
    const A = ATTACKS.rhythm;
    const mods = gs.run.mods;
    const range = A.range * mods.areaMul;
    const dir = gs.enemies.densestDirection(m.x, m.y, range * 1.25);
    if (!dir) return false;
    const half = A.halfAngle * Math.sqrt(mods.areaMul);
    const hits = gs.combat.coneDamage(m.x, m.y - 10, dir.angle, half, range, this.dmg(m, A.damage, power), m.id, { knock: A.knock * power });
    const col = BAND[m.id].color;
    for (let k = 1; k <= 3; k++) {
      const d = range * (0.25 + k * 0.2);
      gs.fx.ring(m.x + Math.cos(dir.angle) * d, m.y - 10 + Math.sin(dir.angle) * d, col, 8 + k * 6, 22 + k * 12 * mods.areaMul, 0.18 + k * 0.03, 'fx_square', echo ? 0.4 : 0.85);
    }
    gs.fx.burst(gs.fx.spark, m.x + Math.cos(dir.angle) * range * 0.5, m.y - 10 + Math.sin(dir.angle) * range * 0.5, col, 5);
    if (hits >= 3 && m.id === 'rhythm') {
      gs.band.resistT = 1.5;
      gs.fx.ring(gs.band.leader.x, gs.band.leader.y - 20, col, 30, 34, 0.35, 'fx_hex', 0.5);
    }
    if (hits > 0) gs.combat.reverbField(m.x + Math.cos(dir.angle) * range * 0.55, m.y + Math.sin(dir.angle) * range * 0.55, m.id, A.damage);
    if (this.chorus()) {
      gs.combat.after(0.1, () => gs.combat.coneDamage(m.x, m.y - 10, dir.angle + 0.5, half * 0.7, range * 0.8, this.dmg(m, A.damage * 0.6, power), m.id, { knock: 90 }));
    }
    gs.audio('chord', { volume: m.isLeader ? 0.18 : 0.1, rate: 0.95 + Math.random() * 0.1 });
    if (m.isLeader) gs.fx.shake(0.0015, 60);
    return true;
  }

  private fireBass(m: Musician, power: number, echo: boolean): boolean {
    const gs = this.gs;
    const A = ATTACKS.bass;
    const mods = gs.run.mods;
    const range = A.range * mods.rangeMul;
    const p = gs.enemies.densestPoint(m.x, m.y, range) ?? (() => {
      const n = gs.enemies.nearest(m.x, m.y, range);
      return n ? { x: n.x, y: n.y, n: 1 } : null;
    })();
    if (!p) return false;
    const sx = m.x;
    const sy = m.y - 22;
    const shots = this.chorus() ? 2 : 1;
    for (let k = 0; k < shots; k++) {
      const tx = p.x + (k ? (Math.random() - 0.5) * 80 : 0);
      const ty = p.y - 8 + (k ? (Math.random() - 0.5) * 80 : 0);
      const ang = Math.atan2(ty - sy, tx - sx);
      const dist = Math.hypot(tx - sx, ty - sy);
      gs.shots.firePlayer('orb', m.id, sx, sy, ang, A.speed, this.dmg(m, A.damage, power), {
        tx,
        ty,
        life: dist / A.speed + 0.4,
        scale: mods.sizeMul * (echo ? 0.8 : 1),
        power,
        radius: 12,
      });
    }
    return true;
  }

  private fireDrums(m: Musician, power: number, echo: boolean): boolean {
    const gs = this.gs;
    const A = ATTACKS.drums;
    const mods = gs.run.mods;
    const col = BAND[m.id].color;
    const kickR = A.kickRadius * mods.areaMul;
    const near = gs.enemies.nearest(m.x, m.y, kickR + 10);
    const far = gs.enemies.nearest(m.x, m.y, A.snareRange * mods.rangeMul);
    if (!far) return false;
    m.kick = !m.kick;
    if ((m.kick && near) || (!far && near)) {
      gs.combat.areaDamage(m.x, m.y - 6, kickR, this.dmg(m, A.kickDamage, power), m.id, { knock: 140 * power });
      gs.fx.ring(m.x, m.y - 6, col, 12, kickR, 0.22, 'fx_ring_thick', echo ? 0.4 : 0.9, DEPTH.telegraph + 3);
      gs.audio('kick', { volume: m.isLeader ? 0.2 : 0.12 });
      gs.combat.reverbField(m.x, m.y, m.id, A.kickDamage);
    } else {
      const r = A.snareRadius * mods.areaMul;
      gs.combat.areaDamage(far.x, far.y, r, this.dmg(m, A.snareDamage, power), m.id, { knock: 90 * power });
      gs.fx.ring(far.x, far.y - 8, col, 6, r, 0.2, 'fx_ring_thick', echo ? 0.4 : 0.9);
      gs.fx.sparks(far.x, far.y - 8, 0xffffff, 4);
      gs.audio('snare', { volume: m.isLeader ? 0.16 : 0.1 });
    }
    m.hitCount++;
    if (m.hitCount % A.discEvery === 0 || this.chorus()) {
      const t = gs.enemies.nearest(m.x, m.y, 300);
      if (t) {
        const a = Math.atan2(t.y - m.y + 20, t.x - m.x);
        gs.shots.firePlayer('disc', m.id, m.x, m.y - 20, a, 520, this.dmg(m, A.discDamage, power), {
          bounces: A.discBounces + (m.isLeader ? 1 : 0),
          pierce: mods.pierce,
          life: 1.4,
          scale: mods.sizeMul,
          radius: 11,
        });
      }
    }
    return true;
  }

  private fireVocals(m: Musician, power: number, echo: boolean): boolean {
    const gs = this.gs;
    const A = ATTACKS.vocals;
    const mods = gs.run.mods;
    const range = A.range * mods.rangeMul;
    const dir = gs.enemies.densestDirection(m.x, m.y, range * 0.9);
    if (!dir) return false;
    const n = this.chorus() ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const a = dir.angle + (n > 1 ? (k - 0.5) * 0.5 : 0);
      const s = gs.shots.firePlayer('arc', m.id, m.x, m.y - 26, a, A.speed, this.dmg(m, A.damage, power), {
        tx: m.x,
        ty: m.y - 26,
        halfAngle: A.halfAngle * Math.sqrt(mods.areaMul),
        maxDist: range,
        life: 2,
        scale: mods.sizeMul,
      });
      if (s && echo) s.sprite.setAlpha(0.5);
    }
    gs.audio('scream', { volume: m.isLeader ? 0.13 : 0.08, rate: 0.9 + Math.random() * 0.25 });
    return true;
  }

  // ------------------------------------------------------------------ SOLO

  /** Leader signature (SOLO button). */
  solo(): void {
    const gs = this.gs;
    const L = gs.band.leader;
    gs.audio('solo', { volume: 0.6 });
    App_haptic(gs, 30);
    gs.fx.flash(BAND[L.id].color, 0.18, 150);
    gs.fx.floatText(L.x, L.y - 70, BAND[L.id].soloName + '!', BAND[L.id].colorCss, 26, 1.0);
    this.special(L, 1);
  }

  /** Signature move at `power` (1 = full SOLO, ~0.55 = companion special). */
  special(m: Musician, power: number): void {
    const gs = this.gs;
    const mods = gs.run.mods;
    const full = power >= 1;
    const dur = full ? mods.soloDurationMul : 0.6;
    m.atkT = 0.3;
    switch (m.id) {
      case 'lead':
        this.shredstorm(m, power, SOLOS.lead.duration * dur);
        break;
      case 'rhythm':
        this.wallOfSound(m, power, SOLOS.rhythm.barrierDuration * dur);
        break;
      case 'bass':
        this.dropZone(m, power);
        break;
      case 'drums':
        this.doubleKick(m, power, full ? SOLOS.drums.hits : 8);
        break;
      case 'vocals':
        this.deathGrowl(m, power);
        break;
    }
    if (!full) gs.fx.floatText(m.x, m.y - 64, BAND[m.id].soloName, BAND[m.id].colorCss, 17, 0.8);
  }

  private beam(): Phaser.GameObjects.Image {
    const b = this.beamPool.pop() ?? this.gs.add.image(0, 0, ...T('fx_beam')).setBlendMode(Phaser.BlendModes.ADD).setOrigin(0, 0.5);
    b.setVisible(true).setDepth(DEPTH.fx);
    return b;
  }

  private shredstorm(m: Musician, power: number, duration: number): void {
    const gs = this.gs;
    const S = SOLOS.lead;
    const mods = gs.run.mods;
    const col = BAND[m.id].color;
    const beam = this.beam().setTint(col);
    const core = this.beam().setTint(0xffffff);
    let t = 0;
    let tick = 0;
    let noteT = 0;
    let ang = m.facing;
    const len = S.beamLength * mods.rangeMul * (power >= 1 ? 1 : 0.7);
    const width = S.beamWidth * mods.sizeMul;
    if (m.isLeader) gs.band.moveMul = S.moveMul;
    this.effects.push({
      update: (dt) => {
        t += dt;
        ang += S.spin * dt;
        const ox = m.x;
        const oy = m.y - 26;
        const k = Math.min(1, t / 0.15) * Math.min(1, (duration - t) / 0.2);
        beam.setPosition(ox, oy).setRotation(ang).setScale((len / 64) * INV_RES * k, (width / 24) * INV_RES * 1.8);
        core.setPosition(ox, oy).setRotation(ang).setScale((len / 64) * INV_RES * k, (width / 24) * INV_RES * 0.6);
        tick -= dt;
        if (tick <= 0) {
          tick = S.tick;
          const ex = ox + Math.cos(ang) * len;
          const ey = oy + Math.sin(ang) * len;
          gs.enemies.queryRadius(ox, oy, len, this.tmp);
          for (const e of this.tmp.slice()) {
            if (!e.targetable) continue;
            const d = segDist(e.x, e.y - e.radius * 0.5, ox, oy, ex, ey);
            if (d < width / 2 + e.radius) gs.combat.damageEnemy(e, this.dmg(m, S.beamDamage, power), m.id, { kx: Math.cos(ang + Math.PI / 2), ky: Math.sin(ang + Math.PI / 2), knock: 60, noOctave: true });
          }
          gs.fx.sparks(ex, ey, col, 2);
        }
        noteT -= dt;
        if (noteT <= 0) {
          noteT = 0.1;
          for (let q = 0; q < 2; q++) {
            const a = Math.random() * Math.PI * 2;
            gs.shots.firePlayer('note', m.id, ox, oy, a, 380, this.dmg(m, S.noteDamage, power), { life: 0.8, pierce: 1 });
          }
          gs.audio('zap', { volume: 0.12, rate: 1 + Math.random() });
        }
        return t < duration;
      },
      end: () => {
        beam.setVisible(false);
        core.setVisible(false);
        this.beamPool.push(beam, core);
        if (m.isLeader) gs.band.moveMul = 1;
      },
    });
    gs.fx.shake(0.003, duration * 1000);
  }

  private wallOfSound(m: Musician, power: number, duration: number): void {
    const gs = this.gs;
    const S = SOLOS.rhythm;
    const mods = gs.run.mods;
    const col = BAND[m.id].color;
    const R = S.blastRadius * mods.areaMul * (power >= 1 ? 1 : 0.75);
    const hit = new Set<number>();
    let t = 0;
    let tick = 0;
    const ring = gs.add.image(m.x, m.y, ...T('fx_hex')).setBlendMode(Phaser.BlendModes.ADD).setTint(col).setDepth(DEPTH.fx);
    const ring2 = gs.add.image(m.x, m.y, ...T('fx_square')).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd2a0).setDepth(DEPTH.fx);
    gs.audio('boom', { volume: 0.4 * power });
    gs.audio('chord', { volume: 0.4, rate: 0.8 });
    gs.fx.shake(0.008 * power, 220);
    const barrierR = S.barrierRadius * mods.areaMul * (power >= 1 ? 1 : 0.7);
    this.effects.push({
      update: (dt) => {
        t += dt;
        const cx = m.x;
        const cy = m.y - 16;
        if (t < 0.35) {
          const r = 20 + (R - 20) * (t / 0.35);
          ring.setPosition(cx, cy).setScale((r / 56) * INV_RES).setAlpha(1);
          ring2.setPosition(cx, cy).setScale((r / 54) * INV_RES).setAlpha(0.6).setRotation(t * 3);
          gs.enemies.queryRadius(cx, cy, r, this.tmp);
          for (const e of this.tmp.slice()) {
            if (hit.has(e.id) || !e.targetable) continue;
            hit.add(e.id);
            const dx = e.x - cx;
            const dy = e.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            gs.combat.damageEnemy(e, this.dmg(m, S.blastDamage, power), m.id, { kx: dx / d, ky: dy / d, knock: S.knock * power });
          }
          gs.shots.clearEnemyShots(cx, cy, r, false);
          return true;
        }
        // lingering armored barrier
        const k = Math.min(1, (duration - (t - 0.35)) / 0.4);
        ring.setPosition(cx, cy).setScale((barrierR / 56) * INV_RES).setAlpha(0.35 + 0.35 * gs.beat.pulse() * k).setRotation(t * 0.6);
        ring2.setAlpha(0);
        gs.shots.clearEnemyShots(cx, cy, barrierR + 8, false);
        tick -= dt;
        if (tick <= 0) {
          tick = 0.3;
          gs.enemies.queryRadius(cx, cy, barrierR, this.tmp);
          for (const e of this.tmp.slice()) {
            if (!e.targetable || e.kind === 'boss' || e.kind === 'structure') continue;
            const dx = e.x - cx;
            const dy = e.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            gs.combat.damageEnemy(e, this.dmg(m, S.barrierDps * 0.3, power), m.id, { kx: dx / d, ky: dy / d, knock: 260, noOctave: true, silent: true });
          }
        }
        return t < 0.35 + duration;
      },
      end: () => {
        ring.destroy();
        ring2.destroy();
      },
    });
    gs.combat.reverbField(m.x, m.y, m.id, S.blastDamage * 0.5);
  }

  private dropZone(m: Musician, power: number): void {
    const gs = this.gs;
    const S = SOLOS.bass;
    const mods = gs.run.mods;
    const col = BAND[m.id].color;
    const p = gs.enemies.densestPoint(m.x, m.y, 340) ?? { x: m.x + Math.cos(m.facing) * 120, y: m.y + Math.sin(m.facing) * 120, n: 0 };
    const cx = p.x;
    const cy = p.y;
    const pullR = S.pullRadius * mods.areaMul * (power >= 1 ? 1 : 0.7);
    const blastR = S.blastRadius * mods.areaMul * (power >= 1 ? 1 : 0.7);
    const swirl = gs.add.image(cx, cy, ...T('fx_swirl')).setBlendMode(Phaser.BlendModes.ADD).setTint(col).setDepth(DEPTH.telegraph + 5);
    const minT = power >= 1 ? S.minCharge : 0.8;
    let t = 0;
    let armed = false;
    let done = false;
    gs.audio('bassPulse', { volume: 0.4, rate: 0.6 });
    const detonate = () => {
      done = true;
      gs.combat.areaDamage(cx, cy, blastR, this.dmg(m, S.blastDamage, power), m.id, { knock: 380 * power });
      gs.fx.ring(cx, cy, col, 20, blastR * 1.2, 0.45, 'fx_ring_thick');
      gs.fx.ring(cx, cy, 0xffffff, 10, blastR * 0.8, 0.3, 'fx_ring');
      gs.fx.burst(gs.fx.shard, cx, cy, col, 24);
      gs.fx.shake(0.012 * power, 260);
      gs.audio('boom', { volume: 0.7 * power });
      gs.audio('bassPulse', { volume: 0.6, rate: 0.5 });
      if (power >= 1) App_haptic(gs, 40);
      gs.combat.reverbField(cx, cy, m.id, S.blastDamage * 0.4);
    };
    this.effects.push({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / 0.4);
        swirl.setScale((pullR / 64) * INV_RES * k * (1 + 0.1 * gs.beat.pulse())).setRotation(-t * 6).setAlpha(0.8);
        gs.enemies.queryRadius(cx, cy, pullR, this.tmp);
        for (const e of this.tmp) {
          if (e.kind === 'structure') continue;
          const dx = cx - e.x;
          const dy = cy - e.y;
          const d = Math.hypot(dx, dy) || 1;
          const pull = S.pullStrength * (1 - e.mass * 0.6) * power;
          e.kx = (dx / d) * Math.min(pull, d * 6);
          e.ky = (dy / d) * Math.min(pull, d * 6);
        }
        if (t >= minT) armed = true;
        return !done && t < 4;
      },
      onBeat: () => {
        // the drop lands ON the beat
        if (armed && !done) detonate();
      },
      end: () => {
        if (!done) detonate();
        swirl.destroy();
      },
    });
  }

  private doubleKick(m: Musician, power: number, hits: number): void {
    const gs = this.gs;
    const S = SOLOS.drums;
    const mods = gs.run.mods;
    const col = BAND[m.id].color;
    let left = hits;
    this.effects.push({
      update: () => left > 0,
      onSixteenth: () => {
        if (left <= 0) return;
        left--;
        const foe = gs.enemies.nearest(m.x + (Math.random() - 0.5) * 160, m.y + (Math.random() - 0.5) * 160, S.reach);
        const x = foe ? foe.x : m.x + (Math.random() - 0.5) * 220;
        const y = foe ? foe.y : m.y + (Math.random() - 0.5) * 220;
        const r = S.radius * mods.areaMul;
        gs.combat.areaDamage(x, y, r, this.dmg(m, S.damage, power), m.id, { knock: 160 });
        gs.fx.ring(x, y - 6, col, 8, r, 0.2, 'fx_ring_thick');
        gs.fx.burst(gs.fx.glow, x, y - 6, col, 2);
        gs.audio('kick', { volume: 0.3 * power, rate: 0.9 + (left % 2) * 0.15 });
        if (left % 4 === 0) gs.fx.shake(0.004 * power, 60);
      },
    });
  }

  private deathGrowl(m: Musician, power: number): void {
    const gs = this.gs;
    const S = SOLOS.vocals;
    const mods = gs.run.mods;
    const col = BAND[m.id].color;
    const dir = gs.enemies.densestDirection(m.x, m.y, S.range)?.angle ?? m.facing;
    const range = S.range * mods.rangeMul * (power >= 1 ? 1 : 0.7);
    const half = S.halfAngle * Math.sqrt(mods.areaMul);
    const ox = m.x;
    const oy = m.y - 26;
    const hit = new Set<number>();
    let t = 0;
    const arcs: Phaser.GameObjects.Image[] = [];
    for (let k = 0; k < 3; k++) arcs.push(gs.add.image(ox, oy, ...T('fx_crescent')).setBlendMode(Phaser.BlendModes.ADD).setTint(k === 1 ? 0xffffff : col).setDepth(DEPTH.fx));
    gs.audio('roar', { volume: 0.55 * power, rate: 1.35 });
    gs.audio('scream', { volume: 0.5, rate: 0.7 });
    gs.fx.shake(0.01 * power, 300);
    this.effects.push({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / 0.32);
        const d = range * k;
        arcs.forEach((a, i) => {
          const dd = Math.max(10, d - i * 30);
          const w = dd * Math.sin(half) * 2;
          a.setPosition(ox + Math.cos(dir) * dd, oy + Math.sin(dir) * dd).setRotation(dir + Math.PI / 2);
          a.setScale((w / 90) * INV_RES, INV_RES * (1.4 - i * 0.3)).setAlpha(1 - k * 0.6);
        });
        gs.enemies.queryRadius(ox, oy, d + 20, this.tmp);
        for (const e of this.tmp.slice()) {
          if (hit.has(e.id) || !e.targetable) continue;
          const ex = e.x - ox;
          const ey = e.y - oy;
          let da = Math.atan2(ey, ex) - dir;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) > half + 0.1) continue;
          hit.add(e.id);
          const dd = Math.hypot(ex, ey) || 1;
          gs.combat.damageEnemy(e, this.dmg(m, S.damage, power), m.id, { kx: ex / dd, ky: ey / dd, knock: 220, vocal: true });
          if (e.active) {
            // interrupt + mark survivors for the band
            if (e.kind !== 'boss') e.stunT = Math.max(e.stunT, S.stun * power);
            else if (e.tele) e.tele.alive = false;
            e.markT = S.mark * (power >= 1 ? 1 : 0.6);
          }
        }
        return t < 0.5;
      },
      end: () => arcs.forEach((a) => a.destroy()),
    });
  }

  // ------------------------------------------------------------------ BREAKDOWN

  /**
   * The full-band super. Brief control lock, camera pull-back, formation,
   * music surge on the next beat, then each instrument fires its combined
   * signature on successive 8th notes.
   */
  breakdown(): void {
    const gs = this.gs;
    const L = gs.band.leader;
    const band = gs.band;
    band.formUp();
    band.lockT = 0.35;
    gs.slowMo(0.3, 0.45);
    gs.zoomPulse(0.8, 0.3, BAR_DURATION * 2);
    const surgeAt = gs.audioEngine().surge();
    gs.audio('breakdown', { volume: 0.9 });
    gs.audio('crash', { volume: 0.6 });
    App_haptic(gs, [60, 40, 120]);
    gs.hud()?.breakdownSlam();
    gs.fx.flash(0xff6a1f, 0.35, 250);
    const wait = Math.max(0, surgeAt - gs.audioEngine().schedulerNow());
    const center = () => ({ x: L.x, y: L.y - 20 });
    const part = (id: MemberId) => band.get(id) ?? L;
    const bossMul = 2.5;
    const D = BREAKDOWN.damage * gs.run.mods.damageMul;
    const seq: [number, () => void][] = [
      [0, () => {
        // LEAD: chain lightning across the screen
        const c = center();
        const hit = new Set<number>();
        const src = part('lead');
        let cur = { x: src.x, y: src.y - 30 };
        for (let i = 0; i < 14; i++) {
          const n = gs.enemies.nearest(cur.x, cur.y, 460, (e) => !hit.has(e.id) && e.targetable);
          if (!n) break;
          hit.add(n.id);
          gs.fx.lightning(cur.x, cur.y, n.x, n.y - n.radius, BAND.lead.color, 4, 0.3, 18);
          gs.combat.damageEnemy(n, D * 0.5, 'lead', { bossMul });
          cur = { x: n.x, y: n.y - n.radius };
        }
        gs.fx.ring(c.x, c.y, BAND.lead.color, 20, 300, 0.4);
      }],
      [1, () => {
        // RHYTHM: giant chord shockwave
        const c = center();
        gs.combat.areaDamage(c.x, c.y, 360, D * 0.55, 'rhythm', { knock: 420, bossMul });
        gs.fx.ring(c.x, c.y, BAND.rhythm.color, 30, 380, 0.5, 'fx_square');
        gs.fx.ring(c.x, c.y, 0xffffff, 20, 360, 0.4, 'fx_ring_thick');
        gs.fx.shake(0.012, 200);
      }],
      [2, () => {
        // BASS: pull everything inward
        const c = center();
        gs.enemies.queryRadius(c.x, c.y, 420, this.tmp);
        for (const e of this.tmp.slice()) {
          if (e.kind === 'structure') continue;
          const dx = c.x - e.x;
          const dy = c.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          e.kx = (dx / d) * Math.min(600, d * 4) * (1 - e.mass * 0.5);
          e.ky = (dy / d) * Math.min(600, d * 4) * (1 - e.mass * 0.5);
          gs.combat.damageEnemy(e, D * 0.3, 'bass', { bossMul, noOctave: true });
        }
        gs.fx.ring(c.x, c.y, BAND.bass.color, 420, 30, 0.45, 'fx_ring_thick');
        gs.audio('bassPulse', { volume: 0.7, rate: 0.5 });
      }],
      [3, () => this.breakdownDrums(D * 0.28, bossMul)],
      [4, () => this.breakdownDrums(D * 0.28, bossMul)],
      [5, () => this.breakdownDrums(D * 0.28, bossMul)],
      [6, () => this.breakdownDrums(D * 0.28, bossMul)],
      [7, () => {
        // VOCALS: 360-degree spectral scream, marks everything
        const c = center();
        gs.enemies.queryRadius(c.x, c.y, 460, this.tmp);
        for (const e of this.tmp.slice()) {
          if (!e.targetable) continue;
          gs.combat.damageEnemy(e, D * 0.6, 'vocals', { bossMul, vocal: true });
          if (e.active) {
            e.markT = 8;
            if (e.kind !== 'boss') e.stunT = Math.max(e.stunT, 1);
          }
        }
        gs.fx.ring(c.x, c.y, BAND.vocals.color, 30, 470, 0.6, 'fx_ring_thick');
        gs.fx.ring(c.x, c.y, 0xffffff, 20, 440, 0.5, 'fx_ring');
        gs.audio('roar', { volume: 0.6, rate: 1.5 });
        gs.fx.shake(0.016, 350);
        gs.fx.flash(BAND.vocals.color, 0.25, 200);
        this.breakdownT = BREAKDOWN.durationBars * BAR_DURATION;
      }],
    ];
    for (const [step, fn] of seq) gs.combat.after(wait + step * EIGHTH, fn);
    gs.shots.clearAllEnemyShots();
  }

  private breakdownDrums(dmg: number, bossMul: number): void {
    const gs = this.gs;
    const L = gs.band.leader;
    for (let k = 0; k < 2; k++) {
      const foe = gs.enemies.nearest(L.x + (Math.random() - 0.5) * 400, L.y + (Math.random() - 0.5) * 400, 300);
      const x = foe ? foe.x : L.x + (Math.random() - 0.5) * 300;
      const y = foe ? foe.y : L.y + (Math.random() - 0.5) * 300;
      gs.combat.areaDamage(x, y, 90, dmg, 'drums', { bossMul, knock: 200 });
      gs.fx.ring(x, y, BAND.drums.color, 10, 95, 0.25, 'fx_ring_thick');
    }
    gs.audio('kick', { volume: 0.5 });
    gs.audio('snare', { volume: 0.35 });
  }
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function App_haptic(gs: GameScene, p: number | number[]): void {
  gs.haptic(p);
}
