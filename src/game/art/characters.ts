/**
 * FALSE PROPHET band art: in-world sprite frames + portraits.
 * All five share proportions and ink style (same band) but differ in
 * silhouette, palette, hair, outfit and instrument.
 */
import type { MemberId } from '../../data/band';
import { BAND } from '../../data/band';
import type { ArtAtlas } from './atlas';
import {
  PAL,
  blob,
  circle,
  ellipse,
  fillStroke,
  halftone,
  line,
  linGrad,
  numToHex,
  poly,
  radialGlow,
  rng,
  shade,
  stroke,
  withAlpha,
  withGlow,
  type Ctx,
} from './paint';

export const MUSICIAN_FRAME = { w: 72, h: 88, originY: 84 / 88 };
export const MUSICIAN_FRAMES = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'atk'] as const;
export type MusicianFrame = (typeof MUSICIAN_FRAMES)[number];

interface Pose {
  phase: number;
  run: boolean;
  bob: number;
  strum: number;
}

const POSES: Record<MusicianFrame, Pose> = {
  idle0: { phase: 0, run: false, bob: 0, strum: 0 },
  idle1: { phase: 0, run: false, bob: 1, strum: 0.15 },
  run0: { phase: 0, run: true, bob: -1.5, strum: 0 },
  run1: { phase: Math.PI / 2, run: true, bob: 0.5, strum: 0.05 },
  run2: { phase: Math.PI, run: true, bob: -1.5, strum: 0 },
  run3: { phase: (3 * Math.PI) / 2, run: true, bob: 0.5, strum: 0.05 },
  atk: { phase: 0, run: false, bob: -1, strum: 1 },
};

interface Build {
  sw: number;
  hw: number;
  shoulderY: number;
  hipY: number;
  headY: number;
  legW: number;
  skin: string;
  skinShade: string;
  jacket: string;
  pants: string;
  boots: string;
  sleeve: 'full' | 'bare' | 'mesh';
}

const BUILDS: Record<MemberId, Build> = {
  lead: { sw: 18, hw: 13, shoulderY: 34, hipY: 55, headY: 21, legW: 5, skin: PAL.skinPale, skinShade: PAL.skinPaleShade, jacket: '#1b1624', pants: '#2b2833', boots: '#0f0d12', sleeve: 'full' },
  rhythm: { sw: 25, hw: 16, shoulderY: 34, hipY: 55, headY: 21, legW: 6, skin: PAL.skinTan, skinShade: PAL.skinTanShade, jacket: '#1a1411', pants: '#27303f', boots: '#2a1a12', sleeve: 'bare' },
  bass: { sw: 27, hw: 19, shoulderY: 32, hipY: 55, headY: 19, legW: 7, skin: PAL.skinDeep, skinShade: PAL.skinDeepShade, jacket: '#161a12', pants: '#121212', boots: '#0c0c0c', sleeve: 'full' },
  drums: { sw: 17, hw: 13, shoulderY: 40, hipY: 59, headY: 27, legW: 5, skin: PAL.skinPale, skinShade: PAL.skinPaleShade, jacket: '#101418', pants: '#1f2a2e', boots: '#15181b', sleeve: 'bare' },
  vocals: { sw: 17, hw: 14, shoulderY: 33, hipY: 54, headY: 20, legW: 4, skin: '#f0e2d6', skinShade: '#bfa89a', jacket: '#140a15', pants: '#140a15', boots: '#0a070b', sleeve: 'mesh' },
};

const col = (id: MemberId) => numToHex(BAND[id].color);

// ---------------------------------------------------------------- instruments

function drawGuitar(
  ctx: Ctx,
  x: number,
  y: number,
  angle: number,
  kind: 'v' | 'explorer' | 'bass',
  glowCol: string,
  bodyCol: string,
  k = 1,
): { neckAt: (d: number) => [number, number] } {
  const neckLen = kind === 'bass' ? 46 : 34;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // neck
  withGlow(ctx, glowCol, 6, () => {
    poly(ctx, [4, -1.8, neckLen, -1.4, neckLen, 1.4, 4, 1.8]);
    fillStroke(ctx, '#2a1d14', 1.4 * k);
  });
  // frets
  for (let d = 10; d < neckLen; d += 4) line(ctx, d, -1.3, d, 1.3, withAlpha(PAL.bone, 0.35), 0.5);
  // headstock
  if (kind === 'v' || kind === 'explorer') {
    poly(ctx, [neckLen, -2, neckLen + 9, -4.5, neckLen + 10, -1, neckLen + 6, 2.5, neckLen, 2]);
  } else {
    poly(ctx, [neckLen, -2.2, neckLen + 10, -3.2, neckLen + 11, 2, neckLen, 2.2]);
  }
  fillStroke(ctx, bodyCol, 1.4 * k);
  // body
  withGlow(ctx, glowCol, 10, () => {
    if (kind === 'v') {
      poly(ctx, [7, -3, -15, -14, -19, -10, -3, 0, -19, 10, -15, 14, 7, 3]);
    } else if (kind === 'explorer') {
      poly(ctx, [8, -3, -2, -12, -18, -13, -20, -6, -12, -2, -16, 9, -2, 11, 8, 4]);
    } else {
      blob(ctx, [8, -3, 0, -9, -10, -11, -17, -6, -15, 0, -17, 7, -9, 11, 1, 9, 8, 4]);
    }
    fillStroke(ctx, bodyCol, 1.8 * k);
  });
  // edge light
  ctx.save();
  ctx.globalAlpha = 0.9;
  if (kind === 'v') poly(ctx, [7, -3, -15, -14, -19, -10], false);
  else if (kind === 'explorer') poly(ctx, [8, -3, -2, -12, -18, -13], false);
  else poly(ctx, [8, -3, 0, -9, -10, -11], false);
  stroke(ctx, glowCol, 1.2);
  ctx.restore();
  // pickups + bridge
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-9, -3, 3, 6);
  ctx.fillRect(-3, -3, 3, 6);
  // strings (glowing)
  withGlow(ctx, glowCol, 4, () => {
    for (let s = -1; s <= 1; s += 1) line(ctx, -12, s * 0.8, neckLen + 2, s * 0.6, withAlpha('#ffffff', 0.8), 0.35);
  });
  if (kind === 'bass') {
    // skull decal
    circle(ctx, -9, 4, 2.6);
    fillStroke(ctx, glowCol, 0);
    ctx.fillStyle = '#10200a';
    ctx.fillRect(-10.2, 3.6, 0.9, 0.9);
    ctx.fillRect(-8.3, 3.6, 0.9, 0.9);
  }
  ctx.restore();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { neckAt: (d: number) => [x + cos * d, y + sin * d] };
}

