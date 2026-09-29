import { describe, expect, it } from 'vitest';
import {
  BAR_DURATION,
  BEAT_DURATION,
  BPM,
  LOOP_DURATION,
  STEM_FILES,
  STEM_IDS,
  STEM_SAMPLES_PER_CHANNEL,
} from '../src/config/audioConfig';
import {
  barInLoop,
  barsSince,
  beatInBar,
  beatsSince,
  loopPosition,
  nextBarTime,
  nextBeatTime,
} from '../src/audio/transportMath';
import { AudioEngine } from '../src/audio/AudioEngine';
import { FakeAudioContext, type FakeGain } from './fakeAudio';

describe('musical grid constants', () => {
  it('128 BPM gives beat = .46875s, bar = 1.875s, 16 bars = 30s', () => {
    expect(BPM).toBe(128);
    expect(BEAT_DURATION).toBe(0.46875);
    expect(BAR_DURATION).toBe(1.875);
    expect(LOOP_DURATION).toBe(30);
    expect(STEM_SAMPLES_PER_CHANNEL).toBe(1_440_000);
  });

  it('every stem file path is configured', () => {
    expect(STEM_IDS).toHaveLength(5);
    for (const id of STEM_IDS) {
      expect(STEM_FILES[id].file).toMatch(/^audio\/music\/fp_[a-z_]+_loop\.wav$/);
    }
  });
});

describe('transport math', () => {
  const origin = 10;

  it('computes beats and bars since origin', () => {
    expect(beatsSince(origin, origin + 0.46875)).toBeCloseTo(1);
    expect(barsSince(origin, origin + 1.875 * 3)).toBeCloseTo(3);
    expect(beatInBar(origin, origin + 0.46875 * 5 + 0.01)).toBe(1);
    expect(barInLoop(origin, origin + 30 + 1.875 * 2 + 0.1)).toBe(2);
  });

  it('wraps loop position at exactly 30 seconds', () => {
    expect(loopPosition(origin, origin + 29.5)).toBeCloseTo(29.5);
    expect(loopPosition(origin, origin + 30)).toBeCloseTo(0);
    expect(loopPosition(origin, origin + 61)).toBeCloseTo(1);
  });

  it('finds the next bar boundary strictly in the future', () => {
    expect(nextBarTime(origin, origin + 0.1)).toBeCloseTo(origin + 1.875);
    expect(nextBarTime(origin, origin + 1.875)).toBeCloseTo(origin + 3.75);
    expect(nextBarTime(origin, origin + 5.0)).toBeCloseTo(origin + 5.625);
    // min lead pushes past a boundary that is too close
    expect(nextBarTime(origin, origin + 1.86, 0.05)).toBeCloseTo(origin + 3.75);
    // before the transport starts, the first boundary is the origin itself
    expect(nextBarTime(origin, origin - 1)).toBe(origin);
  });

  it('finds the next beat boundary', () => {
    expect(nextBeatTime(origin, origin + 0.2)).toBeCloseTo(origin + 0.46875);
    expect(nextBeatTime(origin, origin + 0.47)).toBeCloseTo(origin + 0.9375);
  });
});

function makeEngine() {
  const ctx = new FakeAudioContext();
  const engine = new AudioEngine({
    createContext: () => ctx as unknown as AudioContext,
    fetchArrayBuffer: async () => new ArrayBuffer(8),
    wallClock: () => 0,
    baseUrl: '/',
  });
  return { ctx, engine };
}

