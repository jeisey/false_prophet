/**
 * THE NULL MAESTRO — conductor of the Tessitura harvest.
 *
 * Phase 1: conducts beat-locked projectile waves and summons the orchestra.
 * Phase 2: SILENCE — siphons two bandmates (their stems drop out of the mix)
 *          and shields itself with Siphon Anchors. Breaking an anchor frees a
 *          member and their stem re-enters on the next bar.
 * Phase 3: FULL RESONANCE — the core is exposed and the BREAKDOWN is primed.
 */
import Phaser from 'phaser';
import { App } from '../../app';
import { BAND, type MemberId } from '../../data/band';
import { FINAL_BOSS } from '../../data/enemies';
import { BOSS_LINES } from '../../data/lore';
import { SPIRE } from '../../data/island';
import { T } from '../art/atlas';
import { INV_RES } from '../sceneUtil';
import { DEPTH } from '../systems/Fx';
import type { Brain, Enemy } from '../enemies/Enemy';
import type { GameScene } from '../scenes/GameScene';

const RED = 0xff2a2a;

interface Anchor {
  e: Enemy;
  member: MemberId | null;
}

export class NullMaestroBrain implements Brain {
  phase: 1 | 2 | 3 = 1;
  private t = 0;
  private beats = 0;
  private head!: Phaser.GameObjects.Image;
  private baton!: Phaser.GameObjects.Image;
  private halo!: Phaser.GameObjects.Image;
  private core!: Phaser.GameObjects.Image;
  private organs: Phaser.GameObjects.Image[] = [];
  private cables!: Phaser.GameObjects.Graphics;
  anchors: Anchor[] = [];
  suppressed: MemberId[] = [];
  private stunT = 0;
  private transitioning = 0;
  private sweep: { a0: number; a1: number; t: number; dur: number } | null = null;
  private dying = false;
  boss!: Enemy;

  constructor(
    private gs: GameScene,
    private onDefeated: () => void,
  ) {}

