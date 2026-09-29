/**
 * Run upgrades, styled as guitar pedals and stage gear.
 * Each one perceptibly changes how the band's attacks behave — see
 * `computeModifiers` and the combat system for how each modifier is used.
 */

export type UpgradeId =
  | 'fuzz'
  | 'delay'
  | 'reverb'
  | 'chorus'
  | 'overdrive'
  | 'compressor'
  | 'octaver'
  | 'noisegate'
  | 'wah'
  | 'tremolo'
  | 'phaser'
  | 'ebow'
  | 'pitch'
  | 'inears'
  | 'roadie'
  | 'power'
  | 'stack';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  kind: 'PEDAL' | 'GEAR';
  /** Pedal enclosure color. */
  color: string;
  /** Knob / LED accent. */
  accent: string;
  maxRank: number;
  blurb: string;
  /** What each rank does (index 0 = rank 1). */
  ranks: string[];
  requiresCompanion?: boolean;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  fuzz: {
    id: 'fuzz', name: 'FUZZ', kind: 'PEDAL', color: '#c2261d', accent: '#ffd23a', maxRank: 3,
    blurb: 'Fatter, heavier hits.',
    ranks: ['+20% damage, bigger shots', '+40% damage, heavier knockback', '+60% damage, huge shots'],
  },
  delay: {
    id: 'delay', name: 'DELAY', kind: 'PEDAL', color: '#1c6fd1', accent: '#9fe7ff', maxRank: 3,
    blurb: 'Attacks echo once.',
    ranks: ['Echo repeats at 35% power', 'Echo at 50% power', 'Echo at 65% power'],
  },
  reverb: {
    id: 'reverb', name: 'REVERB', kind: 'PEDAL', color: '#2b3a67', accent: '#b0c4ff', maxRank: 3,
    blurb: 'Area blasts leave a ringing field.',
    ranks: ['Lingering field 1.2s', 'Wider field, 1.6s', 'Huge field, 2s'],
  },
  chorus: {
    id: 'chorus', name: 'CHORUS', kind: 'PEDAL', color: '#1aa69a', accent: '#e8fff9', maxRank: 3,
    blurb: 'Attacks sometimes double up.',
    ranks: ['18% chance to split', '30% chance to split', '42% chance to split'],
  },
  overdrive: {
    id: 'overdrive', name: 'OVERDRIVE', kind: 'PEDAL', color: '#e0a31a', accent: '#1a1a1a', maxRank: 3,
    blurb: 'Kill streaks push the band into the red.',
    ranks: ['Streaks: +35% attack speed 3s', '+45% attack speed 4s', '+55% attack speed 5s, faster feet'],
  },
  compressor: {
    id: 'compressor', name: 'COMPRESSOR', kind: 'PEDAL', color: '#3d3d44', accent: '#7dff8a', maxRank: 3,
    blurb: 'Squashes burst damage.',
    ranks: ['-10% damage taken, hits capped', '-18% damage taken', '-26% damage taken, tight cap'],
  },
  octaver: {
    id: 'octaver', name: 'OCTAVER', kind: 'PEDAL', color: '#6a2bb8', accent: '#ffb8ff', maxRank: 3,
    blurb: 'Hits spawn a sub-octave thump.',
    ranks: ['14% chance: octave shockwave', '22% chance', '30% chance, bigger thump'],
  },
  noisegate: {
    id: 'noisegate', name: 'NOISE GATE', kind: 'PEDAL', color: '#101010', accent: '#ff3c3c', maxRank: 3,
    blurb: 'Every bar, deletes hostile shots near you.',
    ranks: ['Gate pulse every bar', 'Wider gate', 'Gate every half bar'],
  },
  wah: {
    id: 'wah', name: 'WAH', kind: 'PEDAL', color: '#2f7d32', accent: '#e9ff9a', maxRank: 3,
    blurb: 'Attacks sweep wider and reach further.',
    ranks: ['+15% range & area', '+30% range & area', '+45% range & area'],
  },
  tremolo: {
    id: 'tremolo', name: 'TREMOLO', kind: 'PEDAL', color: '#d64b8a', accent: '#fff0f8', maxRank: 3,
    blurb: 'Every beat, the band throbs with damage.',
    ranks: ['Beat pulse around the band', 'Stronger, wider pulse', 'Brutal pulse'],
  },
  phaser: {
    id: 'phaser', name: 'PHASER', kind: 'PEDAL', color: '#ff7a00', accent: '#fff3c4', maxRank: 3,
    blurb: 'Projectiles phase through enemies.',
    ranks: ['Pierce +1', 'Pierce +2', 'Pierce +3'],
  },
  ebow: {
    id: 'ebow', name: 'E-BOW', kind: 'GEAR', color: '#44474f', accent: '#63f3ff', maxRank: 3,
    blurb: 'Infinite sustain for your SOLO.',
    ranks: ['SOLO recharges 15% faster, lasts longer', '30% faster', '45% faster'],
  },
  pitch: {
    id: 'pitch', name: 'PITCH SHIFTER', kind: 'PEDAL', color: '#8e1a3f', accent: '#ffe066', maxRank: 3,
    blurb: 'Harmonic crits ring out for double damage.',
    ranks: ['10% crit chance', '18% crit chance', '26% crit chance'],
  },
  inears: {
    id: 'inears', name: 'IN-EAR MONITORS', kind: 'GEAR', color: '#23252b', accent: '#2fe6ff', maxRank: 2,
    blurb: 'Hear every shard on the island.',
    ranks: ['+50% pickup radius, +10% resonance', '+100% pickup radius, +20% resonance'],
  },
  roadie: {
    id: 'roadie', name: 'ROADIE HUSTLE', kind: 'GEAR', color: '#5b4632', accent: '#ffcf8a', maxRank: 3,
    blurb: 'Move faster, set up faster.',
    ranks: ['+8% move speed', '+16% move speed', '+24% move speed'],
  },
  power: {
    id: 'power', name: 'POWER CONDITIONER', kind: 'GEAR', color: '#1f2a1f', accent: '#9dff2e', maxRank: 3,
    blurb: 'Clean power: more health.',
    ranks: ['+25 max HP, heal 30%', '+50 max HP, heal 30%', '+75 max HP, heal 30%'],
  },
  stack: {
    id: 'stack', name: 'FULL STACK', kind: 'GEAR', color: '#141414', accent: '#f0e6d2', maxRank: 3,
    blurb: 'Your bandmates hit harder.',
    ranks: ['Companions +25% damage', 'Companions +50% damage', 'Companions +75% damage'],
    requiresCompanion: true,
  },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

