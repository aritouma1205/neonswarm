import type { Enemy, EnemyKind } from './types'
import { TAU, clamp } from '../core/math'
import type { Game } from './state'

export interface EnemyDef {
  kind: EnemyKind
  hp: number
  speed: number
  dmg: number
  r: number
  xp: number
  color: string
  sides: number
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  mite:     { kind: 'mite',     hp: 9,    speed: 148, dmg: 8,  r: 9,  xp: 1,   color: '#ff4d9d', sides: 3 },
  drone:    { kind: 'drone',    hp: 26,   speed: 96,  dmg: 12, r: 14, xp: 2,   color: '#ff7a45', sides: 4 },
  wasp:     { kind: 'wasp',     hp: 18,   speed: 205, dmg: 10, r: 10, xp: 3,   color: '#ffe14d', sides: 3 },
  spitter:  { kind: 'spitter',  hp: 36,   speed: 72,  dmg: 10, r: 13, xp: 4,   color: '#b45dff', sides: 5 },
  bulwark:  { kind: 'bulwark',  hp: 150,  speed: 44,  dmg: 22, r: 23, xp: 7,   color: '#ff3b3b', sides: 6 },
  sentinel: { kind: 'sentinel', hp: 950,  speed: 55,  dmg: 26, r: 34, xp: 45,  color: '#ff2d78', sides: 6 },
  overmind: { kind: 'overmind', hp: 2800, speed: 42,  dmg: 34, r: 50, xp: 140, color: '#c7245a', sides: 8 },
}

export function spawnEnemy(
  g: Game,
  kind: EnemyKind,
  x: number,
  y: number,
  hpMul: number,
  elite: boolean,
): Enemy | null {
  const e = g.enemies.obtain()
  if (!e) return null
  const d = ENEMY_DEFS[kind]
  const boss = kind === 'sentinel' || kind === 'overmind'
  e.kind = kind
  e.x = x
  e.y = y
  e.vx = 0
  e.vy = 0
  e.maxHp = Math.round(d.hp * hpMul * (elite ? 5 : 1) * (boss ? 1 : 1))
  e.hp = e.maxHp
  e.r = d.r * (elite ? 1.5 : 1)
  e.speed = d.speed * (elite ? 0.9 : 1) * (0.9 + g.rng() * 0.2)
  e.dmg = Math.round(d.dmg * (elite ? 1.6 : 1))
  e.xp = d.xp * (elite ? 6 : 1)
  e.flash = 0
  e.orbCd = 0
  e.shootCd = 1 + g.rng() * 1.5
  e.t = 0
  e.seed = g.rng() * TAU
  e.elite = elite
  e.boss = boss
  return e
}

const SEP_RADIUS = 26
const SEP_FORCE = 60

export function updateEnemies(g: Game, dt: number): void {
  const p = g.player

  g.enemies.forEach(e => {
    e.t += dt
    if (e.flash > 0) e.flash -= dt
    if (e.orbCd > 0) e.orbCd -= dt

    const dx = p.x - e.x
    const dy = p.y - e.y
    const dist = Math.hypot(dx, dy) || 1
    const ux = dx / dist
    const uy = dy / dist

    let ax = ux
    let ay = uy
    let spd = e.speed

    switch (e.kind) {
      case 'wasp': {
        const s = Math.sin(e.t * 5 + e.seed)
        ax = ux + -uy * s * 0.9
        ay = uy + ux * s * 0.9
        break
      }
      case 'spitter': {
        // keep ~260 range, strafe slowly
        const want = 260
        const radial = clamp((dist - want) / 120, -1, 1)
        const strafe = Math.sin(e.t * 1.3 + e.seed)
        ax = ux * radial + -uy * strafe * 0.5
        ay = uy * radial + ux * strafe * 0.5
        e.shootCd -= dt
        if (e.shootCd <= 0 && dist < 520) {
          e.shootCd = 2.4 + g.rng() * 0.8
          g.fireEnemyBullet(e.x, e.y, ux, uy, 190, e.dmg)
          g.audio.spit()
        }
        break
      }
      case 'sentinel': {
        e.shootCd -= dt
        if (e.shootCd <= 0) {
          e.shootCd = 3.2
          g.radialBurst(e, 12, 170, e.dmg)
          g.audio.bossShot()
        }
        break
      }
      case 'overmind': {
        e.shootCd -= dt
        if (e.shootCd <= 0) {
          e.shootCd = 2.4
          g.radialBurst(e, 18, 160, e.dmg)
          // spiral volley aimed at player
          for (let i = 0; i < 3; i++) {
            const a = Math.atan2(uy, ux) + (i - 1) * 0.28
            g.fireEnemyBullet(e.x, e.y, Math.cos(a), Math.sin(a), 230, e.dmg)
          }
          g.audio.bossShot()
        }
        break
      }
      default:
        break
    }

    const al = Math.hypot(ax, ay) || 1
    e.vx = (ax / al) * spd
    e.vy = (ay / al) * spd
    e.x = clamp(e.x + e.vx * dt, e.r, 3600 - e.r)
    e.y = clamp(e.y + e.vy * dt, e.r, 2400 - e.r)
  })

  // pairwise separation via the spatial hash built this frame
  g.enemies.forEach(e => {
    let pushX = 0
    let pushY = 0
    g.hash.query(e.x, e.y, SEP_RADIUS, o => {
      if (o === e) return
      const dx = e.x - o.x
      const dy = e.y - o.y
      const d2 = dx * dx + dy * dy
      const min = e.r + o.r
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2)
        const f = ((min - d) / min) * SEP_FORCE
        pushX += (dx / d) * f
        pushY += (dy / d) * f
      }
    })
    e.x = clamp(e.x + pushX * dt, e.r, 3600 - e.r)
    e.y = clamp(e.y + pushY * dt, e.r, 2400 - e.r)
  })
}
