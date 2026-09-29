import type Phaser from 'phaser';
import type { EnemyDef, EnemyKind } from '../../data/enemies';
import type { MemberId } from '../../data/band';
import type { Telegraph } from '../systems/Telegraphs';

export type EntityKind = EnemyKind | 'boss' | 'structure';

export interface Brain {
  update(e: Enemy, dt: number): void;
  onBeat?(e: Enemy, beat: number): void;
  onDeath?(e: Enemy): void;
  onDamaged?(e: Enemy, amount: number): void;
}

export type EnemyState = 'move' | 'windup' | 'attack' | 'recover' | 'dive';

let NEXT_ID = 1;

export class Enemy {
  id = NEXT_ID++;
  active = false;
  kind: EntityKind = 'tick';
  def: EnemyDef | null = null;
  x = 0;
  y = 0;
  /** knockback velocity */
  kx = 0;
  ky = 0;
  radius = 10;
  hp = 1;
  maxHp = 1;
  speed = 60;
  contact = 5;
  xp = 1;
  mass = 0.3;
  elite = false;
  flying = false;
  state: EnemyState = 'move';
  stateT = 0;
  atkCd = 0;
  slowT = 0;
  slowMul = 1;
  markT = 0;
  stunT = 0;
  staggerCd = 0;
  flashT = 0;
  contactCd = 0;
  phase = Math.random() * 10;
  facing = 1;
  frameBase = 'e_tick';
  frameCount = 2;
  scaleBase = 1;
  gore = 0xffffff;
  targetable = true;
  invulnerable = false;
  /** Damage multiplier applied to incoming hits (boss shields). */
  damageTaken = 1;
  brain: Brain | null = null;
  tele: Telegraph | null = null;
  lastHitBy: MemberId | null = null;
  /** free-form per-behavior scratch space */
  d: Record<string, number> = {};
  sprite!: Phaser.GameObjects.Image;
  shadow!: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Image | null = null;
  extra: Phaser.GameObjects.Image | null = null;
  markIcon: Phaser.GameObjects.Image | null = null;
  lastFrame = '';
  /** Structures / bosses may hide the HP bar. */
  showHp = false;
  label = '';

  reset(): void {
    this.kx = this.ky = 0;
    this.state = 'move';
    this.stateT = 0;
    this.atkCd = 1 + Math.random() * 2;
    this.slowT = this.markT = this.stunT = this.staggerCd = this.flashT = this.contactCd = 0;
    this.slowMul = 1;
    this.elite = false;
    this.flying = false;
    this.targetable = true;
    this.invulnerable = false;
    this.damageTaken = 1;
    this.brain = null;
    this.tele = null;
    this.lastHitBy = null;
    this.d = {};
    this.showHp = false;
    this.label = '';
    this.frameCount = 2;
    this.lastFrame = '';
  }
}
