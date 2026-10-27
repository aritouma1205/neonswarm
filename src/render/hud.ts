import type { Game } from '../game/state'
import { COLORS } from '../game/config'

const fmtTime = (t: number): string => {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function drawHud(ctx: CanvasRenderingContext2D, g: Game, vw: number, vh: number): void {
  if (g.phase === 'menu') return
  const p = g.player

  // XP bar (top, full width)
  const xpFrac = Math.min(1, p.xp / p.xpNeed)
  ctx.fillStyle = 'rgba(10, 14, 30, 0.85)'
  ctx.fillRect(0, 0, vw, 10)
  ctx.fillStyle = COLORS.gem
  ctx.fillRect(0, 0, vw * xpFrac, 10)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(0, 10, vw, 1)

  // HP bar
  const hpW = 260
  const hpFrac = Math.max(0, p.hp / p.maxHp)
  ctx.fillStyle = 'rgba(10, 14, 30, 0.85)'
  ctx.fillRect(18, 22, hpW, 16)
  const hpColor = hpFrac > 0.5 ? COLORS.player : hpFrac > 0.25 ? COLORS.nova : '#ff4d4d'
  ctx.fillStyle = hpColor
  ctx.fillRect(18, 22, hpW * hpFrac, 16)
  ctx.strokeStyle = 'rgba(207,231,255,0.4)'
  ctx.lineWidth = 1
  ctx.strokeRect(18.5, 22.5, hpW, 16)
  ctx.font = '700 11px ui-monospace, monospace'
  ctx.fillStyle = '#eafcff'
  ctx.fillText(`HULL ${Math.ceil(p.hp)}/${p.maxHp}`, 24, 34)

  // timer
  ctx.font = '800 22px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#cfe7ff'
  ctx.fillText(fmtTime(g.time), vw / 2, 40)
  ctx.textAlign = 'left'

  // kills + level (right)
  ctx.textAlign = 'right'
  ctx.font = '700 14px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(207,231,255,0.8)'
  ctx.fillText(`LV ${p.level}`, vw - 20, 32)
  ctx.fillText(`KILLS ${g.kills}`, vw - 20, 52)
  ctx.textAlign = 'left'

  // weapon row (bottom-left)
  let wx = 20
  const wy = vh - 34
  for (const w of g.weapons) {
    ctx.fillStyle = 'rgba(10,14,30,0.8)'
    ctx.fillRect(wx, wy - 18, 40, 30)
    ctx.strokeStyle = w.def.color
    ctx.lineWidth = 1
    ctx.strokeRect(wx + 0.5, wy - 17.5, 39, 29)
    ctx.font = '16px ui-monospace, monospace'
    ctx.fillStyle = w.def.color
    ctx.fillText(w.def.glyph, wx + 6, wy + 4)
    ctx.font = '700 9px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(207,231,255,0.75)'
    ctx.fillText(`v${w.level}`, wx + 26, wy + 5)
    wx += 48
  }

  // boss bar
  let boss: import('../game/types').Enemy | null = null
  for (const e of g.enemies.items) {
    if (e.active && e.boss) {
      boss = e
      break
    }
  }
  if (boss) {
    const b: import('../game/types').Enemy = boss
    const bw = Math.min(560, vw - 120)
    const bx = (vw - bw) / 2
    ctx.fillStyle = 'rgba(10,14,30,0.85)'
    ctx.fillRect(bx, vh - 44, bw, 12)
    ctx.fillStyle = '#ff2d78'
    ctx.fillRect(bx, vh - 44, bw * Math.max(0, b.hp / b.maxHp), 12)
    ctx.strokeStyle = 'rgba(255,45,120,0.6)'
    ctx.strokeRect(bx + 0.5, vh - 43.5, bw, 12)
    ctx.font = '700 10px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffc4dc'
    ctx.fillText(b.kind.toUpperCase(), vw / 2, vh - 50)
    ctx.textAlign = 'left'
  }

  // low-hp red edge
  if (hpFrac < 0.3 && g.phase === 'play') {
    const a = (0.3 - hpFrac) / 0.3
    const grad = ctx.createRadialGradient(vw / 2, vh / 2, vh / 3, vw / 2, vh / 2, vh)
    grad.addColorStop(0, 'rgba(255,40,40,0)')
    grad.addColorStop(1, `rgba(255,40,60,${0.28 * a})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, vw, vh)
  }
}
