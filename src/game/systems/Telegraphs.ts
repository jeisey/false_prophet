/**
 * Danger telegraphs drawn on the ground. Readable without color: every
 * telegraph has a dashed outline, hatch stripes, and an inner fill that grows
 * toward the edge as the attack charges (fill reaching the rim = impact).
 */
import Phaser from 'phaser';
import { DEPTH } from './Fx';

export type TeleKind = 'circle' | 'cone' | 'line' | 'ring';

export interface Telegraph {
  kind: TeleKind;
  x: number;
  y: number;
  /** circle/ring radius, cone/line length */
  r: number;
  angle: number;
  /** cone half-angle (rad) or line half-width */
  width: number;
  t: number;
  dur: number;
  color: number;
  alive: boolean;
  /** Optional: follow an owner's position. */
  owner?: { x: number; y: number; active: boolean };
  /** ring telegraph inner radius */
  inner?: number;
}

export class Telegraphs {
  list: Telegraph[] = [];
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.telegraph);
  }

  add(t: Partial<Telegraph> & { kind: TeleKind; x: number; y: number; r: number; dur: number }): Telegraph {
    const tel: Telegraph = { angle: 0, width: 0.4, t: 0, color: 0xff3a1a, alive: true, ...t };
    this.list.push(tel);
    return tel;
  }

  clear(): void {
    this.list.length = 0;
    this.g.clear();
  }

  update(dt: number, time: number): void {
    const g = this.g;
    g.clear();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      t.t += dt;
      if (!t.alive || t.t >= t.dur || (t.owner && !t.owner.active)) {
        this.list.splice(i, 1);
        continue;
      }
      const k = Math.min(1, t.t / t.dur);
      const blink = 0.55 + 0.45 * Math.sin(time * 18);
      // very large zones fill more lightly (outline + hatching still read clearly)
      const big = t.r > 280 ? 0.55 : 1;
      const c = t.color;
      switch (t.kind) {
        case 'circle': {
          g.fillStyle(c, 0.12);
          g.fillCircle(t.x, t.y, t.r);
          this.hatchCircle(g, t.x, t.y, t.r, c, 0.22);
          g.fillStyle(c, 0.3);
          g.fillCircle(t.x, t.y, t.r * k);
          this.dashCircle(g, t.x, t.y, t.r, c, 0.9 * blink);
          break;
        }
        case 'ring': {
          const inner = t.inner ?? t.r * 0.6;
          g.lineStyle(t.r - inner, c, 0.14);
          g.strokeCircle(t.x, t.y, (t.r + inner) / 2);
          g.lineStyle(3, c, 0.9 * blink);
          g.strokeCircle(t.x, t.y, t.r);
          g.strokeCircle(t.x, t.y, inner);
          break;
        }
        case 'cone': {
          const a0 = t.angle - t.width;
          const a1 = t.angle + t.width;
          g.fillStyle(c, 0.12 * big);
          g.slice(t.x, t.y, t.r, a0, a1, false);
          g.fillPath();
          g.fillStyle(c, 0.3 * big);
          g.slice(t.x, t.y, t.r * k, a0, a1, false);
          g.fillPath();
          // hatch lines across the cone
          g.lineStyle(2, c, 0.25);
          for (let d = 24; d < t.r; d += 24) {
            g.beginPath();
            g.arc(t.x, t.y, d, a0, a1, false);
            g.strokePath();
          }
          g.lineStyle(3, c, 0.95 * blink);
          g.beginPath();
          g.moveTo(t.x, t.y);
          g.lineTo(t.x + Math.cos(a0) * t.r, t.y + Math.sin(a0) * t.r);
          g.arc(t.x, t.y, t.r, a0, a1, false);
          g.lineTo(t.x, t.y);
          g.strokePath();
          break;
        }
        case 'line': {
          const ca = Math.cos(t.angle);
          const sa = Math.sin(t.angle);
          const hw = t.width;
          const px = -sa * hw;
          const py = ca * hw;
          const ex = t.x + ca * t.r;
          const ey = t.y + sa * t.r;
          g.fillStyle(c, 0.12);
          g.fillPoints(
            [
              new Phaser.Math.Vector2(t.x + px, t.y + py),
              new Phaser.Math.Vector2(ex + px, ey + py),
              new Phaser.Math.Vector2(ex - px, ey - py),
              new Phaser.Math.Vector2(t.x - px, t.y - py),
            ],
            true,
          );
          const fx = t.x + ca * t.r * k;
          const fy = t.y + sa * t.r * k;
          g.fillStyle(c, 0.32);
          g.fillPoints(
            [
              new Phaser.Math.Vector2(t.x + px, t.y + py),
              new Phaser.Math.Vector2(fx + px, fy + py),
              new Phaser.Math.Vector2(fx - px, fy - py),
              new Phaser.Math.Vector2(t.x - px, t.y - py),
            ],
            true,
          );
          // chevrons pointing along the attack
          g.lineStyle(2, c, 0.5 * blink);
          for (let d = 20; d < t.r; d += 30) {
            const cx = t.x + ca * d;
            const cy = t.y + sa * d;
            g.beginPath();
            g.moveTo(cx + px * 0.6 - ca * 8, cy + py * 0.6 - sa * 8);
            g.lineTo(cx, cy);
            g.lineTo(cx - px * 0.6 - ca * 8, cy - py * 0.6 - sa * 8);
            g.strokePath();
          }
          g.lineStyle(2, c, 0.9 * blink);
          g.beginPath();
          g.moveTo(t.x + px, t.y + py);
          g.lineTo(ex + px, ey + py);
          g.lineTo(ex - px, ey - py);
          g.lineTo(t.x - px, t.y - py);
          g.closePath();
          g.strokePath();
          break;
        }
      }
    }
  }

  private dashCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, c: number, a: number): void {
    g.lineStyle(3, c, a);
    const n = Math.max(10, Math.floor(r / 9));
    for (let i = 0; i < n; i += 1) {
      if (i % 2) continue;
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      g.beginPath();
      g.arc(x, y, r, a0, a1, false);
      g.strokePath();
    }
  }

  private hatchCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, c: number, a: number): void {
    g.lineStyle(2, c, a);
    for (let d = -r + 12; d < r; d += 16) {
      // 45-degree stripes clipped to the circle
      const h = Math.sqrt(Math.max(0, r * r - d * d));
      const x1 = x + d * 0.7071 - h * 0.7071;
      const y1 = y - d * 0.7071 - h * 0.7071;
      const x2 = x + d * 0.7071 + h * 0.7071;
      const y2 = y - d * 0.7071 + h * 0.7071;
      g.lineBetween(x1, y1, x2, y2);
    }
  }
}
