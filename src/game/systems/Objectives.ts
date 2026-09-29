/**
 * Island objectives: four siphon sites holding the missing bandmates, the
 * Resonance Spire (sealed until FALSE PROPHET is whole), the final arena and
 * the escape portal.
 *
 * Signals: Rattlewood + Brassmire are live from the start, Feedback Ridge
 * opens after the first rescue, the crater rim after the second — so rescue
 * order varies run to run and routes converge on the interior.
 */
import Phaser from 'phaser';
import { App } from '../../app';
import { BAND, type MemberId } from '../../data/band';
import { MINIBOSSES } from '../../data/enemies';
import { SITES, SPIRE, type SiteDef } from '../../data/island';
import { PACING } from '../../config/gameConfig';
import { T } from '../art/atlas';
import { INV_RES } from '../sceneUtil';
import { MinibossBrain, SiphonCoreBrain } from '../bosses/Minibosses';
import { NullMaestroBrain } from '../bosses/NullMaestro';
import type { Enemy } from '../enemies/Enemy';
import { DEPTH } from './Fx';
import type { GameScene } from '../scenes/GameScene';

export type SiteState = 'locked' | 'signal' | 'guarded' | 'core' | 'release' | 'rescued';

export interface SiteRt {
  def: SiteDef;
  member: MemberId;
  state: SiteState;
  capsule: Phaser.GameObjects.Image;
  captive: Phaser.GameObjects.Image;
  base: Phaser.GameObjects.Image;
  pillar: Phaser.GameObjects.Image;
  boss: Enemy | null;
  core: Enemy | null;
  releaseT: number;
  releaseMax: number;
  waveT: number;
}

export type SpireState = 'sealed' | 'open' | 'fight' | 'escape' | 'done';

export interface ObjectiveTarget {
  x: number;
  y: number;
  color: number;
  kind: 'signal' | 'site' | 'spire' | 'boss' | 'portal';
  member?: MemberId;
}

export class Objectives {
  sites: SiteRt[] = [];
  spire: SpireState = 'sealed';
  boss: NullMaestroBrain | null = null;
  portal: Phaser.GameObjects.Image | null = null;
  private portalGlow: Phaser.GameObjects.Image | null = null;
  text = '';
  target: ObjectiveTarget | null = null;
  bossHint = 'DESTROY THE NULL MAESTRO';
  private t = 0;
  private releaseG: Phaser.GameObjects.Graphics | null = null;
  private releaseLabel: Phaser.GameObjects.Text | null = null;

  constructor(private gs: GameScene) {}

  create(missing: MemberId[]): void {
    const gs = this.gs;
    const order = Phaser.Utils.Array.Shuffle([...missing]);
    SITES.forEach((def, i) => {
      const member = order[i];
      const color = BAND[member].color;
      const base = gs.add.image(def.x, def.y + 8, ...T('lm_capsule_base')).setScale(INV_RES).setDepth(DEPTH.pad);
      const captive = gs.add.image(def.x, def.y - 30, ...T(`m_${member}_captive`)).setOrigin(0.5, 0.95).setScale(INV_RES).setDepth(def.y - 1);
      const capsule = gs.add.image(def.x, def.y + 6, ...T('lm_capsule')).setOrigin(0.5, 0.97).setScale(INV_RES).setDepth(def.y);
      const pillar = gs.add
        .image(def.x, def.y - 60, ...T('fx_beam'))
        .setOrigin(0, 0.5)
        .setRotation(-Math.PI / 2)
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale((700 / 64) * INV_RES, 2.2 * INV_RES)
        .setAlpha(0.45)
        .setDepth(DEPTH.fx - 10);
      const rt: SiteRt = { def, member, state: def.unlockAfter === 0 ? 'signal' : 'locked', capsule, captive, base, pillar, boss: null, core: null, releaseT: 0, releaseMax: 20, waveT: 0 };
      pillar.setVisible(rt.state !== 'locked');
      this.sites.push(rt);
    });
  }

  get rescuedCount(): number {
    return this.sites.filter((s) => s.state === 'rescued').length;
  }

