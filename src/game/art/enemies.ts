/**
 * Alien fauna art. Silly at first glance, dangerous in motion: every creature
 * is a musical instrument that grew teeth. Distinct silhouettes and palettes
 * keep them readable on a phone.
 */
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
  poly,
  radialGlow,
  rng,
  stroke,
  withAlpha,
  withGlow,
  type Ctx,
} from './paint';

const EYE = '#ff2a2a';

function eyes(ctx: Ctx, pts: [number, number][], r: number, color = EYE): void {
  withGlow(ctx, color, r * 3, () => {
    for (const [x, y] of pts) {
      circle(ctx, x, y, r);
      ctx.fillStyle = color;
      ctx.fill();
    }
  });
  ctx.fillStyle = '#fff6d0';
  for (const [x, y] of pts) {
    circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.35);
    ctx.fill();
  }
}

function teeth(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, n: number, size: number, up: boolean): void {
  ctx.fillStyle = PAL.bone;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const ax = x1 + (x2 - x1) * t0;
    const ay = y1 + (y2 - y1) * t0;
    const bx = x1 + (x2 - x1) * t1;
    const by = y1 + (y2 - y1) * t1;
    poly(ctx, [ax, ay, bx, by, (ax + bx) / 2, (ay + by) / 2 + (up ? -size : size)]);
    ctx.fill();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = PAL.ink;
    ctx.stroke();
  }
}

function spiderLegs(ctx: Ctx, cx: number, cy: number, spread: number, len: number, frame: number, color: string, n = 3): void {
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < n; i++) {
      const phase = (i + frame) % 2 === 0 ? 1 : -1;
      const bx = cx + side * (spread * 0.3 + i * 2);
      const by = cy + i * 3 - 2;
      const kx = cx + side * (spread + i * 3);
      const ky = by - 6 + phase * 2;
      const fx = cx + side * (spread + 5 + i * 4);
      const fy = by + len - 2 + phase * 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, fy);
      stroke(ctx, PAL.ink, 3.4);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, fy);
      stroke(ctx, color, 1.6);
    }
  }
}

// ------------------------------------------------------------------ regulars

function paintTick(ctx: Ctx, f: number): void {
  const cx = 15;
  const cy = 13;
  spiderLegs(ctx, cx, cy + 2, 7, 9, f, '#5a3a2a');
  // drum shell
  poly(ctx, [cx - 10, cy - 3, cx + 10, cy - 3, cx + 10, cy + 5, cx - 10, cy + 5]);
  fillStroke(ctx, '#8a1a14', 1.4);
  for (let i = -8; i <= 8; i += 4) line(ctx, cx + i, cy - 2, cx + i, cy + 4, withAlpha(PAL.chrome, 0.8), 0.8);
  ellipse(ctx, cx, cy + 5, 10, 3);
  stroke(ctx, PAL.ink, 1.2);
  // drumhead with a mouth
  ellipse(ctx, cx, cy - 3, 10, 4);
  fillStroke(ctx, PAL.bone, 1.4);
  ellipse(ctx, cx, cy - 3, 6, f ? 2.2 : 1.4);
  fillStroke(ctx, '#2a0606', 0.8);
  teeth(ctx, cx - 5, cy - 3.2, cx + 5, cy - 3.2, 5, 1.2, false);
  eyes(ctx, [[cx - 7, cy + 1], [cx + 7, cy + 1]], 1.3);
}

function paintMaraca(ctx: Ctx, f: number): void {
  const cx = 22;
  const cy = 22 + (f ? 1 : 0);
  const tilt = f ? 0.12 : -0.08;
  spiderLegs(ctx, cx, cy + 12, 8, 11, f, '#3a1a14');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  // handle / stalk
  poly(ctx, [-3, 12, 3, 12, 2, 22, -2, 22]);
  fillStroke(ctx, '#6b3a1a', 1.3);
  // maraca head (egg)
  const egg = () => blob(ctx, [0, -19, 12, -14, 15, -2, 11, 11, 0, 15, -11, 11, -15, -2, -12, -14]);
  withGlow(ctx, '#ff3a1a', 8, () => {
    egg();
    fillStroke(ctx, '#c2261d', 1.8);
  });
  ctx.save();
  egg();
  ctx.clip();
  // painted zig-zag bands
  const bands: [number, string][] = [[-12, '#ff8a1a'], [-5, '#101010'], [2, PAL.bone], [8, '#101010']];
  for (const [yy, c] of bands) {
    ctx.beginPath();
    ctx.moveTo(-16, yy);
    for (let x = -16; x <= 16; x += 4) ctx.lineTo(x, yy + ((x / 4) % 2 === 0 ? -2 : 2));
    ctx.lineTo(16, yy + 3);
    for (let x = 16; x >= -16; x -= 4) ctx.lineTo(x, yy + 3 + ((x / 4) % 2 === 0 ? -2 : 2));
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
  }
  halftone(ctx, -16, -20, 32, 36, withAlpha('#000', 0.35), 2.4, (px) => (-px + 4) / 16);
  ctx.restore();
  egg();
  stroke(ctx, PAL.ink, 1.8);
  // mouth
  blob(ctx, [-10, 2, 0, -1, 10, 2, 8, 10, 0, 13, -8, 10]);
  fillStroke(ctx, '#1a0303', 1.2);
  teeth(ctx, -9, 3, 9, 3, 7, 3, false);
  teeth(ctx, -7, 10.5, 7, 10.5, 5, 2.6, true);
  eyes(ctx, [[-5, -7], [5, -7]], 2);
  ctx.restore();
  // rattle lines
  if (f) {
    line(ctx, 3, 5, 7, 2, withAlpha(PAL.bone, 0.8), 1.2);
    line(ctx, 41, 5, 37, 2, withAlpha(PAL.bone, 0.8), 1.2);
  }
}

