import { TAU } from '../core/math'
import type { Enemy, WeaponDef, WeaponId, WeaponState } from './types'
import { COLORS } from './config'
import type { Game } from './state'
import { spawnParticles, spawnShockwave } from './fx'

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  pulse: {
    id: 'pulse',
    name: 'Pulse Blaster',
    tag: 'WEAPON',
    color: COLORS.pulse,
    glyph: '»',
    damage: [12, 16, 21, 27, 36],
    cooldown: [0.62, 0.56, 0.5, 0.44, 0.36],
    count: [1, 1, 2, 2, 3],
    extra: {},
    blurb: l => `Rapid bolts seek the nearest hostile. Mk.${l + 1} raises output.`,
  },
  orbit: {
    id: 'orbit',
    name: 'Gyre Blades',
    tag: 'WEAPON',
    color: COLORS.orbit,
    glyph: '◎',
    damage: [11, 15, 19, 25, 33],
    cooldown: [99, 99, 99, 99, 99],
    count: [1, 2, 2, 3, 4],
    extra: {
      radius: [74, 82, 90, 100, 114],
      spin: [2.5, 2.8, 3.1, 3.5, 4.0],
    },
    blurb: l => `Blades orbit your hull shredding contacts. Mk.${l + 1} adds mass.`,
  },
  nova: {
    id: 'nova',
    name: 'Nova Burst',
    tag: 'WEAPON',
    color: COLORS.nova,
    glyph: '✦',
    damage: [20, 28, 37, 48, 66],
    cooldown: [2.6, 2.4, 2.15, 1.9, 1.6],
    count: [1, 1, 1, 1, 1],
    extra: { radius: [115, 130, 148, 168, 195] },
    blurb: l => `Periodic shockwave annihilates the swarm. Mk.${l + 1} widens the burst.`,
  },
  missile: {
    id: 'missile',
    name: 'Seeker Swarm',
    tag: 'WEAPON',
    color: COLORS.missile,
    glyph: '➤',
    damage: [17, 22, 28, 36, 48],
    cooldown: [1.35, 1.25, 1.12, 1.0, 0.85],
    count: [1, 2, 2, 3, 4],
    extra: { blast: [58, 66, 74, 84, 96] },
    blurb: l => `Homing warheads detonate on impact. Mk.${l + 1} grows the volley.`,
  },
  lance: {
    id: 'lance',
    name: 'Rail Lance',
    tag: 'WEAPON',
    color: COLORS.lance,
    glyph: '⌖',
    damage: [42, 58, 76, 100, 140],
    cooldown: [3.1, 2.9, 2.65, 2.35, 2.0],
    count: [1, 1, 1, 1, 1],
    extra: { width: [16, 19, 22, 27, 32] },
    blurb: l => `Piercing railgun vaporizes a column. Mk.${l + 1} boosts yield.`,
  },
}

export const MAX_WEAPON_LEVEL = 5

export function addWeapon(g: Game, id: WeaponId): void {
  g.weapons.push({ def: WEAPON_DEFS[id], level: 1, cd: 0.3, angle: g.rng() * TAU })
}

export function levelWeapon(g: Game, id: WeaponId): void {
  const w = g.weapons.find(w => w.def.id === id)
  if (w && w.level < MAX_WEAPON_LEVEL) w.level++
}

const lvl = (w: WeaponState) => w.level - 1

export function orbitRadius(w: WeaponState, areaMul: number): number {
  return w.def.extra.radius[lvl(w)] * areaMul
}

export function orbitPositions(w: WeaponState, px: number, py: number, areaMul: number): { x: number; y: number }[] {
  const n = w.def.count[lvl(w)]
  const r = orbitRadius(w, areaMul)
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const a = w.angle + (i * TAU) / n
    out.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r })
  }
  return out
}

export function nearestEnemy(g: Game, x: number, y: number, maxR: number): Enemy | null {
  let best: Enemy | null = null
  let bestD = maxR * maxR
  g.hash.queryRadius(x, y, maxR, e => {
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y)
    if (d < bestD) {
      bestD = d
      best = e
    }
  })
  return best
}

