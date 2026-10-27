import { describe, it, expect } from 'vitest'
import {
  Director,
  difficultyAt,
  hpMulAt,
  spawnRateAt,
  BOSS_SCHEDULE,
  SPAWN_TABLE,
} from '../src/game/director'
import { mulberry32 } from '../src/core/rng'

describe('director curves', () => {
  it('difficulty and spawn rate grow monotonically', () => {
    for (let t = 0; t < 600; t += 10) {
      expect(difficultyAt(t + 10)).toBeGreaterThan(difficultyAt(t))
      expect(spawnRateAt(t + 10)).toBeGreaterThanOrEqual(spawnRateAt(t))
      expect(hpMulAt(t + 10)).toBeGreaterThan(hpMulAt(t))
    }
  })

  it('starts near baseline', () => {
    expect(difficultyAt(0)).toBe(1)
    expect(hpMulAt(0)).toBe(1)
    expect(spawnRateAt(0)).toBeCloseTo(1.5)
  })
})

describe('Director.tick', () => {
  it('spawns only unlocked kinds and spends budget', () => {
    const d = new Director()
    const rng = mulberry32(1)
    // t=0: only mites unlocked
    let out = d.tick(0, 5, rng, 0, 999)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every(s => s.kind === 'mite')).toBe(true)

    // t=200: everything unlocked
    d.reset()
    const kinds = new Set<string>()
    for (let i = 0; i < 20; i++) d.tick(200, 1, rng, 0, 999).forEach(s => kinds.add(s.kind))
    expect(kinds.size).toBeGreaterThan(1)
    for (const k of kinds) {
      expect(SPAWN_TABLE.find(s => s.kind === k)!.unlockAt).toBeLessThanOrEqual(200)
    }
  })

  it('respects the alive cap', () => {
    const d = new Director()
    const rng = mulberry32(2)
    const out = d.tick(300, 10, rng, 338, 340)
    expect(out.length).toBeLessThanOrEqual(2)
  })

  it('bosses fire once and warnings precede them', () => {
    const d = new Director()
    const first = BOSS_SCHEDULE[0]
    // before warn window: nothing
    expect(d.pendingWarnings(first.at - 6)).toHaveLength(0)
    // inside window: one warning, then never again
    expect(d.pendingWarnings(first.at - 4)).toHaveLength(1)
    expect(d.pendingWarnings(first.at - 4)).toHaveLength(0)
    // boss spawns at t>=at exactly once
    expect(d.pendingBosses(first.at - 0.1)).toHaveLength(0)
    expect(d.pendingBosses(first.at)).toHaveLength(1)
    expect(d.pendingBosses(first.at + 30)).toHaveLength(0)
  })
})