function paintCastanet(ctx: Ctx, f: number): void {
  const cx = 24;
  const cy = 22;
  spiderLegs(ctx, cx, cy + 3, 9, 8, f, '#4a1410');
  // body
  blob(ctx, [cx - 12, cy, cx - 6, cy - 7, cx + 6, cy - 7, cx + 12, cy, cx + 8, cy + 6, cx - 8, cy + 6]);
  fillStroke(ctx, '#7a1410', 1.6);
  halftone(ctx, cx - 12, cy - 7, 24, 13, withAlpha('#000', 0.35), 2.2, (px) => (cx - px) / 12);
  // eye stalks
  line(ctx, cx - 3, cy - 6, cx - 5, cy - 13, PAL.ink, 1.8);
  line(ctx, cx + 3, cy - 6, cx + 5, cy - 13, PAL.ink, 1.8);
  eyes(ctx, [[cx - 5, cy - 14], [cx + 5, cy - 14]], 1.8, '#ffcf3a');
  // castanet claws
  const open = f ? 0.55 : 0.1;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 16, cy - 4);
    ctx.scale(side, 1);
    for (const half of [-1, 1]) {
      ctx.save();
      ctx.rotate(half * open * 0.6);
      blob(ctx, [0, 0, 5, -2 * half - 4 * half, 10, -3 * half, 10, 0, 5, 1 * half]);
      ellipse(ctx, 5, -2.5 * half, 6, 3.4);
      fillStroke(ctx, '#3a1a0c', 1.4);
      ellipse(ctx, 5, -2.5 * half, 4.3, 2.1);
      stroke(ctx, '#a0521a', 0.8);
      ctx.restore();
    }
    ctx.restore();
  }
}

function paintTambourine(ctx: Ctx, f: number): void {
  const cx = 23;
  const cy = 23;
  const rot = f ? Math.PI / 6 : 0;
  // bone blades
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 14, cy + 4);
    ctx.quadraticCurveTo(cx + side * 24, cy - 2, cx + side * 20, cy - 16);
    ctx.quadraticCurveTo(cx + side * 19, cy - 4, cx + side * 11, cy + 1);
    ctx.closePath();
    fillStroke(ctx, PAL.bone, 1.3);
  }
  // hoop
  circle(ctx, cx, cy, 17);
  fillStroke(ctx, '#caa36a', 2);
  circle(ctx, cx, cy, 12.5);
  fillStroke(ctx, '#2a0810', 1.6);
  // membrane eye
  withGlow(ctx, EYE, 8, () => {
    ellipse(ctx, cx, cy, 7, 5);
    ctx.fillStyle = '#ffdfa8';
    ctx.fill();
  });
  ellipse(ctx, cx, cy, 2.2, 4.4);
  ctx.fillStyle = '#c0101a';
  ctx.fill();
  teeth(ctx, cx - 11, cy + 6, cx + 11, cy + 6, 7, 3, true);
  // jingles
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * Math.PI * 2;
    const jx = cx + Math.cos(a) * 15;
    const jy = cy + Math.sin(a) * 15;
    ellipse(ctx, jx, jy, 3.8, 2.4, a);
    fillStroke(ctx, PAL.brass, 1);
    line(ctx, jx - 1, jy - 0.5, jx + 1.2, jy - 0.8, '#fff3b0', 0.8);
  }
}

