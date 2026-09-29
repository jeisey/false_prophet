/**
 * FALSE PROPHET on the island: the leader (player) and rescued companions.
 * Companions follow in a loose, unruly formation, lunge toward nearby
 * enemies, never stack on the leader and can never get lost.
 */
import Phaser from 'phaser';
import { BAND, type MemberId } from '../../data/band';
import { ATTACKS } from '../../data/attacks';
import { COMPANION, PICKUPS, PLAYER } from '../../config/gameConfig';
import { T } from '../art/atlas';
import { INV_RES, setFrame } from '../sceneUtil';
import { DEPTH } from '../systems/Fx';
import type { GameScene } from '../scenes/GameScene';

export class Musician {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing = -Math.PI / 2;
  flip = false;
  moving = false;
  cd = 0.5;
  atkT = 0;
  frozen = false;
  joinT = 0;
  momentumT = 0;
  tempo = 0;
  tempoT = 0;
  hitCount = 0;
  kick = false;
  slot = 0;
  lastFrame = '';
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Image;
  chains: Phaser.GameObjects.Image | null = null;
  active = true;
  radius = 14;

  constructor(
    public readonly id: MemberId,
    public isLeader: boolean,
    scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.x = x;
    this.y = y;
    this.shadow = scene.add.image(x, y, ...T('shadow')).setDepth(DEPTH.shadow).setScale(0.8 * INV_RES);
    this.marker = scene.add
      .image(x, y, ...T(isLeader ? 'fx_ring' : 'fx_glow'))
      .setDepth(DEPTH.shadow + 1)
      .setTint(BAND[id].color)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.sprite = scene.add.image(x, y, ...T(`m_${id}_idle0`)).setOrigin(0.5, 84 / 88);
  }

  get color(): number {
    return BAND[this.id].color;
  }
}

export class BandSystem {
  members: Musician[] = [];
  leader!: Musician;
  /** ASH passive: damage resistance window. */
  resistT = 0;
  overdriveHeat = 0;
  overdriveT = 0;
  /** Spare gear buff on the leader. */
  gearT = 0;
  /** SHREDSTORM plants the guitarist. */
  moveMul = 1;
  lockT = 0;
  private shoveX = 0;
  private shoveY = 0;
  private formationT = 0;

  constructor(private gs: GameScene) {}

  create(starter: MemberId, x: number, y: number): void {
    this.leader = new Musician(starter, true, this.gs, x, y);
    this.members = [this.leader];
  }

  get(id: MemberId): Musician | undefined {
    return this.members.find((m) => m.id === id);
  }

  addMember(id: MemberId, x: number, y: number): Musician {
    const m = new Musician(id, false, this.gs, x, y);
    m.slot = this.members.length - 1;
    m.joinT = 0.6;
    m.cd = 0.8;
    this.members.push(m);
    return m;
  }

  shove(x: number, y: number): void {
    this.shoveX += x;
    this.shoveY += y;
  }

  /** Grave's low-end field: enemies near the bassist move slower. */
  lowEndSlowAt(x: number, y: number): number {
    const g = this.get('bass');
    if (!g || g.frozen) return 1;
    const r = ATTACKS.bass.auraRadius * this.gs.run.mods.areaMul;
    return (g.x - x) ** 2 + (g.y - y) ** 2 < r * r ? ATTACKS.bass.auraSlow : 1;
  }

  onKill(src: MemberId | null): void {
    const mods = this.gs.run.mods;
    if (mods.overdrive) {
      this.overdriveHeat += 1;
      if (this.overdriveHeat >= 9 && this.overdriveT <= 0) {
        this.overdriveT = mods.overdrive.duration;
        this.overdriveHeat = 0;
        this.gs.fx.floatText(this.leader.x, this.leader.y - 60, 'OVERDRIVE!', '#ffb02a', 22, 0.9);
        this.gs.audio('solo', { volume: 0.25, rate: 1.5 });
      }
    }
    // RIOT passive: blast-beat tempo stacks from quick consecutive kills
    const riot = this.get('drums');
    if (riot && (src === 'drums' || riot.isLeader)) {
      riot.tempo = Math.min(8, riot.tempo + (src === 'drums' ? 0.6 : 0.2));
      riot.tempoT = 1.2;
    }
  }

  /** Damage multiplier from passives/buffs for a musician. */
  damageMul(m: Musician): number {
    let k = 1;
    if (m.id === 'lead') k *= 1 + 0.3 * Math.min(1, m.momentumT / 2);
    if (m.id === 'drums') k *= 1 + 0.04 * m.tempo;
    if (m.isLeader && this.gearT > 0) k *= 1.25;
    if (!m.isLeader) k *= COMPANION.damageMul * this.gs.run.mods.companionDamageMul;
    if (this.gs.weapons.breakdownT > 0) k *= 1.25;
    return k;
  }

