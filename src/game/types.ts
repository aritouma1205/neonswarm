export type EnemyKind =
  | 'mite'
  | 'drone'
  | 'wasp'
  | 'spitter'
  | 'bulwark'
  | 'sentinel'
  | 'overmind'

export type ProjectileKind = 'pulse' | 'missile' | 'lance' | 'enemy'

export type WeaponId = 'pulse' | 'orbit' | 'nova' | 'missile' | 'lance'

export interface Enemy {
  active: boolean
  kind: EnemyKind
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  r: number
  speed: number
  dmg: number
  xp: number
  flash: number
  orbCd: number
  shootCd: number
  t: number
  seed: number
  elite: boolean
  boss: boolean
}

export interface Projectile {
  active: boolean
  kind: ProjectileKind
  x: number
  y: number
  vx: number
  vy: number
  r: number
  dmg: number
  life: number
  maxLife: number
  pierce: number
  blast: number
  target: Enemy | null
}

export interface Gem {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  r: number
  value: number
}

export interface Particle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  sprite: number
  drag: number
  grow: number
}

export interface Shockwave {
  active: boolean
  x: number
  y: number
  r: number
  maxR: number
  life: number
  maxLife: number
  color: string
  width: number
}

export interface Floater {
  active: boolean
  x: number
  y: number
  vy: number
  life: number
  maxLife: number
  text: string
  color: string
  size: number
}

export interface Player {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hp: number
  maxHp: number
  level: number
  xp: number
  xpNeed: number
  speed: number
  magnetR: number
  armor: number
  regen: number
  dmgMul: number
  rateMul: number
  areaMul: number
  iframes: number
  facing: number
}

export interface WeaponDef {
  id: WeaponId
  name: string
  tag: string
  color: string
  glyph: string
  damage: readonly number[]
  cooldown: readonly number[]
  count: readonly number[]
  extra: Record<string, readonly number[]>
  blurb: (level: number) => string
}

export interface WeaponState {
  def: WeaponDef
  level: number
  cd: number
  angle: number
}

export type GamePhase = 'menu' | 'play' | 'levelup' | 'paused' | 'over'
