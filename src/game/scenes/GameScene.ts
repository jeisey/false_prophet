/**
 * GameScene — the island. Orchestrates every gameplay system and owns the run
 * lifecycle: start (after audio is ready), rescues, full band, surge, boss,
 * escape, defeat.
 */
import Phaser from 'phaser';
import { App } from '../../app';
import { BAND, type MemberId } from '../../data/band';
import { ENEMIES, type EnemyKind } from '../../data/enemies';
import { START, SPIRE } from '../../data/island';
import { TRANSMISSIONS, TUTORIAL_HINTS } from '../../data/lore';
import { BREAKDOWN, LEVEL_UP_HEAL, PACING, PLAYER, REGEN, RESCUE_HEAL } from '../../config/gameConfig';
import type { SfxName } from '../../audio/sfxBank';
import type { SfxOptions, AudioEngine } from '../../audio/AudioEngine';
import { goToMenu } from '../../flow';
import { layout, type LayoutState } from '../Layout';
import { BeatClock } from '../systems/BeatClock';
import { Fx } from '../systems/Fx';
import { Telegraphs } from '../systems/Telegraphs';
import { Pickups } from '../systems/Pickups';
import { Director } from '../systems/Director';
import { Objectives } from '../systems/Objectives';
import { EnemySystem } from '../enemies/EnemySystem';
import type { Enemy } from '../enemies/Enemy';
import { Projectiles } from '../combat/Projectiles';
import { Combat } from '../combat/Combat';
import { Weapons } from '../combat/Weapons';
import { BandSystem } from '../entities/Band';
import { Terrain } from '../world/Terrain';
import { buildWorld, type WorldVisuals } from '../world/WorldBuilder';
import type { HudScene } from './HudScene';
import type { RunState } from '../../state/RunState';
import { Autopilot } from '../../debug';

let cachedTerrain: Terrain | null = null;

export interface InputState {
  x: number;
  y: number;
  solo: boolean;
  breakdown: boolean;
}

export class GameScene extends Phaser.Scene {
  run!: RunState;
  terrain!: Terrain;
  beat!: BeatClock;
  fx!: Fx;
  tele!: Telegraphs;
  enemies!: EnemySystem;
  shots!: Projectiles;
  combat!: Combat;
  band!: BandSystem;
  weapons!: Weapons;
  pickups!: Pickups;
  director!: Director;
  objectives!: Objectives;
  world!: WorldVisuals;

  /** Filled by the HUD (touch) and keyboard each frame. */
  input2: InputState = { x: 0, y: 0, solo: false, breakdown: false };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  started = false;
  gameTime = 0;
  private slowT = 0;
  private slowScale = 1;
  private hitStopT = 0;
  private invulnT = 0;
  private zoom = 1;
  private zoomTarget = 1;
  private zoomHold = 0;
  private camX = START.x;
  private camY = START.y;
  private region = '';
  private cullTick = 0;
  private levelUpOpen = false;
  private pendingStemPulses: { member: MemberId; at: number }[] = [];
  private ending = false;
  private combatT = 0;
  private autopilot: Autopilot | null = null;
  private lastSoloHint = 0;
  private tuningEl: HTMLElement | null = null;

  constructor() {
    super('game');
  }

