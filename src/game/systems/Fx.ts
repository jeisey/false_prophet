/**
 * Visual effects: pooled rings, lightning, particles, damage numbers, float
 * text, screen shake / flash / hit-stop, and beat-reactive environment lights.
 * Decorative work is capped and scales down automatically on slow devices.
 */
import Phaser from 'phaser';
import { App } from '../../app';
import { FONT, INV_RES, img, particles, txt } from '../sceneUtil';
import { T } from '../art/atlas';
import type { GameScene } from '../scenes/GameScene';

export const DEPTH = {
  ground: -100000,
  groundDecal: -90000,
  pad: -85000,
  telegraph: -80000,
  pickup: -70000,
  shadow: -60000,
  // entities use their y (0..5600)
  shots: 20000,
  fx: 21000,
  lightning: 22000,
  numbers: 25000,
  worldUi: 30000,
};

interface Ring {
  img: Phaser.GameObjects.Image;
  t: number;
  dur: number;
  r0: number;
  r1: number;
  a0: number;
  active: boolean;
  follow?: { x: number; y: number };
}

interface Bolt {
  pts: number[];
  color: number;
  width: number;
  life: number;
  max: number;
}

interface Num {
  t: Phaser.GameObjects.BitmapText;
  life: number;
  vy: number;
  active: boolean;
}

interface FloatText {
  t: Phaser.GameObjects.Text;
  life: number;
  max: number;
  active: boolean;
  follow?: { x: number; y: number };
  dy: number;
}

interface Pulser {
  obj: Phaser.GameObjects.Image;
  baseAlpha: number;
  amp: number;
  baseScale: number;
  scaleAmp: number;
  bar: boolean;
}

export class Fx {
  private rings: Ring[] = [];
  private bolts: Bolt[] = [];
  private nums: Num[] = [];
  private floats: FloatText[] = [];
  private pulsers: Pulser[] = [];
  private lightningG: Phaser.GameObjects.Graphics;
  spark: Phaser.GameObjects.Particles.ParticleEmitter;
  shard: Phaser.GameObjects.Particles.ParticleEmitter;
  glow: Phaser.GameObjects.Particles.ParticleEmitter;
  smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  notes: Phaser.GameObjects.Particles.ParticleEmitter;
  /** 1 = full decorative detail; lowered automatically when frames are slow. */
  quality = 1;
  private slowFrames = 0;

