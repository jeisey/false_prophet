/**
 * AudioEngine — the master transport + mixer for FALSE PROPHET: BREAKDOWN.
 *
 * Graph:
 *   stem source (x5, all started at the same instant, looping 0..30s)
 *     -> stem GainNode (0 until that member is in the band)
 *     -> music bus  -> surge gain -> pause low-pass -> fade gain
 *   sfx voices -> sfx bus
 *   music + sfx -> compressor -> limiter -> master gain -> destination
 *
 * All musical timing derives from ONE origin (`origin`): the AudioContext time
 * of bar 1, beat 1. Stem entrances are scheduled against the shared grid so a
 * rescued member always joins the CURRENT position of the song — sources are
 * never restarted.
 *
 * If Web Audio is unavailable or fails, the engine falls back to a virtual
 * clock so beat-driven gameplay still works (silently).
 */
import {
  AUDIO_MIX,
  BAR_DURATION,
  BEAT_DURATION,
  LOOP_DURATION,
  STEM_FILES,
  STEM_IDS,
  type StemId,
} from '../config/audioConfig';
import { barsSince, beatsSince, nextBarTime, nextBeatTime } from './transportMath';
import { buildSfxBank, type SfxName } from './sfxBank';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'running' | 'failed';

export interface EngineDeps {
  createContext: () => AudioContext;
  fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  /** Wall clock in seconds (used by the silent fallback clock). */
  wallClock: () => number;
  baseUrl: string;
  /** Test-only: skip the compressor/limiter/low-pass so output is linear and analyzable. */
  bypassDynamics?: boolean;
}

const defaultDeps = (): EngineDeps => ({
  createContext: () => {
    const Ctor: typeof AudioContext =
      (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio unsupported');
    return new Ctor({ latencyHint: 'interactive' });
  },
  fetchArrayBuffer: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.arrayBuffer();
  },
  wallClock: () => performance.now() / 1000,
  baseUrl: (import.meta as any).env?.BASE_URL ?? '/',
});

export interface SfxOptions {
  volume?: number;
  rate?: number;
  pan?: number;
  /** Absolute AudioContext time; defaults to now. */
  when?: number;
}

/** Minimum spacing between two plays of the same SFX (seconds). */
const SFX_MIN_INTERVAL = 0.035;
const SFX_MAX_VOICES = 28;

export class AudioEngine {
  status: EngineStatus = 'idle';
  lastError: string | null = null;

  ctx: AudioContext | null = null;
  private deps: EngineDeps;

  private buffers = new Map<StemId, AudioBuffer>();
  private sources = new Map<StemId, AudioBufferSourceNode>();
  private stemGains = new Map<StemId, GainNode>();
  private musicBus: GainNode | null = null;
  private surgeGain: GainNode | null = null;
  private pauseFilter: BiquadFilterNode | null = null;
  private fadeGain: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private masterGain: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  private sfx = new Map<SfxName, AudioBuffer>();
  private sfxLastPlayed = new Map<SfxName, number>();
  private activeVoices = 0;

  /** Members whose stems are part of the arrangement. */
  readonly activeStems = new Set<StemId>();
  /** Stems temporarily silenced by the final boss. */
  readonly suppressedStems = new Set<StemId>();

  /** AudioContext time of bar 1 beat 1 (or virtual-clock time in fallback). */
  origin = 0;
  transportRunning = false;

  private musicVolume: number = AUDIO_MIX.defaultMusicVolume;
  private sfxVolume: number = AUDIO_MIX.defaultSfxVolume;
  private muted = false;

  /** AudioContext time at which the previous soundtrack's fade-out completes. */
  private fadeEndsAt = 0;

  // Silent fallback clock (used when Web Audio is not running).
  private virtualOffset = 0;
  private virtualPausedAt: number | null = null;
  private loadPromise: Promise<void> | null = null;

  constructor(deps: Partial<EngineDeps> = {}) {
    this.deps = { ...defaultDeps(), ...deps };
  }

