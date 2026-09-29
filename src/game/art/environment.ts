/**
 * Island decor + landmarks. Backgrounds are deliberately darker and less
 * saturated than combat elements so attacks and telegraphs pop.
 */
import type { ArtAtlas } from './atlas';
import {
  PAL,
  blob,
  circle,
  distress,
  ellipse,
  fillStroke,
  halftone,
  line,
  linGrad,
  poly,
  radialGlow,
  rng,
  stroke,
  withAlpha,
  withGlow,
  type Ctx,
} from './paint';
import { paintSigil } from './fx';

const LEAF = '#1d3a24';
const LEAF_HI = '#2f5a36';

function palm(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  const bx = 35;
  const lean = (r() - 0.5) * 16;
  // trunk
  ctx.beginPath();
  ctx.moveTo(bx - 4, 94);
  ctx.quadraticCurveTo(bx + lean * 0.3, 60, bx + lean, 30);
  ctx.lineTo(bx + lean + 4, 30);
  ctx.quadraticCurveTo(bx + lean * 0.3 + 5, 60, bx + 4, 94);
  ctx.closePath();
  fillStroke(ctx, '#3a2a1e', 1.6);
  for (let y = 40; y < 92; y += 6) line(ctx, bx - 4 + ((y - 30) / 64) * -lean + lean, y, bx + 3 + lean * (1 - (y - 30) / 64), y + 1, withAlpha('#000', 0.45), 1);
  // fronds
  const tx = bx + lean + 2;
  const ty = 30;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI + (r() - 0.5) * 0.3;
    const len = 26 + r() * 10;
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.6 + 10;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo((tx + ex) / 2, ty - 10, ex, ey);
    ctx.quadraticCurveTo((tx + ex) / 2, ty - 2, tx, ty + 3);
    fillStroke(ctx, i % 2 ? LEAF : LEAF_HI, 1.4);
  }
}

function fern(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI + 0.3 + (i / 5) * (Math.PI - 0.6);
    const len = 14 + r() * 8;
    const ex = 22 + Math.cos(a) * len;
    const ey = 26 + Math.sin(a) * len * 0.8;
    ctx.beginPath();
    ctx.moveTo(22, 27);
    ctx.quadraticCurveTo((22 + ex) / 2 + 3, (27 + ey) / 2 - 4, ex, ey);
    ctx.quadraticCurveTo((22 + ex) / 2 - 2, (27 + ey) / 2, 22, 27);
    fillStroke(ctx, i % 2 ? '#183322' : '#224a2c', 1);
  }
}

function drumtree(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  // a tree whose trunk is stacked drum shells
  for (let i = 0; i < 4; i++) {
    const y = 78 - i * 14;
    const w = 13 - i;
    poly(ctx, [27 - w, y - 12, 27 + w, y - 12, 27 + w, y, 27 - w, y]);
    fillStroke(ctx, i % 2 ? '#4a1612' : '#3a120e', 1.4);
    ellipse(ctx, 27, y - 12, w, 3);
    fillStroke(ctx, '#8a7a60', 1);
    for (let k = -w + 3; k < w; k += 5) line(ctx, 27 + k, y - 10, 27 + k, y - 1, withAlpha(PAL.chrome, 0.35), 0.6);
  }
  // canopy of broad leaves
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ellipse(ctx, 27 + Math.cos(a) * 12, 18 + Math.sin(a) * 6, 13, 7, a);
    fillStroke(ctx, r() > 0.5 ? LEAF : LEAF_HI, 1.2);
  }
  withGlow(ctx, '#ff3a1a', 6, () => {
    circle(ctx, 20, 20, 2);
    ctx.fillStyle = '#ff5a2a';
    ctx.fill();
    circle(ctx, 33, 16, 1.8);
    ctx.fill();
  });
}

function pod(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  line(ctx, 15, 42, 15, 24, '#1d3a24', 3);
  for (let i = 0; i < 3; i++) {
    const px = 8 + i * 7 + r() * 2;
    const py = 12 + (i % 2) * 6;
    line(ctx, 15, 28, px, py + 6, '#1d3a24', 2);
    ellipse(ctx, px, py, 5, 7);
    fillStroke(ctx, i === 1 ? '#8a2014' : '#6a1a10', 1.2);
    line(ctx, px - 4, py - 1, px + 4, py + 1, '#d97a2a', 1.4);
  }
}

