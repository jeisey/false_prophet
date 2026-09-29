/**
 * Animated tour-poster backdrop behind the HTML menus: storm sky, red moon,
 * the wreck, skull mountain, and FALSE PROPHET standing on the rocks.
 */
import Phaser from 'phaser';
import { App } from '../../app';
import { BAND, MEMBER_ORDER, type MemberId } from '../../data/band';
import { BEAT_DURATION } from '../../config/audioConfig';
import { layout, type LayoutState } from '../Layout';
import { img, particles, setFrame, setupScreenCamera, INV_RES } from '../sceneUtil';

export class BackdropScene extends Phaser.Scene {
  private band = new Map<MemberId, Phaser.GameObjects.Image>();
  private glows = new Map<MemberId, Phaser.GameObjects.Image>();
  private sky!: Phaser.GameObjects.Graphics;
  private ground!: Phaser.GameObjects.Graphics;
  private flash!: Phaser.GameObjects.Rectangle;
  private bolts!: Phaser.GameObjects.Graphics;
  private moon!: Phaser.GameObjects.Container;
  private wreck!: Phaser.GameObjects.Image;
  private focus: MemberId | null = null;
  private mode: 'title' | 'select' | 'hidden' = 'title';
  private t = 0;
  private nextBolt = 1.5;
  private boltLife = 0;

  constructor() {
    super('backdrop');
  }

  create(): void {
    setupScreenCamera(this);
    this.sky = this.add.graphics();
    this.moon = this.add.container(0, 0);
    const moonGlow = img(this, 0, 0, 'fx_glow').setTint(0xff2a2a).setAlpha(0.55).setScale(4.2 * INV_RES);
    const moonDisc = this.add.circle(0, 0, 62, 0x5a0a10);
    const sig = img(this, 0, 0, 'sigil').setScale(1.6 * INV_RES).setAlpha(0.8);
    this.moon.add([moonGlow, moonDisc, sig]);
    this.bolts = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.ground = this.add.graphics();
    this.wreck = img(this, 0, 0, 'lm_fuselage').setAlpha(0.95);
    for (const id of MEMBER_ORDER) {
      const g = img(this, 0, 0, 'fx_glow').setTint(BAND[id].color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
      this.glows.set(id, g);
      this.band.set(id, img(this, 0, 0, `m_${id}_idle0`));
    }
    particles(this, 0, 0, 'fx_dot', {
      x: { min: 0, max: 540 },
      y: { min: 900, max: 1300 },
      lifespan: 6000,
      speedY: { min: -40, max: -15 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.35, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xff6a1f, 0xff2a2a, 0xffb02a],
      blendMode: 'ADD',
      frequency: 180,
    });
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xd8c8ff, 0).setOrigin(0);

    this.layoutAll(layout.state);
    const onLayout = (s: LayoutState) => {
      setupScreenCamera(this);
      this.layoutAll(s);
    };
    this.game.events.on('layout', onLayout);
    this.events.once('shutdown', () => this.game.events.off('layout', onLayout));
  }

  setMode(mode: 'title' | 'select' | 'hidden', focus: MemberId | null = null): void {
    this.mode = mode;
    this.focus = focus;
    this.layoutAll(layout.state);
  }

