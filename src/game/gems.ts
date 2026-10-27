import { TAU } from '../core/math'
import { COLORS } from './config'
import { spawnParticles } from './fx'
import type { Game } from './state'

export function spawnGem(g: Game, x: number, y: number, value: number): void {
  const gem = g.gems.obtain()
  if (!gem) return
  const a = g.rng() * TAU
  gem.x = x
  gem.y = y
  gem.vx = Math.cos(a) * 60
  gem.vy = Math.sin(a) * 60
  gem.r = value >= 20 ? 8 : value >= 5 ? 6 : 5
  gem.value = value
}

export function updateGems(g: Game, dt: number): void {
  const p = g.player
  g.gems.forEach(gem => {
    const dx = p.x - gem.x
    const dy = p.y - gem.y
    const d = Math.hypot(dx, dy) || 1

    if (d < p.magnetR) {
      // magnet pull accelerates inward
      const pull = 900 + (p.magnetR - d) * 14
      gem.vx = (dx / d) * pull
      gem.vy = (dy / d) * pull
    } else {
      gem.vx *= Math.exp(-4 * dt)
      gem.vy *= Math.exp(-4 * dt)
    }

    gem.x += gem.vx * dt
    gem.y += gem.vy * dt

    if (d < p.r + gem.r + 4) {
      g.gems.release(gem)
      g.addXp(gem.value)
      spawnParticles(g, gem.x, gem.y, g.sprites.get(COLORS.gem), 5, 120, 3, 0.3)
      g.audio.pickup()
    }
  })
}
