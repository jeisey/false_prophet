/**
 * THE TESSITURA — the alien civilization behind the Resonance Snare.
 *
 * Their creed: every living thing is a note, and a note's worth is its
 * RESONANCE. Exceptional musicians radiate harvestable energy. The Tessitura
 * rank all life on a single scale — from NEGLIGIBLE to SOVEREIGN — and quietly
 * collect the loudest voices in the universe to complete "the First Chord".
 *
 * FALSE PROPHET registered as a five-part SOVEREIGN signature. The storm that
 * took their plane down was a Resonance Snare; the island is a living
 * harvesting station whose fauna absorb musical ideas and grow them as organs.
 *
 * Lore is delivered in tiny doses: transmissions, signs, rescue lines, and the
 * boss. Never as a stop-the-action dump.
 */

export const ALIEN_RACE = 'THE TESSITURA';

export interface Transmission {
  from: string;
  text: string;
}

export const TRANSMISSIONS = {
  start: {
    from: 'TESSITURA HARVEST NET',
    text: 'Five-part signature grounded. Rank: SOVEREIGN. Separate. Measure. Siphon.',
  },
  firstRescue: {
    from: 'TESSITURA HARVEST NET',
    text: 'Specimen two has escaped its siphon. Irregular. Increase the choir.',
  },
  surge: {
    from: 'TESSITURA HARVEST NET',
    text: 'They are getting LOUDER. Accelerate extraction. Release the brass.',
  },
  fullBand: {
    from: 'TESSITURA HARVEST NET',
    text: '...the chord is whole. Maestro, conduct them into silence.',
  },
  bossDefeat: {
    from: 'TESSITURA HARVEST NET',
    text: 'Harvest station 7 lost. Re-rank species: “HUMAN” — DANGEROUS.',
  },
} satisfies Record<string, Transmission>;

export const BOSS_LINES = {
  intro: 'Be honored, little prophets. Only the loud are worth keeping.',
  phase2: 'Rests are also music. Let me show you silence.',
  phase3: 'Impossible. Your chord... resolves?',
  defeat: 'An... unresolved... cadence...',
};

export const MINIBOSS_LINES: Record<string, string> = {
  maracon: '*furious rattling*',
  belcher: '*a note so low it has weather*',
  percussionist: '*counts you in with forty hands*',
  warden: 'TICK. TOCK. YOUR TEMPO IS INSUFFICIENT.',
};

export const INTRO_PANELS = [
  { caption: 'FALSE PROPHET. Somewhere over the ocean. One more gig.', sfx: null },
  { caption: 'A storm builds out of nowhere. Faster than weather should.', sfx: 'thunder' },
  { caption: 'It isn’t lightning. It’s a WAVEFORM — and it’s listening.', sfx: 'transmission' },
  { caption: 'The instruments scream back. Every gauge dies at once.', sfx: 'roar' },
  { caption: 'CRASH.', sfx: 'boom' },
  { caption: '', sfx: null },
] as const;

export const TUTORIAL_HINTS = {
  move: 'DRAG ANYWHERE TO MOVE',
  moveDesktop: 'WASD / ARROWS TO MOVE',
  solo: 'SOLO IS READY — TAP IT',
  soloDesktop: 'SOLO READY — PRESS SPACE',
};
