/**
 * Builds the island's visual layer: painted ground, grain overlay, region
 * decor, landmarks, signs, torches and the spire barrier.
 */
import Phaser from 'phaser';
import { MAP_SCALE_K, REGIONS, SIGNS, SITES, SOLIDS, SPIRE, START, WORLD, SIPHON_PAD_RADIUS, type RegionId } from '../../data/island';

const K = MAP_SCALE_K;
import { T } from '../art/atlas';
import { INV_RES, FONT, txt } from '../sceneUtil';
import { DEPTH, type Fx } from '../systems/Fx';
import { BASE_MAP_SCALE, paintBaseMap, pointInPoly, type Terrain } from './Terrain';

const FLAT = new Set(['fern', 'reed', 'ashrock', 'bones', 'debris', 'luggage', 'cable']);
const VARIANTS: Record<string, number> = {
  palm: 3, fern: 3, spike: 3, reed: 3, ashrock: 3, debris: 3,
  drumtree: 2, pod: 2, horn: 2, crystal: 2, cable: 2, bones: 2, luggage: 2, amp: 2,
  pipe: 1, fork: 1, obelisk: 1, barrel: 1,
};
const GLOWING: Record<string, number> = { crystal: 0xb455ff, obelisk: 0xff2a2a, barrel: 0xff6a1f, fork: 0x2fe6ff, drumtree: 0xff3a1a, pipe: 0x9dff2e };

export interface WorldVisuals {
  decor: Phaser.GameObjects.Image[];
  grain: Phaser.GameObjects.TileSprite;
  barrierPillars: Phaser.GameObjects.Image[];
  gatePillars: Phaser.GameObjects.Image[];
  barrierGlow: Phaser.GameObjects.Graphics;
  spire: Phaser.GameObjects.Image;
  signs: { x: number; y: number; text: string; style: string; shown: boolean }[];
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildWorld(scene: Phaser.Scene, terrain: Terrain, fx: Fx): WorldVisuals {
  if (!scene.textures.exists('basemap')) scene.textures.addCanvas('basemap', paintBaseMap());
  scene.add.image(0, 0, 'basemap').setOrigin(0).setScale(BASE_MAP_SCALE).setDepth(DEPTH.ground);
  const grain = scene.add
    .tileSprite(0, 0, 10, 10, 'grain')
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(DEPTH.ground + 1)
    .setAlpha(0.9);

  const decor: Phaser.GameObjects.Image[] = [];
  const r = rng(1337);
  const keepClear = (x: number, y: number) => {
    if (Math.hypot(x - START.x, y - START.y) < 200) return true;
    if (Math.hypot(x - SPIRE.x, y - SPIRE.y) < SPIRE.barrierRadius + 80) return true;
    for (const s of SITES) if (Math.hypot(x - s.x, y - s.y) < SIPHON_PAD_RADIUS + 20) return true;
    for (const s of SOLIDS) if (Math.hypot(x - s.x, y - s.y) < s.r + 40) return true;
    const i = terrain.cellIndex(x, y);
    return i < 0 || terrain.trailDist[i] < 70;
  };
  for (const reg of REGIONS) {
    const xs = reg.poly.map((p) => p[0]);
    const ys = reg.poly.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const area = (maxX - minX) * (maxY - minY) * 0.7;
    for (const dd of reg.decor) {
      const count = Math.round((area / 100000) * dd.density);
      for (let k = 0; k < count; k++) {
        let placed = false;
        for (let tries = 0; tries < 6 && !placed; tries++) {
          const x = minX + r() * (maxX - minX);
          const y = minY + r() * (maxY - minY);
          if (!pointInPoly(x, y, reg.poly) || !terrain.isWalkable(x, y) || keepClear(x, y)) continue;
          if (terrain.regionAt(x, y) !== (reg.id as RegionId)) continue;
          const v = Math.floor(r() * (VARIANTS[dd.kind] ?? 1));
          const key = `d_${dd.kind}_${v}`;
          const flat = FLAT.has(dd.kind);
          const im = scene.add.image(x, y, ...T(key)).setOrigin(0.5, flat ? 0.5 : 0.95);
          const sc = (0.85 + r() * 0.4) * INV_RES;
          im.setScale(r() < 0.5 ? -sc : sc, sc);
          im.setDepth(flat ? DEPTH.groundDecal : y);
          if (flat) im.setAlpha(0.85);
          decor.push(im);
          const glow = GLOWING[dd.kind];
          if (glow !== undefined) {
            const g = scene.add.image(x, y - (flat ? 0 : 30), ...T('fx_glow')).setTint(glow).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18).setScale(1.3 * INV_RES).setDepth(DEPTH.groundDecal + 1);
            decor.push(g);
            fx.addPulser(g, 0.3, 0.12, dd.kind === 'obelisk');
          }
          placed = true;
        }
      }
    }
  }