function paintMantis(ctx: Ctx, f: number): void {
  const cx = 32;
  const cy = 26;
  const wingA = f ? -0.5 : -0.15;
  // cymbal wings
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 6, cy - 4);
    ctx.rotate(side * wingA);
    const wx = side * 16;
    withGlow(ctx, '#ffcf3a', 5, () => {
      ellipse(ctx, wx, 0, 15, 9);
      fillStroke(ctx, linGrad(ctx, wx - 15, -9, wx + 15, 9, [[0, '#f7d56a'], [0.5, '#b8861f'], [1, '#e8c04f']]), 1.6);
    });
    for (let r = 4; r < 15; r += 3.5) {
      ellipse(ctx, wx, 0, r, r * 0.6);
      stroke(ctx, withAlpha('#5a3d08', 0.55), 0.6);
    }
    circle(ctx, wx, 0, 2);
    fillStroke(ctx, '#3a2a08', 0.8);
    ctx.restore();
  }
  // body
  blob(ctx, [cx - 4, cy - 8, cx + 4, cy - 8, cx + 5, cy + 6, cx + 2, cy + 18, cx - 2, cy + 18, cx - 5, cy + 6]);
  fillStroke(ctx, '#8a0f18', 1.6);
  for (let i = 0; i < 3; i++) line(ctx, cx - 4, cy + 5 + i * 4, cx + 4, cy + 5 + i * 4, withAlpha('#000', 0.5), 0.8);
  // scythe arms
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 3, cy - 4);
    ctx.lineTo(cx + side * 9, cy + 2);
    ctx.lineTo(cx + side * 6, cy + 10);
    stroke(ctx, PAL.ink, 3);
    ctx.beginPath();
    ctx.moveTo(cx + side * 3, cy - 4);
    ctx.lineTo(cx + side * 9, cy + 2);
    ctx.lineTo(cx + side * 6, cy + 10);
    stroke(ctx, '#c02a2a', 1.4);
  }
  // head
  poly(ctx, [cx - 7, cy - 12, cx, cy - 18, cx + 7, cy - 12, cx, cy - 6]);
  fillStroke(ctx, '#a0141c', 1.5);
  eyes(ctx, [[cx - 3.5, cy - 12], [cx + 3.5, cy - 12]], 1.8);
  teeth(ctx, cx - 3, cy - 8, cx + 3, cy - 8, 3, 1.6, false);
}

function paintTuba(ctx: Ctx, f: number): void {
  const cx = 38;
  const cy = 40;
  const inflate = f ? 1.08 : 1;
  // stubby legs
  for (const lx of [-16, -6, 6, 16]) {
    poly(ctx, [cx + lx - 3, cy + 18, cx + lx + 3, cy + 18, cx + lx + 4, cy + 30, cx + lx - 4, cy + 30]);
    fillStroke(ctx, '#6b4a18', 1.4);
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(inflate, inflate);
  // coiled brass body
  withGlow(ctx, '#ffcf3a', 6, () => {
    ellipse(ctx, 0, 4, 28, 22);
    fillStroke(ctx, linGrad(ctx, -28, -18, 28, 26, [[0, '#f0c75a'], [0.45, '#b7861f'], [1, '#5a3a08']]), 2);
  });
  ellipse(ctx, 0, 4, 19, 14);
  stroke(ctx, withAlpha('#5a3a08', 0.8), 3);
  ellipse(ctx, 0, 4, 19, 14);
  stroke(ctx, withAlpha('#fff0b0', 0.5), 1);
  // valves
  for (const vx of [-6, 0, 6]) {
    poly(ctx, [vx - 1.8, -16, vx + 1.8, -16, vx + 1.8, -8, vx - 1.8, -8]);
    fillStroke(ctx, PAL.chrome, 1);
  }
  // bell mouth
  const bw = f ? 18 : 15;
  ellipse(ctx, 0, 12, bw, bw * 0.62);
  fillStroke(ctx, '#e0b544', 2);
  ellipse(ctx, 0, 12, bw - 4, bw * 0.62 - 3.5);
  fillStroke(ctx, '#120404', 1.2);
  radialGlow(ctx, 0, 13, bw - 5, '#ff4a1a', f ? 0.7 : 0.35);
  // teeth ring
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tx = Math.cos(a) * (bw - 4.5);
    const ty = 12 + Math.sin(a) * (bw * 0.62 - 3.8);
    poly(ctx, [tx - 1.4, ty, tx + 1.4, ty, tx * 0.8, 12 + (ty - 12) * 0.75]);
    ctx.fillStyle = PAL.bone;
    ctx.fill();
  }
  eyes(ctx, [[-9, -12], [9, -12]], 2.3);
  ctx.restore();
}

function paintMetronome(ctx: Ctx): void {
  const cx = 24;
  // pyramid body
  poly(ctx, [cx - 5, 6, cx + 5, 6, cx + 18, 60, cx - 18, 60]);
  fillStroke(ctx, linGrad(ctx, cx - 18, 0, cx + 18, 0, [[0, '#120e1a'], [0.6, '#2a2236'], [1, '#3a3050']]), 2);
  poly(ctx, [cx - 3, 12, cx + 3, 12, cx + 10, 52, cx - 10, 52]);
  fillStroke(ctx, '#0a0810', 1);
  // scale ticks
  for (let i = 0; i < 8; i++) {
    const y = 16 + i * 4.5;
    const w = 3 + i * 0.9;
    line(ctx, cx - w, y, cx + w, y, withAlpha('#8a7cff', 0.6), 0.7);
  }
  // brass base + trim
  poly(ctx, [cx - 20, 58, cx + 20, 58, cx + 18, 64, cx - 18, 64]);
  fillStroke(ctx, PAL.brass, 1.4);
  // eye at the top
  withGlow(ctx, '#8a7cff', 8, () => {
    ellipse(ctx, cx, 10, 5, 3.4);
    ctx.fillStyle = '#e8e2ff';
    ctx.fill();
  });
  ellipse(ctx, cx, 10, 1.6, 3);
  ctx.fillStyle = '#3a0a5a';
  ctx.fill();
}

