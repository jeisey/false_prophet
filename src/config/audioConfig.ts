/**
 * Central audio configuration for FALSE PROPHET: BREAKDOWN.
 *
 * Every musical constant used by the game lives here. The soundtrack is five
 * sample-aligned stems of ONE composition. All five play continuously from a
 * single transport origin; recruiting a band member only fades their GainNode
 * in on the next bar line.
 *
 * To drop in the real FALSE PROPHET stems, overwrite the WAV files listed in
 * STEM_FILES (see AUDIO_REPLACEMENT.md). If one stem is too hot or too quiet in
 * the full-band mix, tweak its `gain` below.
 */

export type StemId = 'lead' | 'rhythm' | 'bass' | 'drums' | 'vocals';

export const STEM_IDS: readonly StemId[] = ['lead', 'rhythm', 'bass', 'drums', 'vocals'] as const;

/** Musical grid. */
export const BPM = 128;
export const BEATS_PER_BAR = 4;
export const BARS_PER_LOOP = 16;
export const KEY = 'E minor';
export const TIME_SIGNATURE = '4/4';

/** Derived timing (seconds). 60 / 128 = 0.46875 exactly. */
export const BEAT_DURATION = 60 / BPM;
export const BAR_DURATION = BEAT_DURATION * BEATS_PER_BAR; // 1.875
export const LOOP_DURATION = BAR_DURATION * BARS_PER_LOOP; // 30.000

/** Source file format every stem must match. */
export const STEM_SAMPLE_RATE = 48_000;
export const STEM_CHANNELS = 2;
export const STEM_BIT_DEPTH = 16;
export const STEM_SAMPLES_PER_CHANNEL = Math.round(LOOP_DURATION * STEM_SAMPLE_RATE); // 1,440,000

export interface StemConfig {
  id: StemId;
  label: string;
  /** Path relative to the site root (Vite serves /public at /). */
  file: string;
  /** Linear gain applied when the stem is active (0..1+). */
  gain: number;
}

export const STEM_FILES: Record<StemId, StemConfig> = {
  lead: { id: 'lead', label: 'Lead Guitar', file: 'audio/music/fp_lead_guitar_loop.wav', gain: 0.5 },
  rhythm: { id: 'rhythm', label: 'Rhythm Guitar', file: 'audio/music/fp_rhythm_guitar_loop.wav', gain: 0.62 },
  bass: { id: 'bass', label: 'Bass', file: 'audio/music/fp_bass_loop.wav', gain: 0.45 },
  drums: { id: 'drums', label: 'Drums', file: 'audio/music/fp_drums_loop.wav', gain: 0.8 },
  vocals: { id: 'vocals', label: 'Vocals', file: 'audio/music/fp_vocals_loop.wav', gain: 0.55 },
};

export const AUDIO_MIX = {
  /** Length of the fade-in when a rescued member's stem enters (seconds). One bar. */
  stemFadeIn: BAR_DURATION,
  /** Fade used when a stem is suppressed (boss phase 2) or removed. */
  stemFadeOut: BEAT_DURATION * 2,
  /** Lead time added before transport start so all five sources begin together. */
  startLeadTime: 0.12,
  /** Master output level. */
  masterGain: 0.9,
  /** Default user-facing bus volumes (0..1). */
  defaultMusicVolume: 0.8,
  defaultSfxVolume: 0.75,
  /** Music bus boost during a BREAKDOWN (linear multiplier) and its length in bars. */
  breakdownSurgeGain: 1.3,
  breakdownSurgeBars: 2,
  /** Low-pass cutoff used to muffle the music while the pause menu is open. */
  pausedLowpassHz: 650,
  openLowpassHz: 20_000,
  /** Gentle bus compressor so five stems + SFX never clip. */
  compressor: { threshold: -14, knee: 10, ratio: 4, attack: 0.004, release: 0.22 },
  /** Final brick-wall-ish limiter. */
  limiter: { threshold: -1.5, knee: 0, ratio: 20, attack: 0.001, release: 0.08 },
  /** Ramp used for user volume changes to avoid zipper noise. */
  volumeRamp: 0.05,
} as const;
