/**
 * Pre-rendered radial-gradient glow sprites — cheap additive glow without
 * per-frame shadowBlur cost.
 */
export class SpriteBank {
  readonly list: HTMLCanvasElement[] = []
  private idx = new Map<string, number>()

  get(color: string, radius = 32): number {
    if (typeof document === 'undefined') return -1
    const key = `${color}:${radius}`
    const hit = this.idx.get(key)
    if (hit !== undefined) return hit
    const c = document.createElement('canvas')
    c.width = c.height = radius * 2
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius)
    g.addColorStop(0, color)
    g.addColorStop(0.25, color + 'cc')
    g.addColorStop(0.6, color + '44')
    g.addColorStop(1, color + '00')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, c.width, c.height)
    this.list.push(c)
    this.idx.set(key, this.list.length - 1)
    return this.list.length - 1
  }

  draw(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, scale: number, alpha = 1): void {
    if (i < 0) return
    const s = this.list[i]
    const w = s.width * scale
    ctx.globalAlpha = alpha
    ctx.drawImage(s, x - w / 2, y - w / 2, w, w)
    ctx.globalAlpha = 1
  }
}

/** Draw a regular polygon path centered at x,y. */
export function polyPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  sides: number,
  rot: number,
): void {
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}
