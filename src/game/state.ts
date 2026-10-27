import { Pool } from '../core/pool'
import { SpatialHash } from '../core/spatialHash'
import { mulberry32, type Rng } from '../core/rng'
import { TAU, clamp, normAngle } from '../core/math'
import {
  WORLD_W,
  WORLD_H,
  ENEMY_CAP,
  PROJ_CAP,
  GEM_CAP,
  PARTICLE_CAP,
  FLOATER_CAP,
  SHOCK_CAP,
  PLAYER_BASE,
  XP_FOR_LEVEL,
  COLORS,
} from './config'
import type {
  Enemy,
  Floater,
  GamePhase,
  Gem,
  Particle,
  Player,
  Projectile,
  Shockwave,
  WeaponState,
} from './types'
import { ENEMY_DEFS, spawnEnemy, updateEnemies } from './enemies'
import { Director, difficultyAt, hpMulAt } from './director'
import { updateWeapons, addWeapon } from './weapons'
import { rebuildHash, updateProjectiles, resolveHits } from './collisions'
import { updateGems, spawnGem } from './gems'
import { updateFx, spawnParticles, spawnShockwave, spawnFloater } from './fx'
import { rollUpgrades, type UpgradeOption } from './upgrades'
import { Camera } from './camera'
import { AudioEngine } from './audio'
import { SpriteBank } from '../render/sprites'

const mkEnemy = (): Enemy => ({
  active: false, kind: 'mite', x: 0, y: 0, vx: 0, vy: 0,
  hp: 1, maxHp: 1, r: 9, speed: 0, dmg: 0, xp: 0,
  flash: 0, orbCd: 0, shootCd: 0, t: 0, seed: 0, elite: false, boss: false,
})

const mkProj = (): Projectile => ({
  active: false, kind: 'pulse', x: 0, y: 0, vx: 0, vy: 0,
  r: 4, dmg: 0, life: 0, maxLife: 0, pierce: 0, blast: 0, target: null,
})

const mkGem = (): Gem => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, r: 5, value: 1 })

const mkParticle = (): Particle => ({
  active: false, x: 0, y: 0, vx: 0, vy: 0,
  life: 0, maxLife: 1, size: 4, sprite: 0, drag: 0, grow: 0,
})

const mkShock = (): Shockwave => ({
  active: false, x: 0, y: 0, r: 0, maxR: 0, life: 0, maxLife: 1, color: '#fff', width: 2,
})

const mkFloater = (): Floater => ({
  active: false, x: 0, y: 0, vy: 0, life: 0, maxLife: 1, text: '', color: '#fff', size: 12,
})

const mkPlayer = (): Player => ({
  x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0, r: PLAYER_BASE.r,
  hp: PLAYER_BASE.hp, maxHp: PLAYER_BASE.hp,
  level: 1, xp: 0, xpNeed: XP_FOR_LEVEL(1),
  speed: PLAYER_BASE.speed, magnetR: PLAYER_BASE.magnetR,
  armor: PLAYER_BASE.armor, regen: PLAYER_BASE.regen,
  dmgMul: 1, rateMul: 1, areaMul: 1,
  iframes: 0, facing: 0,
})

export interface MoveInput {
  moveX: number
  moveY: number
}

export class Game {
  phase: GamePhase = 'menu'
  rng: Rng = mulberry32(0)

  enemies = new Pool(mkEnemy, ENEMY_CAP)
  projectiles = new Pool(mkProj, PROJ_CAP)
  gems = new Pool(mkGem, GEM_CAP)
  particles = new Pool(mkParticle, PARTICLE_CAP)
  floaters = new Pool(mkFloater, FLOATER_CAP)
  shockwaves = new Pool(mkShock, SHOCK_CAP)

  hash = new SpatialHash<Enemy>(72)
  director = new Director()
  camera = new Camera()
  sprites = new SpriteBank()
  audio = new AudioEngine()

  player = mkPlayer()
  weapons: WeaponState[] = []
  passives = new Map<string, number>()

  time = 0
  kills = 0
  best = 0
  pendingLevels = 0
  currentOptions: UpgradeOption[] = []

  /** Wired by main.ts */
  onLevelUp: (opts: UpgradeOption[]) => void = () => {}
  onGameOver: () => void = () => {}
  onBanner: (text: string) => void = () => {}

  constructor(seed = (Math.random() * 2 ** 31) | 0) {
    this.rng = mulberry32(seed)
    this.best =
      typeof localStorage !== 'undefined'
        ? Number(localStorage.getItem('neonswarm_best') ?? 0) || 0
        : 0
  }