  create(): void {
    const run = App.run;
    if (!run) {
      goToMenu();
      return;
    }
    this.run = run;
    this.started = false;
    this.ending = false;
    this.levelUpOpen = false;
    this.gameTime = 0;
    this.slowT = this.hitStopT = this.invulnT = 0;
    this.zoom = this.zoomTarget = 1;
    this.zoomHold = 0;
    this.combatT = 0;
    this.lastSoloHint = -1;
    this.damageLog = [];
    this.autopilot = null;
    this.pendingStemPulses = [];
    this.region = '';

    if (!cachedTerrain) cachedTerrain = new Terrain();
    this.terrain = cachedTerrain;
    this.terrain.barrierClosed = true;
    this.terrain.gateLocked = true;

    this.cameras.main.setBackgroundColor('#03060b');
    this.fx = new Fx(this);
    this.world = buildWorld(this, this.terrain, this.fx);
    this.tele = new Telegraphs(this);
    this.beat = new BeatClock();
    this.enemies = new EnemySystem(this);
    this.shots = new Projectiles(this);
    this.combat = new Combat(this);
    this.band = new BandSystem(this);
    this.weapons = new Weapons(this);
    this.pickups = new Pickups(this);
    this.director = new Director(this);
    this.objectives = new Objectives(this);

    this.band.create(run.starter, START.x, START.y);
    this.objectives.create(run.missing);
    this.pickups.createRoadCases();

    this.beat.add({
      onSixteenth: (i) => this.weapons.onSixteenth(i),
      onBeat: (b) => {
        if (!this.run.isRunning) return;
        this.enemies.onBeat(b);
        this.weapons.onBeat(b);
      },
      onBar: (bar) => {
        if (!this.run.isRunning) return;
        this.director.onBar(bar);
        this.weapons.onBar(bar);
        this.hud()?.onBar(bar);
      },
    });

    this.setupCamera(layout.state);
    const onLayout = (s: LayoutState) => this.setupCamera(s);
    this.game.events.on('layout', onLayout);
    const onHidden = () => this.pauseRun('hidden');
    this.game.events.on('page-hidden', onHidden);
    this.events.once('shutdown', () => {
      this.game.events.off('layout', onLayout);
      this.game.events.off('page-hidden', onHidden);
      this.tuningEl?.remove();
      this.tuningEl = null;
      App.ui.hideAudioChip();
    });

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,ESC,P,M') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-M', () => App.store.updateSettings({ muted: !App.store.settings.muted }));
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT,SHIFT');

    if (App.autopilot) this.autopilot = new Autopilot(this);

