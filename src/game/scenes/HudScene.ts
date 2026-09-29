/**
 * In-run HUD (screen space, above the island):
 *  top-left health, top-center countdown + objective, top-right band roster +
 *  compass, bottom-left floating joystick, bottom-right SOLO / BREAKDOWN.
 * The middle of the screen stays clear; splashes are brief.
 */
import Phaser from 'phaser';
import { App } from '../../app';
import { BAND, MEMBER_ORDER, type MemberId } from '../../data/band';
import { REGIONS, type RegionId } from '../../data/island';
import { UPGRADES, type UpgradeId } from '../../data/upgrades';
import { formatClock } from '../../state/RunState';
import { layout, type LayoutState } from '../Layout';
import { FONT, INV_RES, img, setupScreenCamera, txt } from '../sceneUtil';
import type { GameScene } from './GameScene';

interface Indicator {
  id: MemberId;
  frame: Phaser.GameObjects.Rectangle;
  pic: Phaser.GameObjects.Image;
  shade: Phaser.GameObjects.Rectangle;
  q: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  chains: Phaser.GameObjects.Image;
  glow: number;
  suppressed: boolean;
}

const JOY_R = 58;

/** Only touch a Text's color when it actually changes (each change re-renders the text). */
function recolor(t: Phaser.GameObjects.Text, c: string): Phaser.GameObjects.Text {
  if ((t as any).__c !== c) {
    (t as any).__c = c;
    t.setColor(c);
  }
  return t;
}

export class HudScene extends Phaser.Scene {
  joyX = 0;
  joyY = 0;
  private joyId = -1;
  private joyOx = 0;
  private joyOy = 0;
  private joyBase!: Phaser.GameObjects.Image;
  private joyKnob!: Phaser.GameObjects.Image;
  private joyHint!: Phaser.GameObjects.Image;
  private joyHintT = 7;

  private vignette!: Phaser.GameObjects.Image;
  private lowHp!: Phaser.GameObjects.Image;
  private storm!: Phaser.GameObjects.Rectangle;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private stormLevel = 0;
  private stormFlash = 0;
  private nextStormFlash = 4;

  private portrait!: Phaser.GameObjects.Image;
  private portraitFrame!: Phaser.GameObjects.Rectangle;
  private nameT!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private lvText!: Phaser.GameObjects.Text;
  private pauseBtn!: Phaser.GameObjects.Image;
  private muteBtn!: Phaser.GameObjects.Image;
  private timerPlate!: Phaser.GameObjects.Graphics;
  private timer!: Phaser.GameObjects.Text;
  private objPlate!: Phaser.GameObjects.Graphics;
  private objText!: Phaser.GameObjects.Text;
  private objIcon!: Phaser.GameObjects.Text;
  private indicators: Indicator[] = [];
  private compass!: Phaser.GameObjects.Graphics;
  private compassN!: Phaser.GameObjects.Text;
  private edge!: Phaser.GameObjects.Graphics;

  private soloZone!: Phaser.GameObjects.Zone;
  private soloEmblem!: Phaser.GameObjects.Image;
  private soloRing!: Phaser.GameObjects.Graphics;
  private soloLabel!: Phaser.GameObjects.Text;
  private soloGlow!: Phaser.GameObjects.Image;
  private soloShake = 0;
  private bdZone!: Phaser.GameObjects.Zone;
  private bdBtn!: Phaser.GameObjects.Image;
  private bdRing!: Phaser.GameObjects.Graphics;
  private bdLabel!: Phaser.GameObjects.Text;
  private bdGlow!: Phaser.GameObjects.Image;
  private bdVisible = false;
  private pips: Phaser.GameObjects.Rectangle[] = [];

  private splash!: Phaser.GameObjects.Container;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private sayText!: Phaser.GameObjects.Text;
  private sayT = 0;
  private toastText!: Phaser.GameObjects.Text;
  private toastT = 0;
  private transBox!: Phaser.GameObjects.Container;
  private transText!: Phaser.GameObjects.Text;
  private transFull = '';
  private transT = 0;
  private regionText!: Phaser.GameObjects.Text;
  private regionT = 0;
  private controlsHidden = false;
  private gs!: GameScene;
  private lastSecond = -1;

  constructor() {
    super('hud');
  }