function firePulse(g: Game, w: WeaponState): void {
  const p = g.player
  const i = lvl(w)
  const target = nearestEnemy(g, p.x, p.y, 900)
  const baseA = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.facing
  const n = w.def.count[i]
  for (let k = 0; k < n; k++) {
    const a = baseA + (k - (n - 1) / 2) * 0.12
    const pr = g.projectiles.obtain()
    if (!pr) return
    pr.kind = 'pulse'
    pr.x = p.x
    pr.y = p.y
    pr.vx = Math.cos(a) * 640
    pr.vy = Math.sin(a) * 640
    pr.r = 5
    pr.dmg = w.def.damage[i] * p.dmgMul
    pr.life = pr.maxLife = 1.3
    pr.pierce = 0
    pr.blast = 0
    pr.target = null
  }
  g.audio.shoot()
}

function fireNova(g: Game, w: WeaponState): void {
  const p = g.player
  const i = lvl(w)
  const r = w.def.extra.radius[i] * p.areaMul
  const dmg = w.def.damage[i] * p.dmgMul
  g.hash.queryRadius(p.x, p.y, r + 30, e => {
    const d = Math.hypot(e.x - p.x, e.y - p.y)
    if (d <= r + e.r) {
      g.hitEnemy(e, dmg, (e.x - p.x) / (d || 1) * 160, (e.y - p.y) / (d || 1) * 160)
    }
  })
  spawnShockwave(g, p.x, p.y, r, COLORS.nova, 5)
  spawnParticles(g, p.x, p.y, g.sprites.get(COLORS.nova), 26, 320, 4, 0.5)
  g.camera.shake(0.35)
  g.audio.nova()
}

function fireMissiles(g: Game, w: WeaponState): void {
  const p = g.player
  const i = lvl(w)
  const n = w.def.count[i]
  for (let k = 0; k < n; k++) {
    const pr = g.projectiles.obtain()
    if (!pr) return
    const a = g.rng() * TAU
    pr.kind = 'missile'
    pr.x = p.x
    pr.y = p.y
    pr.vx = Math.cos(a) * 220
    pr.vy = Math.sin(a) * 220
    pr.r = 6
    pr.dmg = w.def.damage[i] * p.dmgMul
    pr.life = pr.maxLife = 3.2
    pr.pierce = 0
    pr.blast = w.def.extra.blast[i] * p.areaMul
    pr.target = nearestEnemy(g, p.x, p.y, 1000)
  }
  g.audio.missile()
}

function fireLance(g: Game, w: WeaponState): void {
  const p = g.player
  const i = lvl(w)
  const target = nearestEnemy(g, p.x, p.y, 1100)
  const a = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.facing
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  const range = 1000
  const width = w.def.extra.width[i] * p.areaMul
  const dmg = w.def.damage[i] * p.dmgMul

  // instant ray test: perpendicular distance to beam < width/2 + e.r
  g.enemies.forEach(e => {
    const rx = e.x - p.x
    const ry = e.y - p.y
    const along = rx * dx + ry * dy
    if (along < -e.r || along > range) return
    const perp = Math.abs(rx * dy - ry * dx)
    if (perp <= width / 2 + e.r) {
      g.hitEnemy(e, dmg, dx * 120, dy * 120)
    }
  })

  // beam visual = short-lived lance projectile that only renders
  const pr = g.projectiles.obtain()
  if (pr) {
    pr.kind = 'lance'
    pr.x = p.x
    pr.y = p.y
    pr.vx = dx
    pr.vy = dy
    pr.r = width
    pr.dmg = 0
    pr.life = pr.maxLife = 0.22
    pr.pierce = 0
    pr.blast = 0
    pr.target = null
  }
  spawnParticles(g, p.x + dx * 30, p.y + dy * 30, g.sprites.get(COLORS.lance), 14, 240, 3, 0.35)
  g.camera.shake(0.5)
  g.audio.lance()
}

export function updateWeapons(g: Game, dt: number): void {
  const p = g.player
  for (const w of g.weapons) {
    const i = lvl(w)
    if (w.def.id === 'orbit') {
      w.angle += w.def.extra.spin[i] * dt
      continue // damage applied in collisions.ts via orbitPositions
    }
    w.cd -= dt
    if (w.cd > 0) continue
    w.cd = w.def.cooldown[i] / p.rateMul
    switch (w.def.id) {
      case 'pulse': firePulse(g, w); break
      case 'nova': fireNova(g, w); break
      case 'missile': fireMissiles(g, w); break
      case 'lance': fireLance(g, w); break
      default: break
    }
  }
}
