/**
 * Skippable illustrated intro (~19s). Does NOT consume run time: the 18:00
 * clock only starts once gameplay begins.
 */
import Phaser from 'phaser';
import { App } from '../../app';
import { BAND } from '../../data/band';
import { INTRO_PANELS } from '../../data/lore';
import { beginGameplay } from '../../flow';
import { layout } from '../Layout';
import { FONT, img, INV_RES, particles, setFrame, setupScreenCamera, txt } from '../sceneUtil';
import type { SfxName } from '../../audio/sfxBank';

const DURATIONS = [3.4, 3.4, 3.4, 3.2, 2.3, 3.4];

export class IntroScene extends Phaser.Scene {
  private panel = -1;
  private t = 0;
  private layer!: Phaser.GameObjects.Container;
  private g!: Phaser.GameObjects.Graphics;
  private caption!: Phaser.GameObjects.Text;
  private captionBox!: Phaser.GameObjects.Rectangle;
  private plane: Phaser.GameObjects.Image | null = null;
  private hero: Phaser.GameObjects.Image | null = null;
  private done = false;
  private flash!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('intro');
  }

  create(): void {
    this.panel = -1;
    this.done = false;
    setupScreenCamera(this);
    const s = layout.state;
    this.cameras.main.setBackgroundColor('#05030a');
    this.layer = this.add.container(0, 0);
    this.g = this.add.graphics();
    this.captionBox = this.add.rectangle(s.W / 2, s.H - 150 - s.safe.bottom, s.W - 40, 96, 0x07060a, 0.92).setStrokeStyle(2, 0xb3121d);
    this.caption = txt(this, s.W / 2, s.H - 150 - s.safe.bottom, '', {
      fontFamily: FONT.brush,
      fontSize: '25px',
      color: '#efe4cc',
      align: 'center',
      wordWrap: { width: s.W - 80 },
    }).setOrigin(0.5);
    this.flash = this.add.rectangle(0, 0, s.W, s.H, 0xffffff, 0).setOrigin(0).setDepth(50);
    App.ui.showSkip(() => this.finish());
    this.input.on('pointerdown', () => this.next());
    this.input.keyboard?.on('keydown-SPACE', () => this.next());
    this.input.keyboard?.on('keydown-ENTER', () => this.next());
    this.next();
  }

  private next(): void {
    if (this.done) return;
    this.panel++;
    if (this.panel >= INTRO_PANELS.length) {
      this.finish();
      return;
    }
    this.t = 0;
    this.buildPanel(this.panel);
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    App.store.markIntroWatched();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.time.delayedCall(260, () => beginGameplay());
  }

  private sfx(name: SfxName | null, vol = 0.7): void {
    if (name) App.audio.playSfx(name, { volume: vol });
  }

  private buildPanel(i: number): void {
    const s = layout.state;
    const W = s.W;
    const H = s.H;
    this.layer.removeAll(true);
    this.tweens.killAll();
    this.plane = null;
    this.hero = null;
    const p = INTRO_PANELS[i];
    this.caption.setText(p.caption);
    this.captionBox.setVisible(!!p.caption);
    this.caption.setVisible(!!p.caption);
    this.sfx(p.sfx as SfxName | null, i === 4 ? 1 : 0.7);
    const cy = H * 0.42;

    // sky
    const sky = this.add.graphics();
    const top = i >= 1 && i <= 3 ? 0x1a0f2e : 0x0a0a1e;
    sky.fillGradientStyle(top, top, 0x05030a, 0x05030a, 1);
    sky.fillRect(0, 0, W, H);
    this.layer.add(sky);
    if (i === 0) {
      const sea = this.add.graphics();
      sea.fillStyle(0x06121c, 1);
      sea.fillRect(0, H * 0.62, W, H * 0.38);
      sea.fillStyle(0x2fe6ff, 0.08);
      for (let k = 0; k < 26; k++) sea.fillRect(Phaser.Math.Between(0, W), H * 0.63 + k * 12, Phaser.Math.Between(20, 90), 2);
      const moon = img(this, W * 0.78, H * 0.18, 'fx_glow').setTint(0xefe4cc).setScale(2.4 * INV_RES).setAlpha(0.8);
      const moonDisc = this.add.circle(W * 0.78, H * 0.18, 34, 0xe8dcc4);
      const shine = this.add.rectangle(W * 0.78, H * 0.63, 8, H * 0.3, 0xefe4cc, 0.12).setOrigin(0.5, 0);
      this.layer.add([sea, moon, moonDisc, shine]);
      for (let k = 0; k < 5; k++) {
        const c = this.add.ellipse(Phaser.Math.Between(0, W), Phaser.Math.Between(80, H * 0.5), Phaser.Math.Between(160, 280), Phaser.Math.Between(30, 60), 0x1a1830, 0.6);
        this.layer.add(c);
        this.tweens.add({ targets: c, x: c.x - 60, duration: 3400 });
      }
    }
    if (i === 0 || i === 5) {
      const stars = this.add.graphics();
      for (let k = 0; k < 90; k++) {
        stars.fillStyle(0xefe4cc, Math.random() * 0.7 + 0.1);
        stars.fillCircle(Math.random() * W, Math.random() * H * 0.6, Math.random() * 1.3 + 0.3);
      }
      this.layer.add(stars);
    }

    if (i <= 3) {
      if (i >= 1) {
        // roiling storm clouds rushing in
        for (let k = 0; k < 18; k++) {
          const cloud = this.add.ellipse(k % 2 ? -200 : W + 200, Phaser.Math.Between(40, H * 0.75), Phaser.Math.Between(220, 380), Phaser.Math.Between(80, 150), k % 3 ? 0x2a1840 : 0x3a1f52, 0.55);
          this.layer.add(cloud);
          this.tweens.add({ targets: cloud, x: Phaser.Math.Between(0, W), duration: i === 1 ? 1600 + k * 60 : 400, ease: 'Cubic.easeOut' });
        }
      }
      this.plane = img(this, i === 0 ? -80 : W / 2, cy, 'lm_plane_side').setScale(1.3 * INV_RES);
      this.layer.add(this.plane);
      if (i === 0) {
        this.tweens.add({ targets: this.plane, x: W + 80, duration: 3400, ease: 'Linear' });
        const nav = this.add.circle(0, 0, 3, 0xff2a2a);
        this.layer.add(nav);
        this.tweens.add({ targets: nav, alpha: 0.1, yoyo: true, repeat: -1, duration: 230 });
        const follow = () => { if (!nav.active) { this.events.off('update', follow); return; } if (this.plane) nav.setPosition(this.plane.x + 50, this.plane.y - 10); }; this.events.on('update', follow);
      }
      if (i === 3) {
        this.tweens.add({ targets: this.plane, angle: 380, y: cy + 200, scale: 0.8 * INV_RES, duration: 3200, ease: 'Quad.easeIn' });
        // the band's resonance screaming out of the fuselage
        for (const id of ['lead', 'rhythm', 'bass', 'drums', 'vocals'] as const) {
          const e = particles(this, W / 2, cy, 'fx_spark', {
            speed: { min: 180, max: 360 },
            angle: { min: 0, max: 360 },
            lifespan: 700,
            scale: { start: 1, end: 0 },
            tint: BAND[id].color,
            blendMode: 'ADD',
            frequency: 70,
            rotate: { onEmit: (_p, _k, v) => v },
          } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig);
          e.startFollow(this.plane);
          this.layer.add(e);
        }
      }
    }
    if (i === 4) {
      this.flash.setAlpha(App.store.settings.reducedFlash ? 0.35 : 1);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: 900 });
      if (!App.store.settings.reducedShake) this.cameras.main.shake(700, 0.02);
      App.haptic([80, 40, 120]);
      const crash = txt(this, W / 2, cy, 'CRASH.', { fontFamily: FONT.display, fontSize: '120px', color: '#ff2a2a', stroke: '#07060a', strokeThickness: 10 })
        .setOrigin(0.5)
        .setScale(3)
        .setAngle(-8);
      this.layer.add(crash);
      this.tweens.add({ targets: crash, scale: 1, duration: 260, ease: 'Back.easeOut' });
      const debris = particles(this, W / 2, cy, 'fx_shard', {
        speed: { min: 200, max: 600 },
        lifespan: 1600,
        gravityY: 600,
        scale: { min: 0.6, max: 1.4 },
        tint: [0xc9ccd6, 0xff6a1f, 0x5a5a60],
        rotate: { min: 0, max: 360 },
        emitting: false,
      });
      debris.explode(60);
      this.layer.add(debris);
      this.time.delayedCall(80, () => this.sfx('crash', 0.8));
    }
    if (i === 5) {
      // wake on the beach
      const beach = this.add.graphics();
      beach.fillStyle(0x0a2a33, 1);
      beach.fillRect(0, H * 0.46, W, H * 0.1);
      beach.fillStyle(0x2fe6ff, 0.18);
      for (let k = 0; k < 8; k++) beach.fillRect(Phaser.Math.Between(0, W), H * 0.47 + k * 6, Phaser.Math.Between(30, 120), 2);
      beach.fillStyle(0x2a221d, 1);
      beach.fillRect(0, H * 0.55, W, H * 0.45);
      this.layer.add(beach);
      const wreck = img(this, W * 0.24, H * 0.55, 'lm_fuselage').setScale(0.5 * INV_RES).setAlpha(0.8);
      const fire = img(this, W * 0.2, H * 0.56, 'fx_glow').setTint(0xff6a1f).setBlendMode(Phaser.BlendModes.ADD).setScale(3 * INV_RES).setAlpha(0.5);
      this.layer.add([wreck, fire]);
      this.tweens.add({ targets: fire, alpha: 0.25, yoyo: true, repeat: -1, duration: 240 });
      const starter = App.run?.starter ?? 'lead';
      const glow = img(this, W / 2, H * 0.66, 'fx_glow').setTint(BAND[starter].color).setBlendMode(Phaser.BlendModes.ADD).setScale(5 * INV_RES).setAlpha(0);
      this.hero = img(this, W / 2, H * 0.72, `m_${starter}_idle0`).setOrigin(0.5, 84 / 88).setScale(3 * INV_RES).setAlpha(0);
      this.layer.add([glow, this.hero]);
      this.tweens.add({ targets: [this.hero], alpha: 1, duration: 600 });
      this.tweens.add({ targets: glow, alpha: 0.7, duration: 1200, yoyo: true, repeat: -1 });
      const bubble = txt(this, W / 2 + 10, H * 0.72 - 290, BAND[starter].wakeLine, {
        fontFamily: FONT.brush,
        fontSize: '34px',
        color: '#07060a',
        backgroundColor: '#efe4cc',
        padding: { x: 18, y: 10 },
      })
        .setOrigin(0.5)
        .setAlpha(0);
      this.layer.add(bubble);
      this.tweens.add({ targets: bubble, alpha: 1, delay: 900, duration: 200 });
      const name = txt(this, W / 2, H * 0.84, `${BAND[starter].name} — ${BAND[starter].role}`, {
        fontFamily: FONT.ui,
        fontStyle: '700',
        fontSize: '20px',
        color: BAND[starter].colorCss,
      }).setOrigin(0.5);
      this.layer.add(name);
    }
    // panel frame (torn comic border)
    this.g.clear();
    this.g.lineStyle(10, 0x07060a, 1);
    this.g.strokeRect(6, 6 + s.safe.top, W - 12, H - 12 - s.safe.top - s.safe.bottom);
    this.g.lineStyle(2, 0xefe4cc, 0.25);
    this.g.strokeRect(14, 14 + s.safe.top, W - 28, H - 28 - s.safe.top - s.safe.bottom);
    this.children.bringToTop(this.g);
    this.children.bringToTop(this.captionBox);
    this.children.bringToTop(this.caption);
    this.children.bringToTop(this.flash);
  }

  update(_time: number, dms: number): void {
    if (this.done) return;
    const dt = dms / 1000;
    this.t += dt;
    const W = layout.state.W;
    const H = layout.state.H;
    if (this.panel === 1 && Math.random() < 0.03) {
      this.flash.setAlpha(App.store.settings.reducedFlash ? 0.05 : 0.25);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: 200 });
    }
    if (this.panel === 2 && this.plane) {
      // alien waveforms wrapping the plane
      const g = this.g;
      this.buildFrameOnly();
      const cx = this.plane.x;
      const cy = this.plane.y;
      for (let k = 0; k < 4; k++) {
        g.lineStyle(3, k % 2 ? 0xff2a2a : 0xb455ff, 0.85);
        g.beginPath();
        for (let x = -W * 0.1; x <= W * 1.1; x += 6) {
          const d = Math.abs(x - cx) / W;
          const amp = (40 + k * 18) * Math.max(0.15, 1 - d * 1.6) * Math.min(1, this.t / 1.2);
          const y = cy + Math.sin(x * 0.04 + this.t * (4 + k) + k) * amp;
          if (x <= -W * 0.1) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.strokePath();
      }
      this.plane.y = H * 0.42 + Math.sin(this.t * 20) * 3;
    }
    if (this.panel === 5 && this.hero) {
      setFrame(this.hero, `m_${App.run?.starter ?? 'lead'}_${Math.floor(this.t / 0.47) % 2 ? 'idle1' : 'idle0'}`);
    }
    if (this.t >= DURATIONS[this.panel]) this.next();
  }

  private buildFrameOnly(): void {
    const s = layout.state;
    this.g.clear();
    this.g.lineStyle(10, 0x07060a, 1);
    this.g.strokeRect(6, 6 + s.safe.top, s.W - 12, s.H - 12 - s.safe.top - s.safe.bottom);
  }
}