describe('AudioEngine stem transport', () => {
  it('starts all five sources simultaneously with explicit loop points', async () => {
    const { ctx, engine } = makeEngine();
    engine.initialize();
    await engine.load();
    ctx.currentTime = 5;
    engine.startTransport(['bass']);
    const stems = ctx.sources.filter((s) => s.loop);
    expect(stems).toHaveLength(5);
    const starts = new Set(stems.map((s) => s.startedAt));
    expect(starts.size).toBe(1);
    expect(stems[0].startedAt).toBeCloseTo(5.12);
    for (const s of stems) {
      expect(s.loopStart).toBe(0);
      expect(s.loopEnd).toBe(30);
      expect(s.startOffset).toBe(0);
    }
    expect(engine.origin).toBeCloseTo(5.12);
  });

  it('only the starter stem is audible at the start', async () => {
    const { ctx, engine } = makeEngine();
    engine.initialize();
    await engine.load();
    engine.startTransport(['drums']);
    for (const id of STEM_IDS) {
      expect(engine.isStemAudible(id)).toBe(id === 'drums');
    }
    // stem gain nodes: initial values set at start
    const stemGains = stemGainNodes(ctx);
    const initial = stemGains.map((g) => g.gain.events.find((e) => e.type === 'set')?.value);
    expect(initial.filter((v) => v && v > 0)).toHaveLength(1);
  });

  it('schedules a rescued stem to fade in on the next bar of the shared transport', async () => {
    const { ctx, engine } = makeEngine();
    engine.initialize();
    await engine.load();
    ctx.currentTime = 10;
    engine.startTransport(['lead']);
    const origin = engine.origin; // 10.12
    ctx.currentTime = origin + 1.875 * 3 + 0.4; // mid bar 4
    const at = engine.setStemActive('bass', true);
    expect(at).toBeCloseTo(origin + 1.875 * 4);
    const bassGain = stemGainNodes(ctx)[STEM_IDS.indexOf('bass')];
    const ramp = bassGain.gain.events.filter((e) => e.type === 'linear').pop()!;
    expect(ramp.value).toBeCloseTo(STEM_FILES.bass.gain);
    expect(ramp.time).toBeCloseTo(origin + 1.875 * 5);
    // the gain is held at its current value until the bar line (no click)
    const holds = bassGain.gain.events.filter((e) => e.type === 'set');
    expect(holds[holds.length - 1].time).toBeCloseTo(origin + 1.875 * 4);
    expect(holds[holds.length - 1].value).toBe(0);
    // no source was restarted: still exactly five loop sources
    expect(ctx.sources.filter((s) => s.loop)).toHaveLength(5);
  });

  it('keeps every later rescue aligned to the same origin', async () => {
    const { ctx, engine } = makeEngine();
    engine.initialize();
    await engine.load();
    ctx.currentTime = 0;
    engine.startTransport(['vocals']);
    const origin = engine.origin;
    const times: number[] = [];
    for (const [i, stem] of (['lead', 'rhythm', 'bass', 'drums'] as const).entries()) {
      ctx.currentTime = origin + 20 + i * 37.3;
      times.push(engine.setStemActive(stem, true));
    }
    for (const t of times) {
      const bars = (t - origin) / 1.875;
      expect(Math.abs(bars - Math.round(bars))).toBeLessThan(1e-9);
    }
    for (const id of STEM_IDS) expect(engine.isStemAudible(id)).toBe(true);
  });

  it('suppresses and restores stems for the boss mechanic', async () => {
    const { ctx, engine } = makeEngine();
    engine.initialize();
    await engine.load();
    engine.startTransport(['lead', 'rhythm', 'bass', 'drums', 'vocals']);
    ctx.currentTime = engine.origin + 3.1;
    const t = engine.suppressStem('rhythm');
    expect(engine.isStemAudible('rhythm')).toBe(false);
    expect(((t - engine.origin) / 0.46875) % 1).toBeCloseTo(0);
    ctx.currentTime += 5;
    const t2 = engine.restoreStem('rhythm');
    expect(engine.isStemAudible('rhythm')).toBe(true);
    expect(((t2 - engine.origin) / 1.875) % 1).toBeCloseTo(0);
  });

  it('reports beat/bar position and pauses with the context', async () => {
    const { ctx, engine } = makeEngine();
    engine.initialize();
    await engine.load();
    engine.startTransport(['lead']);
    ctx.currentTime = engine.origin + 1.875 * 2 + 0.46875;
    expect(engine.getCurrentBar()).toBeCloseTo(2.25);
    expect(engine.getCurrentBeat()).toBeCloseTo(9);
    engine.pause();
    expect(ctx.state).toBe('suspended');
    engine.resume();
    expect(ctx.state).toBe('running');
  });

  it('a new run starts its stems only after the previous soundtrack has faded out', async () => {
    const { ctx, engine } = makeEngine();
    engine.initialize();
    await engine.load();
    ctx.currentTime = 2;
    engine.startTransport(['lead']);
    ctx.currentTime = 40;
    engine.fadeOutMusic(2.5);
    const old = ctx.sources.filter((s) => s.loop);
    for (const s of old) expect(s.stoppedAt).toBeCloseTo(42.55);
    ctx.currentTime = 40.2;
    engine.startTransport(['bass']);
    const fresh = ctx.sources.filter((s) => s.loop && !old.includes(s));
    expect(fresh).toHaveLength(5);
    for (const s of fresh) expect(s.startedAt!).toBeGreaterThan(42.5);
    expect(engine.origin).toBeCloseTo(42.52);
    expect(engine.isStemAudible('bass')).toBe(true);
    expect(engine.isStemAudible('lead')).toBe(false);
  });

  it('falls back to a silent virtual clock when audio fails', async () => {
    let wall = 100;
    const engine = new AudioEngine({
      createContext: () => {
        throw new Error('no audio');
      },
      fetchArrayBuffer: async () => new ArrayBuffer(8),
      wallClock: () => wall,
      baseUrl: '/',
    });
    engine.initialize();
    expect(engine.status).toBe('failed');
    engine.startTransport(['lead']);
    wall += 0.12 + 1.875;
    expect(engine.getCurrentBar()).toBeCloseTo(1);
    engine.pause();
    wall += 10;
    expect(engine.getCurrentBar()).toBeCloseTo(1);
    engine.resume();
    wall += 1.875;
    expect(engine.getCurrentBar()).toBeCloseTo(2);
  });
});

function stemGainNodes(ctx: FakeAudioContext): FakeGain[] {
  // The five stem gains are the last five gains created while building the graph.
  const graphGains = ctx.gains.slice(0, 10);
  return graphGains.slice(graphGains.length - 5);
}
