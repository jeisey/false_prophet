/**
 * Resonance shards (XP), stage water, amp charges, spare gear, road cases.
 */
import Phaser from 'phaser';
import { BAND } from '../../data/band';
import { ROAD_CASES } from '../../data/island';
import { BREAKDOWN, PICKUPS, PLAYER } from '../../config/gameConfig';
import { T } from '../art/atlas';
import { INV_RES } from '../sceneUtil';
import { DEPTH } from './Fx';
import type { GameScene } from '../scenes/GameScene';

export type PickupKind = 'xp' | 'water' | 'amp' | 'gear';

interface Pickup {
  active: boolean;
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
  vx: number;
  vy: number;
  magnet: boolean;
  magnetT: number;
  age: number;
  sprite: Phaser.GameObjects.Image;
}

interface RoadCase {
  x: number;
  y: number;
  open: boolean;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
}

const MAX = 320;

export class Pickups {
  list: Pickup[] = [];
  cases: RoadCase[] = [];
  private activeXp = 0;
  caseUpgrades = 0;

  constructor(private gs: GameScene) {}

  createRoadCases(): void {
    for (const [x, y] of ROAD_CASES) {
      const glow = this.gs.add.image(x, y - 10, ...T('fx_glow')).setTint(0xffcf3a).setBlendMode(Phaser.BlendModes.ADD).setScale(1.3 * INV_RES).setAlpha(0.45).setDepth(DEPTH.pickup);
      const sprite = this.gs.add.image(x, y, ...T('pk_case')).setOrigin(0.5, 0.85).setScale(INV_RES).setDepth(y);
      this.cases.push({ x, y, open: false, sprite, glow });
      this.gs.fx.addPulser(glow, 0.35, 0.1);
    }
  }