function paintPendulum(ctx: Ctx, w: number, h: number, color: string): void {
  const cx = w / 2;
  line(ctx, cx, 2, cx, h - 4, PAL.ink, 3.4);
  line(ctx, cx, 2, cx, h - 4, PAL.chrome, 1.6);
  poly(ctx, [cx - w * 0.35, h * 0.35, cx + w * 0.35, h * 0.35, cx + w * 0.25, h * 0.35 + w * 0.6, cx - w * 0.25, h * 0.35 + w * 0.6]);
  fillStroke(ctx, PAL.brass, 1.4);
  withGlow(ctx, color, 8, () => {
    circle(ctx, cx, h - 5, w * 0.22);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

// ------------------------------------------------------------------ minibosses

function paintMaracon(ctx: Ctx, f: number): void {
  const cx = 80;
  const cy = 78;
  // many legs
  for (let i = 0; i < 5; i++) {
    for (const side of [-1, 1]) {
      const ph = (i + f) % 2 ? 4 : -4;
      ctx.beginPath();
      ctx.moveTo(cx + side * (14 + i * 4), cy + 18 + i * 2);
      ctx.lineTo(cx + side * (42 + i * 5), cy + 6 + i * 4 + ph);
      ctx.lineTo(cx + side * (52 + i * 5), cy + 40 + i * 3 + ph);
      stroke(ctx, PAL.ink, 7);
      ctx.beginPath();
      ctx.moveTo(cx + side * (14 + i * 4), cy + 18 + i * 2);
      ctx.lineTo(cx + side * (42 + i * 5), cy + 6 + i * 4 + ph);
      ctx.lineTo(cx + side * (52 + i * 5), cy + 40 + i * 3 + ph);
      stroke(ctx, '#4a1a10', 3.6);
    }
  }
  // two rattle arms (maracas)
  for (const side of [-1, 1]) {
    const up = (side === 1) === (f === 1);
    ctx.save();
    ctx.translate(cx + side * 40, cy - 22 + (up ? -10 : 4));
    ctx.rotate(side * (up ? 0.5 : 0.2));
    poly(ctx, [-3, 10, 3, 10, 2, 34, -2, 34]);
    fillStroke(ctx, '#6b3a1a', 2);
    withGlow(ctx, '#ff5a1a', 10, () => {
      blob(ctx, [0, -20, 13, -12, 14, 2, 8, 12, -8, 12, -14, 2, -13, -12]);
      fillStroke(ctx, '#ff7a1a', 2.4);
    });
    for (const yy of [-10, -2, 6]) line(ctx, -12, yy, 12, yy + 2, '#101010', 2.4);
    ctx.restore();
  }
  // giant maraca body
  const egg = () => blob(ctx, [cx, cy - 58, cx + 38, cy - 40, cx + 46, cy, cx + 34, cy + 34, cx, cy + 44, cx - 34, cy + 34, cx - 46, cy, cx - 38, cy - 40]);
  withGlow(ctx, '#ff2a1a', 18, () => {
    egg();
    fillStroke(ctx, '#b3121d', 3.4);
  });
  ctx.save();
  egg();
  ctx.clip();
  const bands: [number, string][] = [[-44, '#ff8a1a'], [-28, '#101010'], [-12, PAL.bone], [4, '#101010'], [20, '#ff8a1a']];
  for (const [yy, c] of bands) {
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy + yy);
    for (let x = -50; x <= 50; x += 8) ctx.lineTo(cx + x, cy + yy + ((x / 8) % 2 === 0 ? -4 : 4));
    ctx.lineTo(cx + 50, cy + yy + 7);
    for (let x = 50; x >= -50; x -= 8) ctx.lineTo(cx + x, cy + yy + 7 + ((x / 8) % 2 === 0 ? -4 : 4));
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
  }
  halftone(ctx, cx - 50, cy - 60, 100, 110, withAlpha('#000', 0.4), 4, (px) => (cx - px + 10) / 50);
  ctx.restore();
  egg();
  stroke(ctx, PAL.ink, 3.4);
  // crown of spikes
  for (let i = -3; i <= 3; i++) {
    poly(ctx, [cx + i * 9 - 4, cy - 52 + Math.abs(i) * 3, cx + i * 11, cy - 70 + Math.abs(i) * 5, cx + i * 9 + 4, cy - 52 + Math.abs(i) * 3]);
    fillStroke(ctx, PAL.bone, 1.6);
  }
  // mouth
  blob(ctx, [cx - 30, cy + 4, cx, cy - 4 - f * 3, cx + 30, cy + 4, cx + 22, cy + 28, cx, cy + 34, cx - 22, cy + 28]);
  fillStroke(ctx, '#1a0303', 2.4);
  teeth(ctx, cx - 28, cy + 5, cx + 28, cy + 5, 10, 8, false);
  teeth(ctx, cx - 20, cy + 29, cx + 20, cy + 29, 7, 7, true);
  radialGlow(ctx, cx, cy + 18, 14, '#ff3a1a', 0.6);
  eyes(ctx, [[cx - 16, cy - 20], [cx + 16, cy - 20], [cx, cy - 32]], 4.4);
}

function paintBelcher(ctx: Ctx, f: number): void {
  const cx = 90;
  const cy = 88;
  // legs
  for (const lx of [-40, -18, 18, 40]) {
    poly(ctx, [cx + lx - 7, cy + 30, cx + lx + 7, cy + 30, cx + lx + 9, cy + 62, cx + lx - 9, cy + 62]);
    fillStroke(ctx, '#5a3a10', 2);
  }
  // huge coiled body
  withGlow(ctx, '#ffcf3a', 12, () => {
    ellipse(ctx, cx, cy, 70, 52);
    fillStroke(ctx, linGrad(ctx, cx - 70, cy - 50, cx + 70, cy + 50, [[0, '#f6d26a'], [0.4, '#c08f22'], [1, '#4a2e06']]), 3.4);
  });
  for (let r = 0; r < 3; r++) {
    ellipse(ctx, cx - 6 + r * 4, cy + 4, 56 - r * 14, 40 - r * 10);
    stroke(ctx, withAlpha('#4a2e06', 0.8), 5);
    ellipse(ctx, cx - 6 + r * 4, cy + 4, 56 - r * 14, 40 - r * 10);
    stroke(ctx, withAlpha('#fff0b0', 0.4), 1.5);
  }
  // pipes/valves on the back
  for (let i = 0; i < 4; i++) {
    const vx = cx - 30 + i * 20;
    poly(ctx, [vx - 4, cy - 64, vx + 4, cy - 64, vx + 4, cy - 40, vx - 4, cy - 40]);
    fillStroke(ctx, PAL.chrome, 1.6);
    ellipse(ctx, vx, cy - 64, 6, 2.6);
    fillStroke(ctx, '#e8e8f0', 1.2);
  }
  // giant bell (mouth), facing the camera
  const bw = f ? 44 : 38;
  withGlow(ctx, '#ff6a1a', 14, () => {
    ellipse(ctx, cx + 4, cy + 18, bw, bw * 0.66);
    fillStroke(ctx, '#e6b84a', 3.4);
  });
  ellipse(ctx, cx + 4, cy + 18, bw - 8, bw * 0.66 - 7);
  fillStroke(ctx, '#140404', 2);
  radialGlow(ctx, cx + 4, cy + 20, bw - 8, '#ff5a1a', f ? 0.85 : 0.45);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const tx = cx + 4 + Math.cos(a) * (bw - 9);
    const ty = cy + 18 + Math.sin(a) * (bw * 0.66 - 8);
    poly(ctx, [tx - 3, ty, tx + 3, ty, cx + 4 + (tx - cx - 4) * 0.78, cy + 18 + (ty - cy - 18) * 0.72]);
    ctx.fillStyle = PAL.bone;
    ctx.fill();
  }
  eyes(ctx, [[cx - 38, cy - 22], [cx + 42, cy - 24]], 5);
}

function paintPercussionist(ctx: Ctx, f: number): void {
  const cx = 85;
  const cy = 84;
  // six arms with sticks
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const up = (i + f + (side > 0 ? 1 : 0)) % 2 === 0;
      const sx = cx + side * 22;
      const sy = cy - 20 + i * 16;
      const ex = cx + side * (54 + i * 6);
      const ey = sy + (up ? -26 : 4);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cx + side * 42, sy - 10, ex, ey);
      stroke(ctx, PAL.ink, 8);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cx + side * 42, sy - 10, ex, ey);
      stroke(ctx, '#2a4a58', 4.4);
      const a = up ? -Math.PI / 2 + side * 0.4 : side * 0.9;
      const tx = ex + Math.cos(a) * 22;
      const ty = ey + Math.sin(a) * 22;
      line(ctx, ex, ey, tx, ty, PAL.ink, 4);
      line(ctx, ex, ey, tx, ty, '#e8d3a8', 2);
      withGlow(ctx, '#2fe6ff', 8, () => {
        circle(ctx, tx, ty, 2.6);
        ctx.fillStyle = '#2fe6ff';
        ctx.fill();
      });
    }
  }
  // body: stacked drum kit organism
  for (const [dx, dy, r] of [[-26, 30, 20], [26, 30, 20], [0, 36, 26]] as [number, number, number][]) {
    poly(ctx, [cx + dx - r, cy + dy - 8, cx + dx + r, cy + dy - 8, cx + dx + r, cy + dy + 10, cx + dx - r, cy + dy + 10]);
    fillStroke(ctx, '#0d3440', 2);
    ellipse(ctx, cx + dx, cy + dy - 8, r, r * 0.36);
    fillStroke(ctx, PAL.bone, 2);
    ellipse(ctx, cx + dx, cy + dy - 8, r, r * 0.36);
    stroke(ctx, '#2fe6ff', 1.2);
  }
  blob(ctx, [cx - 26, cy - 34, cx, cy - 44, cx + 26, cy - 34, cx + 30, cy + 4, cx + 18, cy + 22, cx - 18, cy + 22, cx - 30, cy + 4]);
  fillStroke(ctx, '#123a48', 3);
  halftone(ctx, cx - 30, cy - 44, 60, 66, withAlpha('#000', 0.4), 3.4, (px) => (cx - px + 6) / 30);
  // cymbal crown
  withGlow(ctx, '#ffcf3a', 8, () => {
    ellipse(ctx, cx, cy - 50, 34, 9);
    fillStroke(ctx, '#d9a72b', 2);
  });
  for (let r = 8; r < 34; r += 7) {
    ellipse(ctx, cx, cy - 50, r, r * 0.26);
    stroke(ctx, withAlpha('#5a3d08', 0.5), 0.8);
  }
  // face
  blob(ctx, [cx - 14, cy - 18, cx + 14, cy - 18, cx + 10, cy + 6, cx - 10, cy + 6]);
  fillStroke(ctx, '#1a0303', 2);
  teeth(ctx, cx - 12, cy - 16, cx + 12, cy - 16, 8, 5, false);
  eyes(ctx, [[cx - 12, cy - 28], [cx, cy - 32], [cx + 12, cy - 28]], 3.6, '#2fe6ff');
}