// ---------------------------------------------------------------- body parts

function drawLeg(ctx: Ctx, hx: number, hy: number, fx: number, fy: number, w: number, pants: string, boots: string, glowCol: string): void {
  const kx = (hx + fx) / 2 + 3;
  const ky = (hy + fy) / 2;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.quadraticCurveTo(kx, ky, fx, fy - 3);
  stroke(ctx, PAL.ink, w + 2.6);
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.quadraticCurveTo(kx, ky, fx, fy - 3);
  stroke(ctx, pants, w);
  // boot
  blob(ctx, [fx - 3, fy - 5, fx + 2, fy - 5.5, fx + 6.5, fy - 1.5, fx + 6, fy + 1, fx - 3.5, fy + 1]);
  fillStroke(ctx, boots, 1.4);
  line(ctx, fx - 2, fy - 0.5, fx + 5, fy - 0.5, withAlpha(glowCol, 0.55), 0.8);
}

function drawArm(ctx: Ctx, sx: number, sy: number, hx: number, hy: number, w: number, upper: string, lower: string, skin: string, bendOut = 1): void {
  const ex = (sx + hx) / 2 + 3 * bendOut;
  const ey = (sy + hy) / 2 + 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineTo(hx, hy);
  stroke(ctx, PAL.ink, w + 2.4);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  stroke(ctx, upper, w);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(hx, hy);
  stroke(ctx, lower, w - 0.6);
  circle(ctx, hx, hy, w * 0.5 + 0.4);
  fillStroke(ctx, skin, 1.1);
}

// ---------------------------------------------------------------- heads
// Head-local coordinates: head center (0,0), roughly 17 wide x 19 tall.
// `k` scales line widths (portraits draw the same head scaled up).

function faceShape(ctx: Ctx, id: MemberId): void {
  if (id === 'bass' || id === 'rhythm') {
    blob(ctx, [-7.5, -6, 1, -9.5, 8.5, -5.5, 8.8, 3, 4, 9.5, -2, 9.5, -7, 5]);
  } else if (id === 'drums') {
    blob(ctx, [-7.5, -6, 1, -9.5, 8.5, -5.5, 8.5, 3, 3, 8.5, -3, 8, -7.5, 4]);
  } else {
    blob(ctx, [-7, -6.5, 1, -9.5, 8, -6, 8.2, 2.5, 3.2, 9.6, -1.5, 9, -6.5, 4.5]);
  }
}