  spawn(): Enemy | null {
    const gs = this.gs;
    const e = gs.enemies.spawnCustom('boss_body', SPIRE.x, SPIRE.y + 60, FINAL_BOSS.hp, FINAL_BOSS.radius, this, {
      kind: 'boss',
      originY: 0.72,
      contact: 13,
      mass: 1,
    });
    if (!e) return null;
    this.boss = e;
    e.label = FINAL_BOSS.name;
    e.gore = RED;
    e.flying = true;
    this.halo = gs.add.image(e.x, e.y, ...T('boss_halo')).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2 * INV_RES);
    this.head = gs.add.image(e.x, e.y, ...T('boss_head')).setOrigin(0.5, 0.8).setScale(1.05 * INV_RES);
    this.baton = gs.add.image(e.x, e.y, ...T('boss_baton')).setOrigin(0.05, 0.5).setScale(INV_RES);
    this.core = gs.add.image(e.x, e.y, ...T('boss_core')).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.cables = gs.add.graphics().setDepth(DEPTH.telegraph + 10);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * 1.15 + (i / 3) * Math.PI * 0.7;
      const ox = SPIRE.x + Math.cos(a) * 420;
      const oy = SPIRE.y + Math.sin(a) * 380 + 40;
      const o = gs.add.image(ox, oy, ...T('boss_organ')).setOrigin(0.5, 0.95).setScale(INV_RES).setDepth(oy);
      this.organs.push(o);
      gs.fx.addPulser(o, 0, 0.05, true);
    }
    e.sprite.setScale(INV_RES * 0.2).setAlpha(0);
    gs.tweens.add({ targets: e.sprite, alpha: 1, duration: 900 });
    gs.hud()?.bossCard(FINAL_BOSS.name, FINAL_BOSS.title);
    gs.hud()?.say(FINAL_BOSS.name, BOSS_LINES.intro, '#ff5a5a');
    gs.audio('roar', { volume: 0.9, rate: 0.7 });
    gs.fx.shake(0.012, 700);
    return e;
  }

  get hpFrac(): number {
    return this.boss ? this.boss.hp / this.boss.maxHp : 0;
  }

  update(e: Enemy, dt: number): void {
    const gs = this.gs;
    this.t += dt;
    const beat = gs.beat.beat;
    this.stunT -= dt;
    if (this.transitioning > 0) this.transitioning -= dt;
    // float + sway, conductor style
    const tx = SPIRE.x + Math.sin(this.t * 0.35) * 150;
    const ty = SPIRE.y + 40 + Math.sin(this.t * 0.8) * 24;
    e.x += (tx - e.x) * Math.min(1, dt * 1.5);
    e.y += (ty - e.y) * Math.min(1, dt * 1.5);
    const intro = Math.min(1, this.t / 1.2);
    e.sprite.setScale(INV_RES * (0.2 + 0.8 * intro) * (1 + 0.015 * gs.beat.pulse(4)));
    const top = e.y - 300 * 0.72 * intro;
    this.halo.setPosition(e.x, top + 40).setRotation(this.t * 0.2).setDepth(e.y - 2).setAlpha((0.6 + 0.4 * gs.beat.barPulse()) * intro).setScale(INV_RES * 1.2 * (1 + 0.05 * gs.beat.pulse()));
    this.head.setPosition(e.x, top + 60).setDepth(e.y + 1).setAlpha(intro);
    // baton conducts: a down-stroke on every beat
    const bf = gs.beat.beatFrac;
    const conduct = -0.9 + Math.sin(bf * Math.PI) * 0.9 + Math.sin(beat * Math.PI * 0.5) * 0.35;
    this.baton.setPosition(e.x + 100, top + 110).setRotation(conduct).setDepth(e.y + 2).setAlpha(intro);
    this.core.setPosition(e.x, e.y - 130).setDepth(e.y + 3).setVisible(this.phase === 3).setScale(INV_RES * (1.4 + 0.3 * gs.beat.pulse(3)));

    // siphon cables: organs -> boss, anchors -> captured members
    const g = this.cables;
    g.clear();
    const pulse = gs.beat.pulse(4);
    for (const o of this.organs) {
      g.lineStyle(5, 0x3a0a14, 0.9);
      g.lineBetween(o.x, o.y - 100, e.x + (o.x < e.x ? -26 : 26), e.y - 160);
      g.lineStyle(2, RED, 0.35 + 0.5 * pulse);
      g.lineBetween(o.x, o.y - 100, e.x + (o.x < e.x ? -26 : 26), e.y - 160);
    }
    for (const a of this.anchors) {
      if (!a.e.active) continue;
      const m = a.member ? gs.band.get(a.member) : null;
      const tx2 = m ? m.x : e.x;
      const ty2 = m ? m.y - 30 : e.y - 130;
      g.lineStyle(6, RED, 0.25 + 0.4 * pulse);
      g.lineBetween(a.e.x, a.e.y - 60, tx2, ty2);
      g.lineStyle(2, 0xffb0b0, 0.8);
      g.lineBetween(a.e.x, a.e.y - 60, tx2, ty2);
    }

    // phase transitions
    if (!this.dying) {
      if (this.phase === 1 && this.hpFrac <= 0.66) this.enterPhase2();
      else if (this.phase === 2 && this.hpFrac <= 0.33 && this.anchors.every((a) => !a.e.active)) this.enterPhase3();
    }
    if (this.phase === 2 && this.anchors.length && this.anchors.every((a) => !a.e.active) && e.damageTaken < 1 && !this.dying) {
      // shield broken: stagger
      e.damageTaken = 1.15;
      this.stunT = 3;
      gs.hud()?.say(BAND[gs.band.leader.id].name, 'The shield is down — hit it!', BAND[gs.band.leader.id].colorCss);
      gs.fx.ring(e.x, e.y - 130, 0xffffff, 20, 240, 0.5, 'fx_ring_thick');
      gs.audio('siphonBreak', { volume: 0.8 });
    }

    if (this.sweep) {
      const s = this.sweep;
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      const a = s.a0 + (s.a1 - s.a0) * k;
      const ox = this.baton.x;
      const oy = this.baton.y;
      const len = 560;
      gs.fx.lightning(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len, RED, 7, 0.05, 5);
      const L = gs.band.leader;
      const px = L.x - ox;
      const py = L.y - 12 - oy;
      const pd = Math.hypot(px, py);
      let da = Math.atan2(py, px) - a;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      if (pd < len && Math.abs(da) * pd < 24) gs.hurtPlayer(10 * gs.enemies.dmgScale(), ox, oy, 'maestro:sweep');
      if (s.t >= s.dur) this.sweep = null;
    }
  }

  private enterPhase2(): void {
    const gs = this.gs;
    const e = this.boss;
    this.phase = 2;
    this.transitioning = 2;
    e.damageTaken = 0.15;
    gs.hud()?.say(FINAL_BOSS.name, BOSS_LINES.phase2, '#ff5a5a');
    gs.hud()?.phaseBanner('PHASE 2 — SILENCE');
    gs.audio('roar', { volume: 0.8, rate: 0.6 });
    gs.fx.flash(0x000000, 0.4, 400);
    gs.shots.clearAllEnemyShots();
    // siphon two companions: their parts drop out of the song
    const comps = gs.band.members.filter((m) => !m.isLeader).map((m) => m.id);
    Phaser.Utils.Array.Shuffle(comps);
    this.suppressed = comps.slice(0, Math.min(2, comps.length));
    for (const id of this.suppressed) {
      gs.band.freeze(id, true);
      App.audio.suppressStem(id);
      gs.hud()?.setSuppressed(id, true);
    }
    const angles = [-Math.PI * 0.85, -Math.PI * 0.15, Math.PI * 0.5];
    const members: (MemberId | null)[] = [this.suppressed[0] ?? null, this.suppressed[1] ?? null, null];
    this.anchors = angles.map((a, i) => {
      const x = SPIRE.x + Math.cos(a) * 300;
      const y = SPIRE.y + 60 + Math.sin(a) * 260;
      const member = members[i];
      const ae = gs.enemies.spawnCustom('anchor', x, y, Math.round(520 * (1 + gs.run.elapsed / 60 / 50)), 24, {
        update: (en: Enemy) => {
          en.sprite.setScale(INV_RES * 1.4 * (1 + 0.05 * gs.beat.pulse()));
        },
        onDeath: (en: Enemy) => this.anchorBroken(en, member),
      }, { kind: 'structure', originY: 0.95, scale: 1.4 })!;
      ae.label = member ? `ANCHOR: ${BAND[member].name}` : 'ANCHOR: SHIELD';
      gs.fx.ring(x, y, RED, 10, 80, 0.4, 'fx_ring_thick');
      return { e: ae, member };
    });
    gs.objectives.setBossHint('BREAK THE SIPHON ANCHORS');
  }

  private anchorBroken(en: Enemy, member: MemberId | null): void {
    const gs = this.gs;
    gs.fx.death(en.x, en.y - 40, RED, true);
    gs.fx.ring(en.x, en.y - 40, 0xffffff, 10, 140, 0.4, 'fx_ring_thick');
    gs.audio('siphonBreak', { volume: 0.8 });
    gs.fx.shake(0.01, 250);
    if (member) {
      gs.band.freeze(member, false);
      const at = App.audio.restoreStem(member);
      gs.hud()?.setSuppressed(member, false);
      gs.stemPulseAt(member, at);
      const m = gs.band.get(member);
      if (m) gs.fx.floatText(m.x, m.y - 70, `${BAND[member].name} IS BACK`, BAND[member].colorCss, 22, 1.6);
    }
    if (this.anchors.every((a) => !a.e.active || a.e === en)) gs.objectives.setBossHint('DESTROY THE NULL MAESTRO');
  }

  private enterPhase3(): void {
    const gs = this.gs;
    this.phase = 3;
    this.transitioning = 1.5;
    this.boss.damageTaken = 1.1;
    gs.hud()?.say(FINAL_BOSS.name, BOSS_LINES.phase3, '#ff5a5a');
    gs.hud()?.phaseBanner('PHASE 3 — FULL RESONANCE');
    if (gs.run.breakdownUnlocked) gs.run.addBreakdown(1);
    gs.objectives.setBossHint('UNLEASH THE BREAKDOWN');
    gs.fx.ring(this.boss.x, this.boss.y - 130, 0xff2a2a, 10, 300, 0.6, 'fx_ring_thick');
    gs.audio('roar', { volume: 0.9, rate: 1.1 });
  }

  onBeat(e: Enemy): void {
    if (this.dying || this.t < 1.5 || this.transitioning > 0 || this.stunT > 0) return;
    const gs = this.gs;
    const L = gs.band.leader;
    this.beats++;
    const b = this.beats;
    const inBar = b % 4;
    const bar = Math.floor(b / 4);
    const ox = this.baton.x;
    const oy = this.baton.y;
    const toL = Math.atan2(L.y - oy, L.x - ox);
    const dmg = (base: number) => base * gs.enemies.dmgScale();

    if (this.phase === 1 || (this.phase === 2 && this.anchors.every((a) => !a.e.active))) {
      const mode = bar % 3;
      if (mode === 0) {
        // downbeat fans with one beat of warning
        if (inBar === 0 || inBar === 2) {
          e.d.aim = toL;
          gs.tele.add({ kind: 'cone', x: ox, y: oy, r: 260, angle: toL, width: 0.62, dur: 0.46, color: RED, owner: e });
        } else {
          for (let i = 0; i < 9; i++) gs.shots.fireEnemy('p_note', ox, oy, e.d.aim + (i - 4) * 0.15, 155, dmg(7), { life: 4 });
          gs.audio('enemyShot', { volume: 0.4, rate: 0.7 });
        }
      } else if (mode === 1) {
        // conductor spiral
        const base = b * 0.55;
        for (let arm = 0; arm < 3; arm++) {
          for (let k = 0; k < 3; k++) gs.shots.fireEnemy('p_orb', e.x, e.y - 130, base + arm * ((Math.PI * 2) / 3) + k * 0.12, 125 + k * 20, dmg(7), { life: 4.5 });
        }
        gs.audio('enemyShot', { volume: 0.3, rate: 1.2 });
      } else if (inBar === 0) {
        // summon the orchestra from the organs
        const o = this.organs[bar % this.organs.length];
        gs.director.waveAround(o.x, o.y + 30, ['maraca', 'tick', 'tick', 'castanet'], this.phase === 1 ? 5 : 4, 60);
        gs.fx.ring(o.x, o.y - 50, RED, 10, 90, 0.4);
        gs.audio('rattle', { volume: 0.4 });
      }
      return;
    }
    if (this.phase === 2) {
      // rests: silence zones that detonate two beats later (every other beat)
      if (b % 2 === 1) {
        this.phase2Sweep(e, b, ox, oy, toL);
        return;
      }
      const tx = L.x + L.vx * 0.25 + (Math.random() - 0.5) * 60;
      const ty = L.y + L.vy * 0.25 + (Math.random() - 0.5) * 60;
      gs.tele.add({ kind: 'circle', x: tx, y: ty, r: 66, dur: 0.9375, color: RED });
      gs.combat.after(0.9375, () => {
        gs.fx.ring(tx, ty, RED, 10, 72, 0.25, 'fx_ring_thick');
        gs.audio('kick', { volume: 0.4, rate: 0.7 });
        const P = gs.band.leader;
        if (Math.hypot(P.x - tx, P.y - ty) < 74) gs.hurtPlayer(dmg(12), tx, ty, 'maestro:rest');
      });
      this.phase2Sweep(e, b, ox, oy, toL);
      return;
    }
    // phase 3: frantic, alternating fans and gapped rings
    if (inBar % 2 === 0) {
      for (let i = 0; i < 7; i++) gs.shots.fireEnemy('p_note', ox, oy, toL + (i - 3) * 0.17, 170, dmg(7), { life: 4 });
    } else {
      const n = 20;
      const gap = toL + Math.PI + (Math.random() - 0.5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        let da = a - gap;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) < 0.5) continue;
        gs.shots.fireEnemy('p_orb', e.x, e.y - 130, a, 140, dmg(7), { life: 4 });
      }
    }
    if (inBar === 0 && bar % 4 === 0) gs.director.waveAround(e.x, e.y + 200, ['maraca', 'tick', 'mantis'], 5, 200);
    gs.audio('enemyShot', { volume: 0.35 });
  }

  private phase2Sweep(e: Enemy, b: number, ox: number, oy: number, toL: number): void {
    const gs = this.gs;
    if (b % 16 === 0) {
      const side = Math.random() < 0.5 ? -1 : 1;
      e.d.sweepA = toL;
      e.d.sweepSide = side;
      gs.tele.add({ kind: 'cone', x: ox, y: oy, r: 560, angle: toL, width: 1.2, dur: 0.9375, color: RED, owner: e });
    }
    if (b % 16 === 2 && e.d.sweepA !== undefined) {
      this.sweep = { a0: e.d.sweepA - 1.2 * e.d.sweepSide, a1: e.d.sweepA + 1.2 * e.d.sweepSide, t: 0, dur: 0.46875 * 4 };
      gs.audio('roar', { volume: 0.4, rate: 1.6 });
    }
  }

  onDeath(e: Enemy): void {
    // keep the visuals around for the death sequence
    this.dying = true;
    const gs = this.gs;
    for (const id of this.suppressed) {
      if (App.audio.suppressedStems.has(id)) {
        App.audio.restoreStem(id);
        gs.band.freeze(id, false);
        gs.hud()?.setSuppressed(id, false);
      }
    }
    for (const a of this.anchors) if (a.e.active) gs.enemies.remove(a.e);
    const x = e.x;
    const y = e.y;
    gs.hud()?.say(FINAL_BOSS.name, BOSS_LINES.defeat, '#ff5a5a');
    gs.slowMo(0.3, 1.4);
    gs.shots.clearAllEnemyShots();
    for (let i = 0; i < 4; i++) {
      gs.combat.after(0.15 + i * 0.47, () => {
        const px = x + (Math.random() - 0.5) * 140;
        const py = y - 60 - Math.random() * 160;
        gs.fx.ring(px, py, i % 2 ? 0xffffff : RED, 20, 200 + i * 60, 0.6, 'fx_ring_thick');
        gs.fx.death(px, py, RED, true);
        gs.audio('boom', { volume: 0.8 });
        gs.fx.shake(0.014, 300);
      });
    }
    gs.combat.after(2.1, () => {
      gs.fx.flash(0xffffff, 0.9, 700);
      gs.audio('crash', { volume: 0.8 });
      for (const o of [this.halo, this.head, this.baton, this.core]) o.destroy();
      this.cables.destroy();
      this.onDefeated();
    });
    gs.tweens.add({ targets: [this.halo, this.head, this.baton], alpha: 0, scale: INV_RES * 1.6, duration: 2000 });
  }
}
