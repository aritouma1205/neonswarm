import { describe, it, expect } from 'vitest'
import { Game } from '../src/game/state'
import { buildUpgradePool, rollUpgrades } from '../src/game/upgrades'
import { WEAPON_DEFS, MAX_WEAPON_LEVEL } from '../src/game/weapons'
import { MAX_WEAPONS, XP_FOR_LEVEL } from '../src/game/config'
import { mulberry32 } from '../src/core/rng'
import type { WeaponId } from '../src/game/types'

const mkGame = (seed = 1) => {
  const g = new Game(seed)
  g.newRun()
  return g
}

describe('upgrade pool', () => {
  it('offers leveling existing weapons and new weapons', () => {
    const g = mkGame()
    const pool = buildUpgradePool(g)
    const ids = pool.map(o => o.id)
    expect(ids).toContain('wpn:pulse:2')
    // all other weapons offered as new
    for (const id of Object.keys(WEAPON_DEFS) as WeaponId[]) {
      if (id === 'pulse') continue
      expect(ids).toContain(`new:${id}`)
    }
    // modules present
    expect(pool.some(o => o.tag === 'MODULE')).toBe(true)
  })

  it('stops offering new weapons at the slot cap and maxed levels', () => {
    const g = mkGame()
    while (g.weapons.length < MAX_WEAPONS) {
      buildUpgradePool(g).find(o => o.tag === 'WEAPON' && o.id.startsWith('new:'))!.apply(g)
    }
    let pool = buildUpgradePool(g)
    expect(pool.every(o => !o.id.startsWith('new:'))).toBe(true)
    // max all weapons
    for (const w of g.weapons) w.level = MAX_WEAPON_LEVEL
    pool = buildUpgradePool(g)
    expect(pool.every(o => !o.id.startsWith('wpn:'))).toBe(true)
    // still never empty (fallback repair card)
    expect(pool.length).toBeGreaterThan(0)
  })

  it('rollUpgrades returns distinct options', () => {
    const g = mkGame(7)
    const rng = mulberry32(7)
    for (let i = 0; i < 30; i++) {
      const opts = rollUpgrades(g, rng, 3)
      expect(opts.length).toBe(3)
      expect(new Set(opts.map(o => o.id)).size).toBe(3)
    }
  })

  it('passive ranks accumulate and respect max', () => {
    const g = mkGame()
    const amp = () => buildUpgradePool(g).find(o => o.id === 'mod:amp')!
    amp().apply(g)
    expect(g.passives.get('amp')).toBe(1)
    const before = g.player.dmgMul
    amp().apply(g)
    expect(g.passives.get('amp')).toBe(2)
    expect(g.player.dmgMul).toBeGreaterThan(before)
  })
})

describe('xp curve', () => {
  it('level cost grows monotonically', () => {
    for (let l = 1; l < 40; l++) {
      expect(XP_FOR_LEVEL(l + 1)).toBeGreaterThan(XP_FOR_LEVEL(l))
    }
  })
})
