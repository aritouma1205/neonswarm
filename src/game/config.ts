export const WORLD_W = 3600
export const WORLD_H = 2400

export const ENEMY_CAP = 340
export const PROJ_CAP = 480
export const GEM_CAP = 420
export const PARTICLE_CAP = 1100
export const FLOATER_CAP = 180
export const SHOCK_CAP = 80

export const PLAYER_BASE = {
  hp: 100,
  speed: 265,
  r: 12,
  magnetR: 90,
  armor: 0,
  regen: 0,
  iframesOnHit: 0.55,
}

export const XP_FOR_LEVEL = (level: number): number =>
  Math.floor(10 + Math.pow(level, 1.42) * 6)

export const MAX_WEAPONS = 4

export const COLORS = {
  player: '#4de8ff',
  pulse: '#4de8ff',
  orbit: '#7dff6a',
  nova: '#ffe14d',
  missile: '#ff9c41',
  lance: '#b45dff',
  gem: '#7dff6a',
  enemyBullet: '#ff5d5d',
} as const
