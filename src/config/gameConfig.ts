/**
 * Balance + pacing constants. Everything tunable about a run lives here.
 */

/** Fixed run length: 18:00. The intro does not consume this. */
export const RUN_SECONDS = 18 * 60;

/** Logical design resolution (portrait). Height stretches on tall phones. */
export const LOGICAL_WIDTH = 540;
export const LOGICAL_MIN_HEIGHT = 960;
/** Shortest logical height used on portrait screens (browser chrome eats height). */
export const LOGICAL_PORTRAIT_MIN_HEIGHT = 800;
export const LOGICAL_MAX_HEIGHT = 1200;
/** Max render scale (caps device-pixel-ratio cost on high-DPI phones). */
export const MAX_RENDER_SCALE = 2;
/** Textures are painted at this multiple of their logical size. */
export const ART_RES = 2;

export const PLAYER = {
  baseHp: 150,
  speed: 142,
  /** Velocity smoothing (higher = snappier). */
  accel: 16,
  invulnAfterHit: 0.65,
  magnetRadius: 120,
  collectRadius: 22,
  radius: 14,
};

export const COMPANION = {
  followSpeedMul: 1.3,
  slotRadius: 58,
  engageRadius: 200,
  leashRadius: 170,
  teleportDistance: 620,
  /** Companion attack damage relative to the leader's kit. */
  damageMul: 0.72,
  /** Companion signature fires every N bars. */
  specialEveryBars: 12,
};

export const SOLO = {
  cooldown: 13,
  /** Charge gained per kill (seconds shaved off the cooldown). */
  killRefund: 0.05,
};

export const BREAKDOWN = {
  perKill: 0.009,
  perEliteHit: 0.004,
  perGraze: 0.02,
  perSecondInCombat: 0.006,
  ampCharge: 0.25,
  /** Meter granted instantly when the full band assembles. */
  startingMeter: 0.5,
  /** Length of the heightened "breakdown" state (bars). */
  durationBars: 2,
  damage: 260,
};

/** Cumulative XP required to reach level index+2 (level 1 -> 2 needs [0]). */
export const XP_THRESHOLDS = [
  18, 50, 100, 170, 270, 400, 570, 790, 1080, 1460, 1960, 2600, 3400, 4400, 5600, 7000, 8600, 10400, 12400, 14600,
];

/** Fraction of max HP restored on each level-up / on each rescue. */
export const LEVEL_UP_HEAL = 0.15;
export const RESCUE_HEAL = 0.5;
/** Passive regen (HP/s): the band keeps each other going. Base + per companion. */
export const REGEN = { base: 0.3, perCompanion: 0.25 };

export const PICKUPS = {
  healAmount: 0.22,
  healDropChance: 0.012,
  ampDropChance: 0.008,
  gearDropChance: 0.006,
  gearDuration: 14,
  eliteHealChance: 0.35,
};

export const PACING = {
  /** Remaining seconds at which the island intensity rises. */
  surgeAtRemaining: 9.5 * 60,
  /** Distance at which a rescue site wakes up. */
  siteEngageRadius: 430,
  /** "Defend until release": seconds the band must hold the capsule, by rescue index. */
  releaseSeconds: [18, 24, 30, 36],
  /** How close the band must stay for the release to progress. */
  releaseRadius: 190,
  /** Arena radius for the final encounter. */
  arenaRadius: 430,
  portalOffset: 560,
};

export const ENEMY_SCALING = {
  /** HP multiplier gained per elapsed minute. Mild on purpose: density scales harder. */
  hpPerMinute: 0.05,
  surgeHpBonus: 0.15,
  /** Damage multiplier gained per elapsed minute. */
  damagePerMinute: 0.025,
};

export const SPAWN = {
  /** Enemies per second at start / at 18 min. */
  rateStart: 1.2,
  rateEnd: 4.2,
  surgeRateBonus: 0.9,
  /** Extra spawn rate per recruited companion (the band gets louder -> the island answers). */
  ratePerCompanion: 0.25,
  capStart: 55,
  capEnd: 135,
  /** Distance outside the view where regular enemies appear. */
  ringPadding: 70,
  despawnDistance: 1300,
  eliteChanceStart: 0.0,
  eliteChanceEnd: 0.06,
  /** A bar-synced swarm pulse every N bars. */
  swarmEveryBars: 16,
};