function drawFace(ctx: Ctx, id: MemberId, b: Build, k: number, detail: boolean, strum: number): void {
  const g = col(id);
  faceShape(ctx, id);
  fillStroke(ctx, b.skin, 1.6 * k);
  // shadow side (left) + under-jaw
  ctx.save();
  faceShape(ctx, id);
  ctx.clip();
  ctx.fillStyle = withAlpha(b.skinShade, 0.9);
  ellipse(ctx, -9, 1, 6, 12);
  ctx.fill();
  if (detail) {
    ctx.fillStyle = linGrad(ctx, -9, 0, 6, 0, [[0, withAlpha('#000000', 0.35)], [0.6, withAlpha('#000000', 0.06)], [1, withAlpha('#000000', 0)]]);
    ctx.fillRect(-10, -10, 20, 21);
    ctx.fillStyle = linGrad(ctx, 0, 4, 0, 10, [[0, withAlpha('#000000', 0)], [1, withAlpha('#000000', 0.3)]]);
    ctx.fillRect(-10, 4, 20, 7);
  }
  // rim light (member color) on right edge
  ctx.strokeStyle = withAlpha(g, 0.85);
  ctx.lineWidth = 1.2 * k;
  faceShape(ctx, id);
  ctx.translate(1.2, 0);
  ctx.stroke();
  ctx.restore();

  if (id === 'bass') {
    // corpse paint
    ctx.fillStyle = withAlpha('#f4f1ea', 0.92);
    blob(ctx, [-5, -4, 1, -6, 7, -4, 7, 1, 4, 3, 0, 1.5, -4, 3, -6, 0]);
    ctx.fill();
    ctx.fillStyle = '#0b0b0b';
    ellipse(ctx, -1, -0.5, 2.6, 2.2);
    ctx.fill();
    ellipse(ctx, 5, -0.5, 2.3, 2.1);
    ctx.fill();
    ctx.fillRect(-0.5, 4, 1, 4.5);
    ctx.fillRect(2.5, 4, 1, 4.5);
  }

  // eyes: glowing slits
  const eyeY = id === 'drums' ? 0.5 : -0.5;
  withGlow(ctx, g, 5 * k + 2, () => {
    ctx.fillStyle = id === 'bass' ? g : shade(g, 0.55);
    poly(ctx, [-2.8, eyeY, 0.4, eyeY - 0.9, 0.8, eyeY + 0.6, -2.4, eyeY + 0.8]);
    ctx.fill();
    poly(ctx, [3.4, eyeY - 0.8, 6.8, eyeY - 0.2, 6.6, eyeY + 1, 3.4, eyeY + 0.9]);
    ctx.fill();
  });
  // brows (angry)
  line(ctx, -3.5, eyeY - 2.8, 1, eyeY - 1.6, PAL.ink, 1.1 * k + 0.2);
  line(ctx, 3, eyeY - 1.8, 7.4, eyeY - 2.8, PAL.ink, 1.1 * k + 0.2);
  if (detail) {
    // nose shadow + cheekbone
    poly(ctx, [2.3, eyeY + 1.6, 1.2, 4.6, 3.4, 4.9]);
    ctx.fillStyle = withAlpha(PAL.ink, 0.28);
    ctx.fill();
    line(ctx, 1.3, 4.7, 3.3, 4.9, withAlpha(PAL.ink, 0.7), 0.35);
    poly(ctx, [-6.5, 1.5, -3.5, 3.2, -6, 5.5]);
    ctx.fillStyle = withAlpha(PAL.ink, 0.18);
    ctx.fill();
  }
  // mouth
  const open = strum > 0.5;
  if (id === 'vocals' || (open && id !== 'rhythm')) {
    ellipse(ctx, 2, 6.3, open ? 2.2 : 1.6, open ? 1.8 : 0.7);
    fillStroke(ctx, id === 'vocals' ? '#3a0a26' : '#1a0606', 0.6 * k);
  } else {
    line(ctx, -0.5, 6.4, 4, 6.1, PAL.ink, 0.8 * k + 0.2);
  }
  if (id === 'vocals' && detail) {
    // dark lips
    ellipse(ctx, 2, 6.3, 2.2, 1.1);
    ctx.fillStyle = '#4d0d3c';
    ctx.fill();
  }
}

function drawHairBack(ctx: Ctx, id: MemberId, k: number): void {
  switch (id) {
    case 'lead': {
      // swept-back spikes
      const pts = [-8, 2, -12, -6, -9, -8, -14, -15, -6, -12, -6, -20, -1, -13, 2, -22, 5, -13, 11, -19, 9, -10, 13, -8, 9, -3];
      withGlow(ctx, '#7b2cff', 4, () => {
        poly(ctx, pts);
        fillStroke(ctx, '#1a0f2e', 1.6 * k);
      });
      poly(ctx, [-6, -12, -6, -20, -1, -13], false);
      stroke(ctx, '#9b4dff', 1 * k);
      poly(ctx, [2, -22, 5, -13], false);
      stroke(ctx, '#9b4dff', 1 * k);
      break;
    }
    case 'rhythm': {
      blob(ctx, [-9, -7, 0, -11, 9, -8, 11, 4, 12, 16, 7, 22, -3, 22, -11, 16, -11, 3]);
      fillStroke(ctx, '#2a1810', 1.6 * k);
      for (let i = -8; i <= 9; i += 3.5) line(ctx, i, 2, i + 0.8, 19, withAlpha('#5b3a22', 0.7), 0.6);
      break;
    }
    case 'bass': {
      // dreadlocks hanging to the chest
      for (let i = -10; i <= 11; i += 2.6) {
        const len = 18 + ((i * 7) % 5);
        ctx.beginPath();
        ctx.moveTo(i * 0.7, -6);
        ctx.quadraticCurveTo(i * 1.05, 6, i * 1.1 + 1, len);
        stroke(ctx, PAL.ink, 3.4 * k + 0.6);
        ctx.beginPath();
        ctx.moveTo(i * 0.7, -6);
        ctx.quadraticCurveTo(i * 1.05, 6, i * 1.1 + 1, len);
        stroke(ctx, '#1f2616', 2.4 * k);
        circle(ctx, i * 1.1 + 1, len, 1.1);
        ctx.fillStyle = '#9dff2e';
        ctx.fill();
      }
      blob(ctx, [-9, -5, -6, -11, 2, -12, 9, -9, 10, -3]);
      fillStroke(ctx, '#1f2616', 1.5 * k);
      break;
    }
    case 'drums':
      break;
    case 'vocals': {
      blob(ctx, [-9, -6, 0, -11, 9, -7, 10, 10, 9, 30, 2, 34, -6, 32, -10, 12]);
      fillStroke(ctx, '#0c0a12', 1.6 * k);
      for (let i = -7; i <= 8; i += 3) line(ctx, i, 4, i + 0.5, 30, withAlpha('#ff5ccf', 0.18), 0.6);
      break;
    }
  }
}