function paintWarden(ctx: Ctx): void {
  const cx = 70;
  // tall pyramid body
  poly(ctx, [cx - 12, 14, cx + 12, 14, cx + 58, 172, cx - 58, 172]);
  fillStroke(ctx, linGrad(ctx, cx - 58, 0, cx + 58, 0, [[0, '#0e0a16'], [0.55, '#2a2240'], [1, '#463a6a']]), 3.4);
  poly(ctx, [cx - 8, 30, cx + 8, 30, cx + 34, 150, cx - 34, 150]);
  fillStroke(ctx, '#07050c', 2);
  for (let i = 0; i < 14; i++) {
    const y = 38 + i * 8;
    const w = 8 + i * 1.9;
    line(ctx, cx - w, y, cx + w, y, withAlpha('#8a7cff', i % 4 === 0 ? 0.9 : 0.45), i % 4 === 0 ? 1.6 : 0.8);
  }
  poly(ctx, [cx - 64, 168, cx + 64, 168, cx + 60, 186, cx - 60, 186]);
  fillStroke(ctx, PAL.brass, 2.4);
  // sigil + giant eye
  withGlow(ctx, '#8a7cff', 16, () => {
    ellipse(ctx, cx, 30, 14, 9);
    ctx.fillStyle = '#efeaff';
    ctx.fill();
  });
  ellipse(ctx, cx, 30, 4, 8);
  ctx.fillStyle = '#3a0a5a';
  ctx.fill();
  // arms
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 30, 100);
    ctx.quadraticCurveTo(cx + side * 62, 80, cx + side * 66, 120);
    stroke(ctx, PAL.ink, 8);
    ctx.beginPath();
    ctx.moveTo(cx + side * 30, 100);
    ctx.quadraticCurveTo(cx + side * 62, 80, cx + side * 66, 120);
    stroke(ctx, '#3a2f58', 4.4);
    for (let c = 0; c < 3; c++) line(ctx, cx + side * 66, 120, cx + side * (62 + c * 5), 130, PAL.bone, 2);
  }
}

