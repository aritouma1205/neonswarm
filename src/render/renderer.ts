import type { Game } from '../game/state'
import type { SpriteBank } from './sprites'
import { polyPath } from './sprites'
import { Starfield } from './background'
import { ENEMY_DEFS } from '../game/enemies'
import { orbitPositions } from '../game/weapons'
import { COLORS } from '../game/config'
import { TAU } from '../core/math'

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private sprites: SpriteBank,
    private stars: Starfield,
  ) {}

  draw(g: Game, ox: number, oy: number, vw: number, vh: number, t: number): void {
    const ctx = this.ctx
    this.stars.draw(ctx, ox, oy, vw, vh, t)

    ctx.save()
    ctx.translate(-ox, -oy)

    this.drawGems(g)
    this.drawShockwaves(g)
    this.drawEnemies(g)
    this.drawOrbitals(g)
    this.drawProjectiles(g)
    if (g.phase !== 'over') this.drawPlayer(g, t)
    this.drawParticles(g)
    this.drawFloaters(g)

    ctx.restore()
  }

  private drawGems(g: Game): void {
    const ctx = this.ctx
    const si = this.sprites.get(COLORS.gem)
    for (const gem of g.gems.items) {
      if (!gem.active) continue
      this.sprites.draw(ctx, si, gem.x, gem.y, 0.28, 0.5)
      polyPath(ctx, gem.x, gem.y, gem.r, 4, g.time * 2)
      ctx.fillStyle = '#d9ffca'
      ctx.fill()
    }
  }

  private drawShockwaves(g: Game): void {
    const ctx = this.ctx
    for (const s of g.shockwaves.items) {
      if (!s.active) continue
      const a = s.life / s.maxLife
      ctx.globalAlpha = a * 0.9
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.width * a + 1
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, TAU)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  private drawEnemies(g: Game): void {
    const ctx = this.ctx
    for (const e of g.enemies.items) {
      if (!e.active) continue
      const def = ENEMY_DEFS[e.kind]
      const si = this.sprites.get(def.color)
      this.sprites.draw(ctx, si, e.x, e.y, e.r / 14, e.boss ? 0.85 : 0.55)

      const rot = e.t * 1.2 + e.seed
      polyPath(ctx, e.x, e.y, e.r, def.sides, rot)
      if (e.flash > 0) {
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      } else {
        ctx.fillStyle = 'rgba(8, 12, 26, 0.9)'
        ctx.fill()
        ctx.strokeStyle = e.elite ? '#ffffff' : def.color
        ctx.lineWidth = e.boss ? 3 : 2
        ctx.stroke()
      }

      if (e.elite && e.flash <= 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1
        polyPath(ctx, e.x, e.y, e.r + 4, def.sides, -rot * 0.7)
        ctx.stroke()
      }

      // boss hp arc
      if (e.boss && e.flash <= 0) {
        ctx.strokeStyle = 'rgba(255,45,120,0.8)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * (e.hp / e.maxHp))
        ctx.stroke()
      }
    }
  }

  private drawOrbitals(g: Game): void {
    const ctx = this.ctx
    const p = g.player
    for (const w of g.weapons) {
      if (w.def.id !== 'orbit') continue
      const orbs = orbitPositions(w, p.x, p.y, p.areaMul)
      const si = this.sprites.get(COLORS.orbit)
      const orbR = 13 * p.areaMul
      // faint path ring
      ctx.globalAlpha = 0.14
      ctx.strokeStyle = COLORS.orbit
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.hypot(orbs[0].x - p.x, orbs[0].y - p.y), 0, TAU)
      ctx.stroke()
      ctx.globalAlpha = 1
      for (const o of orbs) {
        this.sprites.draw(ctx, si, o.x, o.y, orbR / 13, 0.8)
        ctx.fillStyle = '#eaffea'
        ctx.beginPath()
        ctx.arc(o.x, o.y, orbR * 0.45, 0, TAU)
        ctx.fill()
      }
    }
  }

  private drawProjectiles(g: Game): void {
    const ctx = this.ctx
    for (const pr of g.projectiles.items) {
      if (!pr.active) continue
      switch (pr.kind) {
        case 'pulse': {
          const si = this.sprites.get(COLORS.pulse)
          this.sprites.draw(ctx, si, pr.x, pr.y, 0.35, 0.8)
          const l = 14
          const v = Math.hypot(pr.vx, pr.vy) || 1
          ctx.strokeStyle = '#d8fbff'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(pr.x, pr.y)
          ctx.lineTo(pr.x - (pr.vx / v) * l, pr.y - (pr.vy / v) * l)
          ctx.stroke()
          break
        }
        case 'missile': {
          const si = this.sprites.get(COLORS.missile)
          this.sprites.draw(ctx, si, pr.x, pr.y, 0.4, 0.9)
          const a = Math.atan2(pr.vy, pr.vx)
          polyPath(ctx, pr.x, pr.y, pr.r + 2, 3, a)
          ctx.fillStyle = '#fff3e0'
          ctx.fill()
          break
        }
        case 'enemy': {
          const si = this.sprites.get(COLORS.enemyBullet)
          this.sprites.draw(ctx, si, pr.x, pr.y, 0.45, 0.9)
          ctx.fillStyle = '#ffb3b3'
          ctx.beginPath()
          ctx.arc(pr.x, pr.y, pr.r, 0, TAU)
          ctx.fill()
          break
        }
        case 'lance': {
          const a = pr.life / pr.maxLife
          const len = 1000
          ctx.globalAlpha = a
          const grad = ctx.createLinearGradient(pr.x, pr.y, pr.x + pr.vx * len, pr.y + pr.vy * len)
          grad.addColorStop(0, '#ffffff')
          grad.addColorStop(0.1, COLORS.lance)
          grad.addColorStop(1, 'rgba(180,93,255,0)')
          ctx.strokeStyle = grad
          ctx.lineWidth = pr.r * a + 2
          ctx.beginPath()
          ctx.moveTo(pr.x, pr.y)
          ctx.lineTo(pr.x + pr.vx * len, pr.y + pr.vy * len)
          ctx.stroke()
          ctx.globalAlpha = 1
          break
        }
      }
    }
  }

  private drawPlayer(g: Game, t: number): void {
    const ctx = this.ctx
    const p = g.player
    const si = this.sprites.get(COLORS.player)

    // i-frames blink
    if (p.iframes > 0 && Math.floor(t * 24) % 2 === 0) return

    this.sprites.draw(ctx, si, p.x, p.y, 0.9, 0.8)

    // engine glow
    const ex = p.x - Math.cos(p.facing) * p.r
    const ey = p.y - Math.sin(p.facing) * p.r
    const flick = 0.16 + Math.sin(t * 40) * 0.04
    this.sprites.draw(ctx, si, ex, ey, flick, 0.9)

    // hull
    polyPath(ctx, p.x, p.y, p.r, 3, p.facing)
    ctx.fillStyle = '#0a1526'
    ctx.fill()
    ctx.strokeStyle = COLORS.player
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#eafcff'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3.4, 0, TAU)
    ctx.fill()
  }

  private drawParticles(g: Game): void {
    const ctx = this.ctx
    ctx.globalCompositeOperation = 'lighter'
    for (const p of g.particles.items) {
      if (!p.active) continue
      const a = p.life / p.maxLife
      this.sprites.draw(ctx, p.sprite, p.x, p.y, (p.size / 32) * (0.6 + a * 0.7), a)
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  private drawFloaters(g: Game): void {
    const ctx = this.ctx
    ctx.textAlign = 'center'
    for (const f of g.floaters.items) {
      if (!f.active) continue
      const a = Math.min(1, (f.life / f.maxLife) * 2)
      ctx.globalAlpha = a
      ctx.font = `700 ${f.size}px ui-monospace, monospace`
      ctx.fillStyle = f.color
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1
    ctx.textAlign = 'left'
  }
}
