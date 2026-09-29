/**
 * Packs every procedurally painted sprite into a few large canvas pages so the
 * WebGL renderer can batch them (one texture bind per page, not per sprite).
 */
import type Phaser from 'phaser';
import { ART_RES } from '../../config/gameConfig';
import { makeCanvas, type Ctx } from './paint';

interface Item {
  key: string;
  w: number;
  h: number;
  draw: (ctx: Ctx) => void;
}

interface Frame {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAGE_W = 2048;
const PAGE_MAX_H = 2048;
const PAD = 3;

export class ArtAtlas {
  private items: Item[] = [];
  private frames = new Map<string, Frame>();
  private cropCache = new Map<string, HTMLCanvasElement>();
  private urlCache = new Map<string, string>();
  pages: HTMLCanvasElement[] = [];
  built = false;

  /** Queue a sprite of logical size w x h. `draw` paints in logical units. */
  add(key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
    if (this.frames.has(key) || this.items.some((i) => i.key === key)) {
      throw new Error(`duplicate art key ${key}`);
    }
    this.items.push({ key, w, h, draw });
  }

  has(key: string): boolean {
    return this.frames.has(key);
  }

  build(): void {
    const sorted = [...this.items].sort((a, b) => b.h - a.h);
    type Shelf = { y: number; h: number; x: number };
    const layouts: { item: Item; page: number; x: number; y: number; pw: number; ph: number }[] = [];
    let page = 0;
    let shelves: Shelf[] = [];
    let pageBottom = 0;
    const pageHeights: number[] = [];

    for (const item of sorted) {
      const pw = Math.ceil(item.w * ART_RES) + PAD * 2;
      const ph = Math.ceil(item.h * ART_RES) + PAD * 2;
      if (pw > PAGE_W) throw new Error(`sprite ${item.key} too wide`);
      let shelf = shelves.find((s) => s.h >= ph && s.x + pw <= PAGE_W);
      if (!shelf) {
        if (pageBottom + ph > PAGE_MAX_H) {
          pageHeights[page] = pageBottom;
          page++;
          shelves = [];
          pageBottom = 0;
        }
        shelf = { y: pageBottom, h: ph, x: 0 };
        shelves.push(shelf);
        pageBottom += ph;
      }
      layouts.push({ item, page, x: shelf.x, y: shelf.y, pw, ph });
      shelf.x += pw;
    }
    pageHeights[page] = pageBottom;

    this.pages = pageHeights.map((h) => makeCanvas(PAGE_W, Math.ceil(h / 16) * 16 || 16));
    for (const l of layouts) {
      const ctx = this.pages[l.page].getContext('2d')!;
      ctx.save();
      ctx.translate(l.x + PAD, l.y + PAD);
      ctx.beginPath();
      ctx.rect(0, 0, l.pw - PAD * 2, l.ph - PAD * 2);
      ctx.clip();
      ctx.scale(ART_RES, ART_RES);
      try {
        l.item.draw(ctx);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('art failed', l.item.key, err);
      }
      ctx.restore();
      this.frames.set(l.item.key, {
        page: l.page,
        x: l.x + PAD,
        y: l.y + PAD,
        w: l.pw - PAD * 2,
        h: l.ph - PAD * 2,
      });
    }
    this.items = [];
    this.built = true;
  }

  register(textures: Phaser.Textures.TextureManager): void {
    this.pages.forEach((canvas, i) => {
      const key = `atlas${i}`;
      if (textures.exists(key)) textures.remove(key);
      const tex = textures.addCanvas(key, canvas)!;
      for (const [name, f] of this.frames) {
        if (f.page === i) tex.add(name, 0, f.x, f.y, f.w, f.h);
      }
    });
  }

  pageKey(key: string): string {
    const f = this.frames.get(key);
    if (!f) throw new Error(`missing art ${key}`);
    return `atlas${f.page}`;
  }

  /** A standalone canvas copy of one frame (for HTML menus). */
  canvasOf(key: string): HTMLCanvasElement {
    const cached = this.cropCache.get(key);
    if (cached) return cached;
    const f = this.frames.get(key);
    if (!f) throw new Error(`missing art ${key}`);
    const c = makeCanvas(f.w, f.h);
    c.getContext('2d')!.drawImage(this.pages[f.page], f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    this.cropCache.set(key, c);
    return c;
  }

  dataUrl(key: string): string {
    let u = this.urlCache.get(key);
    if (!u) {
      u = this.canvasOf(key).toDataURL('image/png');
      this.urlCache.set(key, u);
    }
    return u;
  }

  frameInfo(key: string): Frame | undefined {
    return this.frames.get(key);
  }
}

export const ART = new ArtAtlas();

/** [textureKey, frameName] for scene.add.image(x, y, ...T('key')). */
export function T(key: string): [string, string] {
  return [ART.pageKey(key), key];
}
