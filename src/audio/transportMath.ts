/**
 * Pure musical-time math for the master transport.
 *
 * Every musical event in the game (stem entrances, beat pulses, beat-locked
 * enemy attacks, BREAKDOWN) is derived from ONE origin: the AudioContext time
 * at which bar 1 / beat 1 of the loop began. Nothing computes "next bar"
 * independently per stem.
 */
import { BEATS_PER_BAR, BPM, BARS_PER_LOOP } from '../config/audioConfig';

export interface TransportGrid {
  bpm: number;
  beatsPerBar: number;
  barsPerLoop: number;
}

export const DEFAULT_GRID: TransportGrid = { bpm: BPM, beatsPerBar: BEATS_PER_BAR, barsPerLoop: BARS_PER_LOOP };

export function beatDuration(grid: TransportGrid = DEFAULT_GRID): number {
  return 60 / grid.bpm;
}

export function barDuration(grid: TransportGrid = DEFAULT_GRID): number {
  return beatDuration(grid) * grid.beatsPerBar;
}

export function loopDuration(grid: TransportGrid = DEFAULT_GRID): number {
  return barDuration(grid) * grid.barsPerLoop;
}

/** Elapsed beats (fractional) since the transport origin. Negative before start. */
export function beatsSince(origin: number, now: number, grid: TransportGrid = DEFAULT_GRID): number {
  return (now - origin) / beatDuration(grid);
}

/** Elapsed bars (fractional) since the transport origin. */
export function barsSince(origin: number, now: number, grid: TransportGrid = DEFAULT_GRID): number {
  return (now - origin) / barDuration(grid);
}

/** Position within the loop in seconds, always in [0, loopDuration). */
export function loopPosition(origin: number, now: number, grid: TransportGrid = DEFAULT_GRID): number {
  const len = loopDuration(grid);
  const t = (now - origin) % len;
  return t < 0 ? t + len : t;
}

/** 0-based beat index within the current bar. */
export function beatInBar(origin: number, now: number, grid: TransportGrid = DEFAULT_GRID): number {
  const b = Math.floor(beatsSince(origin, now, grid) + 1e-9);
  return ((b % grid.beatsPerBar) + grid.beatsPerBar) % grid.beatsPerBar;
}

/** 0-based bar index within the loop (0..barsPerLoop-1). */
export function barInLoop(origin: number, now: number, grid: TransportGrid = DEFAULT_GRID): number {
  const b = Math.floor(barsSince(origin, now, grid) + 1e-9);
  return ((b % grid.barsPerLoop) + grid.barsPerLoop) % grid.barsPerLoop;
}

/**
 * Absolute time of the next grid line of `unit` seconds strictly after
 * `now + minLead`. `minLead` guarantees the Web Audio scheduler always gets a
 * time in the future (scheduling "now" risks landing in the past and clicking).
 */
export function nextGridTime(origin: number, now: number, unit: number, minLead = 0): number {
  const t = now + minLead;
  if (t < origin) return origin;
  const n = Math.floor((t - origin) / unit + 1e-9) + 1;
  // If t sits exactly on a grid line we still want the *next* line.
  return origin + n * unit;
}

export function nextBeatTime(origin: number, now: number, minLead = 0, grid: TransportGrid = DEFAULT_GRID): number {
  return nextGridTime(origin, now, beatDuration(grid), minLead);
}

export function nextBarTime(origin: number, now: number, minLead = 0, grid: TransportGrid = DEFAULT_GRID): number {
  return nextGridTime(origin, now, barDuration(grid), minLead);
}