  activeSite(): SiteRt | null {
    return this.sites.find((s) => s.state === 'guarded' || s.state === 'core' || s.state === 'release') ?? null;
  }

  setBossHint(h: string): void {
    this.bossHint = h;
  }

  /** True if (x,y) is on the other side of the silence barrier from the band. */
  inSealedArena(x: number, y: number): boolean {
    if (this.spire === 'escape' || this.spire === 'done') return false;
    const L = this.gs.band.leader;
    const inside = (px: number, py: number) => Math.hypot(px - SPIRE.x, py - SPIRE.y) < SPIRE.barrierRadius + 40;
    return inside(x, y) !== inside(L.x, L.y);
  }

  update(dt: number): void {
    const gs = this.gs;
    const L = gs.band.leader;
    this.t += dt;
    const beat = gs.beat.beat;
    const pulse = gs.beat.pulse(4);

    for (const s of this.sites) {
      if (s.state === 'rescued') continue;
      // captive floats + drains upward
      s.captive.setY(s.def.y - 32 + Math.sin(this.t * 1.6) * 3);
      s.pillar.setAlpha(s.state === 'locked' ? 0 : 0.28 + 0.3 * pulse);
      s.pillar.setScale((700 / 64) * INV_RES, (1.6 + 0.8 * pulse) * INV_RES);
      if (s.state === 'signal') {
        const d = Math.hypot(L.x - s.def.x, L.y - s.def.y);
        if (d < PACING.siteEngageRadius) this.engage(s);
      }
      if (Math.random() < 0.15 && s.state !== 'locked') gs.fx.sparks(s.def.x + (Math.random() - 0.5) * 30, s.def.y - 60, BAND[s.member].color, 1);
      if (s.state === 'release') this.updateRelease(s, dt);
    }

    // silence barrier glow
    const glow = gs.world.barrierGlow;
    glow.clear();
    if (gs.terrain.barrierClosed) {
      glow.lineStyle(10, 0xff2a2a, 0.12 + 0.18 * gs.beat.barPulse());
      glow.strokeCircle(SPIRE.x, SPIRE.y, SPIRE.barrierRadius);
      if (gs.terrain.gateLocked) {
        glow.lineStyle(4, 0xff5a5a, 0.5 + 0.4 * pulse);
        glow.beginPath();
        glow.arc(SPIRE.x, SPIRE.y, SPIRE.barrierRadius, SPIRE.gateAngle - SPIRE.gateHalfWidth, SPIRE.gateAngle + SPIRE.gateHalfWidth);
        glow.strokePath();
      }
    }

    if (this.spire === 'open') {
      const d = Math.hypot(L.x - SPIRE.x, L.y - SPIRE.y);
      if (d < SPIRE.barrierRadius - 150) this.startBossFight();
    }
    if (this.spire === 'escape' && this.portal) {
      this.portal.setRotation(-this.t * 1.5).setScale(INV_RES * (1 + 0.08 * pulse));
      this.portalGlow?.setAlpha(0.5 + 0.4 * pulse);
      if (Math.random() < 0.4) gs.fx.sparks(SPIRE.portal.x + (Math.random() - 0.5) * 80, SPIRE.portal.y + (Math.random() - 0.5) * 80, 0x2fe6ff, 1);
      if (Math.hypot(L.x - SPIRE.portal.x, L.y - SPIRE.portal.y) < 70) {
        this.spire = 'done';
        gs.victory();
      }
    }
    void beat;
    this.computeObjective();
  }

  // ------------------------------------------------------------------ sites

