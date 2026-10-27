import { sampleWeighted, type Rng } from '../core/rng'
import { MAX_WEAPONS } from './config'
import type { WeaponId } from './types'
import { WEAPON_DEFS, MAX_WEAPON_LEVEL, addWeapon, levelWeapon } from './weapons'
import type { Game } from './state'

export interface UpgradeOption {
  id: string
  name: string
  tag: 'WEAPON' | 'MODULE' | 'SYSTEM'
  glyph: string
  color: string
  desc: string
  weight: number
  apply: (g: Game) => void
}

interface PassiveDef {
  id: string
  name: string
  glyph: string
  color: string
  max: number
  weight: number
  desc: string
  apply: (g: Game) => void
}

export const PASSIVES: readonly PassiveDef[] = [
  {
    id: 'amp', name: 'Amplifier', glyph: '▲', color: '#ff9c41', max: 6, weight: 10,
    desc: 'All damage +15%',
    apply: g => { g.player.dmgMul *= 1.15 },
  },
  {
    id: 'overclock', name: 'Overclock', glyph: '»', color: '#4de8ff', max: 5, weight: 10,
    desc: 'Fire rate +12%',
    apply: g => { g.player.rateMul *= 1.12 },
  },
  {
    id: 'thrusters', name: 'Thrusters', glyph: '➤', color: '#7dff6a', max: 5, weight: 9,
    desc: 'Move speed +8%',
    apply: g => { g.player.speed *= 1.08 },
  },
  {
    id: 'plating', name: 'Hull Plating', glyph: '⬢', color: '#cfe7ff', max: 5, weight: 9,
    desc: 'Max hull +20, repair 20',
    apply: g => {
      g.player.maxHp += 20
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + 20)
    },
  },
  {
    id: 'nanobots', name: 'Nanobots', glyph: '✚', color: '#7dff6a', max: 4, weight: 7,
    desc: 'Regenerate +0.8 hull/s',
    apply: g => { g.player.regen += 0.8 },
  },
  {
    id: 'magnet', name: 'Tractor Field', glyph: '◎', color: '#ffe14d', max: 4, weight: 8,
    desc: 'Pickup radius +40%',
    apply: g => { g.player.magnetR *= 1.4 },
  },
  {
    id: 'aegis', name: 'Aegis', glyph: '◆', color: '#b45dff', max: 4, weight: 7,
    desc: 'Armor +2 (flat damage cut)',
    apply: g => { g.player.armor += 2 },
  },
  {
    id: 'reach', name: 'Resonance', glyph: '≋', color: '#ff4d9d', max: 5, weight: 8,
    desc: 'Area of effect +15%',
    apply: g => { g.player.areaMul *= 1.15 },
  },
]

const ROMAN = ['', 'II', 'III', 'IV', 'V']

/** All currently offerable upgrades. */
export function buildUpgradePool(g: Game): UpgradeOption[] {
  const opts: UpgradeOption[] = []

  for (const w of g.weapons) {
    if (w.level < MAX_WEAPON_LEVEL) {
      const next = w.level + 1
      opts.push({
        id: `wpn:${w.def.id}:${next}`,
        name: `${w.def.name} MK.${ROMAN[next - 1]}`,
        tag: 'WEAPON',
        glyph: w.def.glyph,
        color: w.def.color,
        desc: w.def.blurb(next),
        weight: 11,
        apply: g => levelWeapon(g, w.def.id),
      })
    }
  }

  if (g.weapons.length < MAX_WEAPONS) {
    for (const id of Object.keys(WEAPON_DEFS) as WeaponId[]) {
      if (g.weapons.some(w => w.def.id === id)) continue
      const d = WEAPON_DEFS[id]
      opts.push({
        id: `new:${id}`,
        name: d.name,
        tag: 'WEAPON',
        glyph: d.glyph,
        color: d.color,
        desc: `New system: ${d.blurb(1)}`,
        weight: 9,
        apply: g => addWeapon(g, id),
      })
    }
  }

  for (const p of PASSIVES) {
    const rank = g.passives.get(p.id) ?? 0
    if (rank >= p.max) continue
    opts.push({
      id: `mod:${p.id}`,
      name: p.name + (rank > 0 ? ` ${ROMAN[rank]}` : ''),
      tag: 'MODULE',
      glyph: p.glyph,
      color: p.color,
      desc: p.desc,
      weight: p.weight,
      apply: g => {
        g.passives.set(p.id, rank + 1)
        p.apply(g)
      },
    })
  }

  // fallback so the pool never runs dry
  opts.push({
    id: 'sys:repair',
    name: 'Emergency Repair',
    tag: 'SYSTEM',
    glyph: '✚',
    color: '#7dff6a',
    desc: 'Restore 30% hull integrity',
    weight: 1.5,
    apply: g => {
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + g.player.maxHp * 0.3)
    },
  })

  return opts
}

export function rollUpgrades(g: Game, rng: Rng, n = 3): UpgradeOption[] {
  const pool = buildUpgradePool(g)
  const idx = sampleWeighted(rng, pool.map(o => o.weight), Math.min(n, pool.length))
  return idx.map(i => pool[i])
}
