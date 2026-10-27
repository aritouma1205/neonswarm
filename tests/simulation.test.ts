import { describe, it, expect } from 'vitest'
import { Game } from '../src/game/state'
import { rebuildHash } from '../src/game/collisions'
import { spawnEnemy } from '../src/game/enemies'
import { nearestEnemy, addWeapon, orbitPositions } from '../src/game/weapons'

const STEP = 1 / 60

/** Headless smoke test — run 45s of sim with drift input. */
describe('simulation', () => {
  it('runs 45s without crashing and produces combat', () => {
    const g = new Game(123)
    g.newRun()
    let levelUps = 0
    g.onLevelUp = opts => {
      levelUps++
      expect(opts.length).toBeGreaterThan(0)
    }
    // auto-pick first option whenever we level
    const steps = Math.floor(45 / STEP)
    for (let i = 0; i < steps; i++) {
      const t = i * STEP
      const input = { moveX: Math.sin(t * 0.7), moveY: Math.cos(t * 0.7) }
      if (g.phase === 'play') g.update(STEP, input)
      else if (g.phase === 'levelup') {
        g.chooseUpgrade(0)
      } else if (g.phase === 'over') break
    }
    expect(g.kills).toBeGreaterThan(0)
    expect(g.time).toBeGreaterThan(0)
    // in 45s a stationary-ish player should have leveled at least once
    expect(g.player.level + levelUps).toBeGreaterThan(1)
  })

  it('enemy → player contact drains hull', () => {
    const g = new Game(5)
    g.newRun()
    rebuildHash(g)
    spawnEnemy(g, 'drone', g.player.x + 5, g.player.y, 1, false)
    const before = g.player.hp
    for (let i = 0; i < 60 && g.phase === 'play'; i++) {
      g.update(STEP, { moveX: 0, moveY: 0 })
    }
    expect(g.player.hp).toBeLessThan(before)
  })

  it('weapons fire projectiles over time', () => {
    const g = new Game(9)
    g.newRun()
    rebuildHash(g)
    // ring of drones so pulse has targets
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      spawnEnemy(g, 'drone', g.player.x + Math.cos(a) * 300, g.player.y + Math.sin(a) * 300, 1, false)
    }
    let sawProjectile = false
    for (let i = 0; i < 240; i++) {
      g.update(STEP, { moveX: 0, moveY: 0 })
      if (g.projectiles.liveCount > 0) sawProjectile = true
    }
    expect(sawProjectile).toBe(true)
  })

  it('nearestEnemy respects radius and hash', () => {
    const g = new Game(3)
    g.newRun()
    rebuildHash(g)
    const near = spawnEnemy(g, 'mite', g.player.x + 50, g.player.y, 1, false)!
    spawnEnemy(g, 'mite', g.player.x + 400, g.player.y, 1, false)
    rebuildHash(g)
    expect(nearestEnemy(g, g.player.x, g.player.y, 200)).toBe(near)
    expect(nearestEnemy(g, g.player.x, g.player.y, 30)).toBeNull()
  })

  it('orbit positions form a ring', () => {
    const g = new Game(3)
    g.newRun()
    addWeapon(g, 'orbit')
    const w = g.weapons.find(w => w.def.id === 'orbit')!
    w.level = 4 // 3 orbs
    const pts = orbitPositions(w, 0, 0, 1)
    expect(pts).toHaveLength(3)
    const r = Math.hypot(pts[0].x, pts[0].y)
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(r, 5)
  })

  it('xp overflow queues multiple levels and chooseUpgrade drains them', () => {
    const g = new Game(11)
    g.newRun()
    g.onLevelUp = () => {}
    g.addXp(500)
    expect(g.pendingLevels).toBeGreaterThan(2)
    let safety = 20
    while (g.pendingLevels > 0 && safety-- > 0) {
      g.update(STEP, { moveX: 0, moveY: 0 }) // opens levelup
      if (g.phase === 'levelup') g.chooseUpgrade(0)
    }
    expect(g.pendingLevels).toBe(0)
    expect(g.phase).toBe('play')
  })
})