function horn(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  // hollow brass plant: curling stem ending in a bell
  ctx.beginPath();
  ctx.moveTo(20, 60);
  ctx.quadraticCurveTo(8 + r() * 4, 36, 22, 22);
  stroke(ctx, PAL.ink, 7);
  ctx.beginPath();
  ctx.moveTo(20, 60);
  ctx.quadraticCurveTo(8 + r() * 4, 36, 22, 22);
  stroke(ctx, '#8a6418', 4);
  withGlow(ctx, '#ffcf3a', 4, () => {
    ellipse(ctx, 25, 16, 12, 8, -0.4);
    fillStroke(ctx, linGrad(ctx, 13, 8, 37, 24, [[0, '#e0b544'], [1, '#6a4a10']]), 1.6);
  });
  ellipse(ctx, 25, 16, 7.5, 4.6, -0.4);
  ctx.fillStyle = '#140a02';
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ellipse(ctx, 10 + i * 8, 58, 5, 2.4);
    fillStroke(ctx, '#23301a', 1);
  }
}

function reed(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < 5; i++) {
    const x = 5 + i * 4 + r() * 2;
    const h = 20 + r() * 18;
    ctx.beginPath();
    ctx.moveTo(x, 40);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 8, 40 - h / 2, x + (r() - 0.5) * 6, 40 - h);
    stroke(ctx, i % 2 ? '#3a4a1a' : '#4a5a22', 2);
  }
  ellipse(ctx, 13, 12, 2, 5);
  ctx.fillStyle = '#5a3a1a';
  ctx.fill();
}

function pipe(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(4, 34);
  ctx.lineTo(24, 34);
  ctx.quadraticCurveTo(34, 34, 34, 22);
  ctx.lineTo(34, 14);
  stroke(ctx, PAL.ink, 11);
  ctx.beginPath();
  ctx.moveTo(4, 34);
  ctx.lineTo(24, 34);
  ctx.quadraticCurveTo(34, 34, 34, 22);
  ctx.lineTo(34, 14);
  stroke(ctx, '#7a5818', 7);
  ctx.beginPath();
  ctx.moveTo(4, 32);
  ctx.lineTo(24, 32);
  stroke(ctx, withAlpha('#ffe08a', 0.6), 1.5);
  ellipse(ctx, 34, 12, 8, 4);
  fillStroke(ctx, '#c08f22', 1.4);
  ellipse(ctx, 34, 12, 4.5, 2);
  ctx.fillStyle = '#140a02';
  ctx.fill();
  ellipse(ctx, 50, 30, 14, 6);
  fillStroke(ctx, withAlpha('#3b4a12', 0.9), 1);
  radialGlow(ctx, 50, 30, 10, '#9dff2e', 0.35);
}

function crystal(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < 3; i++) {
    const x = 10 + i * 7 + r() * 3;
    const h = 22 + r() * 24;
    withGlow(ctx, '#b455ff', 6, () => {
      poly(ctx, [x - 4, 52, x - 3, 52 - h * 0.8, x, 52 - h, x + 3, 52 - h * 0.8, x + 4, 52]);
      fillStroke(ctx, linGrad(ctx, x - 4, 0, x + 4, 0, [[0, '#2a0f4a'], [0.5, '#8a3aff'], [1, '#3a1466']]), 1.2);
    });
    line(ctx, x, 52 - h + 3, x - 1, 50, withAlpha('#f0dcff', 0.7), 0.8);
  }
}

function spike(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  const pts = [4, 50, 8 + r() * 4, 20, 14, 4 + r() * 6, 20, 16, 26, 8 + r() * 6, 29, 50];
  poly(ctx, pts);
  fillStroke(ctx, linGrad(ctx, 0, 0, 32, 0, [[0, '#0b0a10'], [0.6, '#211e2c'], [1, '#34304a']]), 1.6);
  line(ctx, 14, 8, 17, 48, withAlpha('#6a5a9a', 0.5), 1);
}

function fork(ctx: Ctx): void {
  // tuning-fork shaped rock that hums
  poly(ctx, [11, 60, 19, 60, 18, 36, 24, 30, 24, 4, 19, 4, 19, 28, 11, 28, 11, 4, 6, 4, 6, 30, 12, 36]);
  fillStroke(ctx, linGrad(ctx, 0, 0, 30, 0, [[0, '#15131c'], [1, '#3a3450']]), 1.6);
  withGlow(ctx, '#2fe6ff', 6, () => {
    line(ctx, 8.5, 6, 8.5, 26, withAlpha('#2fe6ff', 0.7), 1);
    line(ctx, 21.5, 6, 21.5, 26, withAlpha('#2fe6ff', 0.7), 1);
  });
}

