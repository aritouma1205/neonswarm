import { TAU, easeOutCubic } from '../core/math'
import type { Game } from './state'

export function spawnParticles(
  g: Game,
  x: number,
  y: number,
  sprite: number,
  n: number,
  speed: number,
  size: number,
  life: number,
): void {
  for (let i = 0; i < n; i++) {
    const p = g.particles.obtain()
    if (!p) return
    const a = g.rng() * TAU
    const v = speed * (0.3 + g.rng() * 0.9)
    p.x = x
    p.y = y
    p.vx = Math.cos(a) * v
    p.vy = Math.sin(a) * v
    p.life = p.maxLife = life * (0.6 + g.rng() * 0.8)
    p.size = size * (0.6 + g.rng() * 0.9)
    p.sprite = sprite
    p.drag = 3.2
    p.grow = 0
  }
}

export function spawnTrail(g: Game, x: number, y: number, sprite: number, size: number, life = 0.3): void {
  const p = g.particles.obtain()
  if (!p) return
  p.x = x
  p.y = y
  p.vx = 0
  p.vy = 0
  p.life = p.maxLife = life
  p.size = size
  p.sprite = sprite
  p.drag = 0
  p.grow = -0.4
}

export function spawnShockwave(
  g: Game,
  x: number,
  y: number,
  maxR: number,
  color: string,
  width: number,
): void {
  const s = g.shockwaves.obtain()
  if (!s) return
  s.x = x
  s.y = y
  s.r = maxR * 0.15
  s.maxR = maxR
  s.life = s.maxLife = 0.45
  s.color = color
  s.width = width
}

export function spawnFloater(
  g: Game,
  x: number,
  y: number,
  text: string,
  color: string,
  size = 13,
): void {
  const f = g.floaters.obtain()
  if (!f) return
  f.x = x + (g.rng() - 0.5) * 14
  f.y = y - 6
  f.vy = -52
  f.life = f.maxLife = 0.7
  f.text = text
  f.color = color
  f.size = size
}

export function updateFx(g: Game, dt: number): void {
  g.particles.forEach(p => {
    p.life -= dt
    if (p.life <= 0) {
      g.particles.release(p)
      return
    }
    const d = Math.exp(-p.drag * dt)
    p.vx *= d
    p.vy *= d
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.grow !== 0) p.size = Math.max(0.5, p.size * (1 + p.grow * dt))
  })

  g.shockwaves.forEach(s => {
    s.life -= dt
    if (s.life <= 0) {
      g.shockwaves.release(s)
      return
    }
    s.r = s.maxR * easeOutCubic(1 - s.life / s.maxLife)
  })

  g.floaters.forEach(f => {
    f.life -= dt
    if (f.life <= 0) {
      g.floaters.release(f)
      return
    }
    f.y += f.vy * dt
    f.vy *= Math.exp(-3 * dt)
  })
}