// ------------------------------------------------------------------ final boss

function paintMaestroBody(ctx: Ctx): void {
  const cx = 120;
  // tattered robe
  const robe = [cx - 20, 40, cx + 20, 40, cx + 46, 150, cx + 70, 290, cx + 40, 272, cx + 20, 296, cx, 276, cx - 22, 298, cx - 42, 274, cx - 70, 292, cx - 46, 150];
  withGlow(ctx, '#ff1a2a', 18, () => {
    poly(ctx, robe);
    fillStroke(ctx, linGrad(ctx, 0, 40, 0, 300, [[0, '#1a0a18'], [0.6, '#0c0610'], [1, '#050306']]), 3);
  });
  ctx.save();
  poly(ctx, robe);
  ctx.clip();
  halftone(ctx, cx - 70, 40, 140, 260, withAlpha('#ff1a2a', 0.14), 5, (px, py) => 1 - Math.abs(px - cx) / 70 - (py - 40) / 500);
  // sigil lines down the robe
  for (const dx of [-24, 0, 24]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * 0.5, 60);
    ctx.lineTo(cx + dx, 280);
    withGlow(ctx, '#ff2a2a', 6, () => stroke(ctx, withAlpha('#ff2a2a', 0.8), 1.8));
  }
  for (let y = 90; y < 270; y += 34) {
    circle(ctx, cx, y, 6);
    withGlow(ctx, '#ff2a2a', 6, () => stroke(ctx, '#ff3a3a', 1.6));
  }
  ctx.restore();
  // spread arms with long fingers
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 18, 56);
    ctx.quadraticCurveTo(cx + side * 70, 50, cx + side * 104, 88);
    stroke(ctx, PAL.ink, 14);
    ctx.beginPath();
    ctx.moveTo(cx + side * 18, 56);
    ctx.quadraticCurveTo(cx + side * 70, 50, cx + side * 104, 88);
    stroke(ctx, '#1a0a18', 10);
    // sleeve tatters
    for (let i = 0; i < 4; i++) {
      const tx = cx + side * (50 + i * 12);
      poly(ctx, [tx, 60 + i * 5, tx + side * 8, 64 + i * 6, tx + side * 3, 92 + i * 4]);
      fillStroke(ctx, '#12070f', 1.4);
    }
    for (let fgr = 0; fgr < 4; fgr++) {
      line(ctx, cx + side * 104, 88, cx + side * (110 + fgr * 3), 100 + fgr * 4, PAL.ink, 3.4);
      line(ctx, cx + side * 104, 88, cx + side * (110 + fgr * 3), 100 + fgr * 4, '#c9bfd6', 1.4);
    }
  }
  // siphon cable ports on the shoulders
  for (const side of [-1, 1]) {
    circle(ctx, cx + side * 26, 52, 7);
    fillStroke(ctx, '#2a1a24', 2);
    withGlow(ctx, '#ff2a2a', 8, () => {
      circle(ctx, cx + side * 26, 52, 3);
      ctx.fillStyle = '#ff3a3a';
      ctx.fill();
    });
  }
}