function obelisk(ctx: Ctx): void {
  poly(ctx, [10, 88, 28, 88, 26, 14, 19, 4, 12, 14]);
  fillStroke(ctx, linGrad(ctx, 8, 0, 30, 0, [[0, '#0a080c'], [0.6, '#1e1822'], [1, '#2a2230']]), 1.8);
  // speaker cone embedded
  circle(ctx, 19, 58, 6);
  fillStroke(ctx, '#050405', 1.2);
  withGlow(ctx, '#ff2a2a', 8, () => {
    paintSigil(ctx, 19, 30, 7, '#ff2a2a');
  });
}

function ashrock(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  blob(ctx, [4, 24, 8 + r() * 4, 10, 20, 4 + r() * 3, 34, 8, 40, 20, 34, 26, 12, 27]);
  fillStroke(ctx, linGrad(ctx, 0, 0, 0, 28, [[0, '#3a3440'], [1, '#141218']]), 1.4);
  halftone(ctx, 4, 4, 36, 22, withAlpha('#000', 0.35), 2.6, (px) => (22 - px) / 20);
}

function cable(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  ctx.beginPath();
  ctx.moveTo(2, 12);
  ctx.bezierCurveTo(16, 2 + r() * 6, 36, 20, 62, 8 + r() * 6);
  stroke(ctx, PAL.ink, 5);
  ctx.beginPath();
  ctx.moveTo(2, 12);
  ctx.bezierCurveTo(16, 2 + r() * 6, 36, 20, 62, 8 + r() * 6);
  stroke(ctx, '#3a1a24', 3);
  for (let i = 0; i < 3; i++) {
    const x = 12 + i * 18;
    withGlow(ctx, '#ff2a2a', 4, () => {
      circle(ctx, x, 11 + (i % 2) * 2, 1.4);
      ctx.fillStyle = '#ff3a3a';
      ctx.fill();
    });
  }
}

function bones(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < 3; i++) {
    const x = 6 + r() * 26;
    const y = 8 + r() * 10;
    const a = r() * Math.PI;
    const dx = Math.cos(a) * 8;
    const dy = Math.sin(a) * 4;
    line(ctx, x - dx, y - dy, x + dx, y + dy, PAL.ink, 4);
    line(ctx, x - dx, y - dy, x + dx, y + dy, PAL.boneShade, 2.2);
  }
  circle(ctx, 30, 14, 5);
  fillStroke(ctx, PAL.boneShade, 1.2);
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(27.5, 13, 2, 2);
  ctx.fillRect(31, 13, 2, 2);
}

function debris(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  poly(ctx, [4, 26, 10, 8, 30, 4, 50, 12, 44, 28, 20, 30]);
  fillStroke(ctx, linGrad(ctx, 0, 0, 50, 30, [[0, '#8a8e98'], [1, '#3a3c44']]), 1.6);
  for (let i = 0; i < 6; i++) {
    circle(ctx, 12 + i * 6, 14 + (i % 2) * 3, 0.9);
    ctx.fillStyle = '#20222a';
    ctx.fill();
  }
  line(ctx, 10, 20, 44, 18, withAlpha('#b3121d', 0.7), 2);
  distress(ctx, 4, 4, 46, 26, seed, 40);
  if (r() > 0.5) radialGlow(ctx, 36, 12, 8, '#ff6a1f', 0.5);
}

function luggage(ctx: Ctx, seed: number): void {
  const r = rng(seed);
  const c = ['#2a1a3a', '#3a1a14', '#14222a'][Math.floor(r() * 3)];
  poly(ctx, [3, 8, 33, 8, 33, 26, 3, 26]);
  fillStroke(ctx, c, 1.6);
  poly(ctx, [13, 4, 23, 4, 23, 8, 13, 8], false);
  stroke(ctx, PAL.ink, 2);
  // band stickers
  ctx.fillStyle = '#b3121d';
  ctx.fillRect(6, 12, 8, 5);
  ctx.fillStyle = PAL.bone;
  ctx.fillRect(20, 16, 9, 6);
  ctx.fillStyle = PAL.ink;
  ctx.font = 'bold 4px sans-serif';
  ctx.fillText('FP', 22, 21);
}