  get usingFallbackClock(): boolean {
    return !this.ctx || this.status === 'failed';
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  /**
   * Create/resume the AudioContext. MUST be called from inside a user gesture
   * handler (PLAY / START RUN / RETRY) to satisfy mobile autoplay rules.
   */
  initialize(): void {
    try {
      if (!this.ctx) {
        this.ctx = this.deps.createContext();
        this.buildGraph();
        try {
          const nav = (globalThis as any).navigator;
          if (nav?.audioSession) nav.audioSession.type = 'playback';
        } catch {
          /* optional API */
        }
      }
      if (this.ctx.state !== 'running') {
        void this.ctx.resume().catch(() => undefined);
      }
      // iOS unlock: play one silent sample inside the gesture.
      const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
      if (this.status === 'failed') this.status = 'idle';
    } catch (err) {
      this.fail(err);
    }
  }

  /** Fetch + decode all five stems (idempotent). */
  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    if (!this.ctx) {
      return Promise.reject(new Error('initialize() must be called first'));
    }
    const ctx = this.ctx;
    this.status = 'loading';
    this.loadPromise = (async () => {
      try {
        const entries = await Promise.all(
          STEM_IDS.map(async (id) => {
            const url = joinUrl(this.deps.baseUrl, STEM_FILES[id].file);
            const data = await this.deps.fetchArrayBuffer(url);
            const buffer = await decode(ctx, data);
            return [id, buffer] as const;
          }),
        );
        for (const [id, buffer] of entries) this.buffers.set(id, buffer);
        if (this.sfx.size === 0) {
          const bank = buildSfxBank(ctx.sampleRate);
          for (const [name, data] of Object.entries(bank)) {
            const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
            b.getChannelData(0).set(data);
            this.sfx.set(name as SfxName, b);
          }
        }
        this.status = 'ready';
      } catch (err) {
        this.loadPromise = null;
        this.fail(err);
        throw err;
      }
    })();
    return this.loadPromise;
  }

  private fail(err: unknown): void {
    this.status = 'failed';
    this.lastError = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn('[audio] disabled:', this.lastError);
  }

