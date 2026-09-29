/**
 * Siphon-site guardians. Every pattern runs on the master beat grid with a
 * telegraph at least one beat ahead, so fights stay fair on a phone screen.
 */
import Phaser from 'phaser';
import { MINIBOSSES, type MinibossKind } from '../../data/enemies';
import { MINIBOSS_LINES } from '../../data/lore';
import { T } from '../art/atlas';
import { INV_RES, setFrame } from '../sceneUtil';
import type { Brain, Enemy } from '../enemies/Enemy';
import type { GameScene } from '../scenes/GameScene';

type Pattern = { name: string; beats: number };

const RED = 0xff3a1a;

export class MinibossBrain implements Brain {
  private patterns: Pattern[];
  private pi = 0;
  private pb = 0;
  private started = false;
  private dash: { ax: number; ay: number; len: number; t: number; angle: number } | null = null;
  private sweep: { a0: number; a1: number; t: number; dur: number; len: number } | null = null;
  private aim = 0;
  private swingSide = 1;
  private spawnT = 0;

  constructor(
    private gs: GameScene,
    readonly kind: MinibossKind,
    private homeX: number,
    private homeY: number,
    private onDefeat: () => void,
  ) {
    this.patterns = {
      maracon: [{ name: 'fans', beats: 8 }, { name: 'rest', beats: 4 }, { name: 'charge', beats: 4 }, { name: 'fans', beats: 8 }, { name: 'summon', beats: 4 }, { name: 'rest', beats: 4 }],
      belcher: [{ name: 'belch', beats: 4 }, { name: 'rest', beats: 4 }, { name: 'bubbles', beats: 4 }, { name: 'sweep', beats: 8 }, { name: 'rest', beats: 4 }, { name: 'bubbles', beats: 4 }],
      percussionist: [{ name: 'slams', beats: 8 }, { name: 'rest', beats: 4 }, { name: 'rimshot', beats: 4 }, { name: 'rest', beats: 4 }, { name: 'cymbals', beats: 4 }],
      warden: [{ name: 'tickring', beats: 8 }, { name: 'rest', beats: 4 }, { name: 'pendulum', beats: 8 }, { name: 'accel', beats: 4 }, { name: 'rest', beats: 4 }, { name: 'pendulum', beats: 8 }],
    }[kind];
  }

  static spawn(gs: GameScene, kind: MinibossKind, x: number, y: number, rescued: number, onDefeat: () => void): Enemy | null {
    const def = MINIBOSSES[kind];
    const brain = new MinibossBrain(gs, kind, x, y, onDefeat);
    const hp = Math.round(def.hp * (1 + 0.35 * rescued) * (1 + gs.run.elapsed / 60 / 45));
    const frames = kind === 'warden' ? 2 : 2;
    const e = gs.enemies.spawnCustom(`b_${kind}`, x, y, hp, def.radius, brain, { kind: 'boss', frames, originY: kind === 'warden' ? 0.92 : 0.8, contact: def.contactDamage, mass: 0.97 });
    if (!e) return null;
    e.speed = def.speed;
    e.gore = def.color;
    e.label = def.name;
    e.d.spawnT = 0;
    e.sprite.setScale(0.01);
    if (kind === 'warden') {
      if (!e.extra) e.extra = gs.add.image(0, 0, ...T('b_warden_pendulum'));
      e.extra.setVisible(true).setOrigin(0.5, 0.04).setScale(INV_RES);
    }
    gs.hud()?.bossCard(def.name, def.title);
    gs.fx.floatText(x, y - 120, MINIBOSS_LINES[kind] ?? '', '#efe4cc', 18, 2.2, undefined);
    gs.audio('roar', { volume: 0.7 });
    gs.fx.ring(x, y, def.color, 20, 220, 0.6, 'fx_ring_thick');
    gs.fx.shake(0.01, 400);
    return e;
  }