function amp(ctx: Ctx, seed: number): void {
  poly(ctx, [3, 6, 39, 6, 39, 44, 3, 44]);
  fillStroke(ctx, '#121214', 2);
  ctx.fillStyle = '#1e1e22';
  ctx.fillRect(6, 9, 30, 6);
  for (let i = 0; i < 5; i++) {
    circle(ctx, 9 + i * 6, 12, 1.2);
    ctx.fillStyle = PAL.chrome;
    ctx.fill();
  }
  ctx.save();
  poly(ctx, [6, 17, 36, 17, 36, 41, 6, 41]);
  ctx.clip();
  ctx.fillStyle = '#0a0a0b';
  ctx.fillRect(6, 17, 30, 24);
  for (let y = 17; y < 41; y += 2.5) line(ctx, 6, y, 36, y + 3, withAlpha('#5a5a60', 0.5), 0.6);
  ctx.restore();
  distress(ctx, 3, 6, 36, 38, seed, 30, 'rgba(255,255,255,0.08)');
  line(ctx, 8, 40, 30, 20, withAlpha('#000', 0.9), 1.6);
}

function barrel(ctx: Ctx): void {
  poly(ctx, [5, 12, 25, 12, 25, 36, 5, 36]);
  fillStroke(ctx, '#3a1612', 1.6);
  line(ctx, 5, 18, 25, 18, '#1a0a08', 1.4);
  line(ctx, 5, 30, 25, 30, '#1a0a08', 1.4);
  ellipse(ctx, 15, 12, 10, 3);
  fillStroke(ctx, '#1a0a08', 1.2);
  withGlow(ctx, '#ff6a1f', 10, () => {
    blob(ctx, [8, 12, 11, 2, 14, 8, 17, -2, 20, 7, 22, 12]);
    ctx.fillStyle = '#ff8a2a';
    ctx.fill();
  });
  blob(ctx, [11, 12, 13, 6, 15, 10, 17, 4, 19, 12]);
  ctx.fillStyle = '#ffe07a';
  ctx.fill();
}

// ------------------------------------------------------------------ landmarks

function fuselage(ctx: Ctx): void {
  ctx.save();
  ctx.translate(180, 78);
  ctx.rotate(-0.28);
  // body
  blob(ctx, [-170, -8, -120, -32, 60, -34, 150, -24, 176, -4, 150, 22, 60, 30, -120, 28, -170, 10]);
  fillStroke(ctx, linGrad(ctx, 0, -34, 0, 30, [[0, '#d8d6d0'], [0.45, '#9a9892'], [1, '#3a3834']]), 2.6);
  halftone(ctx, -170, -34, 350, 64, withAlpha('#000', 0.25), 4, (_px, py) => (py + 10) / 40);
  // windows glowing orange (fire inside)
  for (let i = 0; i < 9; i++) {
    const x = -90 + i * 22;
    poly(ctx, [x, -16, x + 10, -16, x + 10, -6, x, -6]);
    fillStroke(ctx, i % 3 === 1 ? '#ff7a2a' : '#2a1a14', 1.2);
    if (i % 3 === 1) radialGlow(ctx, x + 5, -11, 12, '#ff6a1f', 0.5);
  }
  // band livery: red stripe + sigil
  line(ctx, -160, 4, 170, 2, '#8a0f18', 5);
  paintSigil(ctx, 110, -6, 14, '#b3121d');
  // torn end
  poly(ctx, [-170, -8, -178, -18, -168, -2, -182, 4, -170, 10]);
  fillStroke(ctx, '#2a2824', 1.6);
  distress(ctx, -170, -34, 340, 64, 91, 160);
  ctx.restore();
  radialGlow(ctx, 40, 100, 30, '#ff6a1f', 0.35);
}

function wing(ctx: Ctx): void {
  poly(ctx, [6, 50, 70, 20, 186, 8, 180, 22, 90, 50, 20, 70]);
  fillStroke(ctx, linGrad(ctx, 0, 0, 0, 70, [[0, '#c8c6c0'], [1, '#4a4844']]), 2.2);
  line(ctx, 40, 44, 170, 16, withAlpha('#000', 0.35), 1.2);
  distress(ctx, 6, 8, 180, 60, 17, 90);
  poly(ctx, [120, 30, 150, 24, 152, 34, 122, 40]);
  fillStroke(ctx, '#2a2824', 1.2);
}