  private engage(s: SiteRt): void {
    const gs = this.gs;
    s.state = 'guarded';
    const rescued = this.rescuedCount;
    const core = gs.enemies.spawnCustom('anchor', s.def.x, s.def.y + 60, Math.round(280 + 90 * rescued), 22, new SiphonCoreBrain(gs, () => this.coreBroken(s)), {
      kind: 'structure',
      originY: 0.95,
      scale: 1,
    });
    if (core) {
      core.invulnerable = true;
      core.label = 'SIPHON CORE';
      if (!core.aura) core.aura = gs.add.image(0, 0, ...T('fx_hex')).setBlendMode(Phaser.BlendModes.ADD);
      core.aura.setTint(0xff3a3a).setScale(0.8 * INV_RES).setVisible(true).setAlpha(0.8);
      s.core = core;
    }
    // the guardian erupts from behind the capsule
    const bx = s.def.x + (gs.band.leader.x < s.def.x ? 90 : -90);
    const by = s.def.y - 60;
    s.boss = MinibossBrain.spawn(gs, s.def.miniboss, bx, by, rescued, () => this.guardianDown(s));
    gs.director.waveAround(s.def.x, s.def.y, rescued === 0 ? ['tick', 'tick', 'maraca'] : ['tick', 'maraca', 'tick', 'castanet'], 4 + rescued * 2, 300);
    gs.hud()?.say(BAND[gs.band.leader.id].name, `${BAND[s.member].name}! Hang on!`, BAND[gs.band.leader.id].colorCss);
    App.haptic(30);
  }

  private guardianDown(s: SiteRt): void {
    const gs = this.gs;
    s.state = 'core';
    s.boss = null;
    if (s.core) {
      s.core.invulnerable = false;
      s.core.aura?.setVisible(false);
      gs.fx.ring(s.core.x, s.core.y - 40, 0xffffff, 10, 90, 0.4, 'fx_hex');
      gs.fx.floatText(s.core.x, s.core.y - 90, 'SHIELD DOWN', '#ffffff', 22, 1.2);
    }
    gs.audio('siphonBreak', { volume: 0.5, rate: 1.3 });
  }

  /** Core destroyed: the capsule starts to open. Hold the area until it releases. */
  private coreBroken(s: SiteRt): void {
    const gs = this.gs;
    s.core = null;
    s.state = 'release';
    s.releaseT = 0;
    s.releaseMax = PACING.releaseSeconds[Math.min(PACING.releaseSeconds.length - 1, this.rescuedCount)];
    s.waveT = 1.5;
    gs.fx.ring(s.def.x, s.def.y - 60, BAND[s.member].color, 10, 160, 0.6, 'fx_ring_thick');
    gs.fx.burst(gs.fx.shard, s.def.x, s.def.y - 40, 0xff3a3a, 14);
    gs.audio('siphonBreak', { volume: 0.8 });
    gs.hud()?.toast('DEFEND THE RELEASE', BAND[s.member].colorCss, 2.4);
    gs.hud()?.say(BAND[s.member].name, 'Keep them off me — this glass is thick!', BAND[s.member].colorCss);
    s.capsule.setTint(0xffb0b0);
    if (!this.releaseG) {
      this.releaseG = gs.add.graphics().setDepth(DEPTH.telegraph + 20);
      this.releaseLabel = gs.add
        .text(0, 0, '', { fontFamily: 'Oswald, sans-serif', fontStyle: '700', fontSize: '22px', color: '#ffffff', stroke: '#07060a', strokeThickness: 5, resolution: 2 })
        .setOrigin(0.5)
        .setDepth(DEPTH.worldUi);
    }
  }

