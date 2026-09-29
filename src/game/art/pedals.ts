/**
 * Upgrade card art: every run upgrade is a stompbox or a piece of stage gear
 * with its own glyph, so choices are recognizable at a glance.
 */
import { UPGRADES, UPGRADE_IDS, type UpgradeId } from '../../data/upgrades';
import type { ArtAtlas } from './atlas';
import { PAL, circle, ellipse, fillStroke, line, linGrad, poly, radialGlow, shade, stroke, withAlpha, withGlow, type Ctx } from './paint';
import { roundRectPath } from './fx';

function glyph(ctx: Ctx, id: UpgradeId, x: number, y: number, s: number, c: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = (pts: number[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  };
  switch (id) {
    case 'fuzz':
      path([-14, 6, -14, -6, -6, -6, -6, 6, 2, 6, 2, -6, 10, -6, 10, 6, 14, 6]);
      break;
    case 'delay':
      for (let i = 0; i < 4; i++) {
        const h = 12 - i * 3;
        ctx.fillRect(-13 + i * 8, 6 - h, 4, h);
      }
      break;
    case 'reverb':
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(-10, 4, i * 6, -1, 1);
        ctx.stroke();
      }
      break;
    case 'chorus':
      for (const off of [-3, 3]) {
        ctx.beginPath();
        for (let t = -14; t <= 14; t++) {
          const yy = Math.sin(t / 3 + off) * 5 + off;
          if (t === -14) ctx.moveTo(t, yy);
          else ctx.lineTo(t, yy);
        }
        ctx.stroke();
      }
      break;
    case 'overdrive':
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.quadraticCurveTo(-12, 2, -4, -12);
      ctx.quadraticCurveTo(-2, -2, 2, -6);
      ctx.quadraticCurveTo(4, -14, 8, -10);
      ctx.quadraticCurveTo(14, 2, 0, 10);
      ctx.fill();
      break;
    case 'compressor':
      path([-14, 0, -10, -8, -6, 8, -2, -3, 2, 3, 6, -3, 10, 3, 14, 0]);
      line(ctx, -14, -10, 14, -10, c, 1.2);
      line(ctx, -14, 10, 14, 10, c, 1.2);
      break;
    case 'octaver':
      for (const [nx, ny] of [[-6, 6], [6, -2]] as [number, number][]) {
        ellipse(ctx, nx, ny, 4, 3, -0.4);
        ctx.fill();
        line(ctx, nx + 3.5, ny - 1, nx + 3.5, ny - 13, c, 1.8);
      }
      line(ctx, -2.5, -7, 9.5, -15, c, 2.4);
      break;
    case 'noisegate':
      path([-12, 10, -12, -8, 12, -8, 12, 10]);
      line(ctx, -4, -8, -4, 10, c, 2);
      line(ctx, 4, -8, 4, 10, c, 2);
      break;
    case 'wah':
      path([-14, 8, 14, -6]);
      circle(ctx, -8, 8, 3);
      ctx.fill();
      break;
    case 'tremolo':
      path([-14, 6, -10, -6, -6, 6, -2, -6, 2, 6, 6, -6, 10, 6, 14, -6]);
      break;
    case 'phaser':
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, 4 + i * 4, i, i + 4);
        ctx.stroke();
      }
      break;
    case 'ebow':
      poly(ctx, [-12, -5, 12, -5, 12, 5, -12, 5]);
      ctx.stroke();
      path([-8, 0, 8, 0]);
      break;
    case 'pitch':
      path([-8, 10, -8, -10]);
      path([-14, -4, -8, -10, -2, -4]);
      ellipse(ctx, 8, 6, 4, 3, -0.4);
      ctx.fill();
      line(ctx, 11.5, 5, 11.5, -8, c, 1.8);
      break;
    case 'inears':
      ctx.beginPath();
      ctx.arc(0, 0, 9, Math.PI * 0.2, Math.PI * 1.6);
      ctx.stroke();
      circle(ctx, 6, 7, 3);
      ctx.fill();
      break;
    case 'roadie':
      path([-10, 10, -10, -8, -2, -8, 0, 4, 12, 6, 12, 10, -10, 10]);
      break;
    case 'power':
      poly(ctx, [-6, -12, 6, -12, 6, 0, -6, 0]);
      ctx.stroke();
      path([-3, -12, -3, -16]);
      path([3, -12, 3, -16]);
      path([0, 0, 0, 12]);
      break;
    case 'stack':
      for (let i = 0; i < 2; i++) {
        poly(ctx, [-11, -12 + i * 12, 11, -12 + i * 12, 11, -1 + i * 12, -11, -1 + i * 12]);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

export function paintPedal(ctx: Ctx, id: UpgradeId, w: number, h: number): void {
  const def = UPGRADES[id];
  const body = def.color;
  if (def.kind === 'PEDAL') {
    // stompbox
    roundRectPath(ctx, 6, 8, w - 12, h - 14, 8);
    fillStroke(ctx, linGrad(ctx, 0, 8, w, h, [[0, shade(body, 0.25)], [0.55, body], [1, shade(body, -0.45)]]), 3);
    // bevel highlight
    roundRectPath(ctx, 10, 12, w - 20, h - 22, 6);
    stroke(ctx, withAlpha('#ffffff', 0.18), 1.4);
    // knobs
    const knobs = id === 'fuzz' || id === 'overdrive' ? 2 : 3;
    for (let i = 0; i < knobs; i++) {
      const kx = w / 2 + (i - (knobs - 1) / 2) * 22;
      circle(ctx, kx, 26, 8);
      fillStroke(ctx, linGrad(ctx, 0, 18, 0, 34, [[0, '#3a3a40'], [1, '#0a0a0c']]), 1.8);
      line(ctx, kx, 26, kx + Math.cos(-2 + i) * 7, 26 + Math.sin(-2 + i) * 7, '#ffffff', 1.6);
    }
    // LED
    withGlow(ctx, def.accent, 10, () => {
      circle(ctx, w - 18, 44, 3.4);
      ctx.fillStyle = def.accent;
      ctx.fill();
    });
    // face plate with glyph
    roundRectPath(ctx, 14, 40, w - 38, 34, 4);
    fillStroke(ctx, withAlpha('#000000', 0.35), 0);
    glyph(ctx, id, (w - 24) / 2 + 7, 57, 1, def.accent);
    // footswitch
    circle(ctx, w / 2, h - 24, 10);
    fillStroke(ctx, linGrad(ctx, 0, h - 34, 0, h - 14, [[0, '#f4f4f8'], [1, '#6a6a74']]), 2);
    circle(ctx, w / 2, h - 24, 5);
    stroke(ctx, withAlpha('#000', 0.4), 1.2);
    // jacks
    for (const jx of [3, w - 9]) {
      ctx.fillStyle = PAL.chrome;
      ctx.fillRect(jx, 30, 6, 10);
    }
  } else {
    // stage gear: rack device / flight case look
    roundRectPath(ctx, 6, 14, w - 12, h - 24, 5);
    fillStroke(ctx, linGrad(ctx, 0, 14, 0, h, [[0, shade(body, 0.2)], [1, shade(body, -0.5)]]), 3);
    ctx.fillStyle = PAL.chrome;
    for (const [x, y] of [[8, 16], [w - 16, 16], [8, h - 20], [w - 16, h - 20]]) ctx.fillRect(x, y, 8, 8);
    radialGlow(ctx, w / 2, h / 2, w * 0.4, def.accent, 0.25);
    glyph(ctx, id, w / 2, h / 2 - 2, 1.5, def.accent);
    line(ctx, 14, h - 34, w - 14, h - 34, withAlpha(def.accent, 0.6), 2);
  }
}

export function registerPedalArt(atlas: ArtAtlas): void {
  for (const id of UPGRADE_IDS) atlas.add(`pedal_${id}`, 96, 120, (ctx) => paintPedal(ctx, id, 96, 120));
}