function spire(ctx: Ctx): void {
  const cx = 140;
  // base platform
  ellipse(ctx, cx, 404, 128, 30);
  fillStroke(ctx, '#0c0a10', 3);
  // spire body: organic alien amplifier tower
  const body = [cx - 70, 400, cx - 40, 250, cx - 60, 170, cx - 22, 70, cx, 6, cx + 22, 70, cx + 60, 170, cx + 40, 250, cx + 70, 400];
  withGlow(ctx, '#ff1a2a', 24, () => {
    poly(ctx, body);
    fillStroke(ctx, linGrad(ctx, cx - 70, 0, cx + 70, 0, [[0, '#07050a'], [0.55, '#1c1020'], [1, '#2e1a2e']]), 3.4);
  });
  ctx.save();
  poly(ctx, body);
  ctx.clip();
  halftone(ctx, cx - 70, 0, 140, 410, withAlpha('#ff1a2a', 0.12), 5, (px, py) => 1 - Math.abs(px - cx) / 60 - py / 900);
  for (let y = 60; y < 400; y += 26) {
    ctx.beginPath();
    ctx.moveTo(cx - 60, y + 10);
    ctx.quadraticCurveTo(cx, y - 8, cx + 60, y + 10);
    stroke(ctx, withAlpha('#ff2a2a', 0.35), 1.4);
  }
  // amp grille slots
  for (let y = 200; y < 380; y += 12) line(ctx, cx - 26, y, cx + 26, y, withAlpha('#000', 0.7), 5);
  ctx.restore();
  // the Harvester eye
  withGlow(ctx, '#ff2a2a', 30, () => {
    ellipse(ctx, cx, 130, 22, 12);
    ctx.fillStyle = '#ff5a5a';
    ctx.fill();
  });
  ellipse(ctx, cx, 130, 5, 11);
  ctx.fillStyle = '#1a0006';
  ctx.fill();
  // fork prongs at the top
  for (const dx of [-26, 26]) {
    poly(ctx, [cx + dx - 5, 90, cx + dx * 1.4, 12, cx + dx * 1.4 + (dx > 0 ? 5 : -5), 16, cx + dx + (dx > 0 ? 7 : -7), 96]);
    fillStroke(ctx, '#1c1020', 2);
  }
}

function capsule(ctx: Ctx): void {
  // siphon capsule glass (the captive member sprite is layered inside)
  ctx.save();
  poly(ctx, [14, 22, 76, 22, 76, 128, 14, 128]);
  ctx.fillStyle = withAlpha('#b8f6ff', 0.1);
  ctx.fill();
  ctx.restore();
  line(ctx, 22, 28, 22, 120, withAlpha('#ffffff', 0.35), 3);
  line(ctx, 28, 30, 28, 90, withAlpha('#ffffff', 0.18), 1.5);
  poly(ctx, [14, 22, 76, 22, 76, 128, 14, 128]);
  stroke(ctx, withAlpha('#d8f8ff', 0.5), 1.6);
  // caps
  poly(ctx, [6, 8, 84, 8, 78, 24, 12, 24]);
  fillStroke(ctx, '#1a1418', 2.4);
  poly(ctx, [6, 142, 84, 142, 78, 126, 12, 126]);
  fillStroke(ctx, '#1a1418', 2.4);
  for (const x of [20, 45, 70]) {
    withGlow(ctx, '#ff2a2a', 6, () => {
      circle(ctx, x, 16, 2.4);
      ctx.fillStyle = '#ff3a3a';
      ctx.fill();
    });
  }
  // tendrils
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(45 + side * 34, 30);
    ctx.bezierCurveTo(45 + side * 48, 60, 45 + side * 30, 100, 45 + side * 44, 140);
    stroke(ctx, PAL.ink, 6);
    ctx.beginPath();
    ctx.moveTo(45 + side * 34, 30);
    ctx.bezierCurveTo(45 + side * 48, 60, 45 + side * 30, 100, 45 + side * 44, 140);
    stroke(ctx, '#5a1a2a', 3.2);
  }
}