  // --- landmarks
  const fus = scene.add.image(1470 * K, 4930 * K, ...T('lm_fuselage')).setOrigin(0.5, 0.75).setScale(INV_RES * 1.15).setDepth(4930 * K);
  const wing = scene.add.image(2150 * K, 4960 * K, ...T('lm_wing')).setOrigin(0.5, 0.7).setScale(INV_RES).setDepth(4960 * K).setAngle(8);
  decor.push(fus, wing);
  for (const [x, y] of ([[1340, 4990], [1620, 4800], [2250, 4900]] as [number, number][]).map(([a, b]) => [a * K, b * K])) {
    const fire = scene.add.image(x, y - 20, ...T('fx_glow')).setTint(0xff6a1f).setBlendMode(Phaser.BlendModes.ADD).setScale(2.4 * INV_RES).setAlpha(0.35).setDepth(y + 1);
    fx.addPulser(fire, 0.3, 0.15);
    decor.push(fire);
    const b = scene.add.image(x, y, ...T('d_barrel_0')).setOrigin(0.5, 0.95).setScale(INV_RES).setDepth(y);
    decor.push(b);
  }
  // scattered stage gear around the wreck
  const gear = rng(99);
  for (let i = 0; i < 16; i++) {
    const x = (1200 + gear() * 1200) * K;
    const y = (4700 + gear() * 500) * K;
    if (!terrain.isWalkable(x, y) || Math.hypot(x - START.x, y - START.y) < 120) continue;
    const kind = ['d_amp_0', 'd_amp_1', 'd_luggage_0', 'd_luggage_1', 'd_debris_1'][Math.floor(gear() * 5)];
    decor.push(scene.add.image(x, y, ...T(kind)).setOrigin(0.5, 0.9).setScale(INV_RES).setDepth(y));
  }

  // torches around each siphon site (pulse on the beat)
  for (const s of SITES) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const x = s.x + Math.cos(a) * (SIPHON_PAD_RADIUS - 40);
      const y = s.y + Math.sin(a) * (SIPHON_PAD_RADIUS - 60);
      decor.push(scene.add.image(x, y, ...T('d_torch_0')).setOrigin(0.5, 0.95).setScale(INV_RES).setDepth(y));
      const g = scene.add.image(x, y - 44, ...T('fx_glow')).setTint(0xff6a1f).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2 * INV_RES).setAlpha(0.3).setDepth(y + 1);
      fx.addPulser(g, 0.5, 0.25);
      decor.push(g);
    }
  }

  // --- the Resonance Spire + silence barrier
  const spire = scene.add.image(SPIRE.x, SPIRE.y - 20, ...T('lm_spire')).setOrigin(0.5, 0.93).setScale(1.05 * INV_RES).setDepth(SPIRE.y - 20);
  const eye = scene.add.image(SPIRE.x, SPIRE.y - 300, ...T('fx_glow')).setTint(0xff2a2a).setBlendMode(Phaser.BlendModes.ADD).setScale(3 * INV_RES).setAlpha(0.4).setDepth(SPIRE.y);
  fx.addPulser(eye, 0.5, 0.2, true);
  const barrierPillars: Phaser.GameObjects.Image[] = [];
  const gatePillars: Phaser.GameObjects.Image[] = [];
  const n = 44;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const x = SPIRE.x + Math.cos(a) * SPIRE.barrierRadius;
    const y = SPIRE.y + Math.sin(a) * SPIRE.barrierRadius;
    let da = a - SPIRE.gateAngle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const p = scene.add.image(x, y, ...T('lm_pillar')).setOrigin(0.5, 0.95).setScale(INV_RES).setDepth(y);
    if (Math.abs(da) < SPIRE.gateHalfWidth) gatePillars.push(p);
    else barrierPillars.push(p);
  }
  const barrierGlow = scene.add.graphics().setDepth(DEPTH.telegraph - 1);

  // --- signs
  const signs: WorldVisuals['signs'] = [];
  for (const s of SIGNS) {
    if (s.style === 'region') {
      scene.add.image(s.x, s.y, ...T('lm_sign')).setOrigin(0.5, 0.95).setScale(INV_RES).setDepth(s.y);
      const label = txt(scene, s.x, s.y - 50, s.text, { fontFamily: FONT.brush, fontSize: s.text.length > 12 ? '15px' : '19px', color: '#9fe7ff', stroke: '#07060a', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(s.y + 1)
        .setAngle(-3);
      decor.push(label as unknown as Phaser.GameObjects.Image);
    } else {
      scene.add.image(s.x, s.y, ...T(s.style === 'alien' ? 'lm_plaque' : 'd_bones_1')).setOrigin(0.5, 0.95).setScale(INV_RES).setDepth(s.y);
    }
    signs.push({ ...s, shown: false });
  }

  void WORLD;
  return { decor, grain, barrierPillars, gatePillars, barrierGlow, spire, signs };
}