  newRun(): void {
    this.enemies.clear()
    this.projectiles.clear()
    this.gems.clear()
    this.particles.clear()
    this.floaters.clear()
    this.shockwaves.clear()
    this.player = mkPlayer()
    this.weapons = []
    this.passives.clear()
    this.director.reset()
    this.time = 0
    this.kills = 0
    this.pendingLevels = 0
    this.currentOptions = []
    addWeapon(this, 'pulse')
    this.camera.snap(this.player.x, this.player.y)
    this.phase = 'play'
  }

  update(dt: number, input: MoveInput): void {
    if (this.phase !== 'play' && this.phase !== 'over') return
    if (this.phase === 'play') this.stepPlay(dt, input)
    else updateFx(this, dt)
    this.audio.update()
  }

  private stepPlay(dt: number, input: MoveInput): void {
    this.time += dt
    const t = this.time

    // director: warnings + boss spawns + regular spawns
    for (const ev of this.director.pendingWarnings(t)) {
      this.onBanner(`⚠ ${ev.name} APPROACHES`)
      this.audio.warn()
    }
    for (const ev of this.director.pendingBosses(t)) {
      const pos = this.edgeSpawnPos()
      spawnEnemy(this, ev.kind, pos.x, pos.y, 1, false)
      this.onBanner(`${ev.name} ONLINE`)
      this.camera.shake(0.6)
    }
    const hpMul = hpMulAt(t)
    for (const s of this.director.tick(t, dt, this.rng, this.enemies.liveCount, ENEMY_CAP)) {
      const pos = this.edgeSpawnPos()
      spawnEnemy(this, s.kind, pos.x, pos.y, hpMul, s.elite)
    }

    // player movement
    const p = this.player
    const mx = input.moveX
    const my = input.moveY
    const ml = Math.hypot(mx, my)
    if (ml > 0) {
      p.vx = (mx / ml) * p.speed
      p.vy = (my / ml) * p.speed
      p.facing = normAngle(Math.atan2(my, mx))
      // engine trail
      if (this.rng() < 0.5) {
        const pt = this.particles.obtain()
        if (pt) {
          pt.x = p.x - Math.cos(p.facing) * p.r
          pt.y = p.y - Math.sin(p.facing) * p.r
          pt.vx = -p.vx * 0.15
          pt.vy = -p.vy * 0.15
          pt.life = pt.maxLife = 0.32
          pt.size = 5
          pt.sprite = this.sprites.get(COLORS.player)
          pt.drag = 0
          pt.grow = -0.4
        }
      }
    } else {
      p.vx *= Math.exp(-8 * dt)
      p.vy *= Math.exp(-8 * dt)
    }
    p.x = clamp(p.x + p.vx * dt, p.r, WORLD_W - p.r)
    p.y = clamp(p.y + p.vy * dt, p.r, WORLD_H - p.r)

    if (p.iframes > 0) p.iframes -= dt
    if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt)

    // world sim
    rebuildHash(this)
    updateEnemies(this, dt)
    updateWeapons(this, dt)
    updateProjectiles(this, dt)
    resolveHits(this)
    updateGems(this, dt)
    updateFx(this, dt)

    this.camera.follow(p.x, p.y, dt)
    this.audio.intensity = clamp(difficultyAt(t) / 7, 0, 1)

