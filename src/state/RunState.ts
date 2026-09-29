/**
 * RunState — pure (Phaser-free) state for one 18-minute run.
 *
 * Owns the countdown, the band roster, health, XP/levels, SOLO + BREAKDOWN
 * meters, upgrades and run statistics. Scenes drive it; tests exercise it
 * directly.
 */
import { BREAKDOWN, PLAYER, RUN_SECONDS, SOLO, XP_THRESHOLDS } from '../config/gameConfig';
import { MEMBER_ORDER, type MemberId } from '../data/band';
import { computeModifiers, UPGRADES, UPGRADE_IDS, type Modifiers, type UpgradeId, type UpgradeRanks } from '../data/upgrades';

export type RunPhase = 'intro' | 'playing' | 'victory' | 'defeat';
export type DefeatReason = 'time' | 'health' | null;

export interface RunStats {
  kills: number;
  elitesKilled: number;
  damageByMember: Record<MemberId, number>;
  upgradesChosen: UpgradeId[];
  rescueOrder: MemberId[];
  rescueTimes: number[];
  breakdowns: number;
  damageTaken: number;
}

export class RunState {
  readonly starter: MemberId;
  phase: RunPhase = 'intro';
  defeatReason: DefeatReason = null;

  /** Seconds left on the 18:00 clock. */
  timeRemaining = RUN_SECONDS;
  /** Seconds of run time elapsed (excludes intro and pauses). */
  elapsed = 0;
  /** Pause reasons currently holding the clock (menu, hidden, levelup, rescue...). */
  private pauseReasons = new Set<string>();

  /** Recruited members in join order; index 0 is the starter. */
  readonly band: MemberId[] = [];

  maxHp = PLAYER.baseHp;
  hp = PLAYER.baseHp;

  xp = 0;
  level = 1;
  /** Level-ups earned but not yet chosen. */
  pendingLevelUps = 0;

  /** SOLO cooldown remaining (seconds). 0 = ready. */
  soloCooldown = 3;
  /** BREAKDOWN meter 0..1 (only fills once the full band is assembled). */
  breakdownMeter = 0;

  readonly upgrades: UpgradeRanks = {};
  mods: Modifiers = computeModifiers({});

  bossDefeated = false;
  extracted = false;
  surgeTriggered = false;

  readonly stats: RunStats;

  constructor(starter: MemberId) {
    if (!MEMBER_ORDER.includes(starter)) throw new Error(`Unknown band member: ${starter}`);
    this.starter = starter;
    this.band.push(starter);
    this.stats = {
      kills: 0,
      elitesKilled: 0,
      damageByMember: { lead: 0, rhythm: 0, bass: 0, drums: 0, vocals: 0 },
      upgradesChosen: [],
      rescueOrder: [],
      rescueTimes: [],
      breakdowns: 0,
      damageTaken: 0,
    };
  }

  // ------------------------------------------------------------------ clock

  /** Begin the countdown (called when the intro ends). */
  start(): void {
    if (this.phase === 'intro') this.phase = 'playing';
  }

  get isOver(): boolean {
    return this.phase === 'victory' || this.phase === 'defeat';
  }

  get isPaused(): boolean {
    return this.pauseReasons.size > 0;
  }

  get isRunning(): boolean {
    return this.phase === 'playing' && !this.isPaused;
  }

  pause(reason = 'menu'): void {
    this.pauseReasons.add(reason);
  }

  resume(reason = 'menu'): void {
    this.pauseReasons.delete(reason);
  }

  pausedBy(reason: string): boolean {
    return this.pauseReasons.has(reason);
  }

  /**
   * Advance the run clock by `dt` seconds of game time. Returns true on the
   * frame the run ends by timeout.
   */
  tick(dt: number): boolean {
    if (!this.isRunning || dt <= 0) return false;
    this.elapsed += dt;
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    this.soloCooldown = Math.max(0, this.soloCooldown - dt);
    if (this.timeRemaining <= 0) {
      this.lose('time');
      return true;
    }
    return false;
  }

  /** mm:ss display, rounding up so 17:59.4 reads 18:00 -> 17:59 naturally. */
  get clockText(): string {
    return formatClock(this.timeRemaining);
  }

  lose(reason: Exclude<DefeatReason, null>): void {
    if (this.isOver) return;
    this.phase = 'defeat';
    this.defeatReason = reason;
  }

  // ------------------------------------------------------------------ band

  isRecruited(id: MemberId): boolean {
    return this.band.includes(id);
  }

  get missing(): MemberId[] {
    return MEMBER_ORDER.filter((m) => !this.band.includes(m));
  }

  get companions(): MemberId[] {
    return this.band.slice(1);
  }

  get isFullBand(): boolean {
    return MEMBER_ORDER.every((m) => this.band.includes(m));
  }

  /** Add a rescued member. Returns false if they were already in the band. */
  rescue(id: MemberId): boolean {
    if (this.isRecruited(id) || this.isOver) return false;
    this.band.push(id);
    this.stats.rescueOrder.push(id);
    this.stats.rescueTimes.push(this.timeRemaining);
    if (this.isFullBand) {
      this.breakdownMeter = Math.max(this.breakdownMeter, BREAKDOWN.startingMeter);
    }
    return true;
  }

  // ------------------------------------------------------------------ health