export interface Modifiers {
  damageMul: number;
  areaMul: number;
  sizeMul: number;
  knockbackMul: number;
  echo: number;
  reverb: { radius: number; duration: number; dpsFrac: number } | null;
  chorusChance: number;
  overdrive: { duration: number; attackSpeed: number; moveSpeed: number } | null;
  damageTakenMul: number;
  hitCapFrac: number;
  octaverChance: number;
  octaverRadius: number;
  noiseGate: { everyBeats: number; radius: number } | null;
  rangeMul: number;
  tremolo: { radius: number; damage: number } | null;
  pierce: number;
  soloCooldownMul: number;
  soloDurationMul: number;
  critChance: number;
  magnetMul: number;
  xpMul: number;
  moveSpeedMul: number;
  maxHpBonus: number;
  companionDamageMul: number;
}

export type UpgradeRanks = Partial<Record<UpgradeId, number>>;

export function computeModifiers(ranks: UpgradeRanks): Modifiers {
  const r = (id: UpgradeId) => ranks[id] ?? 0;
  const wah = r('wah');
  return {
    damageMul: 1 + 0.2 * r('fuzz'),
    sizeMul: 1 + 0.12 * r('fuzz'),
    areaMul: (1 + 0.15 * wah) * (1 + 0.06 * r('fuzz')),
    knockbackMul: 1 + 0.25 * r('fuzz'),
    echo: r('delay') ? [0, 0.35, 0.5, 0.65][r('delay')] : 0,
    reverb: r('reverb') ? { radius: [0, 44, 56, 70][r('reverb')], duration: [0, 1.2, 1.6, 2][r('reverb')], dpsFrac: 0.6 } : null,
    chorusChance: [0, 0.18, 0.3, 0.42][r('chorus')],
    overdrive: r('overdrive')
      ? {
          duration: [0, 3, 4, 5][r('overdrive')],
          attackSpeed: [0, 0.35, 0.45, 0.55][r('overdrive')],
          moveSpeed: r('overdrive') >= 3 ? 0.15 : 0.06,
        }
      : null,
    damageTakenMul: 1 - 0.08 * r('compressor') - (r('compressor') >= 3 ? 0.02 : 0),
    hitCapFrac: [1, 0.2, 0.16, 0.12][r('compressor')],
    octaverChance: [0, 0.14, 0.22, 0.3][r('octaver')],
    octaverRadius: r('octaver') >= 3 ? 64 : 48,
    noiseGate: r('noisegate')
      ? { everyBeats: r('noisegate') >= 3 ? 2 : 4, radius: [0, 110, 145, 160][r('noisegate')] }
      : null,
    rangeMul: 1 + 0.15 * wah,
    tremolo: r('tremolo')
      ? { radius: [0, 70, 88, 104][r('tremolo')], damage: [0, 7, 12, 18][r('tremolo')] }
      : null,
    pierce: r('phaser'),
    soloCooldownMul: 1 - 0.15 * r('ebow'),
    soloDurationMul: 1 + 0.2 * r('ebow'),
    critChance: [0, 0.1, 0.18, 0.26][r('pitch')],
    magnetMul: 1 + 0.5 * r('inears'),
    xpMul: 1 + 0.1 * r('inears'),
    moveSpeedMul: 1 + 0.08 * r('roadie'),
    maxHpBonus: 25 * r('power'),
    companionDamageMul: 1 + 0.25 * r('stack'),
  };
}
