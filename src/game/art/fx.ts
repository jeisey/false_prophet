/**
 * FX, projectiles, pickups and HUD art. Most FX are white so they can be
 * tinted per instrument at runtime.
 */
import type { ArtAtlas } from './atlas';
import { PAL, blob, circle, ellipse, fillStroke, line, linGrad, poly, radialGlow, rng, stroke, withAlpha, withGlow, type Ctx } from './paint';

function ringTex(ctx: Ctx, size: number, width: number, glow: number): void {
  const c = size / 2;
  withGlow(ctx, '#ffffff', glow, () => {
    circle(ctx, c, c, c - width / 2 - glow / 2 - 1);
    stroke(ctx, '#ffffff', width);
  });
}

function note(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ellipse(ctx, x, y, 4 * s, 3 * s, -0.4);
  ctx.fillStyle = color;
  ctx.fill();
  line(ctx, x + 3.6 * s, y - 1 * s, x + 3.6 * s, y - 16 * s, color, 1.6 * s);
  ctx.beginPath();
  ctx.moveTo(x + 3.6 * s, y - 16 * s);
  ctx.quadraticCurveTo(x + 9 * s, y - 12 * s, x + 8 * s, y - 6 * s);
  stroke(ctx, color, 1.6 * s);
}

export function registerFxArt(atlas: ArtAtlas): void {
  atlas.add('fx_glow', 64, 64, (ctx) => radialGlow(ctx, 32, 32, 32, '#ffffff', 1));
  atlas.add('fx_dot', 12, 12, (ctx) => {
    radialGlow(ctx, 6, 6, 6, '#ffffff', 1);
    circle(ctx, 6, 6, 2.5);
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
  atlas.add('fx_spark', 24, 6, (ctx) => {
    const g = linGrad(ctx, 0, 3, 24, 3, [[0, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0.6)']]);
    ellipse(ctx, 12, 3, 12, 2.2);
    ctx.fillStyle = g;
    ctx.fill();
  });
  atlas.add('fx_shard', 10, 10, (ctx) => {
    poly(ctx, [5, 0, 10, 8, 1, 10]);
    ctx.fillStyle = '#fff';
    ctx.fill();
  });
  atlas.add('fx_smoke', 48, 48, (ctx) => {
    const r = rng(5);
    for (let i = 0; i < 6; i++) radialGlow(ctx, 16 + r() * 16, 16 + r() * 16, 14 + r() * 6, '#ffffff', 0.35);
  });
  atlas.add('fx_ring', 128, 128, (ctx) => ringTex(ctx, 128, 3, 4));
  atlas.add('fx_ring_thick', 128, 128, (ctx) => ringTex(ctx, 128, 9, 8));
  atlas.add('fx_square', 128, 128, (ctx) => {
    // speaker-cone pressure wave: nested rounded brackets
    withGlow(ctx, '#fff', 6, () => {
      for (const inset of [10, 22]) {
        const s = 128 - inset * 2;
        roundRectPath(ctx, inset, inset, s, s, 14);
        stroke(ctx, '#ffffff', inset === 10 ? 6 : 3);
      }
    });
  });
  atlas.add('fx_crescent', 96, 48, (ctx) => {
    withGlow(ctx, '#fff', 8, () => {
      ctx.beginPath();
      ctx.moveTo(6, 40);
      ctx.quadraticCurveTo(48, -14, 90, 40);
      ctx.quadraticCurveTo(48, 10, 6, 40);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(14 + i * 6, 42);
      ctx.quadraticCurveTo(48, 18 + i * 6, 82 - i * 6, 42);
      stroke(ctx, withAlpha('#ffffff', 0.5), 1);
    }
  });
  atlas.add('fx_note', 20, 26, (ctx) => withGlow(ctx, '#fff', 4, () => note(ctx, 6, 21, 1, '#ffffff')));
  atlas.add('fx_disc', 28, 28, (ctx) => {
    withGlow(ctx, '#ffe07a', 6, () => {
      ellipse(ctx, 14, 14, 12, 12);
      fillStroke(ctx, linGrad(ctx, 2, 2, 26, 26, [[0, '#fff2b0'], [0.5, '#d9a72b'], [1, '#fff2b0']]), 1.4);
    });
    for (let r = 3; r < 12; r += 3) {
      circle(ctx, 14, 14, r);
      stroke(ctx, withAlpha('#6a4a08', 0.6), 0.6);
    }
  });
  atlas.add('fx_bolt', 40, 12, (ctx) => {
    withGlow(ctx, '#fff', 6, () => {
      poly(ctx, [2, 6, 12, 3, 22, 7, 30, 3, 38, 6, 30, 9, 22, 5, 12, 9]);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });
  });
  atlas.add('fx_orb', 32, 32, (ctx) => {
    radialGlow(ctx, 16, 16, 16, '#ffffff', 1);
    circle(ctx, 16, 16, 7);
    stroke(ctx, '#ffffff', 2);
    circle(ctx, 16, 16, 3.5);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  atlas.add('fx_swirl', 128, 128, (ctx) => {
    ctx.translate(64, 64);
    withGlow(ctx, '#fff', 6, () => {
      for (let arm = 0; arm < 4; arm++) {
        ctx.beginPath();
        for (let t = 0; t < 1; t += 0.02) {
          const a = arm * (Math.PI / 2) + t * 4.2;
          const r = 8 + t * 52;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        stroke(ctx, withAlpha('#ffffff', 0.9), 3);
      }
    });
    radialGlow(ctx, 0, 0, 20, '#ffffff', 0.9);
  });
  atlas.add('fx_beam', 64, 24, (ctx) => {
    const g = linGrad(ctx, 0, 0, 0, 24, [[0, 'rgba(255,255,255,0)'], [0.35, 'rgba(255,255,255,0.7)'], [0.5, 'rgba(255,255,255,1)'], [0.65, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 24);
  });
  atlas.add('fx_mark', 32, 32, (ctx) => {
    withGlow(ctx, '#ff5ccf', 6, () => {
      circle(ctx, 16, 16, 10);
      stroke(ctx, '#ff9ae6', 2);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        line(ctx, 16 + Math.cos(a) * 6, 16 + Math.sin(a) * 6, 16 + Math.cos(a) * 15, 16 + Math.sin(a) * 15, '#ff9ae6', 2);
      }
    });
  });
  atlas.add('fx_hex', 128, 128, (ctx) => {
    withGlow(ctx, '#fff', 8, () => {
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56);
      }
      poly(ctx, pts);
      stroke(ctx, '#ffffff', 5);
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      circle(ctx, 64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56, 5);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  });
  atlas.add('fx_field', 96, 96, (ctx) => {
    radialGlow(ctx, 48, 48, 48, '#ffffff', 0.45);
    circle(ctx, 48, 48, 44);
    stroke(ctx, withAlpha('#ffffff', 0.6), 2);
  });
  atlas.add('shadow', 48, 18, (ctx) => {
    const g = ctx.createRadialGradient(24, 9, 0, 24, 9, 24);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.scale(1, 0.375);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(24, 24, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // ----- hostile projectiles: dark outline + hot core (shape-coded, not just color)
  atlas.add('p_seed', 16, 16, (ctx) => {
    withGlow(ctx, '#ff3a1a', 5, () => {
      ellipse(ctx, 8, 8, 5.5, 4.2, 0.6);
      fillStroke(ctx, '#ff6a2a', 2);
    });
    circle(ctx, 7, 7, 1.8);
    ctx.fillStyle = '#fff3c0';
    ctx.fill();
  });
  atlas.add('p_jingle', 16, 16, (ctx) => {
    withGlow(ctx, '#ffcf3a', 5, () => {
      circle(ctx, 8, 8, 5.5);
      fillStroke(ctx, '#e8b830', 2, '#3a0a0a');
    });
    circle(ctx, 8, 8, 2);
    ctx.fillStyle = '#b3121d';
    ctx.fill();
  });
  atlas.add('p_orb', 18, 18, (ctx) => {
    withGlow(ctx, '#ff2a4a', 6, () => {
      circle(ctx, 9, 9, 6);
      fillStroke(ctx, '#ff2a4a', 2.2, '#1a0006');
    });
    circle(ctx, 9, 9, 2.6);
    ctx.fillStyle = '#ffe0e8';
    ctx.fill();
  });
  atlas.add('p_note', 20, 22, (ctx) => {
    withGlow(ctx, '#ff2a2a', 6, () => note(ctx, 7, 18, 0.95, '#ff3a3a'));
  });
  atlas.add('p_shard', 18, 10, (ctx) => {
    withGlow(ctx, '#b0a4ff', 5, () => {
      poly(ctx, [1, 5, 9, 1, 17, 5, 9, 9]);
      fillStroke(ctx, '#c9c0ff', 1.6, '#150a30');
    });
  });
  atlas.add('p_bubble', 24, 24, (ctx) => {
    withGlow(ctx, '#ffcf3a', 6, () => {
      circle(ctx, 12, 12, 9);
      fillStroke(ctx, withAlpha('#d9a72b', 0.55), 2.4, '#3a2208');
    });
    circle(ctx, 9, 9, 2.5);
    ctx.fillStyle = '#fff6d0';
    ctx.fill();
  });

  // ----- pickups
  atlas.add('pk_shard', 14, 18, (ctx) => {
    withGlow(ctx, '#2fe6ff', 6, () => {
      poly(ctx, [7, 1, 12, 7, 7, 17, 2, 7]);
      fillStroke(ctx, '#7ff3ff', 1.2, '#062a33');
    });
    poly(ctx, [7, 3, 9, 7, 7, 12]);
    ctx.fillStyle = '#e8feff';
    ctx.fill();
  });
  atlas.add('pk_shard_big', 20, 26, (ctx) => {
    withGlow(ctx, '#b455ff', 8, () => {
      poly(ctx, [10, 1, 18, 10, 10, 25, 2, 10]);
      fillStroke(ctx, '#d4a0ff', 1.6, '#1a0633');
    });
    poly(ctx, [10, 4, 13, 10, 10, 18]);
    ctx.fillStyle = '#f6e8ff';
    ctx.fill();
  });
  atlas.add('pk_water', 18, 28, (ctx) => {
    withGlow(ctx, '#9fe7ff', 6, () => {
      poly(ctx, [6, 2, 12, 2, 12, 6, 15, 10, 15, 26, 3, 26, 3, 10, 6, 6]);
      fillStroke(ctx, withAlpha('#bff4ff', 0.8), 1.4);
    });
    ctx.fillStyle = '#b3121d';
    ctx.fillRect(3.5, 13, 11, 6);
    line(ctx, 6.5, 16, 11.5, 16, '#fff', 1.4);
    line(ctx, 9, 13.5, 9, 18.5, '#fff', 1.4);
  });
  atlas.add('pk_amp', 22, 26, (ctx) => {
    poly(ctx, [3, 4, 19, 4, 19, 24, 3, 24]);
    fillStroke(ctx, '#1a1a20', 1.6);
    ctx.fillStyle = '#d9a72b';
    ctx.fillRect(8, 1.5, 6, 3);
    withGlow(ctx, '#ff5a1a', 8, () => {
      poly(ctx, [12, 7, 7, 15, 11, 15, 9, 22, 16, 12, 12, 12, 14, 7]);
      ctx.fillStyle = '#ffb02a';
      ctx.fill();
    });
  });
  atlas.add('pk_gear', 22, 22, (ctx) => {
    withGlow(ctx, '#ffffff', 6, () => {
      for (let i = 0; i < 4; i++) {
        circle(ctx, 11, 11, 3 + i * 2);
        stroke(ctx, i % 2 ? PAL.chrome : '#ffffff', 1.4);
      }
    });
    line(ctx, 11, 11, 20, 3, PAL.chrome, 1.2);
  });
  atlas.add('pk_case', 48, 36, (ctx) => {
    poly(ctx, [4, 6, 44, 6, 44, 32, 4, 32]);
    fillStroke(ctx, '#15151a', 2);
    ctx.fillStyle = PAL.chrome;
    for (const [x, y] of [[4, 6], [40, 6], [4, 28], [40, 28]]) ctx.fillRect(x, y, 4, 4);
    line(ctx, 4, 17, 44, 17, '#3a3a44', 2);
    ctx.fillStyle = '#d9a72b';
    ctx.fillRect(20, 14, 8, 5);
    ctx.fillStyle = withAlpha(PAL.bone, 0.85);
    ctx.font = 'bold 6px sans-serif';
    ctx.fillText('FRAGILE', 12, 28);
    ctx.fillStyle = '#b3121d';
    ctx.fillRect(8, 9, 10, 4);
  });

  // ----- UI
  atlas.add('ui_joy_base', 140, 140, (ctx) => {
    circle(ctx, 70, 70, 62);
    ctx.fillStyle = 'rgba(10,8,14,0.35)';
    ctx.fill();
    withGlow(ctx, '#b455ff', 8, () => {
      circle(ctx, 70, 70, 62);
      stroke(ctx, withAlpha('#e8dcff', 0.55), 3);
    });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.save();
      ctx.translate(70 + Math.cos(a) * 50, 70 + Math.sin(a) * 50);
      ctx.rotate(a + Math.PI / 2);
      poly(ctx, [-5, 3, 0, -4, 5, 3]);
      ctx.fillStyle = withAlpha('#e8dcff', 0.55);
      ctx.fill();
      ctx.restore();
    }
  });
  atlas.add('ui_joy_knob', 64, 64, (ctx) => {
    circle(ctx, 32, 32, 26);
    fillStroke(ctx, linGrad(ctx, 0, 6, 0, 58, [[0, '#d8d4e0'], [1, '#56525e']]), 2.5);
    circle(ctx, 32, 32, 17);
    stroke(ctx, withAlpha('#ffffff', 0.35), 2);
  });
  atlas.add('ui_btn_ring', 136, 136, (ctx) => {
    const r = rng(3);
    withGlow(ctx, '#ffffff', 10, () => {
      circle(ctx, 68, 68, 60);
      stroke(ctx, '#ffffff', 4);
    });
    for (let i = 0; i < 18; i++) {
      const a = r() * Math.PI * 2;
      const l = 6 + r() * 10;
      line(ctx, 68 + Math.cos(a) * 60, 68 + Math.sin(a) * 60, 68 + Math.cos(a + 0.12) * (60 + l), 68 + Math.sin(a + 0.12) * (60 + l), withAlpha('#ffffff', 0.7), 1.4);
    }
  });
  atlas.add('ui_breakdown', 128, 128, (ctx) => {
    const c = 64;
    radialGlow(ctx, c, c, 64, '#ff3a1a', 0.7);
    circle(ctx, c, c, 52);
    fillStroke(ctx, linGrad(ctx, 0, 12, 0, 116, [[0, '#3a0a06'], [1, '#120302']]), 4, '#ff6a1f');
    paintSigil(ctx, c, c, 36, '#ff8a3a');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const sx = c + Math.cos(a) * 56;
      const sy = c + Math.sin(a) * 56;
      circle(ctx, sx, sy, 7);
      fillStroke(ctx, PAL.bone, 1.4);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(sx - 3, sy - 1.5, 2, 2);
      ctx.fillRect(sx + 1, sy - 1.5, 2, 2);
    }
  });
  atlas.add('ui_arrow', 32, 32, (ctx) => {
    withGlow(ctx, '#ffffff', 5, () => {
      poly(ctx, [4, 6, 28, 16, 4, 26, 11, 16]);
      fillStroke(ctx, '#ffffff', 2, '#0a0a0a');
    });
  });
  atlas.add('sigil', 64, 64, (ctx) => paintSigil(ctx, 32, 32, 28, '#ff2a2a'));
  atlas.add('ui_pause', 40, 40, (ctx) => {
    ctx.fillStyle = PAL.bone;
    ctx.fillRect(12, 10, 6, 20);
    ctx.fillRect(22, 10, 6, 20);
  });
  atlas.add('ui_sound', 40, 40, (ctx) => {
    poly(ctx, [8, 16, 14, 16, 22, 9, 22, 31, 14, 24, 8, 24]);
    ctx.fillStyle = PAL.bone;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(22, 20, 7, -0.8, 0.8);
    stroke(ctx, PAL.bone, 2);
    ctx.beginPath();
    ctx.arc(22, 20, 12, -0.8, 0.8);
    stroke(ctx, PAL.bone, 2);
  });
  atlas.add('ui_mute', 40, 40, (ctx) => {
    poly(ctx, [8, 16, 14, 16, 22, 9, 22, 31, 14, 24, 8, 24]);
    ctx.fillStyle = PAL.bone;
    ctx.fill();
    line(ctx, 26, 15, 34, 25, '#ff3a3a', 2.6);
    line(ctx, 34, 15, 26, 25, '#ff3a3a', 2.6);
  });
}

/** FALSE PROPHET band sigil: broken halo, inverted crown, prophet's eye. */
export function paintSigil(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  withGlow(ctx, color, r * 0.3, () => {
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2 + 0.35, Math.PI * 1.5 - 0.35);
    stroke(ctx, color, r * 0.1);
    poly(ctx, [x - r * 0.62, y - r * 0.3, x + r * 0.62, y - r * 0.3, x, y + r * 0.78]);
    stroke(ctx, color, r * 0.09);
    line(ctx, x, y - r * 1.12, x, y + r * 0.95, color, r * 0.09);
    line(ctx, x - r * 0.34, y - r * 0.66, x + r * 0.34, y - r * 0.66, color, r * 0.09);
  });
  blob(ctx, [x - r * 0.3, y + r * 0.02, x, y - r * 0.14, x + r * 0.3, y + r * 0.02, x, y + r * 0.18]);
  ctx.fillStyle = color;
  ctx.fill();
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