  create(): void {
    this.gs = this.scene.get('game') as GameScene;
    this.indicators = [];
    this.pips = [];
    this.controlsHidden = false;
    this.bdVisible = false;
    this.joyId = -1;
    this.joyX = this.joyY = 0;
    this.joyHintT = 7;
    this.stormLevel = 0;
    setupScreenCamera(this);
    this.buildTextures();
    this.build();
    this.layoutAll(layout.state);
    const onLayout = (s: LayoutState) => {
      setupScreenCamera(this);
      this.layoutAll(s);
    };
    this.game.events.on('layout', onLayout);
    this.events.once('shutdown', () => this.game.events.off('layout', onLayout));

    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || this.joyId !== -1 || this.controlsHidden) return;
      const s = layout.state;
      const lx = p.x / s.rs;
      const ly = p.y / s.rs;
      if (ly < s.safe.top + 110) return; // top HUD strip
      this.joyId = p.id;
      this.joyOx = lx;
      this.joyOy = ly;
      this.joyBase.setPosition(lx, ly).setVisible(true).setAlpha(0.9);
      this.joyKnob.setPosition(lx, ly).setVisible(true);
      this.joyHintT = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyId) return;
      const s = layout.state;
      let lx = p.x / s.rs;
      let ly = p.y / s.rs;
      let dx = lx - this.joyOx;
      let dy = ly - this.joyOy;
      let d = Math.hypot(dx, dy);
      if (d > JOY_R) {
        // the stick origin follows the thumb so it never feels pinned
        this.joyOx = lx - (dx / d) * JOY_R;
        this.joyOy = ly - (dy / d) * JOY_R;
        dx = lx - this.joyOx;
        dy = ly - this.joyOy;
        d = JOY_R;
        this.joyBase.setPosition(this.joyOx, this.joyOy);
      }
      this.joyKnob.setPosition(lx, ly);
      const mag = Math.max(0, Math.min(1, (d - 5) / (JOY_R - 5)));
      this.joyX = d > 0 ? (dx / d) * mag : 0;
      this.joyY = d > 0 ? (dy / d) * mag : 0;
      void lx;
      void ly;
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.joyId) return;
      this.resetJoystick();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('gameout', () => this.resetJoystick());
  }

  resetJoystick(): void {
    this.joyId = -1;
    this.joyX = this.joyY = 0;
    this.joyBase?.setVisible(false);
    this.joyKnob?.setVisible(false);
  }

  private buildTextures(): void {
    if (!this.textures.exists('vignette')) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      this.textures.addCanvas('vignette', c);
      const c2 = document.createElement('canvas');
      c2.width = 256;
      c2.height = 256;
      const ctx2 = c2.getContext('2d')!;
      const g2 = ctx2.createRadialGradient(128, 128, 70, 128, 128, 182);
      g2.addColorStop(0, 'rgba(255,0,0,0)');
      g2.addColorStop(1, 'rgba(200,0,20,0.9)');
      ctx2.fillStyle = g2;
      ctx2.fillRect(0, 0, 256, 256);
      this.textures.addCanvas('vignette_red', c2);
    }
  }

  private build(): void {
    const leader = App.run!.starter;
    const col = BAND[leader];
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0.9);
    this.storm = this.add.rectangle(0, 0, 10, 10, 0x3a1466, 0).setOrigin(0);
    this.lowHp = this.add.image(0, 0, 'vignette_red').setOrigin(0).setAlpha(0);
    this.edge = this.add.graphics();

    // --- health block
    this.portraitFrame = this.add.rectangle(0, 0, 56, 64, 0x07060a).setStrokeStyle(3, col.color).setOrigin(0);
    this.portrait = img(this, 0, 0, `portrait_${leader}`).setOrigin(0).setScale(0.39 * INV_RES);
    this.nameT = txt(this, 0, 0, col.name, { fontFamily: FONT.brush, fontSize: '24px', color: col.colorCss, stroke: '#07060a', strokeThickness: 5 });
    this.hpBar = this.add.graphics();
    this.hpText = txt(this, 0, 0, '', { fontFamily: FONT.ui, fontStyle: '700', fontSize: '13px', color: '#ffffff' }).setOrigin(0.5);
    this.lvText = txt(this, 0, 0, 'LV 1', { fontFamily: FONT.ui, fontStyle: '700', fontSize: '12px', color: '#efe4cc', backgroundColor: '#07060a', padding: { x: 4, y: 1 } }).setOrigin(0.5);
    this.pauseBtn = img(this, 0, 0, 'ui_pause').setInteractive(new Phaser.Geom.Circle(40, 40, 40), Phaser.Geom.Circle.Contains);
    this.muteBtn = img(this, 0, 0, App.store.settings.muted ? 'ui_mute' : 'ui_sound').setInteractive(new Phaser.Geom.Circle(40, 40, 40), Phaser.Geom.Circle.Contains);
    this.pauseBtn.on('pointerdown', () => this.gs.togglePause());
    this.muteBtn.on('pointerdown', () => {
      App.store.updateSettings({ muted: !App.store.settings.muted });
    });

    // --- timer + objective
    this.timerPlate = this.add.graphics();
    this.timer = txt(this, 0, 0, '18:00', { fontFamily: FONT.ui, fontStyle: '700', fontSize: '42px', color: '#efe4cc', stroke: '#07060a', strokeThickness: 6 }).setOrigin(0.5);
    this.objPlate = this.add.graphics();
    this.objIcon = txt(this, 0, 0, '!', { fontFamily: FONT.ui, fontStyle: '700', fontSize: '18px', color: '#2fe6ff' }).setOrigin(0.5);
    this.objText = txt(this, 0, 0, '', { fontFamily: FONT.ui, fontStyle: '600', fontSize: '16px', color: '#efe4cc', letterSpacing: 1 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5);

    // --- band roster
    for (const id of MEMBER_ORDER) {
      const m = BAND[id];
      const frame = this.add.rectangle(0, 0, 32, 38, 0x07060a).setStrokeStyle(2, 0x333038).setOrigin(0);
      const pic = img(this, 0, 0, `portrait_${id}`).setOrigin(0).setScale(0.235 * INV_RES);
      const shade = this.add.rectangle(0, 0, 32, 38, 0x07060a, 0.78).setOrigin(0);
      const q = txt(this, 0, 0, '?', { fontFamily: FONT.display, fontSize: '22px', color: '#5a5068' }).setOrigin(0.5);
      const name = txt(this, 0, 0, m.name, { fontFamily: FONT.ui, fontStyle: '700', fontSize: '10px', color: '#8a8290' }).setOrigin(0.5, 0);
      const chains = img(this, 0, 0, 'fx_hex').setTint(0xff2a2a).setScale(0.3 * INV_RES).setVisible(false);
      this.indicators.push({ id, frame, pic, shade, q, name, chains, glow: 0, suppressed: false });
    }
    this.compass = this.add.graphics();
    this.compassN = txt(this, 0, 0, 'N', { fontFamily: FONT.ui, fontStyle: '700', fontSize: '11px', color: '#efe4cc' }).setOrigin(0.5);

    // --- action buttons
    this.soloGlow = img(this, 0, 0, 'fx_glow').setTint(col.color).setBlendMode(Phaser.BlendModes.ADD);
    this.soloEmblem = img(this, 0, 0, `solo_${leader}`);
    this.soloRing = this.add.graphics();
    this.soloLabel = txt(this, 0, 0, 'SOLO', { fontFamily: FONT.brush, fontSize: '26px', color: '#ffffff', stroke: '#07060a', strokeThickness: 6 }).setOrigin(0.5);
    this.soloZone = this.add.zone(0, 0, 150, 150).setInteractive(new Phaser.Geom.Circle(75, 75, 72), Phaser.Geom.Circle.Contains);
    this.soloZone.on('pointerdown', () => {
      this.gs.input2.solo = true;
    });
    for (let i = 0; i < 4; i++) this.pips.push(this.add.rectangle(0, 0, 9, 9, 0xefe4cc, 0.3).setAngle(45));
    this.bdGlow = img(this, 0, 0, 'fx_glow').setTint(0xff5a1a).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.bdBtn = img(this, 0, 0, 'ui_breakdown').setVisible(false);
    this.bdRing = this.add.graphics();
    this.bdLabel = txt(this, 0, 0, 'BREAKDOWN', { fontFamily: FONT.brush, fontSize: '17px', color: '#ffb36a', stroke: '#07060a', strokeThickness: 5 }).setOrigin(0.5).setVisible(false);
    this.bdZone = this.add.zone(0, 0, 130, 130).setInteractive(new Phaser.Geom.Circle(65, 65, 62), Phaser.Geom.Circle.Contains);
    this.bdZone.on('pointerdown', () => {
      if (this.bdVisible) this.gs.input2.breakdown = true;
    });
    this.bdZone.disableInteractive();

    // --- joystick
    this.joyHint = img(this, 0, 0, 'ui_joy_base').setAlpha(0.22).setVisible(layout.state.touch);
    this.joyBase = img(this, 0, 0, 'ui_joy_base').setVisible(false);
    this.joyKnob = img(this, 0, 0, 'ui_joy_knob').setVisible(false);

    // --- boss bar, splashes, text
    this.bossBar = this.add.graphics();
    this.bossName = txt(this, 0, 0, '', { fontFamily: FONT.display, fontSize: '22px', color: '#ff5a5a', stroke: '#07060a', strokeThickness: 5 }).setOrigin(0.5, 1);
    this.splash = this.add.container(0, 0);
    this.sayText = txt(this, 0, 0, '', { fontFamily: FONT.ui, fontStyle: '600', fontSize: '17px', color: '#efe4cc', stroke: '#07060a', strokeThickness: 5, align: 'center', wordWrap: { width: 460 } }).setOrigin(0.5, 1).setAlpha(0);
    this.toastText = txt(this, 0, 0, '', { fontFamily: FONT.ui, fontStyle: '700', fontSize: '18px', color: '#efe4cc', stroke: '#07060a', strokeThickness: 5, align: 'center' }).setOrigin(0.5).setAlpha(0);
    this.regionText = txt(this, 0, 0, '', { fontFamily: FONT.brush, fontSize: '40px', color: '#9fe7ff', stroke: '#07060a', strokeThickness: 7 }).setOrigin(0.5).setAlpha(0);
    const transBg = this.add.rectangle(0, 0, 470, 64, 0x07060a, 0.88).setStrokeStyle(2, 0xff2a2a).setOrigin(0.5, 0);
    const transHdr = txt(this, 0, 6, 'INTERCEPTED TRANSMISSION', { fontFamily: FONT.ui, fontStyle: '700', fontSize: '11px', color: '#ff5a5a', letterSpacing: 3 } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);
    this.transText = txt(this, 0, 22, '', { fontFamily: FONT.ui, fontSize: '15px', color: '#ffd0d0', align: 'center', wordWrap: { width: 440 } }).setOrigin(0.5, 0);
    this.transBox = this.add.container(0, 0, [transBg, transHdr, this.transText]).setAlpha(0);
    this.flashRect = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0);
  }

  private layoutAll(s: LayoutState): void {
    const W = s.W;
    const H = s.H;
    const top = s.safe.top + 10;
    const bot = H - s.safe.bottom;
    this.vignette.setDisplaySize(W, H);
    this.lowHp.setDisplaySize(W, H);
    this.storm.setSize(W, H);
    this.flashRect.setSize(W, H);

    const lx = 10 + s.safe.left;
    this.portraitFrame.setPosition(lx, top);
    this.portrait.setPosition(lx + 3, top + 3).setCrop(0, 0, 256, 290);
    this.nameT.setPosition(lx + 64, top - 6);
    this.hpText.setPosition(lx + 64 + 61, top + 41);
    this.lvText.setPosition(lx + 28, top + 67);
    this.pauseBtn.setPosition(lx + 22, top + 100);
    this.muteBtn.setPosition(lx + 68, top + 100);

    this.timer.setPosition(W / 2, top + 28);
    this.objText.setPosition(W / 2 + 8, top + 76);
    this.objIcon.setPosition(W / 2 - 150, top + 76);

    const rx = W - 8 - s.safe.right - 5 * 35;
    this.indicators.forEach((ind, i) => {
      const x = rx + i * 35;
      ind.frame.setPosition(x, top);
      ind.pic.setPosition(x + 1, top + 1).setCrop(0, 0, 128, 152);
      ind.shade.setPosition(x, top);
      ind.q.setPosition(x + 16, top + 19);
      ind.name.setPosition(x + 16, top + 40);
      ind.chains.setPosition(x + 16, top + 19);
    });
    this.compassN.setVisible(true);

    const sx = W - 80 - s.safe.right;
    const sy = bot - 96;
    this.soloGlow.setPosition(sx, sy).setScale(3.4 * INV_RES);
    this.soloEmblem.setPosition(sx, sy).setScale(0.92 * INV_RES);
    this.soloLabel.setPosition(sx, sy + 34);
    this.soloZone.setPosition(sx, sy);
    this.pips.forEach((p, i) => p.setPosition(sx - 27 + i * 18, sy + 70));
    const bx = sx - 138;
    const by = bot - 72;
    this.bdGlow.setPosition(bx, by).setScale(3 * INV_RES);
    this.bdBtn.setPosition(bx, by).setScale(0.84 * INV_RES);
    this.bdLabel.setPosition(bx, by + 52);
    this.bdZone.setPosition(bx, by);
    this.joyHint.setPosition(100 + s.safe.left, bot - 120);
    this.sayText.setPosition(W / 2, bot - 190);
    this.toastText.setPosition(W / 2, H * 0.3);
    this.regionText.setPosition(W / 2, top + 150);
    this.transBox.setPosition(W / 2, top + 100);
    this.bossName.setPosition(W / 2, top + 152);
  }

  // ------------------------------------------------------------------ per-frame sync

  sync(gs: GameScene): void {
    if (!this.timer) return;
    const s = layout.state;
    const W = s.W;
    const top = s.safe.top + 10;
    const run = gs.run;
    const beat = gs.beat.beat;
    const pulse = gs.beat.pulse(5);
    const dt = this.game.loop.delta / 1000;
    const L = gs.band.leader;

    // HP
    const lx = 10 + s.safe.left + 64;
    const g = this.hpBar;
    g.clear();
    const hpw = 122;
    const frac = run.hp / run.maxHp;
    g.fillStyle(0x07060a, 0.9);
    g.fillRect(lx - 2, top + 32, hpw + 4, 19);
    g.fillStyle(0x3a0a0e, 1);
    g.fillRect(lx, top + 34, hpw, 15);
    g.fillStyle(frac < 0.3 ? 0xff2a2a : 0xc4121c, 1);
    g.fillRect(lx, top + 34, hpw * frac, 15);
    g.fillStyle(0xffffff, 0.18);
    g.fillRect(lx, top + 34, hpw * frac, 4);
    // xp
    g.fillStyle(0x07060a, 0.9);
    g.fillRect(lx - 2, top + 53, hpw + 4, 8);
    g.fillStyle(0x7a3acc, 1);
    g.fillRect(lx, top + 55, hpw * run.xpProgress, 4);
    this.hpText.setText(`${Math.ceil(run.hp)} / ${run.maxHp}`);
    this.lvText.setText(`LV ${run.level}`);
    this.lowHp.setAlpha(frac < 0.3 && !run.isOver ? (0.35 + 0.35 * pulse) * (1 - frac / 0.3) + 0.1 : 0);
    const muteKey = App.store.settings.muted ? 'ui_mute' : 'ui_sound';
    if (this.muteBtn.frame.name !== muteKey) this.muteBtn.setTexture(...this.texFor(muteKey));

    // timer: pulses on each beat, turns red in the last three minutes
    const secs = Math.ceil(run.timeRemaining);
    this.timer.setText(formatClock(run.timeRemaining));
    const urgent = run.timeRemaining < 180;
    recolor(this.timer, run.timeRemaining < 60 ? (Math.floor(beat) % 2 ? '#ff2a2a' : '#ffffff') : urgent ? '#ff5a5a' : '#efe4cc');
    this.timer.setScale(1 + 0.04 * pulse * (urgent ? 2 : 1));
    if (secs !== this.lastSecond && run.timeRemaining < 30 && run.isRunning) gs.audio('tick', { volume: 0.4, rate: 1.2 });
    this.lastSecond = secs;
    const tp = this.timerPlate;
    tp.clear();
    tp.fillStyle(0x07060a, 0.72);
    tp.fillRoundedRect(W / 2 - 66, top + 2, 132, 50, 4);
    tp.lineStyle(2, urgent ? 0xff2a2a : 0x5a1a1a, 0.9);
    tp.strokeRoundedRect(W / 2 - 66, top + 2, 132, 50, 4);
    tp.fillStyle(0xff2a2a, 0.6 + 0.4 * pulse);
    tp.fillTriangle(W / 2 - 6, top + 54, W / 2 + 6, top + 54, W / 2, top + 62);

    // objective banner
    const obj = gs.objectives;
    if (this.objText.text !== obj.text) this.objText.setText(obj.text);
    const tw = Math.min(W - 40, this.objText.width + 70);
    const op = this.objPlate;
    op.clear();
    op.fillStyle(0x07060a, 0.8);
    op.fillRect(W / 2 - tw / 2, top + 62, tw, 30);
    const oc = obj.target?.color ?? 0x2fe6ff;
    op.lineStyle(2, oc, 0.9);
    op.strokeRect(W / 2 - tw / 2, top + 62, tw, 30);
    recolor(this.objIcon.setPosition(W / 2 - tw / 2 + 16, top + 77), '#' + oc.toString(16).padStart(6, '0'));
    this.objText.setPosition(W / 2 + 10, top + 77);
    // >> chevrons blink on 8ths
    if (Math.floor(beat * 2) % 2 === 0) {
      op.fillStyle(oc, 0.9);
      const cx = W / 2 + tw / 2 - 18;
      op.fillTriangle(cx - 6, top + 70, cx, top + 77, cx - 6, top + 84);
      op.fillTriangle(cx + 2, top + 70, cx + 8, top + 77, cx + 2, top + 84);
    }

    // roster
    for (const ind of this.indicators) {
      const inBand = run.isRecruited(ind.id);
      const isLeader = ind.id === run.starter;
      const m = BAND[ind.id];
      ind.glow = Math.max(0, ind.glow - dt * 1.5);
      ind.shade.setAlpha(inBand ? (ind.suppressed ? 0.6 : 0) : 0.8);
      ind.q.setVisible(!inBand);
      ind.pic.setAlpha(inBand ? 1 : 0.35);
      if (!inBand) ind.pic.setTint(0x5a5068);
      else ind.pic.clearTint();
      ind.frame.setStrokeStyle(isLeader ? 3 : 2, inBand ? m.color : 0x333038, inBand ? 1 : 0.8);
      ind.frame.setScale(1 + ind.glow * 0.18);
      recolor(ind.name, inBand ? m.colorCss : '#5a5068');
      ind.chains.setVisible(ind.suppressed).setRotation(beat);
      if (inBand && ind.glow <= 0 && !isLeader) ind.frame.setStrokeStyle(2, m.color, 0.6 + 0.4 * pulse);
    }

    // compass
    this.drawCompass(gs, W - 58 - s.safe.right, top + 112);
    this.drawEdgeArrows(gs);

    // SOLO
    const soloReady = run.soloReady;
    const sx = this.soloEmblem.x;
    const sy = this.soloEmblem.y;
    const sr = this.soloRing;
    sr.clear();
    sr.lineStyle(7, 0x07060a, 0.8);
    sr.strokeCircle(sx, sy, 60);
    const prog = 1 - run.soloCooldown / Math.max(0.01, run.soloCooldownMax);
    sr.lineStyle(5, BAND[run.starter].color, soloReady ? 1 : 0.8);
    sr.beginPath();
    sr.arc(sx, sy, 60, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, prog));
    sr.strokePath();
    this.soloShake = Math.max(0, this.soloShake - dt * 4);
    this.soloEmblem.setTint(soloReady ? 0xffffff : 0x555560).setX(sx + Math.sin(this.soloShake * 40) * this.soloShake * 8);
    this.soloGlow.setAlpha(soloReady ? 0.35 + 0.45 * pulse : 0.05);
    this.soloLabel.setAlpha(soloReady ? 1 : 0.5).setScale(soloReady ? 1 + 0.08 * pulse : 0.9);
    // beat pips: count through the bar
    const bi = Math.floor(beat) % 4;
    this.pips.forEach((p, i) => p.setFillStyle(i <= bi ? BAND[run.starter].color : 0xefe4cc, i <= bi ? 1 : 0.25));

    // BREAKDOWN
    if (run.breakdownUnlocked && !this.bdVisible && !this.controlsHidden) {
      this.bdVisible = true;
      this.bdBtn.setVisible(true).setScale(0.01);
      this.bdLabel.setVisible(true);
      this.bdGlow.setVisible(true);
      this.bdZone.setInteractive(new Phaser.Geom.Circle(65, 65, 62), Phaser.Geom.Circle.Contains);
      this.tweens.add({ targets: this.bdBtn, scale: 0.84 * INV_RES, duration: 500, ease: 'Back.easeOut' });
    }
    const br = this.bdRing;
    br.clear();
    if (this.bdVisible && !this.controlsHidden) {
      const full = run.breakdownMeter >= 1;
      const bx = this.bdZone.x;
      const by = this.bdZone.y;
      br.lineStyle(7, 0x07060a, 0.8);
      br.strokeCircle(bx, by, 52);
      br.lineStyle(5, full ? 0xffd23a : 0xff6a1f, 1);
      br.beginPath();
      br.arc(bx, by, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * run.breakdownMeter);
      br.strokePath();
      this.bdGlow.setAlpha(full ? 0.5 + 0.5 * pulse : 0.12);
      this.bdBtn.setTint(full ? 0xffffff : 0x8a6a5a);
      recolor(this.bdLabel.setText(full ? 'BREAKDOWN' : `${Math.floor(run.breakdownMeter * 100)}%`), full ? '#ffd23a' : '#ffb36a').setScale(full ? 1 + 0.1 * pulse : 1);
      if (full && Math.random() < 0.3) gs.fx.sparks(gs.band.leader.x, gs.band.leader.y - 30, 0xff6a1f, 1);
    }

    // boss health
    const bb = this.bossBar;
    bb.clear();
    const boss = gs.enemies.list.find((e) => e.active && e.kind === 'boss' && e.label);
    if (boss && !this.controlsHidden) {
      const bw = W - 120;
      const y = top + 158;
      this.bossName.setText(boss.label).setVisible(true).setPosition(W / 2, y - 2);
      bb.fillStyle(0x07060a, 0.85);
      bb.fillRect(W / 2 - bw / 2 - 3, y, bw + 6, 14);
      bb.fillStyle(0x5a0a10, 1);
      bb.fillRect(W / 2 - bw / 2, y + 3, bw, 8);
      bb.fillStyle(boss.damageTaken < 1 ? 0x8a8a9a : 0xff2a2a, 1);
      bb.fillRect(W / 2 - bw / 2, y + 3, bw * Math.max(0, boss.hp / boss.maxHp), 8);
    } else this.bossName.setVisible(false);

    // joystick hint for the first seconds
    this.joyHintT -= dt;
    this.joyHint.setVisible(s.touch && this.joyHintT > 0 && this.joyId === -1 && !this.controlsHidden).setAlpha(0.15 + 0.15 * pulse);

    // storm
    this.stormFlash = Math.max(0, this.stormFlash - dt * 3);
    this.nextStormFlash -= dt;
    if (this.nextStormFlash <= 0) {
      this.nextStormFlash = (this.stormLevel ? 3 : 9) + Math.random() * 6;
      this.stormFlash = App.store.settings.reducedFlash ? 0.08 : this.stormLevel ? 0.35 : 0.15;
      if (run.isRunning) gs.audio('thunder', { volume: 0.15 + 0.2 * this.stormLevel });
    }
    const stormA = this.stormFlash > 0.02 ? this.stormFlash * 0.4 : 0.06 * this.stormLevel;
    this.storm.setFillStyle(this.stormFlash > 0.02 ? 0xb8a0ff : 0x3a1466, stormA).setVisible(stormA > 0.005);
    this.flashRect.setVisible(this.flashRect.fillAlpha > 0.005);

    // timed text
    this.sayT -= dt;
    this.sayText.setAlpha(Math.max(0, Math.min(1, this.sayT * 2)));
    this.toastT -= dt;
    this.toastText.setAlpha(Math.max(0, Math.min(1, this.toastT * 2)));
    this.regionT -= dt;
    this.regionText.setAlpha(Math.max(0, Math.min(1, this.regionT, (2.6 - this.regionT) * 3)));
    if (this.transT > 0) {
      this.transT -= dt;
      const shown = Math.min(this.transFull.length, Math.floor((5.5 - this.transT) * 45));
      const glitch = Math.random() < 0.08 ? '▓' : '';
      this.transText.setText(this.transFull.slice(0, shown) + glitch);
      this.transBox.setAlpha(Math.min(1, this.transT * 2, (5.5 - this.transT) * 6));
      this.transBox.setX(W / 2 + (Math.random() < 0.05 ? (Math.random() - 0.5) * 6 : 0));
    }
    void L;
  }

  private texFor(key: string): [string, string] {
    const tex = this.textures.getTextureKeys().find((k) => k.startsWith('atlas') && this.textures.get(k).has(key)) ?? 'atlas0';
    return [tex, key];
  }

  private drawCompass(gs: GameScene, cx: number, cy: number): void {
    const g = this.compass;
    g.clear();
    const R = 36;
    g.fillStyle(0x07060a, 0.75);
    g.fillCircle(cx, cy, R + 4);
    g.lineStyle(2, 0xefe4cc, 0.35);
    g.strokeCircle(cx, cy, R);
    g.lineStyle(1, 0xefe4cc, 0.15);
    g.strokeCircle(cx, cy, R * 0.5);
    this.compassN.setPosition(cx, cy - R - 1);
    const L = gs.band.leader;
    const range = 2400;
    for (const sig of gs.objectives.signals()) {
      const dx = sig.x - L.x;
      const dy = sig.y - L.y;
      const d = Math.hypot(dx, dy);
      const k = Math.min(1, d / range);
      const px = cx + (dx / (d || 1)) * R * k * 0.95;
      const py = cy + (dy / (d || 1)) * R * k * 0.95;
      const isTarget = gs.objectives.target && Math.abs(gs.objectives.target.x - sig.x) < 1 && Math.abs(gs.objectives.target.y - sig.y) < 200;
      g.fillStyle(sig.color, 1);
      if (sig.kind === 'spire') {
        g.fillTriangle(px, py - 5, px - 4, py + 4, px + 4, py + 4);
      } else g.fillCircle(px, py, isTarget ? 4.5 : 3.2);
      if (isTarget) {
        g.lineStyle(1.5, sig.color, 0.7);
        g.lineBetween(cx, cy, px, py);
      }
    }
    // the band (facing arrow)
    const a = L.facing;
    g.fillStyle(BAND[L.id].color, 1);
    g.fillTriangle(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx + Math.cos(a + 2.5) * 5, cy + Math.sin(a + 2.5) * 5, cx + Math.cos(a - 2.5) * 5, cy + Math.sin(a - 2.5) * 5);
  }

  private drawEdgeArrows(gs: GameScene): void {
    const s = layout.state;
    const cam = gs.cameras.main;
    const v = cam.worldView;
    const W = s.W;
    const H = s.H;
    const g = this.edge;
    g.clear();
    if (this.controlsHidden) return;
    const pad = 26;
    const topPad = s.safe.top + 175;
    const botPad = s.safe.bottom + 170;
    const tgt = gs.objectives.target;
    const sigs = gs.objectives.signals().filter((q) => q.kind !== 'spire' || gs.objectives.spire !== 'sealed');
    const list = tgt ? [tgt, ...sigs.filter((q) => Math.hypot(q.x - tgt.x, q.y - tgt.y) > 300)] : sigs;
    list.slice(0, 5).forEach((t, i) => {
      const sx = ((t.x - v.x) / v.width) * W;
      const sy = ((t.y - v.y) / v.height) * H;
      const main = i === 0 && !!tgt;
      const onScreen = sx > pad && sx < W - pad && sy > topPad && sy < H - botPad;
      if (onScreen) {
        if (main) {
          const bob = Math.sin(gs.beat.beat * Math.PI) * 5;
          g.fillStyle(t.color, 0.95);
          g.fillTriangle(sx - 10, sy - 64 + bob, sx + 10, sy - 64 + bob, sx, sy - 50 + bob);
          g.lineStyle(2, 0x07060a, 1);
          g.strokeTriangle(sx - 10, sy - 64 + bob, sx + 10, sy - 64 + bob, sx, sy - 50 + bob);
        }
        return;
      }
      const cx = W / 2;
      const cy = H / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const ex = Phaser.Math.Clamp(cx + Math.cos(ang) * 2000, pad, W - pad);
      const ey = Phaser.Math.Clamp(cy + Math.sin(ang) * 2000, topPad, H - botPad);
      // project onto the inset rectangle along the ray
      const tx = Math.cos(ang) > 0 ? (W - pad - cx) / Math.cos(ang) : (pad - cx) / Math.cos(ang);
      const ty = Math.sin(ang) > 0 ? (H - botPad - cy) / Math.sin(ang) : (topPad - cy) / Math.sin(ang);
      const tt = Math.min(Math.abs(tx), Math.abs(ty));
      const px = cx + Math.cos(ang) * tt;
      const py = cy + Math.sin(ang) * tt;
      void ex;
      void ey;
      const size = main ? 15 : 9;
      const pulse = main ? 1 + 0.2 * gs.beat.pulse(4) : 1;
      const sz = size * pulse;
      g.fillStyle(0x07060a, 0.8);
      g.fillCircle(px, py, sz + 5);
      g.fillStyle(t.color, 1);
      g.fillTriangle(
        px + Math.cos(ang) * sz,
        py + Math.sin(ang) * sz,
        px + Math.cos(ang + 2.4) * sz * 0.8,
        py + Math.sin(ang + 2.4) * sz * 0.8,
        px + Math.cos(ang - 2.4) * sz * 0.8,
        py + Math.sin(ang - 2.4) * sz * 0.8,
      );
    });
  }

  // ------------------------------------------------------------------ events from the game

  onBar(_bar: number): void {
    /* reserved for bar-synced UI flourishes */
  }

  flash(color: number, alpha: number, ms: number): void {
    if (!this.flashRect) return;
    this.flashRect.setFillStyle(color, alpha);
    this.tweens.killTweensOf(this.flashRect);
    this.tweens.add({ targets: this.flashRect, fillAlpha: 0, duration: ms });
  }

  soloDenied(breakdown = false): void {
    if (!breakdown) this.soloShake = 1;
    this.gs.audio('uiClick', { volume: 0.3, rate: 0.6 });
  }

  say(name: string, line: string, color: string): void {
    recolor(this.sayText.setText(`${name}: ${line}`), color);
    this.sayT = 3.2;
  }

  toast(text: string, color = '#efe4cc', dur = 2.4): void {
    recolor(this.toastText.setText(text), color);
    this.toastT = dur;
  }

  transmission(from: string, text: string): void {
    this.transFull = `${from}: ${text}`;
    this.transT = 5.5;
    this.gs.audio('transmission', { volume: 0.4 });
  }

  regionBanner(id: RegionId): void {
    const reg = REGIONS.find((r) => r.id === id);
    const name = reg?.name ?? (id === 'spire' ? 'THE RESONANCE SPIRE' : '');
    if (!name) return;
    this.regionText.setText(name);
    this.regionT = 2.6;
  }

  upgradeTaken(id: UpgradeId): void {
    this.toast(`${UPGRADES[id].name} ON`, '#ffd23a', 1.6);
  }

  stemIn(member: MemberId): void {
    const ind = this.indicators.find((i) => i.id === member);
    if (ind) ind.glow = 1;
    this.toast(`♪ ${BAND[member].roleShort} STEM IN`, BAND[member].colorCss, 1.8);
  }

  setSuppressed(member: MemberId, on: boolean): void {
    const ind = this.indicators.find((i) => i.id === member);
    if (ind) ind.suppressed = on;
  }

  setStorm(level: number): void {
    this.stormLevel = level;
  }

  hideControls(): void {
    this.controlsHidden = true;
    this.resetJoystick();
    for (const o of [this.soloEmblem, this.soloRing, this.soloLabel, this.soloGlow, this.bdBtn, this.bdRing, this.bdLabel, this.bdGlow, this.joyHint, ...this.pips]) o.setVisible(false);
    this.soloZone.disableInteractive();
    this.bdZone.disableInteractive();
    this.edge.clear();
  }

  // ------------------------------------------------------------------ splashes

  private slam(lines: { text: string; font: string; size: number; color: string; y: number }[], hold: number, accent?: number): void {
    const s = layout.state;
    this.splash.removeAll(true);
    this.splash.setPosition(s.W / 2, s.H * 0.34).setAlpha(1).setScale(2.2);
    if (accent !== undefined) {
      const bar = this.add.rectangle(0, 10, s.W + 40, 150, 0x07060a, 0.72).setStrokeStyle(3, accent);
      this.splash.add(bar);
    }
    for (const l of lines) {
      this.splash.add(
        txt(this, 0, l.y, l.text, { fontFamily: l.font, fontSize: `${l.size}px`, color: l.color, stroke: '#07060a', strokeThickness: Math.max(4, l.size / 7), align: 'center' }).setOrigin(0.5),
      );
    }
    this.tweens.killTweensOf(this.splash);
    this.tweens.add({ targets: this.splash, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.splash, alpha: 0, delay: hold * 1000, duration: 350 });
  }

  rescueSplash(member: MemberId): void {
    const m = BAND[member];
    this.slam(
      [
        { text: `${m.roleShort} FOUND`, font: FONT.display, size: 56, color: m.colorCss, y: -18 },
        { text: `${m.name} JOINS FALSE PROPHET`, font: FONT.brush, size: 24, color: '#efe4cc', y: 38 },
      ],
      1.6,
      m.color,
    );
    const ind = this.indicators.find((i) => i.id === member);
    if (ind) ind.glow = 1.5;
  }

  fullBandSplash(): void {
    this.slam(
      [
        { text: 'FULL BAND', font: FONT.display, size: 74, color: '#ffffff', y: -20 },
        { text: 'BREAKDOWN UNLOCKED — THE SPIRE IS OPEN', font: FONT.brush, size: 20, color: '#ffb36a', y: 40 },
      ],
      2.4,
      0xff6a1f,
    );
    for (const ind of this.indicators) ind.glow = 1.5;
  }

  breakdownSlam(): void {
    this.slam([{ text: 'BREAKDOWN!!', font: FONT.display, size: 78, color: '#ffb02a', y: 0 }], 0.7);
  }

  bossCard(name: string, title: string): void {
    this.slam(
      [
        { text: name, font: FONT.display, size: 44, color: '#ff5a5a', y: -14 },
        { text: title.toUpperCase(), font: FONT.ui, size: 16, color: '#efe4cc', y: 32 },
      ],
      1.8,
      0xb3121d,
    );
  }

  phaseBanner(text: string): void {
    this.slam([{ text, font: FONT.brush, size: 34, color: '#ffffff', y: 0 }], 1.5, 0xb455ff);
  }
}
