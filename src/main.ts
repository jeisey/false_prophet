import '@fontsource/metal-mania';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/permanent-marker';
import './styles/main.css';
import Phaser from 'phaser';
import { App, applyAudioSettings } from './app';
import { layout } from './game/Layout';
import { BootScene } from './game/scenes/BootScene';
import { BackdropScene } from './game/scenes/BackdropScene';
import { IntroScene } from './game/scenes/IntroScene';
import { GameScene } from './game/scenes/GameScene';
import { HudScene } from './game/scenes/HudScene';
import { Overlay } from './ui/Overlay';
import { installDebugHooks } from './debug';

layout.measure();
layout.apply();

const s = layout.state;
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#000000',
  width: Math.round(s.W * s.rs),
  height: Math.round(s.H * s.rs),
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
  render: { antialias: true, powerPreference: 'high-performance', roundPixels: false },
  input: { activePointers: 4, keyboard: true, mouse: true, touch: true },
  fps: { target: 60, smoothStep: true },
  audio: { noAudio: true },
  disableContextMenu: true,
  banner: false,
  scene: [BootScene, BackdropScene, IntroScene, GameScene, HudScene],
});
App.game = game;
App.ui = new Overlay(document.getElementById('ui')!);
applyAudioSettings();
App.store.onSettings(applyAudioSettings);

// ---- responsive frame
const onResize = () => layout.refresh();
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
layout.on((st) => {
  game.scale.setGameSize(Math.round(st.W * st.rs), Math.round(st.H * st.rs));
  game.events.emit('layout', st);
});

// ---- page visibility: pause the run + suspend audio
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.events.emit('page-hidden');
    App.audio.pause();
  } else {
    game.events.emit('page-visible');
    // Menus resume immediately; an active run stays paused until RESUME.
    if (!App.run || App.run.isOver || !App.run.pausedBy('menu')) App.audio.resume();
  }
});

// ---- block browser gestures that fight the game (pinch zoom, pull-to-refresh, double-tap zoom)
const scrollable = (t: EventTarget | null) =>
  t instanceof Element && !!t.closest('.lineup, .panel, .howto, input[type=range]');
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1 || !scrollable(e.target)) e.preventDefault();
  },
  { passive: false },
);
let lastTouchEnd = 0;
document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300 && !(e.target instanceof HTMLButtonElement)) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);
document.addEventListener('contextmenu', (e) => e.preventDefault());

if (App.debug) installDebugHooks();