function drawHairFront(ctx: Ctx, id: MemberId, k: number, detail: boolean): void {
  const g = col(id);
  switch (id) {
    case 'lead': {
      // sweeping bangs over the right eye
      withGlow(ctx, '#7b2cff', 3, () => {
        poly(ctx, [-8, -4, -6, -10, 2, -11, 9, -8, 10, -2, 8, 3, 6, -2, 4, 2, 2, -3, -1, -1, -3, -5, -6, -1]);
        fillStroke(ctx, '#1a0f2e', 1.4 * k);
      });
      poly(ctx, [2, -11, 9, -8, 10, -2], false);
      stroke(ctx, '#b455ff', 1 * k);
      break;
    }
    case 'rhythm': {
      poly(ctx, [-8.5, -4, -6, -10, 2, -11, 9, -8, 9.5, -1, 7, -5, 3, -7, -2, -7, -6, -3]);
      fillStroke(ctx, '#2a1810', 1.4 * k);
      // strands framing the face
      poly(ctx, [-8.5, -4, -6, -3, -7.5, 12, -10, 12]);
      fillStroke(ctx, '#2a1810', 1.2 * k);
      // beard
      blob(ctx, [-6.5, 3, -2, 5, 2, 8, 6, 5, 8.6, 2.5, 8.2, 9, 4, 15, -1, 15, -6, 10]);
      fillStroke(ctx, '#23140c', 1.3 * k);
      line(ctx, -0.5, 6.4, 4, 6.1, '#0d0806', 0.9 * k);
      if (detail) for (let i = -4; i <= 6; i += 2) line(ctx, i, 9, i + 0.5, 14, withAlpha('#5b3a22', 0.6), 0.4);
      break;
    }
    case 'bass': {
      // beard + headband with green glyph
      blob(ctx, [-6, 5, -1, 8, 4, 8.5, 8.5, 5, 7, 13, 2, 17, -3, 14]);
      fillStroke(ctx, '#171b10', 1.3 * k);
      poly(ctx, [-9, -5.5, 9.5, -7, 9.8, -4.5, -8.8, -3]);
      fillStroke(ctx, '#0f0f0f', 1 * k);
      withGlow(ctx, g, 4, () => {
        circle(ctx, 1, -5.1, 1);
        ctx.fillStyle = g;
        ctx.fill();
      });
      break;
    }
    case 'drums': {
      // spiky white/cyan hair crown
      withGlow(ctx, g, 4, () => {
        poly(ctx, [-8, -3, -12, -8, -7, -9, -9, -16, -3, -11, 0, -19, 3, -11, 8, -17, 7, -9, 12, -10, 9, -3]);
        fillStroke(ctx, '#e6fbff', 1.5 * k);
      });
      poly(ctx, [-9, -16, -3, -11, 0, -19, 3, -11, 8, -17], false);
      stroke(ctx, withAlpha(g, 0.9), 1 * k);
      // goggles on forehead
      poly(ctx, [-8.5, -4.5, 9.5, -5.5, 9.5, -2.5, -8.5, -1.5]);
      fillStroke(ctx, '#1a1f22', 1 * k);
      withGlow(ctx, g, 6, () => {
        ellipse(ctx, -2, -3.3, 3, 2.6);
        fillStroke(ctx, withAlpha(g, 0.85), 1 * k);
        ellipse(ctx, 5, -3.8, 3, 2.6);
        fillStroke(ctx, withAlpha(g, 0.85), 1 * k);
      });
      ellipse(ctx, -2.8, -4.2, 0.9, 0.6);
      ctx.fillStyle = '#fff';
      ctx.fill();
      break;
    }
    case 'vocals': {
      // blunt bangs + side curtains
      poly(ctx, [-9, -2, -7, -10, 1, -11.5, 9, -8, 9.5, -2, 7, -2.5, 4, -3, 0, -3.5, -5, -2.5]);
      fillStroke(ctx, '#0c0a12', 1.4 * k);
      poly(ctx, [-9, -2, -6.5, -2, -7, 14, -10, 12]);
      fillStroke(ctx, '#0c0a12', 1.2 * k);
      line(ctx, -3, -9.5, 5, -9.5, withAlpha(g, 0.45), 0.7);
      break;
    }
  }
}

function drawHead(ctx: Ctx, id: MemberId, x: number, y: number, b: Build, strum: number, k = 1, detail = false, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const tilt = id === 'vocals' && strum > 0.5 ? -0.25 : id === 'lead' && strum > 0.5 ? 0.12 : 0;
  ctx.rotate(tilt);
  drawHairBack(ctx, id, k);
  drawFace(ctx, id, b, k, detail, strum);
  drawHairFront(ctx, id, k, detail);
  ctx.restore();
}

// ---------------------------------------------------------------- torsos

