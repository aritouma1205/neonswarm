import { describe, it, expect } from 'vitest'
import { Game } from '../src/game/state'
import type { UpgradeOption } from '../src/game/upgrades'
import { ENEMY_DEFS } from '../src/game/enemies'

const STEP = 1 / 60

/**
 * Kiting bot: steer away from the local threat mass, drift toward gems,
 * avoid walls. Not a perfect player — a baseline for balance checks.
 */
function botMove(g: Game): { moveX: number; moveY: number } {
  const p = g.player
  let ax = 0
  let ay = 0

  // threat field: repel from enemies, weighted by 1/d² and enemy damage
  g.enemies.forEach(e => {
    const dx = p.x - e.x
    const dy = p.y - e.y
    const d2 = dx * dx + dy * dy + 100
    const w = (e.dmg * (e.boss ? 4 : 1)) / d2
    ax += dx * w
    ay += dy * w
  })
  // enemy bullets: strong local repulsion
  g.projectiles.forEach(pr => {
    if (pr.kind !== 'enemy') return
    const dx = p.x - pr.x
    const dy = p.y - pr.y
    const d2 = dx * dx + dy * dy + 100
    const w = 60 / d2
    ax += dx * w
    ay += dy * w
  })
  // gem attraction (weak)
  g.gems.forEach(gem => {
    const dx = gem.x - p.x
    const dy = gem.y - p.y
    const d2 = dx * dx + dy * dy + 2500
    const w = 14 / d2
    ax += dx * w
    ay += dy * w
  })
  // wall repulsion
  const M = 220
  if (p.x < M) ax += (M - p.x) / M
  if (p.x > 3600 - M) ax -= (p.x - (3600 - M)) / M
  if (p.y < M) ay += (M - p.y) / M
  if (p.y > 2400 - M) ay -= (p.y - (2400 - M)) / M
  // centering bias keeps the kite orbit inside the arena
  ax += (1800 - p.x) * 2e-6
  ay += (1200 - p.y) * 2e-6

  const l = Math.hypot(ax, ay) || 1
  return { moveX: ax / l, moveY: ay / l }
}

/** Greedy upgrade heuristic: weapon > module priority list. */
function pickUpgrade(_g: Game, opts: UpgradeOption[]): number {
  const pref = [
    (o: UpgradeOption) => o.id.startsWith('new:nova'),
    (o: UpgradeOption) => o.id.startsWith('new:orbit'),
    (o: UpgradeOption) => o.id.startsWith('new:missile'),
    (o: UpgradeOption) => o.id.startsWith('new:lance'),
    (o: UpgradeOption) => o.id.startsWith('wpn:'),
    (o: UpgradeOption) => o.id === 'mod:magnet',
    (o: UpgradeOption) => o.id === 'mod:amp',
    (o: UpgradeOption) => o.id === 'mod:overclock',
    (o: UpgradeOption) => o.id === 'mod:nanobots',
    (o: UpgradeOption) => o.id === 'mod:plating',
  ]
  for (const pred of pref) {
    const i = opts.findIndex(pred)
    if (i >= 0) return i
  }
  return 0
}

export interface SimResult {
  seed: number
  survived: number
  kills: number
  level: number
  cause: string
  hpSamples: number[]
}

export function simRun(seed: number, maxT = 480): SimResult {
  const g = new Game(seed)
  g.newRun()
  const hpSamples: number[] = []
  const steps = Math.floor(maxT / STEP)
  let cause = 'timeout'
  for (let i = 0; i < steps; i++) {
    if (g.phase === 'play') {
      g.update(STEP, botMove(g))
    } else if (g.phase === 'levelup') {
      g.chooseUpgrade(pickUpgrade(g, g.currentOptions))
    } else if (g.phase === 'over') {
      cause = 'dead'
      break
    }
    if (i % 600 === 0) hpSamples.push(Math.round(g.player.hp))
  }
  if (cause === 'dead') hpSamples.push(0)
  return {
    seed,
    survived: Math.round(g.time * 10) / 10,
    kills: g.kills,
    level: g.player.level,
    cause,
    hpSamples,
  }
}

describe('balance: bot survival', () => {
  it('kiting bot survives into the mid-game across seeds', () => {
    const results = [11, 22, 33].map(s => simRun(s, 480))
    for (const r of results) {
      console.log(
        `seed=${r.seed} survived=${r.survived}s kills=${r.kills} level=${r.level} cause=${r.cause} hp=[${r.hpSamples.join(',')}]`,
      )
    }
    const med = results.map(r => r.survived).sort((a, b) => a - b)[1]
    // baseline expectation: a dumb kiter should make it past the first boss wave
    expect(med).toBeGreaterThan(90)
  }, 120_000)

  it('sim tick stays cheap under a dense field', () => {
    const g = new Game(77)
    g.newRun()
    // jump to a dense late-game field
    for (let i = 0; i < 500; i++) {
      g.update(STEP, { moveX: 0.5, moveY: 0.3 })
      if (g.phase === 'levelup') g.chooseUpgrade(0)
      if (g.phase === 'over') break
    }
    g.director.acc += 200
    for (let i = 0; i < 300; i++) {
      g.update(STEP, { moveX: 0.5, moveY: 0.3 })
      if (g.phase === 'levelup') g.chooseUpgrade(0)
      if (g.phase === 'over') break
    }
    const t0 = performance.now()
    const N = 600
    for (let i = 0; i < N; i++) {
      if (g.phase === 'levelup') g.chooseUpgrade(0)
      if (g.phase !== 'play') break
      g.update(STEP, { moveX: 0.5, moveY: 0.3 })
    }
    const ms = (performance.now() - t0) / N
    console.log(`enemies=${g.enemies.liveCount} projectiles=${g.projectiles.liveCount} particles=${g.particles.liveCount} tick=${ms.toFixed(2)}ms`)
    expect(ms).toBeLessThan(8)
  }, 60_000)

  it('enemy defs are self-consistent', () => {
    for (const [k, d] of Object.entries(ENEMY_DEFS)) {
      expect(d.kind).toBe(k)
      expect(d.hp).toBeGreaterThan(0)
      expect(d.speed).toBeGreaterThan(0)
      expect(d.xp).toBeGreaterThan(0)
    }
  })
})