function paintMaestroHead(ctx: Ctx): void {
  const cx = 35;
  // tuning-fork crown
  withGlow(ctx, '#ffcf3a', 10, () => {
    for (const dx of [-14, 0, 14]) {
      const h = dx === 0 ? 34 : 26;
      poly(ctx, [cx + dx - 5, 36, cx + dx - 5, 36 - h, cx + dx - 2, 36 - h, cx + dx - 2, 32, cx + dx + 2, 32, cx + dx + 2, 36 - h, cx + dx + 5, 36 - h, cx + dx + 5, 36]);
      fillStroke(ctx, linGrad(ctx, cx + dx - 5, 0, cx + dx + 5, 0, [[0, '#8a6412'], [0.5, '#ffe28a'], [1, '#a07a1a']]), 1.6);
    }
  });
  poly(ctx, [cx - 22, 34, cx + 22, 34, cx + 18, 42, cx - 18, 42]);
  fillStroke(ctx, PAL.brass, 1.8);
  // faceless elongated mask
  blob(ctx, [cx - 15, 42, cx + 15, 42, cx + 16, 62, cx + 8, 86, cx, 90, cx - 8, 86, cx - 16, 62]);
  fillStroke(ctx, linGrad(ctx, cx - 16, 0, cx + 16, 0, [[0, '#8f8898'], [0.5, '#ece6f2'], [1, '#9a90a6']]), 2.2);
  // void mouth line + eye slits (red)
  withGlow(ctx, '#ff1a2a', 10, () => {
    poly(ctx, [cx - 10, 56, cx - 3, 58, cx - 10, 59]);
    ctx.fillStyle = '#ff2a2a';
    ctx.fill();
    poly(ctx, [cx + 10, 56, cx + 3, 58, cx + 10, 59]);
    ctx.fill();
  });
  poly(ctx, [cx - 5, 72, cx + 5, 72, cx + 3, 84, cx - 3, 84]);
  fillStroke(ctx, '#0a0508', 1);
}

function paintBaton(ctx: Ctx): void {
  withGlow(ctx, '#ff2a2a', 10, () => {
    poly(ctx, [4, 7, 100, 5.5, 108, 7, 100, 8.5]);
    fillStroke(ctx, '#f0e6ff', 1.4);
  });
  poly(ctx, [2, 4, 18, 4, 18, 10, 2, 10]);
  fillStroke(ctx, '#2a1a24', 1.4);
  circle(ctx, 106, 7, 3);
  ctx.fillStyle = '#ff5a5a';
  ctx.fill();
}

function paintHalo(ctx: Ctx, size: number): void {
  const c = size / 2;
  withGlow(ctx, '#ff1a2a', 20, () => {
    circle(ctx, c, c, c - 14);
    stroke(ctx, '#b3121d', 7);
  });
  circle(ctx, c, c, c - 26);
  stroke(ctx, withAlpha('#ff3a3a', 0.6), 1.5);
  const r = rng(77);
  ctx.fillStyle = '#ff5a5a';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = c + Math.cos(a) * (c - 20);
    const y = c + Math.sin(a) * (c - 20);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillRect(-1, -4, 2, 3 + r() * 5);
    ctx.fillRect(-3, -1, 6, 1.5);
    ctx.restore();
  }
}

function paintCore(ctx: Ctx, size: number): void {
  const c = size / 2;
  radialGlow(ctx, c, c, c, '#ff2a2a', 0.9);
  blob(ctx, [c, c - 16, c + 12, c - 6, c + 10, c + 10, c, c + 16, c - 10, c + 10, c - 12, c - 6]);
  fillStroke(ctx, '#ff5a5a', 2);
  blob(ctx, [c, c - 8, c + 6, c - 2, c + 5, c + 6, c, c + 9, c - 5, c + 6, c - 6, c - 2]);
  ctx.fillStyle = '#fff0f0';
  ctx.fill();
}

