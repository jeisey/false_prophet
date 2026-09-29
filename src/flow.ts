/**
 * Top-level flow between menus, intro and gameplay.
 */
import { App } from './app';
import type { MemberId } from './data/band';
import { RunState } from './state/RunState';

const RUN_SCENES = ['intro', 'game', 'hud'];

function stopRunScenes(): void {
  const sm = App.game.scene;
  for (const k of RUN_SCENES) {
    if (sm.isActive(k) || sm.isPaused(k) || sm.isSleeping(k)) sm.stop(k);
  }
}

export function goToMenu(): void {
  stopRunScenes();
  App.run = null;
  App.ui.hideAudioChip();
  App.audio.stopTransport();
  App.audio.resume();
  const sm = App.game.scene;
  if (!sm.isActive('backdrop')) sm.start('backdrop');
  // wait a tick so the backdrop scene exists before menus configure it
  setTimeout(() => App.ui.showTitle(), 0);
}

/**
 * Begin a run. Call from inside a user gesture: the AudioContext is created /
 * resumed here so mobile browsers allow sound.
 */
export function startRun(member: MemberId, skipIntro: boolean): void {
  App.audio.initialize();
  void App.audio.load().catch(() => undefined);
  App.audio.stopTransport();
  App.selected = member;
  App.run = new RunState(member);
  App.store.recordRunStart(member);
  App.ui.clear();
  stopRunScenes();
  const sm = App.game.scene;
  if (sm.isActive('backdrop')) sm.stop('backdrop');
  if (skipIntro) sm.start('game');
  else sm.start('intro');
}

/** Intro finished (or skipped): the clock starts once the world is ready. */
export function beginGameplay(): void {
  const sm = App.game.scene;
  if (sm.isActive('intro')) sm.stop('intro');
  App.ui.clear();
  sm.start('game');
}