function drawTorso(ctx: Ctx, id: MemberId, cx: number, b: Build, sy: number, hy: number): void {
  const g = col(id);
  const { sw, hw } = b;
  if (id === 'vocals') {
    // long dress flaring to the ankles
    poly(ctx, [cx - sw / 2, sy, cx + sw / 2, sy, cx + hw / 2, hy, cx + 15, 80, cx + 4, 78, cx - 6, 81, cx - 15, 79, cx - hw / 2, hy]);
    fillStroke(ctx, b.jacket, 1.8);
    ctx.save();
    poly(ctx, [cx - sw / 2, sy, cx + sw / 2, sy, cx + hw / 2, hy, cx + 15, 80, cx - 15, 79, cx - hw / 2, hy]);
    ctx.clip();
    for (let i = 0; i < 6; i++) line(ctx, cx - 12 + i * 5, hy, cx - 15 + i * 6, 80, withAlpha(g, 0.16), 1);
    ctx.restore();
    // corset lacing
    for (let yy = sy + 6; yy < hy; yy += 3) line(ctx, cx - 2, yy, cx + 3, yy + 1.5, withAlpha(g, 0.7), 0.7);
    // chain belt
    ctx.beginPath();
    ctx.moveTo(cx - hw / 2, hy - 1);
    ctx.quadraticCurveTo(cx, hy + 4, cx + hw / 2 + 1, hy - 2);
    stroke(ctx, PAL.chrome, 0.9);
    // choker
    line(ctx, cx - 3, sy - 2.5, cx + 4, sy - 2.5, g, 1.3);
    return;
  }
  poly(ctx, [cx - sw / 2, sy + 1, cx - sw / 2 + 3, sy - 1.5, cx + sw / 2 - 3, sy - 1.5, cx + sw / 2, sy + 1, cx + hw / 2 + 1, hy + 2, cx - hw / 2 - 1, hy + 2]);
  fillStroke(ctx, b.jacket, 1.8);
  ctx.save();
  poly(ctx, [cx - sw / 2, sy + 1, cx + sw / 2, sy + 1, cx + hw / 2 + 1, hy + 2, cx - hw / 2 - 1, hy + 2]);
  ctx.clip();
  halftone(ctx, cx - sw / 2, sy - 2, sw / 2, hy - sy + 5, withAlpha('#000000', 0.45), 1.8, (px) => (cx - px) / (sw / 2));
  ctx.restore();
  // rim light
  line(ctx, cx + sw / 2 - 0.5, sy + 1.5, cx + hw / 2 + 0.5, hy + 1, withAlpha(g, 0.9), 1.1);

  switch (id) {
    case 'lead': {
      // open jacket lapels + studs + belt chain
      poly(ctx, [cx - 1, sy, cx + 3, sy, cx + 2, hy + 1, cx - 1, hy + 1]);
      fillStroke(ctx, '#2e2838', 0.8);
      for (const sx of [-6, -3, 4, 7]) {
        circle(ctx, cx + sx, sy + 1.5, 0.9);
        ctx.fillStyle = PAL.chrome;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(cx - hw / 2, hy);
      ctx.quadraticCurveTo(cx + 1, hy + 5, cx + hw / 2, hy);
      stroke(ctx, PAL.chrome, 0.9);
      break;
    }
    case 'rhythm': {
      // vest over a dark tee with a red patch
      poly(ctx, [cx - 3, sy - 1, cx + 3, sy - 1, cx + 2, hy + 1, cx - 2, hy + 1]);
      fillStroke(ctx, '#3b1a12', 0.8);
      poly(ctx, [cx - 9, sy + 5, cx - 5, sy + 4, cx - 5, sy + 9, cx - 9, sy + 10]);
      fillStroke(ctx, '#b3121d', 0.7);
      break;
    }
    case 'bass': {
      // coat tails over the legs + crossing chains
      poly(ctx, [cx - hw / 2 - 1, hy, cx - hw / 2 - 4, 76, cx - 6, 74, cx - 3, hy + 1]);
      fillStroke(ctx, b.jacket, 1.5);
      poly(ctx, [cx + hw / 2 + 1, hy, cx + hw / 2 + 5, 75, cx + 7, 73, cx + 3, hy + 1]);
      fillStroke(ctx, b.jacket, 1.5);
      ctx.beginPath();
      ctx.moveTo(cx - sw / 2 + 3, sy + 2);
      ctx.quadraticCurveTo(cx, sy + 12, cx + sw / 2 - 2, hy - 3);
      stroke(ctx, PAL.chrome, 1.1);
      ctx.beginPath();
      ctx.moveTo(cx + sw / 2 - 3, sy + 2);
      ctx.quadraticCurveTo(cx, sy + 12, cx - sw / 2 + 2, hy - 3);
      stroke(ctx, withAlpha(PAL.chrome, 0.7), 1);
      break;
    }
    case 'drums': {
      // tank top skull print
      withGlow(ctx, g, 3, () => {
        circle(ctx, cx + 1, sy + 8, 3.2);
        ctx.fillStyle = withAlpha(g, 0.85);
        ctx.fill();
      });
      ctx.fillStyle = '#101418';
      ctx.fillRect(cx - 0.8, sy + 7.4, 1.1, 1.1);
      ctx.fillRect(cx + 1.8, sy + 7.4, 1.1, 1.1);
      break;
    }
  }
}

// ---------------------------------------------------------------- full sprite

export function paintMusician(ctx: Ctx, id: MemberId, pose: Pose): void {
  const b = BUILDS[id];
  const g = col(id);
  const cx = 34;
  const ground = 84;
  const bob = pose.bob;
  const sy = b.shoulderY + bob;
  const hy = b.hipY + bob;
  const hdY = b.headY + bob;

  // feet
  let backFoot: [number, number];
  let frontFoot: [number, number];
  if (pose.run) {
    const s = Math.sin(pose.phase);
    const c = Math.cos(pose.phase);
    frontFoot = [cx + 3 + s * 9, ground - Math.max(0, -c) * 5];
    backFoot = [cx - 3 - s * 9, ground - Math.max(0, c) * 5];
  } else {
    frontFoot = [cx + 6, ground];
    backFoot = [cx - 6, ground];
  }
  if (id === 'rhythm' && pose.strum > 0.5) {
    // wide chug stance
    frontFoot = [cx + 10, ground];
    backFoot = [cx - 10, ground];
  }

  // back hair for long-hair members is drawn with the head (after torso)
  drawLeg(ctx, cx - b.hw / 4, hy, backFoot[0], backFoot[1], b.legW, shade(b.pants, -0.25), b.boots, g);
  if (id !== 'vocals') drawLeg(ctx, cx + b.hw / 4, hy, frontFoot[0], frontFoot[1], b.legW, b.pants, b.boots, g);
  else drawLeg(ctx, cx + b.hw / 4, hy, frontFoot[0], frontFoot[1], b.legW, b.pants, b.boots, g);

  // long hair behind body
  if (id === 'vocals' || id === 'rhythm' || id === 'bass') {
    ctx.save();
    ctx.translate(cx + 1, hdY);
    drawHairBack(ctx, id, 1);
    ctx.restore();
  }

  drawTorso(ctx, id, cx, b, sy, hy);

  // neck
  ctx.fillStyle = b.skinShade;
  ctx.fillRect(cx - 2, hdY + 7, 5, sy - hdY - 6);

  const shoulderL: [number, number] = [cx - b.sw / 2 + 2.5, sy + 2];
  const shoulderR: [number, number] = [cx + b.sw / 2 - 2.5, sy + 2];
  const sleeveUpper = b.sleeve === 'bare' ? b.skin : b.sleeve === 'mesh' ? '#221725' : b.jacket;
  const sleeveLower = b.sleeve === 'full' ? b.jacket : b.sleeve === 'mesh' ? '#2a1d2c' : b.skin;
  const armW = id === 'bass' ? 5.2 : id === 'rhythm' ? 5 : 4;

  // head (before instrument so the instrument sits over the chest)
  const headFn = () => {
    ctx.save();
    ctx.translate(cx + 1, hdY);
    const tilt = id === 'vocals' && pose.strum > 0.5 ? -0.25 : id === 'lead' && pose.strum > 0.5 ? 0.12 : 0;
    ctx.rotate(tilt);
    if (!(id === 'vocals' || id === 'rhythm' || id === 'bass')) drawHairBack(ctx, id, 1);
    drawFace(ctx, id, b, 1, false, pose.strum);
    drawHairFront(ctx, id, 1, false);
    ctx.restore();
  };

  if (id === 'lead' || id === 'rhythm' || id === 'bass') {
    headFn();
    const kind = id === 'lead' ? 'v' : id === 'rhythm' ? 'explorer' : 'bass';
    const bodyCol = id === 'lead' ? '#2a0f4a' : id === 'rhythm' ? '#8a2a0a' : '#16240c';
    let angle = id === 'lead' ? -0.55 : id === 'rhythm' ? -0.38 : -0.7;
    let gx = cx - 3;
    let gy = hy - 3;
    if (pose.strum > 0.5) {
      angle += id === 'rhythm' ? 0.18 : -0.45;
      gy += id === 'rhythm' ? 2 : -3;
    }
    const gtr = drawGuitar(ctx, gx, gy, angle, kind, g, bodyCol);
    const fret = gtr.neckAt(id === 'bass' ? 30 : 22);
    const strumHand: [number, number] = [gx + 1, gy - 1 + (pose.strum > 0.5 ? 3 : 0)];
    drawArm(ctx, shoulderR[0], shoulderR[1], fret[0], fret[1], armW, sleeveUpper, sleeveLower, b.skin, 1);
    drawArm(ctx, shoulderL[0], shoulderL[1], strumHand[0], strumHand[1], armW, shade(sleeveUpper, -0.2), shade(sleeveLower, -0.15), b.skin, -1);
    if (id === 'rhythm') {
      // red wristbands
      circle(ctx, strumHand[0] + 1, strumHand[1] - 3, 1.8);
      fillStroke(ctx, '#b3121d', 0.8);
    }
  } else if (id === 'drums') {
    headFn();
    // marching snare on a harness
    const dx = cx + 1;
    const dy = hy - 1;
    line(ctx, shoulderL[0], shoulderL[1], dx + 6, dy - 3, '#0b0d0f', 1.6);
    poly(ctx, [dx - 12, dy, dx + 12, dy, dx + 12, dy + 8, dx - 12, dy + 8]);
    fillStroke(ctx, '#0c2a33', 1.6);
    for (let i = -10; i <= 10; i += 5) line(ctx, dx + i, dy + 1, dx + i + 2.5, dy + 7, withAlpha(PAL.chrome, 0.8), 0.7);
    withGlow(ctx, g, 6, () => {
      ellipse(ctx, dx, dy, 12, 4.2);
      fillStroke(ctx, PAL.bone, 1.4);
    });
    ellipse(ctx, dx, dy, 12, 4.2);
    stroke(ctx, g, 1);
    const up = pose.strum > 0.5;
    const hL: [number, number] = up ? [cx - 9, sy - 9] : [cx - 5, dy - 3 - (pose.run ? 1 : 0)];
    const hR: [number, number] = up ? [cx + 11, sy - 11] : [cx + 7, dy - 4 + (pose.bob > 0 ? 1 : 0)];
    const stick = (h: [number, number], ang: number) => {
      const ex = h[0] + Math.cos(ang) * 13;
      const ey = h[1] + Math.sin(ang) * 13;
      line(ctx, h[0], h[1], ex, ey, PAL.ink, 2.6);
      line(ctx, h[0], h[1], ex, ey, '#e8d3a8', 1.4);
      withGlow(ctx, g, 5, () => {
        circle(ctx, ex, ey, 1.2);
        ctx.fillStyle = g;
        ctx.fill();
      });
    };
    stick(hL, up ? -2.2 : 0.35);
    stick(hR, up ? -1.0 : 2.7);
    drawArm(ctx, shoulderL[0], shoulderL[1], hL[0], hL[1], armW, sleeveUpper, sleeveLower, b.skin, -1);
    drawArm(ctx, shoulderR[0], shoulderR[1], hR[0], hR[1], armW, sleeveUpper, sleeveLower, b.skin, 1);
    // tattoo lines
    line(ctx, shoulderR[0] + 1, shoulderR[1] + 3, shoulderR[0] + 2, shoulderR[1] + 7, withAlpha(g, 0.7), 0.7);
  } else {
    // vocals: mic stand held like a staff
    const up = pose.strum > 0.5;
    const top: [number, number] = up ? [cx + 12, hdY + 2] : [cx + 9, hdY - 4];
    const base: [number, number] = up ? [cx + 26, ground - 4] : [cx + 16, ground];
    line(ctx, base[0], base[1], top[0], top[1], PAL.ink, 2.6);
    line(ctx, base[0], base[1], top[0], top[1], PAL.chrome, 1.3);
    headFn();
    withGlow(ctx, g, 8, () => {
      ellipse(ctx, top[0] - 1, top[1] - 1, 2.6, 3.2, -0.5);
      fillStroke(ctx, '#2a2a30', 1.2);
    });
    circle(ctx, top[0] - 1.6, top[1] - 1.8, 0.8);
    ctx.fillStyle = withAlpha(g, 0.9);
    ctx.fill();
    const hFront: [number, number] = up ? [top[0] + 2, top[1] + 7] : [cx + 12, sy + 10];
    const hBack: [number, number] = up ? [cx - 7, sy - 4] : [top[0] + 2, top[1] + 8];
    drawArm(ctx, shoulderL[0], shoulderL[1], hBack[0], hBack[1], armW, sleeveUpper, sleeveLower, b.skin, -1);
    drawArm(ctx, shoulderR[0], shoulderR[1], hFront[0], hFront[1], armW, sleeveUpper, sleeveLower, b.skin, 1);
  }
}

// ---------------------------------------------------------------- portrait

export function paintPortrait(ctx: Ctx, id: MemberId, w: number, h: number, withBg = true): void {
  const b = BUILDS[id];
  const g = col(id);
  if (withBg) {
    ctx.fillStyle = '#0a080d';
    ctx.fillRect(0, 0, w, h);
    radialGlow(ctx, w * 0.55, h * 0.42, w * 0.75, g, 0.55);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    halftone(ctx, 0, 0, w, h, withAlpha(g, 0.35), 5, (px, py) => 1 - Math.hypot(px - w * 0.6, py - h * 0.35) / (w * 0.8));
    // speaker-grille diagonal lines
    ctx.globalAlpha = 0.07;
    for (let i = -h; i < w; i += 6) line(ctx, i, h, i + h, 0, '#ffffff', 1);
    ctx.restore();
  }
  const cx = w * 0.5;
  const headY = h * 0.47;
  const s = w / 40; // head scale factor

  // shoulders / bust
  const shW = (id === 'bass' ? 1.16 : id === 'rhythm' ? 1.1 : id === 'drums' ? 0.92 : 0.95) * w * 0.52;
  const bustTop = headY + 9.5 * s;
  // back hair for long-haired members
  ctx.save();
  ctx.translate(cx, headY);
  ctx.scale(s, s);
  if (id === 'vocals' || id === 'rhythm' || id === 'bass') drawHairBack(ctx, id, 0.5);
  ctx.restore();

  // neck
  ctx.fillStyle = b.skinShade;
  ctx.beginPath();
  ctx.rect(cx - 3 * s, headY + 5 * s, 6.5 * s, 6 * s);
  ctx.fill();
  // torso
  blob(ctx, [cx - shW, h + 10, cx - shW * 0.95, bustTop + 12 * s, cx - shW * 0.55, bustTop + 2 * s, cx, bustTop + 4 * s, cx + shW * 0.55, bustTop + 1.5 * s, cx + shW * 0.98, bustTop + 11 * s, cx + shW, h + 10]);
  const outfit = id === 'rhythm' ? '#1a1411' : b.jacket;
  fillStroke(ctx, outfit, 3);
  ctx.save();
  blob(ctx, [cx - shW, h + 10, cx - shW * 0.95, bustTop + 12 * s, cx - shW * 0.55, bustTop + 2 * s, cx, bustTop + 4 * s, cx + shW * 0.55, bustTop + 1.5 * s, cx + shW * 0.98, bustTop + 11 * s, cx + shW, h + 10]);
  ctx.clip();
  halftone(ctx, 0, bustTop, w, h - bustTop, withAlpha('#000', 0.5), 3.2, (px) => (cx - px) / shW + 0.2);
  ctx.strokeStyle = withAlpha(g, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + shW * 0.55, bustTop + 2 * s);
  ctx.quadraticCurveTo(cx + shW * 0.95, bustTop + 6 * s, cx + shW, h);
  ctx.stroke();
  // outfit detail
  if (id === 'lead') {
    for (let i = 0; i < 5; i++) {
      circle(ctx, cx + shW * (0.45 + i * 0.1), bustTop + (4 + i * 1.6) * s, 1.6);
      ctx.fillStyle = PAL.chrome;
      ctx.fill();
    }
    poly(ctx, [cx - 5, bustTop + 4 * s, cx + 7, bustTop + 4 * s, cx + 3, h, cx - 3, h]);
    ctx.fillStyle = '#2e2838';
    ctx.fill();
  } else if (id === 'rhythm') {
    ctx.fillStyle = b.skin;
    blob(ctx, [cx - shW * 0.95, h, cx - shW * 0.95, bustTop + 12 * s, cx - shW * 0.7, bustTop + 5 * s, cx - shW * 0.55, h]);
    ctx.fill();
    blob(ctx, [cx + shW * 0.98, h, cx + shW * 0.98, bustTop + 11 * s, cx + shW * 0.72, bustTop + 4 * s, cx + shW * 0.58, h]);
    ctx.fill();
  } else if (id === 'bass') {
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.moveTo(cx - shW * 0.7, bustTop + (5 + k * 6) * s);
      ctx.quadraticCurveTo(cx, bustTop + (14 + k * 6) * s, cx + shW * 0.8, bustTop + (4 + k * 7) * s);
      stroke(ctx, PAL.chrome, 2.2);
    }
  } else if (id === 'drums') {
    ctx.fillStyle = b.skin;
    blob(ctx, [cx - shW * 0.95, h, cx - shW * 0.95, bustTop + 12 * s, cx - shW * 0.72, bustTop + 4 * s, cx - shW * 0.6, h]);
    ctx.fill();
    blob(ctx, [cx + shW * 0.98, h, cx + shW * 0.98, bustTop + 11 * s, cx + shW * 0.74, bustTop + 4 * s, cx + shW * 0.62, h]);
    ctx.fill();
    for (let i = 0; i < 4; i++) line(ctx, cx + shW * 0.8, bustTop + (8 + i * 3) * s, cx + shW * 0.92, bustTop + (9 + i * 3) * s, withAlpha(g, 0.8), 1.4);
  } else if (id === 'vocals') {
    for (let yy = bustTop + 6 * s; yy < h; yy += 5) line(ctx, cx - 3, yy, cx + 4, yy + 2, withAlpha(g, 0.7), 1.1);
    line(ctx, cx - 4 * s, headY + 9 * s, cx + 4.5 * s, headY + 9 * s, g, 3);
  }
  ctx.restore();

  // head
  ctx.save();
  ctx.translate(cx, headY);
  ctx.scale(s, s);
  if (!(id === 'vocals' || id === 'rhythm' || id === 'bass')) drawHairBack(ctx, id, 0.5);
  drawFace(ctx, id, b, 0.5, true, 0);
  drawHairFront(ctx, id, 0.5, true);
  ctx.restore();
}

