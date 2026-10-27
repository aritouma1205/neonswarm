import { mulberry32 } from '../core/rng'
import { WORLD_W, WORLD_H } from '../game/config'

interface Star {
  x: number
  y: number
  z: number // parallax factor 0..1
  r: number
  tw: number // twinkle phase
}

export class Starfield {
  private stars: Star[] = []

  constructor() {
    const rng = mulberry32(1337)
    for (let i = 0; i < 260; i++) {
      this.stars.push({
        x: rng() * WORLD_W,
        y: rng() * WORLD_H,
        z: 0.15 + rng() * 0.55,
        r: 0.5 + rng() * 1.6,
        tw: rng() * Math.PI * 2,
      })
    }
  }

  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number, vw: number, vh: number, t: number): void {
    // base
    ctx.fillStyle = '#05070f'
    ctx.fillRect(0, 0, vw, vh)

    // parallax stars
    for (const s of this.stars) {
      const sx = s.x - ox * s.z
      const sy = s.y - oy * s.z
      const wx = ((sx % vw) + vw) % vw
      const wy = ((sy % vh) + vh) % vh
      const a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.7 + s.tw))
      ctx.globalAlpha = a * s.z
      ctx.fillStyle = '#9fd8ff'
      ctx.fillRect(wx, wy, s.r, s.r)
    }
    ctx.globalAlpha = 1

    // faint grid (world-locked)
    const grid = 120
    ctx.strokeStyle = 'rgba(77, 232, 255, 0.05)'
    ctx.lineWidth = 1
    ctx.beginPath()
    const startX = -((ox % grid) + grid) % grid
    const startY = -((oy % grid) + grid) % grid
    for (let x = startX; x < vw; x += grid) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, vh)
    }
    for (let y = startY; y < vh; y += grid) {
      ctx.moveTo(0, y)
      ctx.lineTo(vw, y)
    }
    ctx.stroke()

    // arena bounds
    ctx.strokeStyle = 'rgba(255, 77, 157, 0.4)'
    ctx.lineWidth = 2
    ctx.strokeRect(-ox, -oy, WORLD_W, WORLD_H)
  }
}
