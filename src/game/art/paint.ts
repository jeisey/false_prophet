/**
 * Canvas 2D painting helpers shared by all procedural art.
 * Style: heavy ink outlines, limited palette, rim light, halftone shading.
 */

export type Ctx = CanvasRenderingContext2D;

export const PAL = {
  ink: '#07060a',
  night: '#0d0b12',
  bone: '#efe4cc',
  boneShade: '#b9ab8c',
  blood: '#b3121d',
  bloodBright: '#ff2a2a',
  violet: '#b455ff',
  acid: '#9dff2e',
  orange: '#ff6a1f',
  cyan: '#2fe6ff',
  rose: '#ff5ccf',
  brass: '#d9a72b',
  brassDark: '#7a5412',
  chrome: '#c9ccd6',
  leather: '#17151c',
  leather2: '#26222d',
  denim: '#28303f',
  skinPale: '#e9d6c1',
  skinPaleShade: '#b89c86',
  skinTan: '#c99873',
  skinTanShade: '#8e6247',
  skinDeep: '#7a5140',
  skinDeepShade: '#4d3026',
};

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function withGlow(ctx: Ctx, color: string, blur: number, fn: () => void): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

export function poly(ctx: Ctx, pts: number[], close = true): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}

/** Smooth closed shape through points (quadratic midpoints). */
export function blob(ctx: Ctx, pts: number[]): void {
  const n = pts.length / 2;
  ctx.beginPath();
  const mx = (i: number) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
  const my = (i: number) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  ctx.moveTo(mx(0), my(0));
  for (let i = 1; i <= n; i++) {
    ctx.quadraticCurveTo(pts[(i % n) * 2], pts[(i % n) * 2 + 1], mx(i), my(i));
  }
  ctx.closePath();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
}

export function fillStroke(ctx: Ctx, fill: string | CanvasGradient, lw = 2, stroke: string = PAL.ink): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

export function stroke(ctx: Ctx, color: string, lw: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, lw: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  stroke(ctx, color, lw);
}

export function radialGlow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(0.35, withAlpha(color, alpha * 0.45));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function linGrad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

/** Halftone dots inside the current clip, sized by `weight(x,y)` 0..1. */
export function halftone(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  spacing: number,
  weight: (px: number, py: number) => number,
): void {
  ctx.fillStyle = color;
  for (let j = 0, py = y; py < y + h; py += spacing, j++) {
    for (let px = x + (j % 2 ? spacing / 2 : 0); px < x + w; px += spacing) {
      const k = weight(px, py);
      if (k <= 0.02) continue;
      ctx.beginPath();
      ctx.arc(px, py, (spacing / 2) * Math.min(1, k), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function withAlpha(color: string, a: number): string {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function shade(color: string, k: number): string {
  const { r, g, b } = hexToRgb(color);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function numToHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

/** Jagged lightning polyline between two points. */
export function lightning(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, jag: number, seg: number, r: () => number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < seg; i++) {
    const t = i / seg;
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const len = Math.hypot(nx, ny) || 1;
    const off = (r() - 0.5) * 2 * jag;
    ctx.lineTo(x1 + (x2 - x1) * t + (nx / len) * off, y1 + (y2 - y1) * t + (ny / len) * off);
  }
  ctx.lineTo(x2, y2);
}

/** Speckle/scratch texture for distressed surfaces. */
export function distress(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, amount = 60, color = 'rgba(0,0,0,0.35)'): void {
  const r = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < amount; i++) {
    const px = x + r() * w;
    const py = y + r() * h;
    const s = 0.4 + r() * 1.4;
    ctx.fillRect(px, py, s, s * (0.5 + r()));
  }
}