  attackSpeedMul(m: Musician): number {
    let k = 1;
    const od = this.gs.run.mods.overdrive;
    if (od && this.overdriveT > 0) k *= 1 + od.attackSpeed;
    if (m.id === 'drums') k *= 1 + 0.03 * m.tempo;
    if (m.isLeader && this.gearT > 0) k *= 1.35;
    if (this.gs.weapons.breakdownT > 0) k *= 2;
    return k;
  }

  freeze(id: MemberId, frozen: boolean): void {
    const m = this.get(id);
    if (!m || m.isLeader) return;
    m.frozen = frozen;
    if (frozen) {
      if (!m.chains) m.chains = this.gs.add.image(0, 0, ...T('fx_hex')).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2a2a);
      m.chains.setVisible(true);
    } else m.chains?.setVisible(false);
  }

  /** BREAKDOWN: snap companions into a pentagon around the leader. */
  formUp(): void {
    this.formationT = 1.2;
  }

  update(dt: number, ix: number, iy: number): void {
    const gs = this.gs;
    const run = gs.run;
    const L = this.leader;
    const beat = gs.beat.beat;
    this.resistT -= dt;
    this.overdriveT -= dt;
    this.gearT -= dt;
    this.lockT -= dt;
    this.formationT -= dt;
    this.overdriveHeat = Math.max(0, this.overdriveHeat - dt * 2.5);

    // ---- leader movement
    const mag = Math.min(1, Math.hypot(ix, iy));
    const od = run.mods.overdrive && this.overdriveT > 0 ? 1 + run.mods.overdrive.moveSpeed : 1;
    const speed = PLAYER.speed * run.mods.moveSpeedMul * od * this.moveMul * gs.terrain.speedFactor(L.x, L.y);
    const locked = this.lockT > 0;
    const tx = locked ? 0 : ix * speed;
    const ty = locked ? 0 : iy * speed;
    const a = Math.min(1, PLAYER.accel * dt);
    L.vx += (tx - L.vx) * a;
    L.vy += (ty - L.vy) * a;
    const mx = L.vx * dt + this.shoveX * dt;
    const my = L.vy * dt + this.shoveY * dt;
    this.shoveX *= Math.pow(0.001, dt);
    this.shoveY *= Math.pow(0.001, dt);
    const p = gs.terrain.move(L.x, L.y, mx, my, PLAYER.radius);
    L.x = p[0];
    L.y = p[1];
    L.moving = mag > 0.15 && !locked;
    if (L.moving) {
      L.facing = Math.atan2(iy, ix);
      if (Math.abs(ix) > 0.12) L.flip = ix < 0;
      L.momentumT += dt;
    } else L.momentumT = Math.max(0, L.momentumT - dt * 3);

    // ---- companions
    const comps = this.members.filter((m) => !m.isLeader);
    const slots = [2.5, -2.5, 1.7, -1.7];
    for (const m of comps) {
      if (m.frozen) {
        this.renderMember(m, beat, dt);
        continue;
      }
      m.joinT -= dt;
      let tx2: number;
      let ty2: number;
      if (this.formationT > 0) {
        const ang = -Math.PI / 2 + ((m.slot + 1) / 5) * Math.PI * 2;
        tx2 = L.x + Math.cos(ang) * 62;
        ty2 = L.y + Math.sin(ang) * 50;
      } else {
        const sa = L.facing + slots[m.slot % 4];
        tx2 = L.x + Math.cos(sa) * COMPANION.slotRadius * (m.slot >= 2 ? 1.25 : 1);
        ty2 = L.y + Math.sin(sa) * COMPANION.slotRadius * 0.8 * (m.slot >= 2 ? 1.25 : 1);
        // lunge a little toward nearby enemies, then drift back
        const foe = gs.enemies.nearest(m.x, m.y, COMPANION.engageRadius, (e) => !!e.def);
        if (foe) {
          const fd = Math.hypot(foe.x - tx2, foe.y - ty2) || 1;
          const lunge = Math.min(46, fd);
          tx2 += ((foe.x - tx2) / fd) * lunge;
          ty2 += ((foe.y - ty2) / fd) * lunge;
        }
      }
      const dx = tx2 - m.x;
      const dy = ty2 - m.y;
      const d = Math.hypot(dx, dy);
      const distL = Math.hypot(L.x - m.x, L.y - m.y);
      if (distL > COMPANION.teleportDistance) {
        // never lost: re-join with a spectral poof
        const q = gs.terrain.nearestWalkable(L.x - Math.cos(L.facing) * 40, L.y - Math.sin(L.facing) * 40, 200) ?? [L.x, L.y];
        gs.fx.ring(m.x, m.y, m.color, 6, 40, 0.3);
        m.x = q[0];
        m.y = q[1];
        gs.fx.ring(m.x, m.y, m.color, 40, 6, 0.3);
        continue;
      }
      const maxSp = PLAYER.speed * run.mods.moveSpeedMul * COMPANION.followSpeedMul * (distL > COMPANION.leashRadius ? 1.4 : 1);
      const want = d > 6 ? Math.min(maxSp, d * 5) : 0;
      let cvx = d > 0 ? (dx / d) * want : 0;
      let cvy = d > 0 ? (dy / d) * want : 0;
      // separation from other band members
      for (const o of this.members) {
        if (o === m) continue;
        const ox = m.x - o.x;
        const oy = m.y - o.y;
        const od2 = Math.hypot(ox, oy) || 0.01;
        if (od2 < 30) {
          cvx += (ox / od2) * (30 - od2) * 8;
          cvy += (oy / od2) * (30 - od2) * 8;
        }
      }
      const ka = Math.min(1, 10 * dt);
      m.vx += (cvx - m.vx) * ka;
      m.vy += (cvy - m.vy) * ka;
      const q = gs.terrain.move(m.x, m.y, m.vx * dt, m.vy * dt, 10);
      m.x = q[0];
      m.y = q[1];
      m.moving = Math.hypot(m.vx, m.vy) > 20;
      if (m.moving) {
        m.facing = Math.atan2(m.vy, m.vx);
        if (Math.abs(m.vx) > 8) m.flip = m.vx < 0;
      }
    }

    for (const m of this.members) {
      m.atkT -= dt;
      if (m.tempoT > 0) {
        m.tempoT -= dt;
        if (m.tempoT <= 0) m.tempo = 0;
      }
      if (!m.isLeader && !m.moving) m.momentumT = Math.max(0, m.momentumT - dt);
      if (!m.isLeader && m.moving) m.momentumT += dt;
      this.renderMember(m, beat, dt);
    }
  }

  private renderMember(m: Musician, beat: number, _dt: number): void {
    let f: string;
    if (m.atkT > 0) f = 'atk';
    else if (m.moving && !m.frozen) f = `run${Math.floor(beat * 4) % 4}`;
    else f = Math.floor(beat) % 2 ? 'idle1' : 'idle0';
    const key = `m_${m.id}_${f}`;
    if (key !== m.lastFrame) {
      m.lastFrame = key;
      setFrame(m.sprite, key);
    }
    const s = (m.isLeader ? 1.08 : 0.94) * INV_RES;
    const join = m.joinT > 0 ? 1 + m.joinT * 0.8 : 1;
    m.sprite.setScale(s * join * (m.flip ? -1 : 1), s * join).setPosition(m.x, m.y).setDepth(m.y + 0.5);
    m.sprite.setAlpha(m.frozen ? 0.55 : 1);
    if (m.frozen) m.sprite.setTint(0xff6a6a);
    else if (this.gs.invulnFlash() && m.isLeader) m.sprite.setTintFill(0xffffff);
    else m.sprite.clearTint();
    m.shadow.setPosition(m.x, m.y + 1);
    const pulse = Math.exp(-(beat % 1) * 5);
    if (m.isLeader) {
      m.marker.setPosition(m.x, m.y + 1).setScale((22 / 60) * INV_RES * (1 + 0.12 * pulse)).setAlpha(0.55 + 0.35 * pulse);
      m.marker.setScale((24 / 60) * INV_RES * (1 + 0.1 * pulse), (12 / 60) * INV_RES * (1 + 0.1 * pulse));
    } else {
      m.marker.setPosition(m.x, m.y - 4).setScale(0.8 * INV_RES).setAlpha(0.3 + 0.25 * pulse);
    }
    if (m.chains) m.chains.setPosition(m.x, m.y - 30).setScale(0.55 * INV_RES).setRotation(beat).setDepth(m.y + 1);
  }

  /** Magnet radius for pickups. */
  magnetRadius(): number {
    return PLAYER.magnetRadius * this.gs.run.mods.magnetMul;
  }

  /** Spare gear pickup: instrument-specific temporary boost. */
  applyGear(): void {
    this.gearT = PICKUPS.gearDuration;
  }
}
