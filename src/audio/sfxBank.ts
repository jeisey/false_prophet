/**
 * Procedurally synthesized sound effects. Rendered once into Float32Arrays at
 * load time (a few dozen ms), then played as cheap AudioBufferSourceNodes.
 * Pitched material is kept inside E minor so SFX sit inside the soundtrack.
 */

export type SfxName =
  | 'zap'
  | 'chord'
  | 'bassPulse'
  | 'kick'
  | 'snare'
  | 'scream'
  | 'hit'
  | 'kill'
  | 'killBig'
  | 'hurt'
  | 'pickup'
  | 'heal'
  | 'levelUp'
  | 'rattle'
  | 'enemyShot'
  | 'telegraph'
  | 'boom'
  | 'crash'
  | 'siphonBreak'
  | 'rescue'
  | 'roar'
  | 'solo'
  | 'breakdown'
  | 'uiClick'
  | 'uiConfirm'
  | 'gameOver'
  | 'victory'
  | 'thunder'
  | 'portal'
  | 'transmission'
  | 'tick'
  | 'brass'
  | 'graze'
  | 'shield'
  | 'gate';

type Buf = Float32Array;

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    // xorshift32
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return (this.s / 0xffffffff) * 2 - 1;
  }
}

const TAU = Math.PI * 2;
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function buildSfxBank(sr: number): Record<SfxName, Buf> {
  const len = (s: number) => Math.max(1, Math.floor(s * sr));
  const mk = (s: number) => new Float32Array(len(s));

  function fadeOut(b: Buf, s = 0.01): Buf {
    const n = Math.min(b.length, len(s));
    for (let i = 0; i < n; i++) b[b.length - 1 - i] *= i / n;
    return b;
  }
  function norm(b: Buf, peak: number): Buf {
    let m = 0;
    for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(b[i]));
    if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m;
    return b;
  }
  function lp(b: Buf, cutoff: number): Buf {
    const a = 1 - Math.exp((-TAU * cutoff) / sr);
    let y = 0;
    for (let i = 0; i < b.length; i++) {
      y += a * (b[i] - y);
      b[i] = y;
    }
    return b;
  }
  function hp(b: Buf, cutoff: number): Buf {
    const a = 1 - Math.exp((-TAU * cutoff) / sr);
    let y = 0;
    for (let i = 0; i < b.length; i++) {
      y += a * (b[i] - y);
      b[i] = b[i] - y;
    }
    return b;
  }
  function noiseBurst(s: number, decay: number, seed: number): Buf {
    const b = mk(s);
    const r = new Rng(seed);
    for (let i = 0; i < b.length; i++) b[i] = r.next() * Math.exp((-i / sr) * decay);
    return b;
  }
  function sweep(s: number, f0: number, f1: number, decay: number, shape: 'sin' | 'saw' | 'sq' = 'sin'): Buf {
    const b = mk(s);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const f = f0 * Math.pow(f1 / f0, t / s);
      ph += f / sr;
      ph -= Math.floor(ph);
      const v = shape === 'sin' ? Math.sin(TAU * ph) : shape === 'saw' ? 2 * ph - 1 : ph < 0.5 ? 1 : -1;
      b[i] = v * Math.exp(-t * decay);
    }
    return b;
  }
  function powerChord(root: number, s: number, decay: number, drive = 5): Buf {
    const b = mk(s);
    const fs = [hz(root), hz(root + 7), hz(root + 12)];
    const ph = [0, 0.3, 0.6];
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      let v = 0;
      for (let k = 0; k < 3; k++) {
        ph[k] += fs[k] / sr;
        ph[k] -= Math.floor(ph[k]);
        v += 2 * ph[k] - 1;
      }
      const env = Math.exp(-t * decay);
      b[i] = Math.tanh(v * drive * env) * env;
    }
    return lp(b, 2400);
  }
  function mix(...parts: Array<[Buf, number, number?]>): Buf {
    let n = 0;
    for (const [b, , off = 0] of parts) n = Math.max(n, b.length + len(off));
    const out = new Float32Array(n);
    for (const [b, g, off = 0] of parts) {
      const o = len(off);
      for (let i = 0; i < b.length; i++) out[i + o] += b[i] * g;
    }
    return out;
  }
  function tone(m: number, s: number, decay: number, shape: 'sin' | 'tri' | 'sq' = 'sin', vib = 0): Buf {
    const b = mk(s);
    const f = hz(m);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      ph += (f * (1 + vib * Math.sin(TAU * 6 * t))) / sr;
      ph -= Math.floor(ph);
      const v = shape === 'sin' ? Math.sin(TAU * ph) : shape === 'tri' ? 1 - 4 * Math.abs(ph - 0.5) : ph < 0.5 ? 1 : -1;
      b[i] = v * Math.exp(-t * decay) * Math.min(1, t / 0.004);
    }
    return b;
  }

  const bank = {} as Record<SfxName, Buf>;

  // --- Player instrument hits (quiet, short; the music is the star) ---
  {
    const b = mk(0.12);
    const r = new Rng(3);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const f = 1800 - 1200 * (t / 0.12);
      ph += f / sr;
      ph -= Math.floor(ph);
      b[i] = (Math.sign(Math.sin(TAU * ph)) * 0.6 + r.next() * 0.5) * Math.exp(-t * 30);
    }
    bank.zap = norm(fadeOut(hp(b, 600)), 0.5);
  }
  bank.chord = norm(fadeOut(powerChord(40, 0.28, 12, 8), 0.03), 0.6);
  bank.bassPulse = norm(fadeOut(mix([sweep(0.35, 140, 38, 7), 1], [lp(noiseBurst(0.05, 60, 5), 800), 0.3])), 0.8);
  bank.kick = norm(fadeOut(mix([sweep(0.25, 170, 45, 12), 1], [noiseBurst(0.01, 300, 9), 0.4])), 0.8);
  bank.snare = norm(fadeOut(mix([hp(noiseBurst(0.2, 18, 11), 900), 0.9], [tone(55, 0.12, 30), 0.6])), 0.65);
  {
    // vocal "scream" whoosh: formant-ish filtered noise with pitch glide
    const b = mk(0.35);
    const r = new Rng(21);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const f = hz(76) * (1 + 0.15 * Math.sin(t * 30));
      ph += f / sr;
      ph -= Math.floor(ph);
      b[i] = ((2 * ph - 1) * 0.5 + r.next() * 0.6) * Math.min(1, t / 0.02) * Math.exp(-t * 7);
    }
    bank.scream = norm(fadeOut(lp(hp(b, 700), 3200), 0.04), 0.5);
  }

  // --- Impacts ---
  bank.hit = norm(fadeOut(mix([lp(noiseBurst(0.06, 70, 31), 2500), 1], [sweep(0.06, 300, 120, 50), 0.6])), 0.45);
  bank.kill = norm(
    fadeOut(mix([lp(noiseBurst(0.16, 30, 41), 3000), 0.9], [sweep(0.12, 520, 90, 25, 'sq'), 0.35])),
    0.55,
  );
  bank.killBig = norm(
    fadeOut(mix([lp(noiseBurst(0.6, 7, 43), 1800), 1], [sweep(0.5, 160, 35, 6), 0.9], [tone(52, 0.4, 8, 'sq'), 0.2])),
    0.85,
  );
  bank.hurt = norm(fadeOut(mix([sweep(0.22, 420, 110, 12, 'saw'), 0.7], [lp(noiseBurst(0.12, 30, 51), 1400), 0.6])), 0.7);
  bank.graze = norm(fadeOut(hp(noiseBurst(0.12, 25, 57), 2500), 0.03), 0.3);
  bank.shield = norm(fadeOut(mix([tone(71, 0.25, 12, 'tri'), 0.6], [hp(noiseBurst(0.1, 40, 59), 3000), 0.3])), 0.5);

  // --- Pickups & progression (E minor pentatonic) ---
  bank.pickup = norm(fadeOut(mix([tone(88, 0.12, 30, 'sin'), 0.7], [tone(95, 0.1, 40, 'sin'), 0.3, 0.02])), 0.35);
  bank.heal = norm(mix([tone(76, 0.3, 8, 'tri'), 0.6], [tone(79, 0.3, 8, 'tri'), 0.5, 0.07], [tone(83, 0.35, 7, 'tri'), 0.5, 0.14]), 0.5);
  bank.levelUp = norm(
    mix(
      [tone(64, 0.5, 5, 'sq', 0.004), 0.3],
      [tone(71, 0.5, 5, 'sq', 0.004), 0.3, 0.08],
      [tone(76, 0.6, 4, 'sq', 0.004), 0.3, 0.16],
      [tone(83, 0.8, 3, 'tri', 0.006), 0.4, 0.24],
    ),
    0.6,
  );

  // --- Enemies ---
  {
    const parts: Array<[Buf, number, number?]> = [];
    for (let k = 0; k < 5; k++) parts.push([hp(noiseBurst(0.04, 90, 60 + k), 3500), 0.8 - k * 0.1, k * 0.045]);
    bank.rattle = norm(mix(...parts), 0.4);
  }
  bank.enemyShot = norm(fadeOut(mix([sweep(0.1, 900, 400, 25, 'sq'), 0.4], [hp(noiseBurst(0.05, 60, 71), 2000), 0.4])), 0.3);
  bank.telegraph = norm(mix([tone(75, 0.18, 10, 'sq'), 0.3], [tone(75, 0.18, 10, 'sq'), 0.3, 0.2]), 0.3);
  bank.tick = norm(fadeOut(mix([hp(noiseBurst(0.03, 150, 77), 3000), 0.7], [tone(96, 0.03, 120, 'sin'), 0.5])), 0.4);
  {
    const b = mk(0.7);
    let ph = 0;
    const r = new Rng(81);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const f = hz(40) * (1 + 0.02 * Math.sin(TAU * 9 * t));
      ph += f / sr;
      ph -= Math.floor(ph);
      const env = Math.min(1, t / 0.05) * Math.exp(-t * 2.5);
      b[i] = Math.tanh(((2 * ph - 1) * 2 + r.next() * 0.3) * 2) * env;
    }
    bank.brass = norm(fadeOut(lp(b, 1500), 0.08), 0.6);
  }
  bank.roar = norm(
    fadeOut(
      mix([lp(noiseBurst(1.1, 2.5, 91), 900), 0.9], [sweep(1.1, 90, 50, 2, 'saw'), 0.6], [sweep(1.0, 180, 95, 3, 'sq'), 0.2]),
      0.2,
    ),
    0.8,
  );

  // --- Big moments ---
  bank.boom = norm(fadeOut(mix([sweep(0.7, 120, 30, 5), 1], [lp(noiseBurst(0.7, 6, 101), 1200), 0.8]), 0.1), 0.9);
  bank.crash = norm(fadeOut(hp(noiseBurst(1.4, 2.8, 103), 2500), 0.2), 0.55);
  bank.thunder = norm(fadeOut(lp(mix([noiseBurst(1.6, 2, 105), 1], [noiseBurst(0.3, 10, 107), 0.8, 0.05]), 700), 0.3), 0.8);
  bank.siphonBreak = norm(
    fadeOut(mix([hp(noiseBurst(0.5, 8, 111), 1500), 0.7], [sweep(0.6, 1400, 60, 5, 'saw'), 0.5], [sweep(0.4, 100, 40, 8), 0.8])),
    0.85,
  );
  bank.rescue = norm(
    mix(
      [powerChord(40, 1.6, 1.4, 5), 0.8],
      [powerChord(47, 1.3, 1.8, 5), 0.6, 0.23],
      [powerChord(52, 1.2, 1.6, 5), 0.6, 0.47],
      [hp(noiseBurst(1.2, 2.6, 113), 3000), 0.3],
    ),
    0.85,
  );
  bank.solo = norm(
    mix([powerChord(52, 0.8, 3, 7), 0.6], [sweep(0.6, 400, 1600, 3, 'saw'), 0.25], [hp(noiseBurst(0.5, 6, 115), 2500), 0.25]),
    0.7,
  );
  bank.breakdown = norm(
    mix(
      [sweep(1.2, 110, 30, 2.2), 1],
      [powerChord(28, 1.8, 1.4, 8), 0.8],
      [hp(noiseBurst(1.6, 2.2, 117), 2800), 0.4],
      [lp(noiseBurst(0.4, 8, 119), 600), 0.6],
    ),
    0.95,
  );
  bank.portal = norm(
    mix([tone(64, 1.5, 1.5, 'tri', 0.01), 0.4], [tone(71, 1.5, 1.5, 'tri', 0.01), 0.3, 0.1], [tone(88, 1.3, 2, 'sin', 0.02), 0.3, 0.2]),
    0.6,
  );
  {
    const b = mk(0.9);
    const r = new Rng(121);
    for (let i = 0; i < b.length; i++) {
      const t = i / sr;
      const step = Math.floor(t * 22);
      const f = [1320, 990, 1760, 660, 1175][step % 5];
      const gate = Math.sin(TAU * f * t) > 0 ? 1 : -1;
      b[i] = (gate * 0.4 + r.next() * 0.15) * (step % 3 === 2 ? 0.2 : 1) * Math.exp(-t * 1.5);
    }
    bank.transmission = norm(fadeOut(lp(b, 4000), 0.05), 0.35);
  }
  bank.gameOver = norm(
    fadeOut(
      mix([sweep(3, 165, 40, 0.9, 'saw'), 0.5], [sweep(3, 196, 46, 0.9, 'saw'), 0.4], [lp(noiseBurst(3, 0.8, 131), 500), 0.5]),
      0.4,
    ),
    0.75,
  );
  bank.victory = norm(
    mix(
      [powerChord(40, 2.2, 0.9, 6), 0.7],
      [powerChord(45, 2.0, 1.0, 6), 0.5, 0.35],
      [powerChord(47, 2.4, 0.8, 6), 0.6, 0.7],
      [hp(noiseBurst(2, 1.6, 133), 3000), 0.3, 0.7],
    ),
    0.85,
  );
  bank.gate = norm(fadeOut(mix([hp(noiseBurst(0.08, 50, 141), 4000), 0.6], [tone(83, 0.08, 40, 'sq'), 0.25])), 0.35);

  // --- UI ---
  bank.uiClick = norm(fadeOut(mix([tone(83, 0.05, 60, 'sq'), 0.4], [hp(noiseBurst(0.02, 200, 151), 3000), 0.3])), 0.35);
  bank.uiConfirm = norm(mix([powerChord(52, 0.35, 8, 6), 0.7], [tone(88, 0.2, 14, 'tri'), 0.3, 0.03]), 0.55);

  return bank;
}
