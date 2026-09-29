import Phaser from 'phaser';
import { ART, T } from './art/atlas';
import { ART_RES } from '../config/gameConfig';
import { layout } from './Layout';

export const FONT = {
  display: '"Metal Mania", Impact, serif',
  brush: '"Permanent Marker", Impact, sans-serif',
  ui: 'Oswald, "Arial Narrow", sans-serif',
};

/** Screen-space camera: logical (0,0) at top-left, scaled by render scale. */
export function setupScreenCamera(scene: Phaser.Scene): void {
  const s = layout.state;
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);
  cam.setSize(Math.round(s.W * s.rs), Math.round(s.H * s.rs));
  cam.setZoom(s.rs);
  cam.setScroll(0, 0);
}

export function textRes(): number {
  return Math.max(1, Math.ceil(layout.state.rs));
}

export function txt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, { resolution: textRes(), ...style });
  return t;
}

/** Image from the art atlas at its logical size. */
export function img(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  return scene.add.image(x, y, ...T(key)).setScale(1 / ART_RES);
}

export function sprite(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Sprite {
  return scene.add.sprite(x, y, ...T(key)).setScale(1 / ART_RES);
}

/** Swap an image's atlas frame (frames may live on different pages). */
export function setFrame(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, key: string): void {
  if (obj.frame.name === key) return;
  obj.setTexture(ART.pageKey(key), key);
}

export const INV_RES = 1 / ART_RES;

export function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** Particle emitter using an atlas frame (resolves which page holds it). */
export function particles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  frameKey: string,
  config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
): Phaser.GameObjects.Particles.ParticleEmitter {
  return scene.add.particles(x, y, ART.pageKey(frameKey), { frame: frameKey, ...config });
}
