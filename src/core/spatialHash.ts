export interface HashItem {
  x: number
  y: number
}

/**
 * Uniform-grid broad phase. Rebuilt each frame; queries return all items
 * in cells overlapping the query circle (superset — use queryRadius for
 * exact distance filtering).
 */
export class SpatialHash<T extends HashItem> {
  private buckets = new Map<number, T[]>()

  constructor(private cellSize = 64) {}

  private key(cx: number, cy: number): number {
    return (cx * 73856093) ^ (cy * 19349663)
  }

  clear(): void {
    this.buckets.clear()
  }

  insert(item: T): void {
    const cx = Math.floor(item.x / this.cellSize)
    const cy = Math.floor(item.y / this.cellSize)
    const k = this.key(cx, cy)
    let b = this.buckets.get(k)
    if (!b) {
      b = []
      this.buckets.set(k, b)
    }
    b.push(item)
  }

  /** Invoke cb for items whose cells overlap circle (x,y,r). Coarse — may over-return. */
  query(x: number, y: number, r: number, cb: (item: T) => void): void {
    const minX = Math.floor((x - r) / this.cellSize)
    const maxX = Math.floor((x + r) / this.cellSize)
    const minY = Math.floor((y - r) / this.cellSize)
    const maxY = Math.floor((y + r) / this.cellSize)
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const b = this.buckets.get(this.key(cx, cy))
        if (!b) continue
        for (const it of b) cb(it)
      }
    }
  }

  /** Invoke cb for items exactly within radius r of (x,y). */
  queryRadius(x: number, y: number, r: number, cb: (item: T) => void): void {
    const r2 = r * r
    this.query(x, y, r, it => {
      const dx = it.x - x
      const dy = it.y - y
      if (dx * dx + dy * dy <= r2) cb(it)
    })
  }
}