  /** Apply damage after upgrades. Returns the damage actually dealt. */
  damage(raw: number): number {
    if (this.isOver || raw <= 0) return 0;
    let dmg = raw * this.mods.damageTakenMul;
    dmg = Math.min(dmg, this.maxHp * this.mods.hitCapFrac);
    this.hp = Math.max(0, this.hp - dmg);
    this.stats.damageTaken += dmg;
    if (this.hp <= 0) this.lose('health');
    return dmg;
  }

  heal(amount: number): number {
    if (this.isOver) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  // ------------------------------------------------------------------ xp

  get xpForNextLevel(): number {
    return XP_THRESHOLDS[Math.min(this.level - 1, XP_THRESHOLDS.length - 1)] + Math.max(0, this.level - XP_THRESHOLDS.length) * 550;
  }

  get xpForThisLevel(): number {
    if (this.level <= 1) return 0;
    const i = this.level - 2;
    return XP_THRESHOLDS[Math.min(i, XP_THRESHOLDS.length - 1)] + Math.max(0, i - (XP_THRESHOLDS.length - 1)) * 550;
  }

  /** 0..1 progress through the current level. */
  get xpProgress(): number {
    const lo = this.xpForThisLevel;
    const hi = this.xpForNextLevel;
    return Math.max(0, Math.min(1, (this.xp - lo) / Math.max(1, hi - lo)));
  }

  /** Add XP; returns the number of level-ups earned. */
  addXp(amount: number): number {
    if (this.isOver) return 0;
    this.xp += amount * this.mods.xpMul;
    let ups = 0;
    while (this.xp >= this.xpForNextLevel) {
      this.level++;
      ups++;
    }
    this.pendingLevelUps += ups;
    return ups;
  }

  // ------------------------------------------------------------------ upgrades

  rankOf(id: UpgradeId): number {
    return this.upgrades[id] ?? 0;
  }

  /** Upgrades that can still be offered. */
  availableUpgrades(): UpgradeId[] {
    return UPGRADE_IDS.filter((id) => {
      const def = UPGRADES[id];
      if (this.rankOf(id) >= def.maxRank) return false;
      if (def.requiresCompanion && this.band.length < 2) return false;
      return true;
    });
  }

  /** Pick up to `count` distinct upgrade choices using `rand` (0..1). */
  rollUpgradeChoices(count = 3, rand: () => number = Math.random): UpgradeId[] {
    const pool = this.availableUpgrades();
    const weighted = pool.map((id) => ({ id, w: (this.rankOf(id) > 0 ? 1.35 : 1) * (rand() + 0.05) }));
    weighted.sort((a, b) => b.w - a.w);
    return weighted.slice(0, count).map((x) => x.id);
  }

  /** Apply an upgrade choice. Returns false if it cannot be taken. */
  chooseUpgrade(id: UpgradeId): boolean {
    const def = UPGRADES[id];
    if (!def || this.rankOf(id) >= def.maxRank) return false;
    this.upgrades[id] = this.rankOf(id) + 1;
    this.stats.upgradesChosen.push(id);
    const prevBonus = this.mods.maxHpBonus;
    this.mods = computeModifiers(this.upgrades);
    const hpGain = this.mods.maxHpBonus - prevBonus;
    if (hpGain > 0) {
      this.maxHp += hpGain;
      this.hp = Math.min(this.maxHp, this.hp + hpGain + this.maxHp * 0.3);
    }
    if (this.pendingLevelUps > 0) this.pendingLevelUps--;
    return true;
  }

  // ------------------------------------------------------------------ solo / breakdown

  get soloReady(): boolean {
    return this.soloCooldown <= 0;
  }

  get soloCooldownMax(): number {
    return SOLO.cooldown * this.mods.soloCooldownMul;
  }

  useSolo(): boolean {
    if (!this.soloReady || !this.isRunning) return false;
    this.soloCooldown = this.soloCooldownMax;
    return true;
  }

  refundSolo(seconds: number): void {
    this.soloCooldown = Math.max(0, this.soloCooldown - seconds);
  }

  /** BREAKDOWN is locked until all five members are together. */
  get breakdownUnlocked(): boolean {
    return this.isFullBand;
  }

  get canBreakdown(): boolean {
    return this.breakdownUnlocked && this.breakdownMeter >= 1 && this.isRunning;
  }

  addBreakdown(amount: number): void {
    if (!this.breakdownUnlocked || amount <= 0) return;
    this.breakdownMeter = Math.min(1, this.breakdownMeter + amount);
  }

  useBreakdown(): boolean {
    if (!this.canBreakdown) return false;
    this.breakdownMeter = 0;
    this.stats.breakdowns++;
    return true;
  }

  // ------------------------------------------------------------------ ending

  defeatBoss(): void {
    this.bossDefeated = true;
  }

  /** Reaching the escape portal after the boss falls wins the run. */
  extract(): boolean {
    if (!this.bossDefeated || this.isOver) return false;
    this.extracted = true;
    this.phase = 'victory';
    return true;
  }

  recordDamage(member: MemberId, amount: number): void {
    this.stats.damageByMember[member] += amount;
  }

  recordKill(elite: boolean): void {
    this.stats.kills++;
    if (elite) this.stats.elitesKilled++;
  }
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-6));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}