  constructor(private gs: GameScene) {
    const scene = gs;
    this.lightningG = scene.add.graphics().setDepth(DEPTH.lightning).setBlendMode(Phaser.BlendModes.ADD);
    this.spark = particles(scene, 0, 0, 'fx_spark', {
      speed: { min: 120, max: 380 },
      lifespan: { min: 180, max: 420 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: 0,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(DEPTH.fx);
    // align sparks with their velocity
    this.spark.particleRotate = { onEmit: (p?: Phaser.GameObjects.Particles.Particle) => (p ? Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) : 0) } as any;
    this.shard = particles(scene, 0, 0, 'fx_shard', {
      speed: { min: 80, max: 260 },
      lifespan: { min: 300, max: 650 },
      scale: { start: 0.9, end: 0.2 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      gravityY: 240,
      emitting: false,
    }).setDepth(DEPTH.fx);
    this.glow = particles(scene, 0, 0, 'fx_glow', {
      speed: { min: 10, max: 60 },
      lifespan: { min: 200, max: 400 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.8, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(DEPTH.fx);
    this.smoke = particles(scene, 0, 0, 'fx_smoke', {
      speed: { min: 10, max: 50 },
      lifespan: { min: 500, max: 900 },
      scale: { start: 0.5, end: 1.2 },
      alpha: { start: 0.35, end: 0 },
      tint: 0x1a1420,
      emitting: false,
    }).setDepth(DEPTH.fx - 1);
    this.notes = particles(scene, 0, 0, 'fx_note', {
      speed: { min: 30, max: 90 },
      angle: { min: 240, max: 300 },
      lifespan: 900,
      scale: { start: 0.55, end: 0.2 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(DEPTH.fx);
  }

  // ------------------------------------------------------------------ particles

  burst(emitter: Phaser.GameObjects.Particles.ParticleEmitter, x: number, y: number, color: number, count: number): void {
    const n = Math.max(1, Math.round(count * this.quality));
    emitter.particleTint = color;
    emitter.explode(n, x, y);
  }

  sparks(x: number, y: number, color: number, count = 6): void {
    this.burst(this.spark, x, y, color, count);
  }

  death(x: number, y: number, color: number, big = false): void {
    this.burst(this.shard, x, y, color, big ? 18 : 7);
    this.burst(this.glow, x, y, color, big ? 6 : 2);
    if (big) this.burst(this.smoke, x, y, 0x1a1420, 6);
  }

  musicNotes(x: number, y: number, color: number, count = 2): void {
    this.burst(this.notes, x, y, color, count);
  }

  // ------------------------------------------------------------------ rings

  ring(x: number, y: number, color: number, r0: number, r1: number, dur: number, tex = 'fx_ring', alpha = 1, depth: number = DEPTH.fx, follow?: { x: number; y: number }): void {
    let r = this.rings.find((q) => !q.active);
    if (!r) {
      if (this.rings.length >= 64) {
        r = this.rings[0];
        this.rings.push(this.rings.shift()!);
      } else {
        r = { img: img(this.gs, 0, 0, tex), t: 0, dur: 1, r0: 0, r1: 1, a0: 1, active: false };
        this.rings.push(r);
      }
    }
    if (r.img.frame.name !== tex) r.img.setTexture(...T(tex));
    r.img.setVisible(true).setPosition(x, y).setTint(color).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    r.t = 0;
    r.dur = dur;
    r.r0 = r0;
    r.r1 = r1;
    r.a0 = alpha;
    r.active = true;
    r.follow = follow;
    this.applyRing(r);
  }

  private applyRing(r: Ring): void {
    const k = Math.min(1, r.t / r.dur);
    const e = 1 - Math.pow(1 - k, 3);
    const rad = r.r0 + (r.r1 - r.r0) * e;
    r.img.setScale((rad / 60) * INV_RES);
    r.img.setAlpha(r.a0 * (1 - k));
    if (r.follow) r.img.setPosition(r.follow.x, r.follow.y);
  }

  // ------------------------------------------------------------------ lightning

  lightning(x1: number, y1: number, x2: number, y2: number, color: number, width = 3, life = 0.14, jag = 14): void {
    if (this.bolts.length > 40) this.bolts.shift();
    const d = Math.hypot(x2 - x1, y2 - y1);
    const seg = Math.max(3, Math.min(10, Math.floor(d / 22)));
    const pts: number[] = [x1, y1];
    const nx = -(y2 - y1) / (d || 1);
    const ny = (x2 - x1) / (d || 1);
    for (let i = 1; i < seg; i++) {
      const t = i / seg;
      const off = (Math.random() - 0.5) * 2 * jag;
      pts.push(x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off);
    }
    pts.push(x2, y2);
    this.bolts.push({ pts, color, width, life, max: life });
  }

  // ------------------------------------------------------------------ numbers + text

  number(x: number, y: number, value: number, color: number, crit = false): void {
    if (!App.store.settings.damageNumbers) return;
    let n = this.nums.find((q) => !q.active);
    if (!n) {
      if (this.nums.length >= 36) {
        n = this.nums.reduce((a, b) => (a.life < b.life ? a : b));
      } else {
        const t = this.gs.add.bitmapText(0, 0, 'dmg', '0').setOrigin(0.5).setDepth(DEPTH.numbers);
        n = { t, life: 0, vy: 0, active: false };
        this.nums.push(n);
      }
    }
    n.active = true;
    n.life = 0.6;
    n.vy = -60;
    n.t.setText(crit ? `${Math.round(value)}!` : `${Math.round(value)}`);
    n.t.setPosition(x + (Math.random() - 0.5) * 14, y - 18);
    n.t.setScale((crit ? 0.8 : 0.55) * 1).setTint(crit ? 0xffe066 : color).setVisible(true).setAlpha(1);
  }

  floatText(x: number, y: number, text: string, color: string, size = 18, life = 1.2, follow?: { x: number; y: number }, font = FONT.brush): void {
    let f = this.floats.find((q) => !q.active);
    if (!f) {
      if (this.floats.length >= 12) f = this.floats[0];
      else {
        const t = txt(this.gs, 0, 0, '', { fontFamily: font, fontSize: '18px', color: '#fff', stroke: '#07060a', strokeThickness: 5, align: 'center', wordWrap: { width: 300 } })
          .setOrigin(0.5, 1)
          .setDepth(DEPTH.worldUi);
        f = { t, life: 0, max: 1, active: false, dy: 0 };
        this.floats.push(f);
      }
    }
    f.active = true;
    f.life = life;
    f.max = life;
    f.follow = follow;
    f.dy = 0;
    f.t.setFontFamily(font).setText(text).setColor(color).setFontSize(size).setPosition(x, y).setVisible(true).setAlpha(1);
  }

  // ------------------------------------------------------------------ screen

  shake(intensity: number, ms = 160): void {
    const k = App.store.settings.reducedShake ? 0.2 : 1;
    if (k * intensity < 0.0006) return;
    this.gs.cameras.main.shake(ms, intensity * k);
  }

  flash(color: number, alpha: number, ms = 180): void {
    const a = App.store.settings.reducedFlash ? Math.min(alpha, 0.12) : alpha;
    this.gs.hud()?.flash(color, a, ms);
  }

  // ------------------------------------------------------------------ beat-reactive lights

  addPulser(obj: Phaser.GameObjects.Image, amp = 0.4, scaleAmp = 0.08, bar = false): void {
    this.pulsers.push({ obj, baseAlpha: obj.alpha, amp, baseScale: obj.scaleX, scaleAmp, bar });
  }

  // ------------------------------------------------------------------ frame

  update(dt: number, realDt: number, beatPulse: number, barPulse: number): void {
    // adaptive quality: drop decorative detail when frames are consistently slow
    if (realDt > 1 / 40) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 90 && this.quality > 0.4) {
      this.quality = Math.max(0.4, this.quality - 0.2);
      this.slowFrames = 0;
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      if (r.t >= r.dur) {
        r.active = false;
        r.img.setVisible(false);
        continue;
      }
      this.applyRing(r);
    }

    const g = this.lightningG;
    g.clear();
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.bolts.splice(i, 1);
        continue;
      }
      const a = b.life / b.max;
      g.lineStyle(b.width * 3, b.color, 0.35 * a);
      g.beginPath();
      g.moveTo(b.pts[0], b.pts[1]);
      for (let k = 2; k < b.pts.length; k += 2) g.lineTo(b.pts[k], b.pts[k + 1]);
      g.strokePath();
      g.lineStyle(b.width, 0xffffff, a);
      g.strokePath();
    }

    for (const n of this.nums) {
      if (!n.active) continue;
      n.life -= realDt;
      n.t.y += n.vy * realDt;
      n.vy *= 0.92;
      n.t.setAlpha(Math.min(1, n.life * 3));
      if (n.life <= 0) {
        n.active = false;
        n.t.setVisible(false);
      }
    }
    for (const f of this.floats) {
      if (!f.active) continue;
      f.life -= realDt;
      f.dy -= 14 * realDt;
      if (f.follow) f.t.setPosition(f.follow.x, f.follow.y - 70 + f.dy);
      else f.t.y -= 14 * realDt;
      f.t.setAlpha(Math.min(1, f.life * 2.5, (f.max - f.life) * 8));
      if (f.life <= 0) {
        f.active = false;
        f.t.setVisible(false);
      }
    }

    const cam = this.gs.cameras.main.worldView;
    for (const p of this.pulsers) {
      if (!p.obj.visible) continue;
      if (p.obj.x < cam.x - 200 || p.obj.x > cam.right + 200 || p.obj.y < cam.y - 200 || p.obj.y > cam.bottom + 300) continue;
      const k = p.bar ? barPulse : beatPulse;
      p.obj.setAlpha(Math.min(1, p.baseAlpha + p.amp * k));
      if (p.scaleAmp) p.obj.setScale(p.baseScale * (1 + p.scaleAmp * k));
    }
  }
}

