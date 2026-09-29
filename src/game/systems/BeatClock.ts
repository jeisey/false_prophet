/**
 * Reads the master audio transport every frame and emits musical ticks.
 * If the audio clock stalls (context suspended by the OS, audio disabled), it
 * keeps extrapolating from real time so beat-driven gameplay never freezes.
 */
import { App } from '../../app';
import { BEAT_DURATION } from '../../config/audioConfig';

export interface BeatListener {
  onSixteenth?(index: number): void;
  onBeat?(beat: number): void;
  onBar?(bar: number): void;
}

export class BeatClock {
  /** Continuous beat position (fractional). */
  beat = 0;
  private lastAudio = -1;
  private stall = 0;
  private last16 = -1;
  private lastBeat = -1;
  private lastBar = -1;
  private listeners: BeatListener[] = [];

  add(l: BeatListener): void {
    this.listeners.push(l);
  }

  reset(): void {
    this.beat = this.readAudioBeat();
    this.stall = 0;
    this.last16 = Math.floor(this.readAudioBeat() * 4) - 1;
    this.lastBeat = Math.floor(this.readAudioBeat()) - 1;
    this.lastBar = Math.floor(this.readAudioBeat() / 4) - 1;
    this.lastAudio = -1;
  }

  private readAudioBeat(): number {
    return Math.max(0, App.audio.getCurrentBeat());
  }

  /** Fraction through the current beat (0 on the beat). */
  get beatFrac(): number {
    return this.beat - Math.floor(this.beat);
  }

  /** 1 on the downbeat decaying to 0 — handy for pulses. */
  pulse(sharpness = 6): number {
    return Math.exp(-this.beatFrac * sharpness);
  }

  barPulse(sharpness = 3): number {
    const f = (this.beat / 4) % 1;
    return Math.exp(-f * sharpness);
  }

  update(realDt: number): void {
    const a = App.audio.getCurrentBeat();
    if (a > this.lastAudio + 1e-6) {
      this.lastAudio = a;
      this.stall = 0;
      this.beat = Math.max(this.beat, a);
      if (a < this.beat - 2) this.beat = a; // transport restarted
    } else {
      this.stall += realDt;
      if (this.stall > 0.2) this.beat += realDt / BEAT_DURATION;
    }
    const s16 = Math.floor(this.beat * 4 + 1e-6);
    if (s16 > this.last16) {
      // only fire the most recent tick if several passed in one frame (lag)
      this.last16 = s16;
      for (const l of this.listeners) l.onSixteenth?.(s16);
    }
    const b = Math.floor(this.beat + 1e-6);
    if (b > this.lastBeat) {
      this.lastBeat = b;
      for (const l of this.listeners) l.onBeat?.(b);
    }
    const bar = Math.floor(this.beat / 4 + 1e-6);
    if (bar > this.lastBar) {
      this.lastBar = bar;
      for (const l of this.listeners) l.onBar?.(bar);
    }
  }
}