/** Circular emblem for the SOLO button: portrait in a ring. */
export function paintSoloEmblem(ctx: Ctx, id: MemberId, size: number): void {
  const g = col(id);
  const r = size / 2;
  ctx.save();
  circle(ctx, r, r, r - 6);
  ctx.clip();
  ctx.translate(r - r * 0.9, r * 0.05);
  paintPortrait(ctx, id, r * 1.8, r * 2.1, true);
  ctx.restore();
  withGlow(ctx, g, 14, () => {
    circle(ctx, r, r, r - 5);
    stroke(ctx, g, 4);
  });
  circle(ctx, r, r, r - 2);
  stroke(ctx, PAL.ink, 3);
}

export function registerCharacterArt(atlas: ArtAtlas): void {
  const ids: MemberId[] = ['lead', 'rhythm', 'bass', 'drums', 'vocals'];
  for (const id of ids) {
    for (const f of MUSICIAN_FRAMES) {
      atlas.add(`m_${id}_${f}`, MUSICIAN_FRAME.w, MUSICIAN_FRAME.h, (ctx) => paintMusician(ctx, id, POSES[f]));
    }
    atlas.add(`portrait_${id}`, 128, 150, (ctx) => paintPortrait(ctx, id, 128, 150));
    atlas.add(`solo_${id}`, 120, 120, (ctx) => paintSoloEmblem(ctx, id, 120));
    // captured (desaturated, drained) pose for siphon capsules
    atlas.add(`m_${id}_captive`, MUSICIAN_FRAME.w, MUSICIAN_FRAME.h, (ctx) => {
      paintMusician(ctx, id, { phase: 0, run: false, bob: 0, strum: 0 });
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(40,10,60,0.55)';
      ctx.fillRect(0, 0, 72, 88);
      ctx.globalCompositeOperation = 'source-over';
    });
  }
  // unknown / missing member silhouette for the HUD
  atlas.add('portrait_missing', 128, 150, (ctx) => {
    ctx.fillStyle = '#07060a';
    ctx.fillRect(0, 0, 128, 150);
    const r = rng(9);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(160,160,190,${r() * 0.12})`;
      ctx.fillRect(r() * 128, r() * 150, 2, 1);
    }
  });
}

/** Deterministic ghostly "static" overlay for a missing member portrait. */
export function paintStatic(ctx: Ctx, w: number, h: number, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < (w * h) / 18; i++) {
    ctx.fillStyle = `rgba(200,200,230,${r() * 0.18})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
  }
}

export { drawHead, linGrad };
