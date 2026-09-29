/**
 * Uniform-grid spatial hash for fast neighbor queries (enemies).
 * Rebuilt every frame; allocation-free after warm-up.
 */
export interface Positioned {
  x: number;
  y: number;
  radius: number;
  active: boolean;
}

export class SpatialHash<T extends Positioned> {
  private cells = new Map<number, T[]>();
  private used: T[][] = [];
  private pool: T[][] = [];

  constructor(private size = 80) {}

  private key(cx: number, cy: number): number {
    return (cx + 1024) * 4096 + (cy + 1024);
  }

  clear(): void {
    for (const arr of this.used) {
      arr.length = 0;
      this.pool.push(arr);
    }
    this.used.length = 0;
    this.cells.clear();
  }

  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.size), Math.floor(item.y / this.size));
    let arr = this.cells.get(k);
    if (!arr) {
      arr = this.pool.pop() ?? [];
      this.cells.set(k, arr);
      this.used.push(arr);
    }
    arr.push(item);
  }

  /** Items whose centers lie within r (+ their radius) of (x, y). */
  query(x: number, y: number, r: number, out: T[], filter?: (t: T) => boolean): T[] {
    out.length = 0;
    const s = this.size;
    const pad = 60;
    const x0 = Math.floor((x - r - pad) / s);
    const x1 = Math.floor((x + r + pad) / s);
    const y0 = Math.floor((y - r - pad) / s);
    const y1 = Math.floor((y + r + pad) / s);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (!arr) continue;
        for (const it of arr) {
          if (!it.active) continue;
          const dx = it.x - x;
          const dy = it.y - y;
          const rr = r + it.radius;
          if (dx * dx + dy * dy <= rr * rr && (!filter || filter(it))) out.push(it);
        }
      }
    }
    return out;
  }
}