  private layoutAll(s: LayoutState): void {
    const W = s.W;
    const H = s.H;
    // sky
    const g = this.sky;
    g.clear();
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const t = i / bands;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x1a0f2e),
        Phaser.Display.Color.ValueToColor(0x05030a),
        100,
        Math.round(t * 100),
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (H * i) / bands, W, H / bands + 1);
    }
    // storm clouds
    const rnd = new Phaser.Math.RandomDataGenerator(['fp']);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(i % 3 ? 0x2a1840 : 0x3a1f52, 0.22);
      g.fillEllipse(rnd.between(-40, W + 40), rnd.between(40, H * 0.4), rnd.between(120, 260), rnd.between(40, 90));
    }
    // stars
    for (let i = 0; i < 70; i++) {
      g.fillStyle(0xefe4cc, rnd.realInRange(0.2, 0.7));
      g.fillCircle(rnd.between(0, W), rnd.between(0, H * 0.45), rnd.realInRange(0.5, 1.4));
    }
    this.moon.setPosition(W / 2, H * 0.1 + s.safe.top);

    // ground: jagged rock + mountains + skull peak
    const gr = this.ground;
    gr.clear();
    const horizon = H * 0.56;
    gr.fillStyle(0x0c0812, 1);
    gr.beginPath();
    gr.moveTo(0, horizon + 40);
    const peaks = [0, 40, 60, 10, 120, 70, 170, 20, 240, 60, 300, -20, 360, 50, 420, 0, 480, 60, 540, 30];
    for (let i = 0; i < peaks.length; i += 2) gr.lineTo(peaks[i] * (W / 540), horizon + peaks[i + 1] - 60);
    gr.lineTo(W, H);
    gr.lineTo(0, H);
    gr.closePath();
    gr.fillPath();
    // skull mountain eyes
    gr.fillStyle(0xff2a2a, 0.9);
    gr.fillEllipse(W * 0.56 - 12, horizon - 40, 10, 6);
    gr.fillEllipse(W * 0.56 + 12, horizon - 40, 10, 6);
    // waterfall hints
    gr.fillStyle(0x2fe6ff, 0.12);
    gr.fillRect(W * 0.72, horizon - 30, 6, 90);
    gr.fillRect(W * 0.76, horizon - 20, 4, 70);
    // foreground rock ledge the band stands on
    gr.fillStyle(0x07050a, 1);
    gr.beginPath();
    const ledgeY = H * 0.63;
    gr.moveTo(0, ledgeY + 30);
    gr.lineTo(W * 0.15, ledgeY + 6);
    gr.lineTo(W * 0.4, ledgeY + 14);
    gr.lineTo(W * 0.62, ledgeY);
    gr.lineTo(W * 0.85, ledgeY + 12);
    gr.lineTo(W, ledgeY + 2);
    gr.lineTo(W, H);
    gr.lineTo(0, H);
    gr.closePath();
    gr.fillPath();

    this.wreck.setPosition(W * 0.3, horizon - 10).setScale(0.62 * INV_RES).setAngle(-6);
    this.flash.setSize(W, H);

    const bandY = ledgeY + 24;
    const order: MemberId[] = ['lead', 'rhythm', 'bass', 'drums', 'vocals'];
    const scale = this.mode === 'select' ? 2.3 : 2.3;
    order.forEach((id, i) => {
      const x = W * (0.12 + i * 0.19);
      const im = this.band.get(id)!;
      im.setOrigin(0.5, 84 / 88);
      im.setPosition(x, bandY + (i % 2 ? 8 : 0));
      im.setScale(scale * INV_RES);
      im.setFlipX(i >= 3);
      const glow = this.glows.get(id)!;
      glow.setPosition(x, bandY - 60).setScale(3.4 * INV_RES);
      const visible = this.mode !== 'hidden' && (this.mode === 'title' || this.focus === id);
      im.setVisible(visible);
      glow.setVisible(visible);
      if (this.mode === 'select' && this.focus === id) {
        im.setPosition(W * 0.5, bandY + 10).setScale(2.6 * INV_RES).setFlipX(false);
        glow.setPosition(W * 0.5, bandY - 70).setScale(4.4 * INV_RES);
      }
    });
    this.ground.setVisible(true);
    this.wreck.setVisible(this.mode === 'title');
  }

  update(_t: number, dms: number): void {
    const dt = dms / 1000;
    this.t += dt;
    // idle bob on the beat (menus run at 128 BPM too)
    const beat = App.audio.transportRunning ? App.audio.getCurrentBeat() : this.t / BEAT_DURATION;
    const f = Math.floor(beat) % 2 === 0 ? 'idle0' : 'idle1';
    for (const [id, im] of this.band) {
      setFrame(im, `m_${id}_${f}`);
      const glow = this.glows.get(id)!;
      glow.setAlpha(0.35 + 0.2 * Math.max(0, 1 - (beat % 1) * 2));
    }
    const moonPulse = 1 + 0.03 * Math.max(0, 1 - (beat % 1) * 3);
    this.moon.setScale(moonPulse);

    // lightning
    const reduced = App.store.settings.reducedFlash;
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.nextBolt = 2 + Math.random() * 4;
      this.boltLife = 0.25;
      this.drawBolt();
      this.flash.setAlpha(reduced ? 0.04 : 0.18);
      if (App.audio.ctx?.state === 'running' && !App.run) App.audio.playSfx('thunder', { volume: 0.25 });
    }
    if (this.boltLife > 0) {
      this.boltLife -= dt;
      this.bolts.setAlpha(Math.max(0, this.boltLife / 0.25));
      this.flash.setAlpha(Math.max(0, this.flash.alpha - dt * 1.2));
      if (this.boltLife <= 0) this.bolts.clear();
    }
  }

  private drawBolt(): void {
    const s = layout.state;
    const g = this.bolts;
    g.clear();
    let x = Phaser.Math.Between(20, s.W - 20);
    let y = 0;
    const endY = s.H * Phaser.Math.FloatBetween(0.3, 0.5);
    g.lineStyle(3, 0xd8c0ff, 1);
    g.beginPath();
    g.moveTo(x, y);
    while (y < endY) {
      x += Phaser.Math.Between(-26, 26);
      y += Phaser.Math.Between(18, 40);
      g.lineTo(x, y);
    }
    g.strokePath();
    g.lineStyle(9, 0x8a3aff, 0.35);
    g.strokePath();
  }
}
