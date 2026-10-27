import type { EnemyKind } from './types'
import type { Rng } from '../core/rng'

/** Difficulty multiplier over time (seconds). ~1 at start, ~3.5 at 5min, ~9 at 10min. */
export function difficultyAt(t: number): number {
  const m = t / 60
  return 1 + m * 0.55 + m * m * 0.05
}

/** Enemy HP multiplier — gentler ramp than spawn budget. */
export function hpMulAt(t: number): number {
  const m = t / 60
  return 1 + m * 0.3 + m * m * 0.025
}

/** Spawn budget generated per second. */
export function spawnRateAt(t: number): number {
  return Math.min(16, 1.5 + t / 40 + (t * t) / 55000)
}

export const ELITE_CHANCE = (t: number): number => Math.min(0.14, 0.008 + t / 5500)

interface SpawnPick {
  kind: EnemyKind
  cost: number
  weight: number
  unlockAt: number
}

export const SPAWN_TABLE: readonly SpawnPick[] = [
  { kind: 'mite',    cost: 1, weight: 10, unlockAt: 0 },
  { kind: 'drone',   cost: 2, weight: 7,  unlockAt: 18 },
  { kind: 'wasp',    cost: 3, weight: 5,  unlockAt: 50 },
  { kind: 'spitter', cost: 4, weight: 4,  unlockAt: 85 },
  { kind: 'bulwark', cost: 6, weight: 3,  unlockAt: 125 },
]

export interface BossEvent {
  at: number
  kind: EnemyKind
  name: string
}

export const BOSS_SCHEDULE: readonly BossEvent[] = [
  { at: 95,  kind: 'sentinel', name: 'SENTINEL' },
  { at: 230, kind: 'overmind', name: 'OVERMIND' },
]

export const BOSS_WARN_LEAD = 5

export class Director {
  acc = 0
  warned = new Set<number>()
  spawned = new Set<number>()

  reset(): void {
    this.acc = 0
    this.warned.clear()
    this.spawned.clear()
  }

  /** Boss events that need a warning banner right now. */
  pendingWarnings(t: number): BossEvent[] {
    const out: BossEvent[] = []
    BOSS_SCHEDULE.forEach((ev, i) => {
      if (!this.warned.has(i) && t >= ev.at - BOSS_WARN_LEAD && t < ev.at) {
        this.warned.add(i)
        out.push(ev)
      }
    })
    return out
  }

  /** Boss events that should spawn right now. */
  pendingBosses(t: number): BossEvent[] {
    const out: BossEvent[] = []
    BOSS_SCHEDULE.forEach((ev, i) => {
      if (!this.spawned.has(i) && t >= ev.at) {
        this.spawned.add(i)
        out.push(ev)
      }
    })
    return out
  }

  /** Accumulate budget and pick enemy kinds to spawn this tick. */
  tick(t: number, dt: number, rng: Rng, alive: number, cap: number): { kind: EnemyKind; elite: boolean }[] {
    this.acc += spawnRateAt(t) * dt
    const table = SPAWN_TABLE.filter(s => t >= s.unlockAt)
    const cheapest = table.reduce((m, s) => Math.min(m, s.cost), Infinity)
    const out: { kind: EnemyKind; elite: boolean }[] = []
    const eliteChance = ELITE_CHANCE(t)

    let guard = 64
    while (this.acc >= cheapest && guard-- > 0) {
      if (alive + out.length >= cap) {
        this.acc = Math.min(this.acc, cheapest * 2)
        break
      }
      const affordable = table.filter(s => s.cost <= this.acc)
      if (affordable.length === 0) break
      const weights = affordable.map(s => s.weight)
      let total = 0
      for (const w of weights) total += w
      let r = rng() * total
      let sel = affordable[0]
      for (let i = 0; i < affordable.length; i++) {
        r -= weights[i]
        if (r < 0) {
          sel = affordable[i]
          break
        }
      }
      this.acc -= sel.cost
      out.push({ kind: sel.kind, elite: rng() < eliteChance })
    }
    return out
  }
}
