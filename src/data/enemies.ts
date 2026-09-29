/**
 * The island's fauna: alien organisms that absorb musical concepts into their
 * biology. Stats here are base values at minute 0; see ENEMY_SCALING.
 */

export type EnemyKind = 'tick' | 'maraca' | 'castanet' | 'tambourine' | 'mantis' | 'tuba' | 'metronome';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  contactDamage: number;
  xp: number;
  flying?: boolean;
  /** Knockback resistance 0..1. */
  mass: number;
  /** Visual scale of the sprite relative to its painted size. */
  scale: number;
  /** Preferred distance from the band (0 = melee rush). */
  preferredRange: number;
  /** Seconds between attack attempts. */
  attackCooldown: number;
  /** Seconds of telegraph before an attack lands. */
  telegraph: number;
  projectileDamage: number;
  /** Death burst color. */
  gore: number;
  firstSightLine?: string;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  tick: {
    kind: 'tick', name: 'DRUMLET TICK', hp: 7, speed: 104, radius: 9, contactDamage: 3, xp: 1,
    mass: 0.1, scale: 1, preferredRange: 0, attackCooldown: 0, telegraph: 0, projectileDamage: 0, gore: 0xd9c9a3,
  },
  maraca: {
    kind: 'maraca', name: 'MARACA MAW', hp: 20, speed: 80, radius: 14, contactDamage: 6, xp: 1,
    mass: 0.25, scale: 1, preferredRange: 150, attackCooldown: 3.8, telegraph: 0.6, projectileDamage: 6, gore: 0xff4a2a,
    firstSightLine: 'Of course it’s maracas.',
  },
  castanet: {
    kind: 'castanet', name: 'CASTANET CRAB', hp: 28, speed: 74, radius: 15, contactDamage: 6, xp: 2,
    mass: 0.35, scale: 1, preferredRange: 210, attackCooldown: 3.1, telegraph: 0.5, projectileDamage: 6, gore: 0xc0281f,
  },
  tambourine: {
    kind: 'tambourine', name: 'TAMBOURINE REAPER', hp: 44, speed: 62, radius: 18, contactDamage: 7, xp: 2,
    mass: 0.4, scale: 1, preferredRange: 120, attackCooldown: 4.2, telegraph: 0.7, projectileDamage: 8, gore: 0xe8d9b0,
  },
  mantis: {
    kind: 'mantis', name: 'CYMBAL MANTIS', hp: 38, speed: 112, radius: 17, contactDamage: 8, xp: 3, flying: true,
    mass: 0.3, scale: 1, preferredRange: 190, attackCooldown: 5, telegraph: 1.0, projectileDamage: 12, gore: 0xd4a52a,
    firstSightLine: 'Those are cymbals. On a bug.',
  },
  tuba: {
    kind: 'tuba', name: 'TUBA GULPER', hp: 170, speed: 42, radius: 30, contactDamage: 9, xp: 6,
    mass: 0.85, scale: 1, preferredRange: 150, attackCooldown: 5.5, telegraph: 1.1, projectileDamage: 10, gore: 0xc99a2e,
    firstSightLine: 'Is that thing... inhaling?',
  },
  metronome: {
    kind: 'metronome', name: 'METRONOME SENTINEL', hp: 95, speed: 30, radius: 22, contactDamage: 7, xp: 5,
    mass: 0.9, scale: 1, preferredRange: 240, attackCooldown: 0, telegraph: 0.47, projectileDamage: 7, gore: 0x8a7cff,
  },
};

export type MinibossKind = 'maracon' | 'belcher' | 'percussionist' | 'warden';

export interface MinibossDef {
  kind: MinibossKind;
  name: string;
  title: string;
  hp: number;
  radius: number;
  speed: number;
  contactDamage: number;
  color: number;
}

export const MINIBOSSES: Record<MinibossKind, MinibossDef> = {
  maracon: { kind: 'maracon', name: 'THE GRAND MARACON', title: 'Rattle-King of Rattlewood', hp: 1700, radius: 46, speed: 62, contactDamage: 16, color: 0xff4a2a },
  belcher: { kind: 'belcher', name: 'THE BRASS BELCHER', title: 'Foghorn of the Brassmire', hp: 2200, radius: 52, speed: 40, contactDamage: 18, color: 0xd9a72b },
  percussionist: { kind: 'percussionist', name: 'THE PERCUSSIONIST', title: 'Many Hands, One Groove', hp: 2200, radius: 46, speed: 70, contactDamage: 16, color: 0x2fe6ff },
  warden: { kind: 'warden', name: 'THE TEMPO WARDEN', title: 'Keeper of the Harvest Clock', hp: 2400, radius: 50, speed: 34, contactDamage: 18, color: 0x8a7cff },
};

export const FINAL_BOSS = {
  name: 'THE NULL MAESTRO',
  title: 'Conductor of a Silent Universe',
  hp: 62000,
  radius: 70,
};