    // queued level-ups open once damage resolution is done
    if (this.pendingLevels > 0) this.openLevelUp()
  }

  /** Random point just outside the camera view, inside world bounds. */
  private edgeSpawnPos(): { x: number; y: number } {
    const margin = 90
    const hw = this.camera.viewW / 2 + margin
    const hh = this.camera.viewH / 2 + margin
    const side = Math.floor(this.rng() * 4)
    let x: number
    let y: number
    if (side === 0) {
      x = this.camera.x - hw + this.rng() * hw * 2
      y = this.camera.y - hh
    } else if (side === 1) {
      x = this.camera.x - hw + this.rng() * hw * 2
      y = this.camera.y + hh
    } else if (side === 2) {
      x = this.camera.x - hw
      y = this.camera.y - hh + this.rng() * hh * 2
    } else {
      x = this.camera.x + hw
      y = this.camera.y - hh + this.rng() * hh * 2
    }
    return { x: clamp(x, 20, WORLD_W - 20), y: clamp(y, 20, WORLD_H - 20) }
  }

  hitEnemy(e: Enemy, dmg: number, kx: number, ky: number): void {
    if (!e.active) return
    e.hp -= dmg
    e.flash = 0.09
    e.x += kx * 0.016
    e.y += ky * 0.016
    if (dmg >= 1) spawnFloater(this, e.x, e.y - e.r, String(Math.round(dmg)), '#cfe7ff', 12)
    if (e.hp <= 0) this.killEnemy(e)
  }

  private killEnemy(e: Enemy): void {
    const def = ENEMY_DEFS[e.kind]
    const si = this.sprites.get(def.color)
    spawnParticles(this, e.x, e.y, si, e.boss ? 60 : e.elite ? 26 : 12, e.boss ? 420 : 240, e.boss ? 7 : 4, 0.6)
    spawnShockwave(this, e.x, e.y, e.boss ? 200 : e.elite ? 90 : 50, def.color, 3)
    this.enemies.release(e)
    this.kills++
    this.audio.enemyDie()
    if (e.boss) {
      this.camera.shake(1)
      this.onBanner(`${e.kind.toUpperCase()} DESTROYED`)
      this.audio.explode()
    } else if (e.elite) {
      this.camera.shake(0.4)
    }
    // xp gems — split big drops into chunks
    let remaining = e.xp
    while (remaining > 0) {
      const chunk = remaining >= 20 ? 20 : remaining >= 5 ? 5 : 1
      spawnGem(this, e.x + (this.rng() - 0.5) * 20, e.y + (this.rng() - 0.5) * 20, chunk)
      remaining -= chunk
    }
  }

  damagePlayer(dmg: number, kx: number, ky: number): void {
    const p = this.player
    const real = Math.max(1, Math.round(dmg - p.armor))
    p.hp -= real
    p.iframes = PLAYER_BASE.iframesOnHit
    p.x += kx * 0.02
    p.y += ky * 0.02
    this.camera.shake(0.55)
    spawnFloater(this, p.x, p.y - 20, `-${real}`, '#ff6b6b', 15)
    spawnParticles(this, p.x, p.y, this.sprites.get('#ff6b6b'), 12, 200, 4, 0.4)
    this.audio.hurt()
    if (p.hp <= 0) {
      p.hp = 0
      this.phase = 'over'
      if (this.time > this.best) {
        this.best = this.time
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('neonswarm_best', String(this.best))
        }
      }
      spawnParticles(this, p.x, p.y, this.sprites.get(COLORS.player), 80, 420, 6, 1.1)
      spawnShockwave(this, p.x, p.y, 260, COLORS.player, 6)
      this.camera.shake(1)
      this.audio.gameOver()
      this.onGameOver()
    }
  }

  addXp(v: number): void {
    const p = this.player
    p.xp += v
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed
      p.level++
      p.xpNeed = XP_FOR_LEVEL(p.level)
      this.pendingLevels++
    }
  }

  private openLevelUp(): void {
    if (this.phase !== 'play') return
    this.phase = 'levelup'
    this.currentOptions = rollUpgrades(this, this.rng, 3)
    this.audio.levelup()
    this.onLevelUp(this.currentOptions)
  }

  chooseUpgrade(i: number): void {
    const opt = this.currentOptions[i]
    if (!opt) return
    opt.apply(this)
    this.pendingLevels--
    this.currentOptions = []
    this.audio.uiClick()
    if (this.pendingLevels > 0) {
      this.currentOptions = rollUpgrades(this, this.rng, 3)
      this.onLevelUp(this.currentOptions)
    } else {
      this.phase = 'play'
    }
  }

  fireEnemyBullet(x: number, y: number, dx: number, dy: number, speed: number, dmg: number): void {
    const pr = this.projectiles.obtain()
    if (!pr) return
    pr.kind = 'enemy'
    pr.x = x
    pr.y = y
    pr.vx = dx * speed
    pr.vy = dy * speed
    pr.r = 5
    pr.dmg = dmg
    pr.life = pr.maxLife = 4
    pr.pierce = 0
    pr.blast = 0
    pr.target = null
  }

  radialBurst(e: Enemy, n: number, speed: number, dmg: number): void {
    const off = this.rng() * TAU
    for (let i = 0; i < n; i++) {
      const a = off + (i * TAU) / n
      this.fireEnemyBullet(e.x, e.y, Math.cos(a), Math.sin(a), speed, dmg)
    }
    spawnShockwave(this, e.x, e.y, e.r + 40, '#ff2d78', 3)
  }

  enemyCount(): number {
    return this.enemies.liveCount
  }
}