    this.scene.launch('hud');
    this.scene.bringToTop('hud');
    this.waitForAudio();
  }

  // ------------------------------------------------------------------ startup

  private waitForAudio(): void {
    const a = App.audio;
    if (a.status === 'ready' || a.status === 'running') {
      this.begin();
      return;
    }
    if (!a.ctx) {
      this.begin();
      return;
    }
    this.tuningEl = App.ui.showTuning();
    const timeout = new Promise((r) => setTimeout(r, 8000));
    Promise.race([a.load().catch(() => undefined), timeout]).then(() => {
      this.tuningEl?.remove();
      this.tuningEl = null;
      if (this.scene.isActive()) this.begin();
    });
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    const run = this.run;
    App.audio.startTransport([run.starter]);
    App.audio.setMuffled(false);
    this.beat.reset();
    run.start();
    if (App.audio.status !== 'running') {
      App.ui.showAudioChip(() => this.retryAudio());
    }
    const L = this.band.leader;
    this.fx.ring(L.x, L.y, BAND[run.starter].color, 10, 120, 0.8, 'fx_ring_thick');
    this.hud()?.toast(layout.state.touch ? TUTORIAL_HINTS.move : TUTORIAL_HINTS.moveDesktop, '#efe4cc', 3.2);
    this.time.delayedCall(2600, () => this.hud()?.transmission(TRANSMISSIONS.start.from, TRANSMISSIONS.start.text));
  }

  private retryAudio(): void {
    App.audio.initialize();
    App.audio
      .load()
      .then(() => {
        if (!this.run.isOver) {
          App.audio.startTransport(this.run.band);
          this.beat.reset();
          App.ui.hideAudioChip();
        }
      })
      .catch(() => App.ui.showAudioChip(() => this.retryAudio()));
  }

  private setupCamera(s: LayoutState): void {
    const cam = this.cameras.main;
    cam.setSize(Math.round(s.W * s.rs), Math.round(s.H * s.rs));
    cam.setZoom(s.rs * this.zoom);
    this.world?.grain.setSize(s.W * 1.3, s.H * 1.3);
  }

  // ------------------------------------------------------------------ helpers used by systems

  hud(): HudScene | null {
    const h = this.scene.get('hud') as HudScene | undefined;
    return h && this.scene.isActive('hud') ? h : null;
  }

  audio(name: SfxName, opts?: SfxOptions): void {
    App.audio.playSfx(name, opts);
  }

  audioEngine(): AudioEngine {
    return App.audio;
  }

  haptic(p: number | number[]): void {
    App.haptic(p);
  }

  invulnFlash(): boolean {
    return this.invulnT > 0 && Math.floor(this.gameTime * 22) % 2 === 0;
  }

  slowMo(scale: number, realSeconds: number): void {
    this.slowScale = scale;
    this.slowT = Math.max(this.slowT, realSeconds);
  }

  hitStop(realSeconds: number): void {
    this.hitStopT = Math.max(this.hitStopT, realSeconds);
  }

  zoomPulse(z: number, _inTime: number, hold: number): void {
    this.zoomTarget = z;
    this.zoomHold = hold;
  }

  stemPulseAt(member: MemberId, audioTime: number): void {
    this.pendingStemPulses.push({ member, at: audioTime });
  }

  onFirstSight(kind: EnemyKind, e: Enemy): void {
    const line = ENEMIES[kind].firstSightLine;
    if (!line || !this.started) return;
    this.time.delayedCall(600, () => {
      if (!e.active) return;
      const L = this.band.leader;
      this.hud()?.say(BAND[L.id].name, line, BAND[L.id].colorCss);
    });
  }

  /** Debug: recent damage sources. */
  damageLog: { t: number; src: string; dmg: number }[] = [];

  hurtPlayer(amount: number, sx: number, sy: number, src = 'unknown'): boolean {
    if (this.invulnT > 0 || !this.run.isRunning || this.ending || (App as any).god) return false;
    let dmg = amount;
    if (this.band.resistT > 0) dmg *= 0.6;
    const dealt = this.run.damage(dmg);
    if (App.debug) {
      this.damageLog.push({ t: Math.round(this.run.elapsed), src, dmg: Math.round(dealt) });
      if (this.damageLog.length > 400) this.damageLog.shift();
    }
    this.invulnT = PLAYER.invulnAfterHit;
    const L = this.band.leader;
    const dx = L.x - sx;
    const dy = L.y - sy;
    const d = Math.hypot(dx, dy) || 1;
    this.band.shove((dx / d) * 140, (dy / d) * 140);
    this.audio('hurt', { volume: 0.5 });
    this.fx.flash(0xff1a1a, Math.min(0.35, 0.08 + dealt / 80), 160);
    this.fx.shake(Math.min(0.012, 0.003 + dealt / 2500), 140);
    this.fx.sparks(L.x, L.y - 20, 0xff3a3a, 5);
    if (dealt >= 14) this.haptic(40);
    if (this.run.phase === 'defeat') this.gameOver();
    return true;
  }

  onGraze(x: number, y: number): void {
    if (!this.run.breakdownUnlocked) return;
    this.run.addBreakdown(BREAKDOWN.perGraze);
    this.fx.sparks(x, y, 0xffffff, 2);
    this.audio('graze', { volume: 0.15 });
  }

  queueLevelUp(): void {
    // processed in update so several shards in one frame open one card set
  }

  openUpgradeChoice(title: string): void {
    if (this.run.isOver) return;
    const choices = this.run.rollUpgradeChoices(3);
    if (choices.length === 0) {
      this.run.pendingLevelUps = 0;
      return;
    }
    this.levelUpOpen = true;
    this.run.pause('levelup');
    if (title === 'LEVEL UP') this.run.heal(this.run.maxHp * LEVEL_UP_HEAL);
    this.input2.x = this.input2.y = 0;
    this.hud()?.resetJoystick();
    const accent = BAND[this.run.starter].color;
    this.fx.ring(this.band.leader.x, this.band.leader.y - 20, accent, 10, 90, 0.4);
    App.ui.showLevelUp(choices, title === 'LEVEL UP' ? `LEVEL ${this.run.level}` : title, (id) => {
      const wasLevel = title === 'LEVEL UP';
      const pending = this.run.pendingLevelUps;
      this.run.chooseUpgrade(id);
      if (!wasLevel && pending === this.run.pendingLevelUps + 1) this.run.pendingLevelUps++; // road cases don't consume level-ups
      App.ui.clear();
      this.hud()?.upgradeTaken(id);
      this.run.resume('levelup');
      this.time.delayedCall(250, () => (this.levelUpOpen = false));
    });
  }

  // ------------------------------------------------------------------ pause

  togglePause(): void {
    if (this.run.isOver || !this.started || this.levelUpOpen) return;
    if (this.run.pausedBy('menu')) this.resumeRun();
    else this.pauseRun('menu');
  }

  pauseRun(reason: 'menu' | 'hidden'): void {
    if (!this.started || this.run.isOver || this.levelUpOpen) return;
    if (reason === 'hidden') {
      // treat page-hide like opening the pause menu: nothing advances while away
      if (this.run.pausedBy('menu')) return;
    }
    this.run.pause('menu');
    this.input2.x = this.input2.y = 0;
    this.hud()?.resetJoystick();
    App.audio.setMuffled(true);
    App.ui.showPause(
      () => this.resumeRun(),
      () => goToMenu(),
      () => {
        App.audio.initialize();
        import('../../flow').then((f) => f.startRun(this.run.starter, true));
      },
    );
  }

  resumeRun(): void {
    App.audio.resume();
    App.audio.setMuffled(false);
    App.ui.clear();
    if (App.audio.status !== 'running' && this.started) App.ui.showAudioChip(() => this.retryAudio());
    this.run.resume('menu');
    this.run.resume('hidden');
  }

  // ------------------------------------------------------------------ story beats

  rescue(member: MemberId, x: number, y: number): void {
    const run = this.run;
    if (!run.rescue(member)) return;
    const m = BAND[member];
    run.pause('rescue');
    this.slowMo(0.12, 1.5);
    this.time.delayedCall(1500, () => run.resume('rescue'));
    this.fx.ring(x, y - 40, m.color, 20, 260, 0.9, 'fx_ring_thick');
    this.fx.ring(x, y - 40, 0xffffff, 10, 160, 0.6);
    this.fx.flash(m.color, 0.3, 300);
    this.fx.shake(0.01, 350);
    this.audio('siphonBreak', { volume: 0.9 });
    this.audio('rescue', { volume: 0.8 });
    this.haptic([50, 30, 90]);
    run.heal(run.maxHp * RESCUE_HEAL);
    const comp = this.band.addMember(member, x, y);
    const at = App.audio.setStemActive(member, true);
    this.stemPulseAt(member, at);
    this.hud()?.rescueSplash(member);
    this.time.delayedCall(1700, () => {
      this.fx.floatText(comp.x, comp.y - 70, `“${m.rescueLine}”`, m.colorCss, 17, 3.2, comp, '"Oswald", sans-serif');
    });
    if (run.stats.rescueOrder.length === 1) {
      this.time.delayedCall(5000, () => this.hud()?.transmission(TRANSMISSIONS.firstRescue.from, TRANSMISSIONS.firstRescue.text));
    }
    if (run.isFullBand) this.time.delayedCall(1900, () => this.fullBand());
  }

  private fullBand(): void {
    const L = this.band.leader;
    this.hud()?.fullBandSplash();
    this.audio('breakdown', { volume: 0.7 });
    this.fx.flash(0xffffff, 0.4, 400);
    this.fx.shake(0.012, 500);
    this.haptic([60, 40, 60, 40, 120]);
    // the island flinches at the combined resonance
    this.combat.areaDamage(L.x, L.y, 520, 80, L.id, { knock: 500, noOctave: true });
    for (const id of ['lead', 'rhythm', 'bass', 'drums', 'vocals'] as MemberId[]) {
      this.fx.ring(L.x, L.y - 20, BAND[id].color, 20, 300 + Math.random() * 200, 0.9, 'fx_ring_thick', 0.8);
    }
    this.objectives.openSpire();
    this.time.delayedCall(3500, () => this.hud()?.transmission(TRANSMISSIONS.fullBand.from, TRANSMISSIONS.fullBand.text));
  }

  private triggerSurge(): void {
    this.run.surgeTriggered = true;
    this.hud()?.phaseBanner('THE ISLAND STIRS');
    this.hud()?.transmission(TRANSMISSIONS.surge.from, TRANSMISSIONS.surge.text);
    this.hud()?.setStorm(1);
    this.audio('thunder', { volume: 0.7 });
    this.fx.flash(0xb455ff, 0.25, 300);
    this.fx.shake(0.006, 600);
  }

  onBossDefeated(): void {
    this.hud()?.phaseBanner('THE STORM BREAKS');
    this.hud()?.setStorm(0);
    this.time.delayedCall(1500, () => this.hud()?.transmission(TRANSMISSIONS.bossDefeat.from, TRANSMISSIONS.bossDefeat.text));
  }

  victory(): void {
    if (this.ending) return;
    if (!this.run.extract()) return;
    this.ending = true;
    const isBest = App.store.recordVictory(this.run.starter, this.run.timeRemaining);
    this.audio('victory', { volume: 0.9 });
    this.audio('portal', { volume: 0.7 });
    this.haptic([80, 50, 80, 50, 200]);
    this.fx.flash(0x2fe6ff, 0.5, 600);
    for (const m of this.band.members) {
      this.tweens.add({ targets: m.sprite, alpha: 0, scale: 0.05, x: SPIRE.portal.x, y: SPIRE.portal.y, duration: 900, delay: Math.random() * 300 });
    }
    this.hud()?.hideControls();
    this.time.delayedCall(1600, () => {
      App.ui.showResults(this.run, isBest);
      App.audio.setMuffled(true);
    });
  }

  gameOver(): void {
    if (this.ending) return;
    this.ending = true;
    const run = this.run;
    if (run.phase !== 'defeat') run.lose('time');
    this.hud()?.hideControls();
    this.audio('gameOver', { volume: 0.9 });
    App.audio.fadeOutMusic(3);
    this.haptic([200, 100, 300]);
    // siphon beams rip the band into the sky
    for (const m of this.band.members) {
      this.fx.ring(m.x, m.y - 20, 0xff2a2a, 60, 4, 1.2, 'fx_ring_thick');
      this.tweens.add({ targets: m.sprite, alpha: 0, y: m.y - 140, duration: 1800, ease: 'Quad.easeIn' });
      this.fx.lightning(m.x, m.y - 30, m.x + (Math.random() - 0.5) * 40, m.y - 700, 0xff2a2a, 6, 1.4, 20);
    }
    this.fx.flash(0xff0000, 0.35, 900);
    this.time.delayedCall(2300, () => App.ui.showResults(run, false));
  }

  // ------------------------------------------------------------------ frame

  perfMs = 0;
  private fpsWindow = 0;
  private fpsFrames = 0;
  private slowWindows = 0;
  /** Worst-case ms per subsystem since the last read (debug only). */
  prof: Record<string, number> = {};
  private profT = 0;
  private mark(name: string): void {
    const n = performance.now();
    const v = n - this.profT;
    if (v > (this.prof[name] ?? 0)) this.prof[name] = v;
    this.profT = n;
  }

  update(_time: number, delta: number): void {
    if (!this.run) return;
    const perf0 = performance.now();
    const realDt = Math.min(0.05, delta / 1000);
    const run = this.run;
    const frozen = run.pausedBy('menu') || run.pausedBy('levelup') || run.pausedBy('hidden');

    this.profT = performance.now();
    this.readInput();
    this.mark('input');
    if (!this.started || frozen) {
      this.hud()?.sync(this);
      return;
    }

    // time scaling: slow-mo (rescue/breakdown), hit-stop, test speed
    let scale = App.speed;
    if (this.slowT > 0) {
      this.slowT -= realDt;
      scale *= this.slowScale;
    }
    if (this.hitStopT > 0) {
      this.hitStopT -= realDt;
      scale *= 0.08;
    }
    const dt = realDt * scale;
    this.gameTime += dt;
    this.invulnT -= dt;

    if (!this.ending && run.tick(dt)) {
      this.gameOver();
    }
    this.beat.update(realDt);

    const inp = this.input2;
    this.profT = performance.now();
    if (!this.ending) {
      this.band.update(dt, inp.x, inp.y);
    }
    this.mark('band');
    this.weapons.update(dt);
    this.mark('weapons');
    this.enemies.update(dt);
    this.mark('enemies');
    this.shots.update(dt);
    this.mark('shots');
    this.combat.update(dt);
    this.mark('combat');
    this.pickups.update(dt);
    this.mark('pickups');
    if (!this.ending) {
      this.director.update(dt);
      this.objectives.update(dt);
    }
    this.mark('director+objectives');
    this.tele.update(dt, this.gameTime);
    const bandK = 0.45 + 0.14 * this.run.band.length + (this.weapons.breakdownT > 0 ? 0.6 : 0);
    this.fx.update(dt, realDt, this.beat.pulse() * bandK, this.beat.barPulse() * bandK);
    this.mark('tele+fx');

    // action buttons (edge-triggered)
    if (inp.solo) {
      inp.solo = false;
      if (run.useSolo()) this.weapons.solo();
      else if (this.gameTime - this.lastSoloHint > 0.4) {
        this.lastSoloHint = this.gameTime;
        this.hud()?.soloDenied();
      }
    }
    if (inp.breakdown) {
      inp.breakdown = false;
      if (run.useBreakdown()) this.weapons.breakdown();
      else if (run.breakdownUnlocked) this.hud()?.soloDenied(true);
    }

    // the band keeps each other standing
    if (!this.ending) run.heal((REGEN.base + REGEN.perCompanion * run.companions.length) * dt);

    // sustained combat feeds the BREAKDOWN meter
    const L = this.band.leader;
    if (this.enemies.nearest(L.x, L.y, 260)) {
      this.combatT += dt;
      run.addBreakdown(BREAKDOWN.perSecondInCombat * dt);
    }

    // the island surges at ~9:30
    if (!run.surgeTriggered && run.timeRemaining <= PACING.surgeAtRemaining) this.triggerSurge();

    // level-ups (one card set at a time, never during slow-mo moments)
    if (run.pendingLevelUps > 0 && !this.levelUpOpen && this.slowT <= 0 && !this.ending && !run.pausedBy('rescue')) {
      this.openUpgradeChoice('LEVEL UP');
    }

    // stem entrance pulses land exactly when the audio reaches the bar line
    if (this.pendingStemPulses.length) {
      const now = App.audio.schedulerNow();
      for (let i = this.pendingStemPulses.length - 1; i >= 0; i--) {
        const p = this.pendingStemPulses[i];
        if (now >= p.at - 0.01) {
          this.pendingStemPulses.splice(i, 1);
          this.stemPulse(p.member);
        }
      }
    }

    this.watchFrameRate(delta / 1000);
    this.updateCamera(realDt);
    this.mark('camera');
    this.updateWorldBits();
    this.mark('world');
    this.hud()?.sync(this);
    this.mark('hud');
    this.perfMs += (performance.now() - perf0 - this.perfMs) * 0.05;
  }

  /** If the device keeps missing ~45 fps, step the render resolution down. */
  private watchFrameRate(rawDt: number): void {
    this.fpsWindow += rawDt;
    this.fpsFrames++;
    if (this.fpsWindow < 4) return;
    const fps = this.fpsFrames / this.fpsWindow;
    this.fpsWindow = 0;
    this.fpsFrames = 0;
    if (fps < 45 && !App.autopilot) {
      this.slowWindows++;
      if (this.slowWindows >= 2 && layout.lowerResolution()) this.slowWindows = 0;
    } else this.slowWindows = 0;
  }

  private stemPulse(member: MemberId): void {
    const m = this.band.get(member) ?? this.band.leader;
    const col = BAND[member].color;
    this.fx.ring(m.x, m.y - 20, col, 10, 180, 0.7, 'fx_ring_thick');
    this.fx.ring(m.x, m.y - 20, col, 40, 300, 1.0, 'fx_ring', 0.6);
    this.fx.musicNotes(m.x, m.y - 40, col, 6);
    this.hud()?.stemIn(member);
  }

  private readInput(): void {
    const k = this.keys;
    let kx = 0;
    let ky = 0;
    if (k.A.isDown || k.LEFT.isDown) kx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) kx += 1;
    if (k.W.isDown || k.UP.isDown) ky -= 1;
    if (k.S.isDown || k.DOWN.isDown) ky += 1;
    const hud = this.hud();
    let x = hud?.joyX ?? 0;
    let y = hud?.joyY ?? 0;
    if (kx || ky) {
      const d = Math.hypot(kx, ky);
      x = kx / d;
      y = ky / d;
    }
    if (this.autopilot && this.started && !this.run.isPaused) {
      const a = this.autopilot.steer();
      x = a.x;
      y = a.y;
      if (a.solo) this.input2.solo = true;
      if (a.breakdown) this.input2.breakdown = true;
    }
    this.input2.x = x;
    this.input2.y = y;
    if (Phaser.Input.Keyboard.JustDown(k.SPACE)) this.input2.solo = true;
    if (Phaser.Input.Keyboard.JustDown(k.SHIFT)) this.input2.breakdown = true;
  }

  private updateCamera(realDt: number): void {
    const L = this.band.leader;
    const cam = this.cameras.main;
    const look = L.moving ? 46 : 0;
    const tx = L.x + Math.cos(L.facing) * look;
    const ty = L.y - 20 + Math.sin(L.facing) * look;
    const k = 1 - Math.pow(0.0025, realDt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    if (this.zoomHold > 0) this.zoomHold -= realDt;
    else this.zoomTarget = 1;
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.pow(0.02, realDt));
    cam.setZoom(layout.state.rs * this.zoom);
    cam.centerOn(this.camX, this.camY);
    const v = cam.worldView;
    this.world.grain.setTilePosition(v.x * 0.5, v.y * 0.5);
    this.world.grain.setPosition(0, 0);
  }

  private updateWorldBits(): void {
    const L = this.band.leader;
    // cull decor outside the view
    if (++this.cullTick % 8 === 0) {
      const v = this.cameras.main.worldView;
      const x0 = v.x - 160;
      const x1 = v.right + 160;
      const y0 = v.y - 120;
      const y1 = v.bottom + 220;
      for (const d of this.world.decor) d.setVisible(d.x > x0 && d.x < x1 && d.y > y0 && d.y < y1);
    }
    this.mark('cull');
    // region banner
    const reg = this.terrain.regionAt(L.x, L.y);
    if (reg !== this.region) {
      const prev = this.region;
      this.region = reg;
      if (prev) this.hud()?.regionBanner(reg);
    }
    this.mark('region');
    // environmental text (signs, plaques)
    for (const s of this.world.signs) {
      if (s.shown || s.style === 'region') continue;
      if (Math.hypot(L.x - s.x, L.y - s.y) < 120) {
        s.shown = true;
        this.fx.floatText(s.x, s.y - 70, s.text, s.style === 'alien' ? '#ff9a9a' : '#efe4cc', 16, 4.5, undefined, '"Oswald", sans-serif');
      }
    }
  }
}
