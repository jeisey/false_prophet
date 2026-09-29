/**
 * Responsive portrait layout.
 *
 * The game uses a logical canvas 540 units wide. On tall phones the logical
 * height stretches (up to ~1200) so the battlefield fills the screen instead
 * of letterboxing; on wide screens (desktop) it stays 9:16 and is centered.
 * Rendering happens at `rs` device pixels per logical unit (capped at 2) so
 * text and vector art stay crisp without paying for 3x DPR.
 */
import { LOGICAL_MAX_HEIGHT, LOGICAL_MIN_HEIGHT, LOGICAL_WIDTH, MAX_RENDER_SCALE } from '../config/gameConfig';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutState {
  /** Logical width/height. */
  W: number;
  H: number;
  /** Device pixels per logical unit. */
  rs: number;
  /** Frame size + position in CSS px. */
  cssW: number;
  cssH: number;
  cssLeft: number;
  cssTop: number;
  /** CSS px per logical unit. */
  unit: number;
  /** Safe-area insets in LOGICAL units. */
  safe: Insets;
  touch: boolean;
  /** True when there is spare horizontal room around the frame (desktop). */
  wide: boolean;
}

export function computeLayout(viewW: number, viewH: number, dpr: number, safeCss: Insets, touch: boolean): LayoutState {
  const W = LOGICAL_WIDTH;
  const aspect = viewH / Math.max(1, viewW);
  const minA = LOGICAL_MIN_HEIGHT / W;
  const maxA = LOGICAL_MAX_HEIGHT / W;
  let H: number;
  let cssW: number;
  let cssH: number;
  if (aspect >= minA) {
    const a = Math.min(aspect, maxA);
    H = Math.round(W * a);
    cssW = viewW;
    cssH = viewW * a;
  } else {
    H = LOGICAL_MIN_HEIGHT;
    cssH = viewH;
    cssW = (viewH * W) / H;
  }
  const cssLeft = Math.max(0, (viewW - cssW) / 2);
  const cssTop = Math.max(0, (viewH - cssH) / 2);
  const unit = cssW / W;
  const rs = Math.max(0.75, Math.min(MAX_RENDER_SCALE, Math.round(dpr * unit * 4) / 4));
  const toLogical = (v: number) => Math.max(0, v) / unit;
  const safe: Insets = {
    top: toLogical(safeCss.top - cssTop),
    bottom: toLogical(safeCss.bottom - (viewH - cssTop - cssH)),
    left: toLogical(safeCss.left - cssLeft),
    right: toLogical(safeCss.right - (viewW - cssLeft - cssW)),
  };
  return { W, H, rs, cssW, cssH, cssLeft, cssTop, unit, safe, touch, wide: viewW - cssW > 360 };
}

type Listener = (l: LayoutState) => void;

class LayoutManager {
  state: LayoutState = computeLayout(540, 960, 1, { top: 0, right: 0, bottom: 0, left: 0 }, false);
  private listeners = new Set<Listener>();

  measure(): LayoutState {
    const vv = window.visualViewport;
    const viewW = Math.round(vv?.width ?? window.innerWidth);
    const viewH = Math.round(vv?.height ?? window.innerHeight);
    const dpr = window.devicePixelRatio || 1;
    const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.state = computeLayout(viewW, viewH, dpr, readSafeArea(), touch);
    return this.state;
  }

  apply(): void {
    const s = this.state;
    const frame = document.getElementById('frame')!;
    frame.style.width = `${s.cssW}px`;
    frame.style.height = `${s.cssH}px`;
    frame.style.left = `${s.cssLeft}px`;
    frame.style.top = `${s.cssTop}px`;
    const root = document.documentElement;
    root.style.setProperty('--u', `${s.unit}px`);
    root.style.setProperty('--safe-top', `${s.safe.top * s.unit}px`);
    root.style.setProperty('--safe-bottom', `${s.safe.bottom * s.unit}px`);
    root.style.setProperty('--frame-w', `${s.cssW}px`);
    document.body.classList.toggle('wide', s.wide);
    document.body.classList.toggle('touch', s.touch);
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  refresh(): void {
    const prev = this.state;
    this.measure();
    this.apply();
    const s = this.state;
    if (prev.H !== s.H || prev.rs !== s.rs || prev.cssW !== s.cssW || prev.cssH !== s.cssH || prev.safe.top !== s.safe.top || prev.safe.bottom !== s.safe.bottom) {
      for (const l of this.listeners) l(s);
    }
  }
}

function readSafeArea(): Insets {
  const probe = document.getElementById('safe-probe');
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(probe);
  const px = (v: string) => parseFloat(v) || 0;
  return { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
}

export const layout = new LayoutManager();