function capsuleBase(ctx: Ctx): void {
  ellipse(ctx, 60, 30, 56, 18);
  fillStroke(ctx, '#0e0a10', 2.6);
  ellipse(ctx, 60, 26, 40, 11);
  fillStroke(ctx, '#1e1420', 1.6);
  withGlow(ctx, '#ff2a2a', 10, () => {
    ellipse(ctx, 60, 26, 40, 11);
    stroke(ctx, withAlpha('#ff2a2a', 0.8), 1.6);
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    circle(ctx, 60 + Math.cos(a) * 48, 30 + Math.sin(a) * 14, 2);
    ctx.fillStyle = '#ff3a3a';
    ctx.fill();
  }
}

function portal(ctx: Ctx): void {
  const c = 90;
  radialGlow(ctx, c, c, 90, '#2fe6ff', 0.6);
  for (let i = 0; i < 5; i++) {
    withGlow(ctx, '#ffffff', 10, () => {
      ctx.beginPath();
      ctx.ellipse(c, c, 70 - i * 11, 70 - i * 11, i, 0.2, Math.PI * 1.6);
      stroke(ctx, i % 2 ? withAlpha('#2fe6ff', 0.9) : withAlpha('#ffffff', 0.9), 4 - i * 0.4);
    });
  }
  radialGlow(ctx, c, c, 30, '#ffffff', 1);
}

function barrierPillar(ctx: Ctx): void {
  poly(ctx, [6, 70, 28, 70, 25, 12, 17, 2, 9, 12]);
  fillStroke(ctx, linGrad(ctx, 6, 0, 28, 0, [[0, '#0a070c'], [1, '#2a1a2a']]), 1.8);
  withGlow(ctx, '#ff2a2a', 10, () => {
    line(ctx, 17, 16, 17, 60, '#ff3a3a', 2);
  });
}

function signRegion(ctx: Ctx): void {
  line(ctx, 24, 70, 26, 30, PAL.ink, 7);
  line(ctx, 24, 70, 26, 30, '#3a2a1e', 4);
  line(ctx, 130, 70, 128, 30, PAL.ink, 7);
  line(ctx, 130, 70, 128, 30, '#3a2a1e', 4);
  poly(ctx, [6, 8, 148, 4, 150, 40, 4, 44]);
  fillStroke(ctx, '#2a1e16', 2.4);
  for (let y = 14; y < 42; y += 9) line(ctx, 8, y, 146, y - 2, withAlpha('#000', 0.4), 1);
  distress(ctx, 4, 4, 146, 40, 3, 80, 'rgba(0,0,0,0.3)');
  // skull nailed on top
  circle(ctx, 77, 6, 7);
  fillStroke(ctx, PAL.boneShade, 1.4);
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(73.5, 4, 2.5, 2.5);
  ctx.fillRect(78.5, 4, 2.5, 2.5);
}

function plaque(ctx: Ctx): void {
  poly(ctx, [10, 66, 50, 66, 46, 8, 30, 2, 14, 8]);
  fillStroke(ctx, '#140e18', 2);
  withGlow(ctx, '#ff2a2a', 6, () => {
    const r = rng(12);
    for (let i = 0; i < 6; i++) {
      const y = 16 + i * 8;
      for (let x = 18; x < 42; x += 5) {
        if (r() > 0.35) line(ctx, x, y, x + 2 + r() * 2, y + (r() - 0.5) * 3, withAlpha('#ff4a4a', 0.9), 1.1);
      }
    }
  });
}

function torch(ctx: Ctx): void {
  line(ctx, 10, 46, 10, 16, PAL.ink, 4);
  line(ctx, 10, 46, 10, 16, '#3a2a1e', 2.2);
  withGlow(ctx, '#ff6a1f', 10, () => {
    blob(ctx, [5, 16, 8, 6, 10, 10, 12, 2, 15, 16]);
    ctx.fillStyle = '#ff8a2a';
    ctx.fill();
  });
}

function planeSide(ctx: Ctx): void {
  // small tour jet, side view (intro)
  blob(ctx, [6, 26, 30, 18, 110, 16, 134, 22, 138, 28, 126, 34, 30, 34, 10, 31]);
  fillStroke(ctx, linGrad(ctx, 0, 16, 0, 34, [[0, '#e8e6e0'], [1, '#6a6862']]), 2);
  poly(ctx, [100, 18, 116, 2, 126, 2, 120, 20]);
  fillStroke(ctx, '#c8c6c0', 1.6);
  poly(ctx, [52, 30, 86, 30, 70, 46, 58, 46]);
  fillStroke(ctx, '#a8a6a0', 1.6);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = '#2a3a4a';
    ctx.fillRect(34 + i * 10, 21, 5, 4);
  }
  line(ctx, 14, 29, 130, 27, '#b3121d', 2);
  paintSigil(ctx, 118, 10, 5, '#b3121d');
}