  dropXp(x: number, y: number, value: number): void {
    // merge into a nearby shard when the field gets crowded
    if (this.activeXp > 220) {
      let best: Pickup | null = null;
      let bd = 90 * 90;
      for (const p of this.list) {
        if (!p.active || p.kind !== 'xp') continue;
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (best) {
        best.value += value;
        this.styleXp(best);
        return;
      }
    }
    this.spawn('xp', x, y, value);
  }

  drop(kind: Exclude<PickupKind, 'xp'>, x: number, y: number): void {
    this.spawn(kind, x, y, 1);
  }

  private spawn(kind: PickupKind, x: number, y: number, value: number): void {
    let p = this.list.find((q) => !q.active);
    if (!p) {
      if (this.list.length >= MAX) {
        // absorb oldest xp into the new one
        p = this.list.find((q) => q.kind === 'xp');
        if (!p) return;
        value += p.value;
        this.activeXp--;
      } else {
        p = { active: false, kind, x, y, value, vx: 0, vy: 0, magnet: false, magnetT: 0, age: 0, sprite: this.gs.add.image(x, y, ...T('pk_shard')) };
        this.list.push(p);
      }
    }
    const a = Math.random() * Math.PI * 2;
    Object.assign(p, { active: true, kind, x, y, value, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, magnet: false, magnetT: 0, age: 0 });
    const frame = kind === 'xp' ? 'pk_shard' : kind === 'water' ? 'pk_water' : kind === 'amp' ? 'pk_amp' : 'pk_gear';
    p.sprite.setTexture(...T(frame)).setVisible(true).setDepth(kind === 'xp' ? DEPTH.pickup : DEPTH.pickup + 1).setAlpha(1).clearTint();
    if (kind === 'xp') {
      this.activeXp++;
      this.styleXp(p);
    } else p.sprite.setScale(INV_RES * 1.2);
  }

  private styleXp(p: Pickup): void {
    const big = p.value >= 5;
    const key = big ? 'pk_shard_big' : 'pk_shard';
    if (p.sprite.frame.name !== key) p.sprite.setTexture(...T(key));
    p.sprite.setScale(INV_RES * Math.min(1.8, 0.9 + Math.log2(1 + p.value) * 0.18));
  }

  /** Pull every shard to the band (after the boss, etc). */
  vacuum(): void {
    for (const p of this.list) if (p.active && p.kind === 'xp') p.magnet = true;
  }

  update(dt: number): void {
    const gs = this.gs;
    const L = gs.band.leader;
    const mr = gs.band.magnetRadius();
    const beat = gs.beat.beat;
    for (const p of this.list) {
      if (!p.active) continue;
      p.age += dt;
      const dx = L.x - p.x;
      const dy = L.y - 14 - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (!p.magnet && d < (p.kind === 'xp' ? mr : PLAYER.collectRadius * 2.2)) p.magnet = true;
      if (p.magnet) {
        // home in directly; speed ramps up from the moment it was grabbed
        p.magnetT += dt;
        const sp = Math.min(1100, 320 + p.magnetT * 900);
        const step = sp * dt;
        if (step >= d || d < PLAYER.collectRadius) {
          this.collect(p);
          continue;
        }
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      } else {
        p.vx *= Math.pow(0.02, dt);
        p.vy *= Math.pow(0.02, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      p.sprite.setPosition(p.x, p.y - 4 - Math.max(0, Math.sin(beat * Math.PI * 2 + p.x * 0.01)) * 2);
      if (d < PLAYER.collectRadius) this.collect(p);
      else if (p.kind !== 'xp' && p.age > 30) {
        p.active = false;
        p.sprite.setVisible(false);
      }
    }

    // road cases: walk into them to crack them open
    for (const c of this.cases) {
      if (c.open) continue;
      const dist = Math.hypot(L.x - c.x, L.y - c.y);
      c.sprite.setDepth(c.y);
      if (dist < 34) this.openCase(c);
    }
  }

  private collect(p: Pickup): void {
    const gs = this.gs;
    const run = gs.run;
    p.active = false;
    p.sprite.setVisible(false);
    switch (p.kind) {
      case 'xp': {
        this.activeXp--;
        const ups = run.addXp(p.value);
        // chime climbs the E minor pentatonic as the level fills
        const scale = [0, 3, 5, 7, 10, 12, 15];
        const semis = scale[Math.floor(run.xpProgress * scale.length) % scale.length];
        gs.audio('pickup', { volume: 0.18, rate: Math.pow(2, semis / 12) });
        if (ups > 0) gs.queueLevelUp();
        break;
      }
      case 'water': {
        const healed = run.heal(run.maxHp * PICKUPS.healAmount);
        gs.audio('heal', { volume: 0.6 });
        gs.fx.floatText(gs.band.leader.x, gs.band.leader.y - 60, `+${Math.round(healed)} STAGE WATER`, '#9fe7ff', 18);
        gs.fx.ring(gs.band.leader.x, gs.band.leader.y - 10, 0x9fe7ff, 10, 50, 0.4);
        break;
      }
      case 'amp': {
        if (run.breakdownUnlocked) {
          run.addBreakdown(BREAKDOWN.ampCharge);
          gs.fx.floatText(gs.band.leader.x, gs.band.leader.y - 60, 'AMP CHARGE', '#ffb02a', 18);
        } else {
          run.refundSolo(run.soloCooldownMax * 0.5);
          gs.fx.floatText(gs.band.leader.x, gs.band.leader.y - 60, 'AMP CHARGE: SOLO', '#ffb02a', 18);
        }
        gs.audio('solo', { volume: 0.3, rate: 1.6 });
        break;
      }
      case 'gear': {
        gs.band.applyGear();
        const L = gs.band.leader;
        gs.fx.floatText(L.x, L.y - 60, BAND[L.id].spareGear + '!', BAND[L.id].colorCss, 20);
        gs.audio('levelUp', { volume: 0.4, rate: 1.3 });
        break;
      }
    }
  }

  private openCase(c: RoadCase): void {
    const gs = this.gs;
    c.open = true;
    c.sprite.setAlpha(0.45).setTint(0x555555);
    c.glow.setVisible(false);
    gs.fx.burst(gs.fx.shard, c.x, c.y - 10, 0xc9ccd6, 12);
    gs.fx.ring(c.x, c.y - 10, 0xffcf3a, 10, 60, 0.35);
    gs.audio('siphonBreak', { volume: 0.35, rate: 1.6 });
    if (this.caseUpgrades < 3 && gs.run.availableUpgrades().length > 0) {
      this.caseUpgrades++;
      gs.fx.floatText(c.x, c.y - 40, 'ROAD CASE!', '#ffcf3a', 22);
      gs.openUpgradeChoice('ROAD CASE');
    } else {
      this.drop('water', c.x - 14, c.y);
      this.drop('amp', c.x + 14, c.y);
      gs.fx.floatText(c.x, c.y - 40, 'SUPPLIES', '#ffcf3a', 20);
    }
  }
}