  update(e: Enemy, dt: number): void {
    const gs = this.gs;
    const L = gs.band.leader;
    // emerge
    if (!this.started) {
      e.d.spawnT += dt;
      const k = Math.min(1, e.d.spawnT / 0.8);
      e.sprite.setScale(INV_RES * (0.2 + 0.8 * Phaser.Math.Easing.Back.Out(k)));
      e.invulnerable = k < 1;
      if (k >= 1) this.started = true;
      return;
    }
    e.sprite.setScale(INV_RES);
    const dx = L.x - e.x;
    const dy = L.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (this.dash) {
      const d = this.dash;
      d.t += dt;
      const step = 620 * dt;
      e.x += Math.cos(d.angle) * step;
      e.y += Math.sin(d.angle) * step;
      d.len -= step;
      if (dist < e.radius + 16) gs.hurtPlayer(15 * gs.enemies.dmgScale(), e.x, e.y, 'boss:dash');
      if (Math.random() < 0.6) gs.fx.sparks(e.x, e.y, 0xff8a1a, 1);
      if (d.len <= 0 || !gs.terrain.isWalkable(e.x, e.y)) this.dash = null;
      this.keepHome(e);
      return;
    }
    if (this.sweep) {
      const s = this.sweep;
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      const a = s.a0 + (s.a1 - s.a0) * k;
      const ox = e.x;
      const oy = e.y - 30;
      gs.fx.lightning(ox, oy, ox + Math.cos(a) * s.len, oy + Math.sin(a) * s.len, 0xffb02a, 6, 0.05, 4);
      const px = L.x - ox;
      const py = L.y - 12 - oy;
      const pd = Math.hypot(px, py);
      if (pd < s.len) {
        let da = Math.atan2(py, px) - a;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) * pd < 22) gs.hurtPlayer(12 * gs.enemies.dmgScale(), ox, oy, 'boss:sweep');
      }
      if (s.t >= s.dur) this.sweep = null;
    }

    // hover at a preferred distance while patterns run
    const pref = this.kind === 'percussionist' ? 200 : this.kind === 'warden' ? 230 : 170;
    let mvx = 0;
    let mvy = 0;
    if (dist > pref + 30) {
      mvx = dx / dist;
      mvy = dy / dist;
    } else if (dist < pref - 50) {
      mvx = (-dx / dist) * 0.5;
      mvy = (-dy / dist) * 0.5;
    }
    if (this.kind === 'percussionist') {
      mvx += (-dy / dist) * 0.7;
      mvy += (dx / dist) * 0.7;
    }
    const sp = e.speed * gs.band.lowEndSlowAt(e.x, e.y) * (e.slowMul || 1);
    const p = gs.terrain.moveSimple(e.x, e.y, mvx * sp * dt, mvy * sp * dt);
    e.x = p[0];
    e.y = p[1];
    this.keepHome(e);

    if (this.kind === 'warden' && e.extra) {
      const b = gs.beat.beat;
      const swing = Math.sin(b * Math.PI) * 0.7 * this.swingSide;
      e.extra.setPosition(e.x, e.y - 150).setRotation(swing).setDepth(e.y + 1).setVisible(true);
    }
    this.spawnT -= dt;
  }

  private keepHome(e: Enemy): void {
    const hx = e.x - this.homeX;
    const hy = e.y - this.homeY;
    const hd = Math.hypot(hx, hy);
    if (hd > 400) {
      e.x = this.homeX + (hx / hd) * 400;
      e.y = this.homeY + (hy / hd) * 400;
    }
  }

  onBeat(e: Enemy, _beat: number): void {
    if (!this.started || this.dash) return;
    const pat = this.patterns[this.pi];
    this.runPattern(e, pat.name, this.pb);
    this.pb++;
    if (this.pb >= pat.beats) {
      this.pb = 0;
      this.pi = (this.pi + 1) % this.patterns.length;
    }
  }

  onDeath(e: Enemy): void {
    const gs = this.gs;
    e.extra?.setVisible(false);
    gs.fx.ring(e.x, e.y, MINIBOSSES[this.kind].color, 20, 260, 0.7, 'fx_ring_thick');
    gs.fx.death(e.x, e.y - 40, MINIBOSSES[this.kind].color, true);
    gs.fx.death(e.x + 30, e.y - 20, 0xffffff, true);
    gs.audio('killBig', { volume: 0.9 });
    gs.audio('boom', { volume: 0.6 });
    gs.fx.shake(0.014, 500);
    gs.hitStop(0.12);
    gs.pickups.dropXp(e.x, e.y, 30);
    gs.pickups.drop('water', e.x - 20, e.y);
    gs.pickups.drop('amp', e.x + 20, e.y);
    gs.run.recordKill(true);
    this.onDefeat();
  }

  // ------------------------------------------------------------------ patterns

  private dmg(base: number): number {
    return base * this.gs.enemies.dmgScale();
  }

  private runPattern(e: Enemy, name: string, b: number): void {
    const gs = this.gs;
    const L = gs.band.leader;
    const toL = Math.atan2(L.y - e.y, L.x - e.x);
    switch (name) {
      // ---------------- GRAND MARACON
      case 'fans': {
        // alternating rattles: warn on beat 1, fire on beat 2 (twice per pattern)
        if (b % 4 === 0) {
          this.aim = toL + (b % 8 === 0 ? -0.18 : 0.18);
          gs.tele.add({ kind: 'cone', x: e.x, y: e.y - 20, r: 220, angle: this.aim, width: 0.6, dur: 0.46, color: RED, owner: e });
          gs.audio('rattle', { volume: 0.4 });
        } else if (b % 4 === 1) {
          const side = b % 8 === 1 ? -1 : 1;
          const ox = e.x + side * 40;
          for (let i = 0; i < 9; i++) gs.shots.fireEnemy('p_seed', ox, e.y - 30, this.aim + (i - 4) * 0.13, 165 + (i % 2) * 30, this.dmg(7), { life: 2.6 });
          gs.audio('enemyShot', { volume: 0.4 });
        }
        break;
      }
      case 'charge': {
        if (b === 0) {
          this.aim = toL;
          gs.tele.add({ kind: 'line', x: e.x, y: e.y, r: 380, angle: this.aim, width: 46, dur: 0.9, color: RED, owner: e });
          gs.audio('roar', { volume: 0.35, rate: 1.4 });
        } else if (b === 2) {
          this.dash = { ax: e.x, ay: e.y, len: 380, t: 0, angle: this.aim };
        }
        break;
      }
      case 'summon': {
        if (b === 0) {
          gs.director.waveAround(e.x, e.y, ['tick', 'tick', 'maraca'], 6, 120);
          gs.fx.ring(e.x, e.y, 0xff4a2a, 10, 140, 0.4);
          gs.audio('rattle', { volume: 0.5, rate: 0.7 });
        }
        break;
      }
      // ---------------- BRASS BELCHER
      case 'belch': {
        if (b === 0) {
          this.aim = toL;
          gs.tele.add({ kind: 'cone', x: e.x, y: e.y - 20, r: 280, angle: this.aim, width: 0.62, dur: 0.94, color: RED, owner: e });
          gs.audio('brass', { volume: 0.4, rate: 0.6 });
          setFrame(e.sprite, `b_${this.kind}_1`);
        } else if (b === 2) {
          const pd = Math.hypot(L.x - e.x, L.y - e.y);
          let da = Math.atan2(L.y - e.y, L.x - e.x) - this.aim;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (pd < 290 && Math.abs(da) < 0.62) {
            gs.hurtPlayer(this.dmg(16), e.x, e.y, 'boss:belch');
            gs.band.shove(Math.cos(this.aim) * 250, Math.sin(this.aim) * 250);
          }
          for (let i = 0; i < 11; i++) gs.shots.fireEnemy('p_note', e.x, e.y - 30, this.aim + (i - 5) * 0.11, 240, this.dmg(8), { life: 1.4 });
          gs.audio('brass', { volume: 0.8 });
          gs.fx.shake(0.008, 200);
        }
        break;
      }
      case 'bubbles': {
        if (b === 0) {
          for (let i = -1; i <= 1; i++) {
            gs.shots.fireEnemy('p_bubble', e.x, e.y - 40, toL + i * 0.45, 120, this.dmg(10), { life: 2.2, burstAt: 1.1, spin: Math.random() * 3, weak: false });
          }
          gs.audio('brass', { volume: 0.3, rate: 1.4 });
        }
        break;
      }
      case 'sweep': {
        if (b === 0) {
          const center = toL;
          const side = Math.random() < 0.5 ? -1 : 1;
          this.aim = center;
          e.d.sweepSide = side;
          gs.tele.add({ kind: 'cone', x: e.x, y: e.y - 30, r: 340, angle: center, width: 1.05, dur: 0.94, color: RED, owner: e });
          gs.audio('brass', { volume: 0.35, rate: 0.5 });
        } else if (b === 2) {
          const side = e.d.sweepSide;
          this.sweep = { a0: this.aim - 1.05 * side, a1: this.aim + 1.05 * side, t: 0, dur: 0.46875 * 4, len: 340 };
          gs.audio('brass', { volume: 0.7, rate: 0.8 });
        }
        break;
      }
      // ---------------- PERCUSSIONIST
      case 'slams': {
        if (b % 2 === 1) break;
        const tx = L.x + L.vx * 0.3;
        const ty = L.y + L.vy * 0.3;
        gs.tele.add({ kind: 'circle', x: tx, y: ty, r: 72, dur: 0.9375, color: RED });
        gs.combat.after(0.9375, () => {
          gs.fx.ring(tx, ty, 0x2fe6ff, 10, 80, 0.25, 'fx_ring_thick');
          gs.audio('kick', { volume: 0.5, rate: 0.8 });
          if (Math.hypot(gs.band.leader.x - tx, gs.band.leader.y - ty) < 72 + 8) gs.hurtPlayer(this.dmg(14), tx, ty, 'boss:slam');
        });
        break;
      }
      case 'rimshot': {
        if (b === 0) {
          const n = 20;
          const gap = toL + (Math.random() - 0.5) * 1.2;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            let da = a - gap;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            if (Math.abs(da) < 0.55) continue; // the way through
            gs.shots.fireEnemy('p_orb', e.x, e.y - 30, a, 135, this.dmg(8), { life: 3.5 });
          }
          gs.audio('snare', { volume: 0.5 });
        }
        break;
      }
      case 'cymbals': {
        if (b === 0) {
          for (let i = -1; i <= 1; i++) gs.shots.fireEnemy('p_jingle', e.x, e.y - 40, toL + i * 0.35, 260, this.dmg(12), { life: 2.2, accel: -60, radius: 10 });
          gs.audio('crash', { volume: 0.4 });
        }
        break;
      }
      // ---------------- TEMPO WARDEN
      case 'tickring': {
        gs.audio('tick', { volume: 0.5, rate: b % 4 === 0 ? 0.8 : 1.3 });
        if (b % 4 === 3) gs.tele.add({ kind: 'ring', x: e.x, y: e.y - 60, r: 90, inner: 40, dur: 0.46, color: 0x8a7cff, owner: e });
        if (b % 4 === 0) {
          const n = 14;
          const off = (b / 4) % 2 ? Math.PI / n : 0;
          for (let i = 0; i < n; i++) gs.shots.fireEnemy('p_shard', e.x, e.y - 60, off + (i / n) * Math.PI * 2, 125, this.dmg(7), { life: 4 });
        }
        if (b % 4 === 2) for (let i = -1; i <= 1; i++) gs.shots.fireEnemy('p_shard', e.x, e.y - 60, toL + i * 0.14, 220, this.dmg(7), { life: 3 });
        break;
      }
      case 'pendulum': {
        if (b % 2 === 0) {
          this.swingSide = -this.swingSide;
          this.aim = toL;
          gs.tele.add({ kind: 'cone', x: e.x, y: e.y - 20, r: 270, angle: toL + this.swingSide * 0.45, width: 0.5, dur: 0.46, color: 0x8a7cff, owner: e });
        } else {
          const a = this.aim + this.swingSide * 0.45;
          const pd = Math.hypot(L.x - e.x, L.y - e.y);
          let da = Math.atan2(L.y - e.y, L.x - e.x) - a;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (pd < 280 && Math.abs(da) < 0.5) gs.hurtPlayer(this.dmg(15), e.x, e.y, 'boss:pendulum');
          gs.fx.lightning(e.x, e.y - 60, e.x + Math.cos(a) * 270, e.y - 20 + Math.sin(a) * 270, 0xb0a4ff, 8, 0.12, 4);
          gs.audio('tick', { volume: 0.7, rate: 0.6 });
          gs.fx.shake(0.004, 80);
        }
        break;
      }
      case 'accel': {
        if (b === 3) break;
        const n = 8;
        const off = b * 0.3;
        for (let i = 0; i < n; i++) gs.shots.fireEnemy('p_shard', e.x, e.y - 60, off + (i / n) * Math.PI * 2, 155, this.dmg(7), { life: 3 });
        gs.audio('tick', { volume: 0.6, rate: 1.6 });
        break;
      }
    }
  }
}

/** The siphon machine holding a bandmate; shielded until its guardian falls. */
export class SiphonCoreBrain implements Brain {
  private beats = 0;
  constructor(
    private gs: GameScene,
    private onBreak: (e: Enemy) => void,
  ) {}

  update(e: Enemy): void {
    const pulse = this.gs.beat.pulse(4);
    e.sprite.setScale(INV_RES * (1 + 0.06 * pulse));
    if (e.aura) e.aura.setPosition(e.x, e.y - 40).setVisible(e.invulnerable).setRotation(this.gs.beat.beat * 0.5).setDepth(e.y + 2);
  }

  onBeat(e: Enemy): void {
    if (e.invulnerable) return;
    this.beats++;
    if (this.beats % 8 === 0) this.gs.director.waveAround(e.x, e.y, ['tick', 'maraca'], 3, 200);
  }

  onDeath(e: Enemy): void {
    this.onBreak(e);
  }
}
