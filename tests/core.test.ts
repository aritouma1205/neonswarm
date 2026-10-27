import { describe, it, expect } from 'vitest'
import { mulberry32, range, intRange, pick, pickWeighted, sampleWeighted } from '../src/core/rng'
import { clamp, lerp, damp, normAngle, easeOutCubic, TAU } from '../src/core/math'
import { Pool } from '../src/core/pool'
import { SpatialHash } from '../src/core/spatialHash'

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })

  it('differs across seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('range/intRange/pick stay in bounds', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 500; i++) {
      const v = range(rng, -3, 5)
      expect(v).toBeGreaterThanOrEqual(-3)
      expect(v).toBeLessThan(5)
      const iv = intRange(rng, 0, 3)
      expect(iv).toBeGreaterThanOrEqual(0)
      expect(iv).toBeLessThanOrEqual(3)
      expect(Number.isInteger(iv)).toBe(true)
      expect([10, 20, 30]).toContain(pick(rng, [10, 20, 30]))
    }
  })

  it('pickWeighted returns valid indices and favors heavy weights', () => {
    const rng = mulberry32(99)
    const counts = [0, 0, 0]
    for (let i = 0; i < 3000; i++) counts[pickWeighted(rng, [1, 10, 1])]++
    expect(counts[1]).toBeGreaterThan(counts[0] * 4)
    expect(counts[1]).toBeGreaterThan(counts[2] * 4)
  })

  it('sampleWeighted returns distinct indices', () => {
    const rng = mulberry32(5)
    const idx = sampleWeighted(rng, [1, 2, 3, 4, 5], 3)
    expect(idx).toHaveLength(3)
    expect(new Set(idx).size).toBe(3)
    for (const i of idx) expect(i).toBeGreaterThanOrEqual(0)
  })
})

describe('math', () => {
  it('clamp/lerp basics', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(lerp(0, 10, 0.5)).toBe(5)
  })

  it('damp converges toward target', () => {
    let v = 0
    for (let i = 0; i < 200; i++) v = damp(v, 100, 5, 1 / 60)
    expect(v).toBeGreaterThan(99)
    expect(v).toBeLessThanOrEqual(100.01)
  })

  it('normAngle wraps into (-π, π]', () => {
    expect(normAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 5)
    expect(normAngle(-3 * Math.PI)).toBeCloseTo(Math.PI, 5)
    expect(normAngle(TAU / 4)).toBeCloseTo(Math.PI / 2, 5)
  })

  it('easing endpoints', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })
})

describe('pool', () => {
  it('recycles released slots and honors capacity', () => {
    const pool = new Pool(() => ({ active: false, v: 0 }), 3)
    const a = pool.obtain()!
    const b = pool.obtain()!
    const c = pool.obtain()!
    expect(pool.liveCount).toBe(3)
    expect(pool.obtain()).toBeNull()
    pool.release(b)
    expect(pool.liveCount).toBe(2)
    const d = pool.obtain()!
    expect(d).toBe(b)
    expect(pool.liveCount).toBe(3)
    expect(a.active && c.active && d.active).toBe(true)
  })

  it('clear resets everything', () => {
    const pool = new Pool(() => ({ active: false }), 4)
    pool.obtain()
    pool.obtain()
    pool.clear()
    expect(pool.liveCount).toBe(0)
    expect(pool.items.every(i => !i.active)).toBe(true)
  })
})

describe('spatialHash', () => {
  it('queryRadius returns exactly the in-radius items', () => {
    const h = new SpatialHash<{ x: number; y: number; id: number }>(32)
    const items = [
      { x: 0, y: 0, id: 1 },
      { x: 10, y: 0, id: 2 },
      { x: 500, y: 500, id: 3 },
      { x: -40, y: -40, id: 4 },
    ]
    items.forEach(i => h.insert(i))
    const found = new Set<number>()
    h.queryRadius(0, 0, 20, it => found.add(it.id))
    expect(found).toEqual(new Set([1, 2]))
  })

  it('handles negative coordinates', () => {
    const h = new SpatialHash<{ x: number; y: number; id: number }>(32)
    h.insert({ x: -100, y: -100, id: 7 })
    const found: number[] = []
    h.queryRadius(-100, -100, 5, it => found.push(it.id))
    expect(found).toEqual([7])
  })
})
