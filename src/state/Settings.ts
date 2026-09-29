/**
 * Lightweight persistence (localStorage): preferences + progression only.
 * Interrupted runs are intentionally NOT saved — a run is one focused session.
 */
import { AUDIO_MIX } from '../config/audioConfig';
import type { MemberId } from '../data/band';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reducedShake: boolean;
  reducedFlash: boolean;
  haptics: boolean;
  damageNumbers: boolean;
  /** Play the crash intro before every run (otherwise only until it has been seen). */
  introAlways: boolean;
}

export interface Progress {
  /** Most time remaining on a victorious run (seconds), or null. */
  bestTimeRemaining: number | null;
  victoriesByMember: Record<MemberId, number>;
  runsStarted: number;
  introWatched: boolean;
  lastStarter: MemberId | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const SETTINGS_KEY = 'fp-breakdown.settings.v1';
const PROGRESS_KEY = 'fp-breakdown.progress.v1';

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: AUDIO_MIX.defaultMusicVolume,
  sfxVolume: AUDIO_MIX.defaultSfxVolume,
  muted: false,
  reducedShake: false,
  reducedFlash: false,
  haptics: true,
  damageNumbers: true,
  introAlways: false,
};

export const DEFAULT_PROGRESS: Progress = {
  bestTimeRemaining: null,
  victoriesByMember: { lead: 0, rhythm: 0, bass: 0, drums: 0, vocals: 0 },
  runsStarted: 0,
  introWatched: false,
  lastStarter: null,
};

function safeStorage(): StorageLike | null {
  try {
    const s = (globalThis as any).localStorage as StorageLike | undefined;
    if (!s) return null;
    const probe = '__fp_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export class Store {
  settings: Settings;
  progress: Progress;
  private listeners = new Set<(s: Settings) => void>();

  constructor(private storage: StorageLike | null = safeStorage()) {
    this.settings = { ...DEFAULT_SETTINGS, ...this.read<Partial<Settings>>(SETTINGS_KEY) };
    const p = this.read<Partial<Progress>>(PROGRESS_KEY);
    this.progress = {
      ...DEFAULT_PROGRESS,
      ...p,
      victoriesByMember: { ...DEFAULT_PROGRESS.victoriesByMember, ...(p?.victoriesByMember ?? {}) },
    };
    this.sanitize();
  }

  private read<T>(key: string): T | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / private mode: ignore */
    }
  }

  private sanitize(): void {
    const s = this.settings;
    s.musicVolume = clamp01(Number(s.musicVolume));
    s.sfxVolume = clamp01(Number(s.sfxVolume));
    s.muted = !!s.muted;
    s.reducedShake = !!s.reducedShake;
    s.reducedFlash = !!s.reducedFlash;
    s.haptics = s.haptics !== false;
    s.damageNumbers = s.damageNumbers !== false;
    s.introAlways = !!s.introAlways;
  }

  updateSettings(patch: Partial<Settings>): void {
    Object.assign(this.settings, patch);
    this.sanitize();
    this.write(SETTINGS_KEY, this.settings);
    for (const l of this.listeners) l(this.settings);
  }

  onSettings(fn: (s: Settings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  saveProgress(): void {
    this.write(PROGRESS_KEY, this.progress);
  }

  markIntroWatched(): void {
    this.progress.introWatched = true;
    this.saveProgress();
  }

  recordRunStart(starter: MemberId): void {
    this.progress.runsStarted++;
    this.progress.lastStarter = starter;
    this.saveProgress();
  }

  /** Returns true if this is a new best. */
  recordVictory(starter: MemberId, timeRemaining: number): boolean {
    this.progress.victoriesByMember[starter] = (this.progress.victoriesByMember[starter] ?? 0) + 1;
    const best = this.progress.bestTimeRemaining;
    const isBest = best === null || timeRemaining > best;
    if (isBest) this.progress.bestTimeRemaining = timeRemaining;
    this.saveProgress();
    return isBest;
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
}
