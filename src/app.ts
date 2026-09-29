/**
 * Shared application context: persistence, audio, the Phaser game, overlay UI
 * and the current run. Scenes and menus reach shared services through here.
 */
import type Phaser from 'phaser';
import { AudioEngine } from './audio/AudioEngine';
import type { MemberId } from './data/band';
import type { RunState } from './state/RunState';
import { Store } from './state/Settings';
import type { Overlay } from './ui/Overlay';

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

export const App = {
  store: new Store(),
  audio: new AudioEngine(),
  game: null as unknown as Phaser.Game,
  ui: null as unknown as Overlay,
  run: null as RunState | null,
  selected: 'lead' as MemberId,
  /** ?debug enables the test hooks on window.__FP__. */
  debug: params.has('debug'),
  /** ?speed=N multiplies game time (testing only). */
  speed: Math.max(0.25, Math.min(20, Number(params.get('speed') ?? 1) || 1)),
  /** ?autopilot lets a simple bot play (testing only). */
  autopilot: params.has('autopilot'),

  haptic(pattern: number | number[]): void {
    if (!this.store.settings.haptics) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    } catch {
      /* unsupported */
    }
  },
};

export function applyAudioSettings(): void {
  const s = App.store.settings;
  App.audio.setMusicVolume(s.musicVolume);
  App.audio.setSfxVolume(s.sfxVolume);
  App.audio.setMuted(s.muted);
}
