/**
 * Instrument weapon numbers. The leader uses these directly; rescued
 * companions fire a streamlined version (see COMPANION in gameConfig).
 */
export const ATTACKS = {
  lead: { cooldown: 0.36, damage: 12, speed: 880, range: 380, chains: 2, chainRange: 118, aimHalfAngle: 0.9 },
  rhythm: { cooldown: 0.82, damage: 25, range: 128, halfAngle: 0.74, knock: 240 },
  bass: { cooldown: 1.0, damage: 30, range: 330, speed: 430, auraRadius: 115, auraSlow: 0.74 },
  drums: { cooldown: 0.46875, kickDamage: 13, kickRadius: 88, snareDamage: 18, snareRadius: 58, snareRange: 270, discDamage: 15, discBounces: 3, discEvery: 4 },
  vocals: { cooldown: 0.94, damage: 20, range: 310, speed: 540, halfAngle: 0.6 },
};

export const SOLOS = {
  lead: { duration: 2.4, beamLength: 300, beamWidth: 28, tick: 0.08, beamDamage: 15, noteDamage: 11, spin: 5.6, moveMul: 0.35 },
  rhythm: { blastRadius: 200, blastDamage: 60, knock: 540, barrierRadius: 150, barrierDuration: 3.5, barrierDps: 30 },
  bass: { pullRadius: 240, pullStrength: 300, blastRadius: 175, blastDamage: 160, minCharge: 1.35 },
  drums: { hits: 16, radius: 64, damage: 32, reach: 210 },
  vocals: { range: 390, halfAngle: 0.58, damage: 100, stun: 0.8, mark: 6 },
};

/** Companion signatures are these fractions of the leader SOLO. */
export const COMPANION_SPECIAL_POWER = 0.55;
