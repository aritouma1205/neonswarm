import { dist2 } from '../core/math'
import { COLORS } from './config'
import { orbitPositions } from './weapons'
import { spawnParticles } from './fx'
import type { Game } from './state'

/** Rebuild the enemy spatial hash. Called once per tick before AI/attacks. */
export function rebuildHash(g: Game): void {
  g.hash.clear()
  g.enemies.forEach(e => g.hash.insert(e))
}

export function updateProjectiles(g: Game, dt: number): void {
  g.projectiles.forEach(pr => {
    pr.life -= dt
    if (pr.life <= 0) {
      if (pr.kind === 'missile') detonate(g, pr.x, pr.y, pr.blast, pr.dmg)
      g.projectiles.release(pr)
      return
    }

    if (pr.kind === 'missile') {
      // retarget if dead
      if (!pr.target || !pr.target.active) {
        pr.target = nearestAlive(g, pr.x, pr.y, 1100)
      }
      if (pr.target) {
        const t = pr.target
        const want = Math.atan2(t.y - pr.y, t.x - pr.x)
        const cur = Math.atan2(pr.vy, pr.vx)
        let diff = want - cur
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        const turn = 6.5 * dt
        const na = cur + Math.max(-turn, Math.min(turn, diff))
        const spd = Math.min(560, Math.hypot(pr.vx, pr.vy) + 620 * dt)
        pr.vx = Math.cos(na) * spd
        pr.vy = Math.sin(na) * spd
      }
      // exhaust trail
      if (g.rng() < 0.7) spawnTrailSafe(g, pr.x, pr.y, COLORS.missile)
    }

    if (pr.kind === 'pulse' && g.rng() < 0.35) {
      spawnTrailSafe(g, pr.x, pr.y, COLORS.pulse)
    }

    pr.x += pr.vx * dt
    pr.y += pr.vy * dt
  })
}

function spawnTrailSafe(g: Game, x: number, y: number, color: string): void {
  const pt = g.particles.obtain()
  if (!pt) return
  pt.x = x
  pt.y = y
  pt.vx = 0
  pt.vy = 0
  pt.life = pt.maxLife = 0.28
  pt.size = 4
  pt.sprite = g.sprites.get(color)
  pt.drag = 0
  pt.grow = -0.5
}

function nearestAlive(g: Game, x: number, y: number, maxR: number) {
  let best: import('./types').Enemy | null = null
  let bestD = maxR * maxR
  g.hash.queryRadius(x, y, maxR, e => {
    const d = dist2(x, y, e.x, e.y)
    if (d < bestD) {
      bestD = d
      best = e
    }
  })
  return best
}

function detonate(g: Game, x: number, y: number, blast: number, dmg: number): void {
  g.hash.queryRadius(x, y, blast + 30, e => {
    const d = Math.hypot(e.x - x, e.y - y)
    if (d <= blast + e.r) {
      const k = 1 - (d / (blast + e.r)) * 0.5
      g.hitEnemy(e, dmg * k, ((e.x - x) / (d || 1)) * 140, ((e.y - y) / (d || 1)) * 140)
    }
  })
  spawnParticles(g, x, y, g.sprites.get(COLORS.missile), 16, 260, 4, 0.45)
  g.audio.explode()
}

/** All contact/hit resolution for one tick. */
export function resolveHits(g: Game): void {
  const p = g.player

  // projectiles → enemies
  g.projectiles.forEach(pr => {
    if (pr.kind === 'enemy' || pr.kind === 'lance') return
    let dead = false
    g.hash.queryRadius(pr.x, pr.y, pr.r + 40, e => {
      if (dead) return
      const rr = pr.r + e.r
      if (dist2(pr.x, pr.y, e.x, e.y) > rr * rr) return
      if (pr.kind === 'missile') {
        detonate(g, pr.x, pr.y, pr.blast, pr.dmg)
        dead = true
        return
      }
      g.hitEnemy(e, pr.dmg, pr.vx * 0.08, pr.vy * 0.08)
      if (pr.pierce > 0) {
        pr.pierce--
      } else {
        dead = true
      }
    })
    if (dead && pr.active) g.projectiles.release(pr)
  })

  // orbital blades → enemies
  for (const w of g.weapons) {
    if (w.def.id !== 'orbit') continue
    const i = w.level - 1
    const orbs = orbitPositions(w, p.x, p.y, p.areaMul)
    const orbR = 13 * p.areaMul
    const dmg = w.def.damage[i] * p.dmgMul
    for (const o of orbs) {
      g.hash.queryRadius(o.x, o.y, orbR + 40, e => {
        if (e.orbCd > 0) return
        const rr = orbR + e.r
        if (dist2(o.x, o.y, e.x, e.y) <= rr * rr) {
          e.orbCd = 0.3
          const d = Math.hypot(e.x - p.x, e.y - p.y) || 1
          g.hitEnemy(e, dmg, ((e.x - p.x) / d) * 200, ((e.y - p.y) / d) * 200)
        }
      })
    }
  }

  // enemies → player (contact damage, gated by i-frames)
  if (p.iframes <= 0) {
    const hits: { dmg: number; x: number; y: number }[] = []
    g.hash.queryRadius(p.x, p.y, p.r + 60, e => {
      if (hits.length > 0) return
      const rr = p.r + e.r
      if (dist2(p.x, p.y, e.x, e.y) <= rr * rr) {
        hits.push({ dmg: e.dmg, x: e.x, y: e.y })
      }
    })
    if (hits.length > 0) {
      const h = hits[0]
      const d = Math.hypot(p.x - h.x, p.y - h.y) || 1
      g.damagePlayer(h.dmg, ((p.x - h.x) / d) * 320, ((p.y - h.y) / d) * 320)
    }
  }

  // enemy bullets → player
  g.projectiles.forEach(pr => {
    if (pr.kind !== 'enemy' || p.iframes > 0) return
    const rr = pr.r + p.r
    if (dist2(pr.x, pr.y, p.x, p.y) <= rr * rr) {
      const d = Math.hypot(p.x - pr.x, p.y - pr.y) || 1
      g.damagePlayer(pr.dmg, ((p.x - pr.x) / d) * 260, ((p.y - pr.y) / d) * 260)
      g.projectiles.release(pr)
    }
  })
}