  private updateRelease(s: SiteRt, dt: number): void {
    const gs = this.gs;
    const L = gs.band.leader;
    const inRange = Math.hypot(L.x - s.def.x, L.y - s.def.y) < PACING.releaseRadius;
    if (inRange) s.releaseT += dt;
    const k = Math.min(1, s.releaseT / s.releaseMax);
    const col = BAND[s.member].color;
    // the captive brightens as the siphon lets go
    s.captive.setTint(Phaser.Display.Color.GetColor(110 + 145 * k, 60 + 195 * k, 150 + 105 * k));
    const g = this.releaseG!;
    g.clear();
    const pulse = gs.beat.pulse(4);
    g.lineStyle(3, col, 0.25 + 0.2 * pulse);
    g.strokeCircle(s.def.x, s.def.y, PACING.releaseRadius);
    g.lineStyle(10, 0x07060a, 0.7);
    g.strokeCircle(s.def.x, s.def.y - 60, 64);
    g.lineStyle(7, col, inRange ? 1 : 0.4);
    g.beginPath();
    g.arc(s.def.x, s.def.y - 60, 64, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    g.strokePath();
    this.releaseLabel!.setPosition(s.def.x, s.def.y - 150).setText(inRange ? `${Math.floor(k * 100)}%` : 'STAY CLOSE').setVisible(true);
    // the siphon's defenders keep coming
    s.waveT -= dt;
    if (s.waveT <= 0) {
      s.waveT = 3.2;
      const kinds = gs.director.pickKind();
      gs.director.waveAround(s.def.x, s.def.y, [kinds, 'tick', 'maraca'], 3 + this.rescuedCount, 340);
    }
    if (k >= 1) this.release(s);
  }

  /** Test hook: complete a site immediately through the real rescue flow. */
  forceRescue(member: MemberId): boolean {
    const s = this.sites.find((q) => q.member === member);
    if (!s || s.state === 'rescued') return false;
    if (s.boss?.active) {
      s.boss.brain = null;
      this.gs.enemies.remove(s.boss);
    }
    if (s.core?.active) {
      s.core.brain = null;
      this.gs.enemies.remove(s.core);
    }
    s.boss = null;
    s.core = null;
    this.release(s);
    return true;
  }

  private release(s: SiteRt): void {
    const gs = this.gs;
    s.state = 'rescued';
    this.releaseG?.clear();
    this.releaseLabel?.setVisible(false);
    // shatter the capsule
    gs.fx.burst(gs.fx.shard, s.def.x, s.def.y - 60, 0xd8f8ff, 30);
    gs.fx.burst(gs.fx.shard, s.def.x, s.def.y - 60, BAND[s.member].color, 20);
    s.capsule.setVisible(false);
    s.captive.setVisible(false);
    s.pillar.setVisible(false);
    s.base.setAlpha(0.5);
    gs.rescue(s.member, s.def.x, s.def.y - 10);
    // new signals come online
    const n = this.rescuedCount;
    for (const o of this.sites) {
      if (o.state === 'locked' && n >= o.def.unlockAfter) {
        o.state = 'signal';
        o.pillar.setVisible(true);
        gs.hud()?.toast(`NEW SIGNAL: ${BAND[o.member].roleShort}`, BAND[o.member].colorCss);
      }
    }
  }

  // ------------------------------------------------------------------ spire

  openSpire(): void {
    const gs = this.gs;
    this.spire = 'open';
    gs.terrain.gateLocked = false;
    for (const p of gs.world.gatePillars) {
      gs.fx.burst(gs.fx.shard, p.x, p.y - 30, 0xff3a3a, 8);
      gs.tweens.add({ targets: p, alpha: 0, scaleY: 0, duration: 600, ease: 'Quad.easeIn' });
    }
    gs.audio('siphonBreak', { volume: 0.7, rate: 0.7 });
  }

  private startBossFight(): void {
    const gs = this.gs;
    this.spire = 'fight';
    gs.terrain.gateLocked = true;
    for (const p of gs.world.gatePillars) {
      p.setAlpha(1).setScale(INV_RES);
    }
    gs.director.enabled = false;
    // clear stragglers inside the arena for a clean entrance
    for (const e of gs.enemies.list) if (e.active && e.def) gs.combat.kill(e, null);
    gs.shots.clearAllEnemyShots();
    this.boss = new NullMaestroBrain(gs, () => this.bossDefeated());
    this.boss.spawn();
  }

  private bossDefeated(): void {
    const gs = this.gs;
    gs.run.defeatBoss();
    this.spire = 'escape';
    gs.terrain.barrierClosed = false;
    for (const p of [...gs.world.barrierPillars, ...gs.world.gatePillars]) {
      gs.tweens.add({ targets: p, alpha: 0, duration: 900, delay: Math.random() * 400 });
    }
    for (const e of gs.enemies.list) if (e.active && e.def) gs.combat.kill(e, null);
    this.portalGlow = gs.add.image(SPIRE.portal.x, SPIRE.portal.y, ...T('fx_glow')).setTint(0x2fe6ff).setBlendMode(Phaser.BlendModes.ADD).setScale(6 * INV_RES).setDepth(DEPTH.fx - 5);
    this.portal = gs.add.image(SPIRE.portal.x, SPIRE.portal.y, ...T('lm_portal')).setBlendMode(Phaser.BlendModes.ADD).setScale(INV_RES).setDepth(DEPTH.fx - 4);
    gs.world.spire.setTint(0x555555);
    gs.pickups.vacuum();
    gs.onBossDefeated();
    // the harvest remnants try to cut off the escape
    gs.director.enabled = true;
    gs.director.pressure = 0.6;
  }

  // ------------------------------------------------------------------ HUD objective

  private computeObjective(): void {
    const gs = this.gs;
    const L = gs.band.leader;
    if (this.spire === 'escape' || this.spire === 'done') {
      this.text = 'REACH THE PORTAL';
      this.target = { x: SPIRE.portal.x, y: SPIRE.portal.y, color: 0x2fe6ff, kind: 'portal' };
      return;
    }
    if (this.spire === 'fight') {
      this.text = this.bossHint;
      const b = this.boss?.boss;
      const anchor = this.boss?.anchors.find((a) => a.e.active);
      if (anchor) this.target = { x: anchor.e.x, y: anchor.e.y, color: 0xff2a2a, kind: 'boss' };
      else this.target = b && b.active ? { x: b.x, y: b.y - 100, color: 0xff2a2a, kind: 'boss' } : null;
      return;
    }
    if (this.spire === 'open') {
      this.text = 'REACH THE SPIRE';
      this.target = { x: SPIRE.x, y: SPIRE.y + 200, color: 0xff2a2a, kind: 'spire' };
      return;
    }
    const act = this.activeSite();
    if (act) {
      if (act.state === 'guarded' && act.boss?.active) {
        this.text = `DEFEAT ${MINIBOSSES[act.def.miniboss].name}`;
        this.target = { x: act.boss.x, y: act.boss.y, color: 0xff3a1a, kind: 'site', member: act.member };
      } else if (act.state === 'release') {
        const pct = Math.floor(Math.min(1, act.releaseT / act.releaseMax) * 100);
        this.text = `DEFEND THE RELEASE — ${pct}%`;
        this.target = { x: act.def.x, y: act.def.y + 40, color: BAND[act.member].color, kind: 'site', member: act.member };
      } else {
        this.text = 'BREAK THE SIPHON';
        this.target = { x: act.def.x, y: act.def.y + 40, color: BAND[act.member].color, kind: 'site', member: act.member };
      }
      return;
    }
    let best: SiteRt | null = null;
    let bd = Infinity;
    for (const s of this.sites) {
      if (s.state !== 'signal') continue;
      const d = Math.hypot(s.def.x - L.x, s.def.y - L.y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (best) {
      this.text = `FOLLOW THE ${BAND[best.member].roleShort} SIGNAL`;
      this.target = { x: best.def.x, y: best.def.y, color: BAND[best.member].color, kind: 'signal', member: best.member };
    } else {
      this.text = 'SURVIVE';
      this.target = null;
    }
  }

  /** All visible signals (for the compass). */
  signals(): ObjectiveTarget[] {
    const out: ObjectiveTarget[] = [];
    for (const s of this.sites) {
      if (s.state === 'signal' || s.state === 'guarded' || s.state === 'core' || s.state === 'release') out.push({ x: s.def.x, y: s.def.y, color: BAND[s.member].color, kind: 'signal', member: s.member });
    }
    if (this.spire === 'open' || this.spire === 'fight') out.push({ x: SPIRE.x, y: SPIRE.y, color: 0xff2a2a, kind: 'spire' });
    else if (this.spire === 'sealed') out.push({ x: SPIRE.x, y: SPIRE.y, color: 0x6a1a1a, kind: 'spire' });
    if (this.spire === 'escape') out.push({ x: SPIRE.portal.x, y: SPIRE.portal.y, color: 0x2fe6ff, kind: 'portal' });
    return out;
  }
}