  private buildGraph(): void {
    const ctx = this.ctx!;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : AUDIO_MIX.masterGain;

    let comp: AudioNode;
    if (this.deps.bypassDynamics) {
      comp = this.masterGain;
    } else {
      const limiter = ctx.createDynamicsCompressor();
      setComp(limiter, AUDIO_MIX.limiter);
      const c = ctx.createDynamicsCompressor();
      setComp(c, AUDIO_MIX.compressor);
      c.connect(limiter);
      limiter.connect(this.masterGain);
      comp = c;
    }
    this.masterGain.connect(ctx.destination);

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.7;

    this.fadeGain = ctx.createGain();
    this.pauseFilter = ctx.createBiquadFilter();
    this.pauseFilter.type = 'lowpass';
    this.pauseFilter.frequency.value = AUDIO_MIX.openLowpassHz;
    this.surgeGain = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;

    this.musicBus.connect(this.surgeGain);
    if (this.deps.bypassDynamics) this.surgeGain.connect(this.fadeGain);
    else {
      this.surgeGain.connect(this.pauseFilter);
      this.pauseFilter.connect(this.fadeGain);
    }
    this.fadeGain.connect(comp);
    this.fadeGain.connect(this.analyser);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(comp);

    for (const id of STEM_IDS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.musicBus);
      this.stemGains.set(id, g);
    }
  }

  // ------------------------------------------------------------------
  // Transport
  // ------------------------------------------------------------------

  /**
   * Start ALL FIVE stems at the same AudioContext instant. Only the stems in
   * `initialStems` are audible; every other GainNode sits at zero while its
   * source keeps running in perfect sync.
   */
  startTransport(initialStems: Iterable<StemId>): void {
    this.stopSources();
    this.activeStems.clear();
    this.suppressedStems.clear();
    for (const s of initialStems) this.activeStems.add(s);

    if (!this.ctx || this.status !== 'ready' || this.buffers.size !== STEM_IDS.length) {
      // Silent fallback: keep a musical clock alive for beat-driven gameplay.
      this.virtualOffset = 0;
      this.virtualPausedAt = null;
      this.origin = this.virtualNow() + AUDIO_MIX.startLeadTime;
      this.transportRunning = true;
      return;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    // If the previous run's music is still fading out, start after it is gone.
    const startAt = Math.max(now + AUDIO_MIX.startLeadTime, this.fadeEndsAt + 0.02);
    this.origin = startAt;

    // Reset bus automation from a previous run.
    const fg = this.fadeGain!.gain;
    const cur = fg.value;
    fg.cancelScheduledValues(now);
    fg.setValueAtTime(cur, now);
    if (this.fadeEndsAt > now) {
      fg.linearRampToValueAtTime(0, this.fadeEndsAt);
      fg.setValueAtTime(0, startAt - 0.005);
    }
    fg.linearRampToValueAtTime(1, startAt + 0.01);
    this.rampParam(this.surgeGain!.gain, 1, 0.01);
    this.pauseFilter!.frequency.cancelScheduledValues(ctx.currentTime);
    this.pauseFilter!.frequency.setValueAtTime(AUDIO_MIX.openLowpassHz, ctx.currentTime);

    for (const id of STEM_IDS) {
      const src = ctx.createBufferSource();
      src.buffer = this.buffers.get(id)!;
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = LOOP_DURATION;
      src.connect(this.stemGains.get(id)!);
      const g = this.stemGains.get(id)!.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(this.activeStems.has(id) ? STEM_FILES[id].gain : 0, ctx.currentTime);
      src.start(startAt, 0);
      this.sources.set(id, src);
    }
    this.transportRunning = true;
    this.status = 'running';
  }

  private stopSources(): void {
    for (const src of this.sources.values()) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      try {
        src.disconnect();
      } catch {
        /* noop */
      }
    }
    this.sources.clear();
    this.transportRunning = false;
    if (this.status === 'running') this.status = 'ready';
  }

  /** Current musical clock (seconds), compensated for output latency. */
  now(): number {
    if (this.ctx && this.status === 'running') {
      const lat = (this.ctx as any).outputLatency || this.ctx.baseLatency || 0;
      return this.ctx.currentTime - Math.min(lat, 0.12);
    }
    return this.virtualNow();
  }

  /** Raw scheduling clock (no latency compensation). */
  schedulerNow(): number {
    if (this.ctx && this.status === 'running') return this.ctx.currentTime;
    return this.virtualNow();
  }

  private virtualNow(): number {
    const t = this.virtualPausedAt ?? this.deps.wallClock();
    return t - this.virtualOffset;
  }

  getCurrentBeat(): number {
    if (!this.transportRunning) return -1;
    return beatsSince(this.origin, this.now());
  }

  getCurrentBar(): number {
    if (!this.transportRunning) return -1;
    return barsSince(this.origin, this.now());
  }

  getNextBarTime(minLead = 0.03): number {
    return nextBarTime(this.origin, this.schedulerNow(), minLead);
  }

  getNextBeatTime(minLead = 0.02): number {
    return nextBeatTime(this.origin, this.schedulerNow(), minLead);
  }

  /** Seconds (wall/game) until the next bar line, from the listener's POV. */
  secondsToNextBar(): number {
    return this.getNextBarTime() - this.schedulerNow();
  }

  // ------------------------------------------------------------------
  // Stems
  // ------------------------------------------------------------------

  /**
   * Add/remove a member's stem from the arrangement. The change is scheduled
   * on the NEXT BAR LINE of the shared transport and ramps smoothly (one bar
   * by default). Returns the AudioContext time the change begins.
   */
  setStemActive(stem: StemId, active: boolean, fade: number = AUDIO_MIX.stemFadeIn): number {
    if (active) this.activeStems.add(stem);
    else this.activeStems.delete(stem);
    return this.applyStemGain(stem, 'bar', fade);
  }

  /** Boss mechanic: silence a stem quickly (on the next beat). */
  suppressStem(stem: StemId): number {
    this.suppressedStems.add(stem);
    return this.applyStemGain(stem, 'beat', AUDIO_MIX.stemFadeOut);
  }

  /** Restore a suppressed stem on the next bar line. */
  restoreStem(stem: StemId): number {
    this.suppressedStems.delete(stem);
    return this.applyStemGain(stem, 'bar', AUDIO_MIX.stemFadeIn);
  }

  isStemAudible(stem: StemId): boolean {
    return this.activeStems.has(stem) && !this.suppressedStems.has(stem);
  }

  private applyStemGain(stem: StemId, quantize: 'bar' | 'beat', fade: number): number {
    const at = quantize === 'bar' ? this.getNextBarTime() : this.getNextBeatTime();
    const gainNode = this.stemGains.get(stem);
    if (!this.ctx || !gainNode || this.status !== 'running') return at;
    const target = this.isStemAudible(stem) ? STEM_FILES[stem].gain : 0;
    const g = gainNode.gain;
    const now = this.ctx.currentTime;
    // Hold whatever value the param has right now (mid-ramp safe), then ramp
    // from the bar line. Avoids discontinuities -> no clicks.
    const current = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(current, now);
    g.setValueAtTime(current, at);
    g.linearRampToValueAtTime(target, at + Math.max(0.01, fade));
    return at;
  }

  // ------------------------------------------------------------------
  // Bus FX
  // ------------------------------------------------------------------

  /** BREAKDOWN: the whole mix surges on the next beat, then settles. */
  surge(): number {
    const at = this.getNextBeatTime();
    if (!this.ctx || !this.surgeGain || this.status !== 'running') return at;
    const g = this.surgeGain.gain;
    const now = this.ctx.currentTime;
    const cur = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(cur, now);
    g.setValueAtTime(cur, at);
    g.linearRampToValueAtTime(AUDIO_MIX.breakdownSurgeGain, at + 0.06);
    g.setValueAtTime(AUDIO_MIX.breakdownSurgeGain, at + AUDIO_MIX.breakdownSurgeBars * BAR_DURATION);
    g.linearRampToValueAtTime(1, at + (AUDIO_MIX.breakdownSurgeBars + 1) * BAR_DURATION);
    return at;
  }

  /** Muffle the music while a menu is open (gameplay paused, audio alive). */
  setMuffled(muffled: boolean): void {
    if (!this.ctx || !this.pauseFilter) return;
    const f = this.pauseFilter.frequency;
    const now = this.ctx.currentTime;
    f.cancelScheduledValues(now);
    f.setValueAtTime(f.value, now);
    f.exponentialRampToValueAtTime(muffled ? AUDIO_MIX.pausedLowpassHz : AUDIO_MIX.openLowpassHz, now + 0.25);
  }

  /** Fade the music out (defeat) and stop the sources afterwards. */
  fadeOutMusic(seconds = 2.5): void {
    if (!this.ctx || !this.fadeGain || this.status !== 'running') {
      this.transportRunning = false;
      return;
    }
    const g = this.fadeGain.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + seconds);
    const sources = [...this.sources.values()];
    this.fadeEndsAt = now + seconds;
    for (const s of sources) {
      try {
        s.stop(now + seconds + 0.05);
      } catch {
        /* noop */
      }
    }
    this.sources.clear();
    this.transportRunning = false;
    this.status = 'ready';
  }

  /** Stop the soundtrack immediately-but-smoothly (quit to menu). */
  stopTransport(): void {
    this.fadeOutMusic(0.35);
  }

  // ------------------------------------------------------------------
  // Pause / resume (page hidden)
  // ------------------------------------------------------------------

  pause(): void {
    if (this.virtualPausedAt === null) this.virtualPausedAt = this.deps.wallClock();
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend().catch(() => undefined);
    }
  }

  /** Call from a user gesture where possible (mobile). */
  resume(): void {
    if (this.virtualPausedAt !== null) {
      this.virtualOffset += this.deps.wallClock() - this.virtualPausedAt;
      this.virtualPausedAt = null;
    }
    if (this.ctx && this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => undefined);
    }
  }

  // ------------------------------------------------------------------
  // Volumes
  // ------------------------------------------------------------------

  setMusicVolume(v: number): void {
    this.musicVolume = clamp01(v);
    if (this.musicBus) this.rampParam(this.musicBus.gain, this.musicVolume, AUDIO_MIX.volumeRamp);
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = clamp01(v);
    if (this.sfxBus) this.rampParam(this.sfxBus.gain, this.sfxVolume, AUDIO_MIX.volumeRamp);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain) this.rampParam(this.masterGain.gain, m ? 0 : AUDIO_MIX.masterGain, AUDIO_MIX.volumeRamp);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private rampParam(p: AudioParam, target: number, seconds: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const cur = p.value;
    p.cancelScheduledValues(now);
    p.setValueAtTime(cur, now);
    p.linearRampToValueAtTime(target, now + seconds);
  }

  // ------------------------------------------------------------------
  // SFX
  // ------------------------------------------------------------------

  playSfx(name: SfxName, opts: SfxOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.sfxBus || this.muted) return;
    const buf = this.sfx.get(name);
    if (!buf) return;
    const now = ctx.currentTime;
    const last = this.sfxLastPlayed.get(name) ?? -1;
    if (opts.when === undefined && now - last < SFX_MIN_INTERVAL) return;
    if (this.activeVoices >= SFX_MAX_VOICES) return;
    this.sfxLastPlayed.set(name, now);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const g = ctx.createGain();
    g.gain.value = opts.volume ?? 1;
    let tail: AudioNode = g;
    if (opts.pan !== undefined && typeof (ctx as any).createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      tail = p;
    }
    src.connect(g);
    tail.connect(this.sfxBus);
    this.activeVoices++;
    src.onended = () => {
      this.activeVoices--;
      try {
        tail.disconnect();
        g.disconnect();
      } catch {
        /* noop */
      }
    };
    src.start(opts.when ?? now);
  }

  /** Normalized low-frequency energy (0..1) for light visual pulsing only. */
  getBassLevel(): number {
    if (!this.analyser || this.status !== 'running') return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 1; i < 6; i++) sum += data[i];
    return sum / (5 * 255);
  }

  destroy(): void {
    this.stopSources();
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
    }
    this.ctx = null;
    this.buffers.clear();
    this.stemGains.clear();
    this.sfx.clear();
    this.loadPromise = null;
    this.status = 'idle';
  }
}

function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // Safari < 14.1 only supports the callback form.
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);
    if (p && typeof (p as Promise<AudioBuffer>).then === 'function') {
      (p as Promise<AudioBuffer>).then(resolve, reject);
    }
  });
}

function setComp(c: DynamicsCompressorNode, s: { threshold: number; knee: number; ratio: number; attack: number; release: number }): void {
  c.threshold.value = s.threshold;
  c.knee.value = s.knee;
  c.ratio.value = s.ratio;
  c.attack.value = s.attack;
  c.release.value = s.release;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function joinUrl(base: string, path: string): string {
  if (!base.endsWith('/')) base += '/';
  return base + path.replace(/^\//, '');
}

export { BEAT_DURATION, BAR_DURATION };