function paintOrgan(ctx: Ctx): void {
  // amplifier-like siphon organ
  poly(ctx, [8, 20, 82, 20, 86, 116, 4, 116]);
  fillStroke(ctx, '#1a1016', 2.6);
  // grille
  ctx.save();
  poly(ctx, [14, 28, 76, 28, 78, 96, 12, 96]);
  ctx.clip();
  ctx.fillStyle = '#0a0608';
  ctx.fillRect(0, 0, 90, 120);
  for (let y = 28; y < 96; y += 4) line(ctx, 10, y, 80, y + 2, withAlpha('#ff2a2a', 0.18), 1);
  radialGlow(ctx, 45, 50, 22, '#ff2a2a', 0.8);
  radialGlow(ctx, 45, 80, 16, '#ff2a2a', 0.6);
  ctx.restore();
  circle(ctx, 45, 50, 14);
  stroke(ctx, '#3a0a10', 3);
  circle(ctx, 45, 80, 10);
  stroke(ctx, '#3a0a10', 3);
  // fleshy tubes on top
  for (const tx of [20, 45, 70]) {
    ctx.beginPath();
    ctx.moveTo(tx, 20);
    ctx.quadraticCurveTo(tx + 6, 6, tx - 2, 2);
    stroke(ctx, PAL.ink, 6);
    ctx.beginPath();
    ctx.moveTo(tx, 20);
    ctx.quadraticCurveTo(tx + 6, 6, tx - 2, 2);
    stroke(ctx, '#5a1a2a', 3.4);
  }
}

function paintAnchor(ctx: Ctx): void {
  const cx = 22;
  poly(ctx, [cx - 16, 86, cx + 16, 86, cx + 10, 70, cx - 10, 70]);
  fillStroke(ctx, '#1a1016', 2);
  withGlow(ctx, '#ff2a2a', 12, () => {
    poly(ctx, [cx, 4, cx + 9, 30, cx + 6, 72, cx - 6, 72, cx - 9, 30]);
    fillStroke(ctx, linGrad(ctx, cx - 9, 0, cx + 9, 0, [[0, '#3a0a14'], [0.5, '#b3121d'], [1, '#3a0a14']]), 2.2);
  });
  for (let y = 22; y < 68; y += 9) line(ctx, cx - 5, y, cx + 5, y, withAlpha('#ffb0b0', 0.8), 1);
  circle(ctx, cx, 16, 4);
  ctx.fillStyle = '#fff0f0';
  ctx.fill();
}

function paintEliteAura(ctx: Ctx, size: number): void {
  const c = size / 2;
  radialGlow(ctx, c, c, c, '#ffcf3a', 0.35);
  ctx.save();
  ctx.translate(c, c);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    poly(ctx, [-3, -c * 0.62, 0, -c * 0.95, 3, -c * 0.62]);
    ctx.fillStyle = withAlpha('#ffcf3a', 0.9);
    ctx.fill();
  }
  ctx.restore();
  circle(ctx, c, c, c * 0.62);
  stroke(ctx, withAlpha('#ffcf3a', 0.9), 2);
}

export function registerEnemyArt(atlas: ArtAtlas): void {
  for (const f of [0, 1]) {
    atlas.add(`e_tick_${f}`, 30, 26, (ctx) => paintTick(ctx, f));
    atlas.add(`e_maraca_${f}`, 44, 52, (ctx) => paintMaraca(ctx, f));
    atlas.add(`e_castanet_${f}`, 48, 38, (ctx) => paintCastanet(ctx, f));
    atlas.add(`e_tambourine_${f}`, 46, 46, (ctx) => paintTambourine(ctx, f));
    atlas.add(`e_mantis_${f}`, 64, 48, (ctx) => paintMantis(ctx, f));
    atlas.add(`e_tuba_${f}`, 76, 74, (ctx) => paintTuba(ctx, f));
    atlas.add(`b_maracon_${f}`, 160, 150, (ctx) => paintMaracon(ctx, f));
    atlas.add(`b_belcher_${f}`, 180, 160, (ctx) => paintBelcher(ctx, f));
    atlas.add(`b_percussionist_${f}`, 170, 160, (ctx) => paintPercussionist(ctx, f));
  }
  atlas.add('e_metronome_0', 48, 66, (ctx) => paintMetronome(ctx));
  atlas.add('e_metronome_1', 48, 66, (ctx) => paintMetronome(ctx));
  atlas.add('e_pendulum', 12, 46, (ctx) => paintPendulum(ctx, 12, 46, '#8a7cff'));
  atlas.add('b_warden_0', 140, 190, (ctx) => paintWarden(ctx));
  atlas.add('b_warden_1', 140, 190, (ctx) => paintWarden(ctx));
  atlas.add('b_warden_pendulum', 32, 150, (ctx) => paintPendulum(ctx, 32, 150, '#b0a4ff'));
  atlas.add('boss_body', 240, 300, (ctx) => paintMaestroBody(ctx));
  atlas.add('boss_head', 70, 92, (ctx) => paintMaestroHead(ctx));
  atlas.add('boss_baton', 112, 14, (ctx) => paintBaton(ctx));
  atlas.add('boss_halo', 220, 220, (ctx) => paintHalo(ctx, 220));
  atlas.add('boss_core', 60, 60, (ctx) => paintCore(ctx, 60));
  atlas.add('boss_organ', 90, 120, (ctx) => paintOrgan(ctx));
  atlas.add('anchor', 44, 90, (ctx) => paintAnchor(ctx));
  atlas.add('elite_aura', 72, 72, (ctx) => paintEliteAura(ctx, 72));
}