export function registerEnvironmentArt(atlas: ArtAtlas): void {
  atlas.add('lm_plane_side', 140, 50, (ctx) => planeSide(ctx));
  for (let v = 0; v < 3; v++) {
    atlas.add(`d_palm_${v}`, 70, 96, (ctx) => palm(ctx, 11 + v * 7));
    atlas.add(`d_fern_${v}`, 44, 30, (ctx) => fern(ctx, 21 + v * 7));
    atlas.add(`d_spike_${v}`, 32, 52, (ctx) => spike(ctx, 31 + v * 7));
    atlas.add(`d_reed_${v}`, 26, 42, (ctx) => reed(ctx, 41 + v * 7));
    atlas.add(`d_ashrock_${v}`, 44, 30, (ctx) => ashrock(ctx, 51 + v * 7));
    atlas.add(`d_debris_${v}`, 54, 34, (ctx) => debris(ctx, 61 + v * 7));
  }
  for (let v = 0; v < 2; v++) {
    atlas.add(`d_drumtree_${v}`, 54, 84, (ctx) => drumtree(ctx, 71 + v * 7));
    atlas.add(`d_pod_${v}`, 30, 44, (ctx) => pod(ctx, 81 + v * 7));
    atlas.add(`d_horn_${v}`, 42, 62, (ctx) => horn(ctx, 91 + v * 7));
    atlas.add(`d_crystal_${v}`, 34, 54, (ctx) => crystal(ctx, 101 + v * 7));
    atlas.add(`d_cable_${v}`, 64, 22, (ctx) => cable(ctx, 111 + v * 7));
    atlas.add(`d_bones_${v}`, 40, 26, (ctx) => bones(ctx, 121 + v * 7));
    atlas.add(`d_luggage_${v}`, 36, 28, (ctx) => luggage(ctx, 131 + v * 7));
    atlas.add(`d_amp_${v}`, 42, 46, (ctx) => amp(ctx, 141 + v * 7));
  }
  atlas.add('d_pipe_0', 70, 42, (ctx) => pipe(ctx));
  atlas.add('d_fork_0', 30, 62, (ctx) => fork(ctx));
  atlas.add('d_obelisk_0', 38, 92, (ctx) => obelisk(ctx));
  atlas.add('d_barrel_0', 30, 38, (ctx) => barrel(ctx));
  atlas.add('d_torch_0', 20, 48, (ctx) => torch(ctx));
  atlas.add('lm_fuselage', 360, 170, (ctx) => fuselage(ctx));
  atlas.add('lm_wing', 190, 80, (ctx) => wing(ctx));
  atlas.add('lm_spire', 280, 440, (ctx) => spire(ctx));
  atlas.add('lm_capsule', 90, 150, (ctx) => capsule(ctx));
  atlas.add('lm_capsule_base', 120, 50, (ctx) => capsuleBase(ctx));
  atlas.add('lm_portal', 180, 180, (ctx) => portal(ctx));
  atlas.add('lm_pillar', 34, 72, (ctx) => barrierPillar(ctx));
  atlas.add('lm_sign', 154, 72, (ctx) => signRegion(ctx));
  atlas.add('lm_plaque', 60, 70, (ctx) => plaque(ctx));
}

/** Ground grain tile (registered as its own repeating texture). */
export function paintGrainTile(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const r = rng(1234);
  for (let i = 0; i < size * size * 0.02; i++) {
    const x = r() * size;
    const y = r() * size;
    const s = 1 + r() * 3;
    ctx.fillStyle = r() > 0.5 ? `rgba(0,0,0,${0.15 + r() * 0.25})` : `rgba(255,240,220,${0.03 + r() * 0.05})`;
    ctx.fillRect(x, y, s, s * (0.4 + r()));
  }
  // pebbles
  for (let i = 0; i < 26; i++) {
    const x = r() * size;
    const y = r() * size;
    ctx.fillStyle = `rgba(0,0,0,0.25)`;
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 1.5, 3 + r() * 4, 2 + r() * 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(200,190,180,0.07)`;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 + r() * 3, 1.5 + r() * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    let x = r() * size;
    let y = r() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (r() - 0.5) * 30;
      y += (r() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}

export { ellipse };
