import './style.css'
import { Game } from './game/state'
import { Input } from './core/input'
import { Renderer } from './render/renderer'
import { Starfield } from './render/background'
import { drawHud } from './render/hud'
import { UI } from './game/ui'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

const VIEW_H_WORLD = 820 // world units visible vertically

let dpr = Math.min(2, window.devicePixelRatio || 1)
let scale = 1

function resize(): void {
  dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = Math.floor(w * dpr)
  canvas.height = Math.floor(h * dpr)
  scale = h / VIEW_H_WORLD
  game.camera.viewW = w / scale
  game.camera.viewH = VIEW_H_WORLD
}

const input = new Input()
const ui = new UI()
const game = new Game()
const renderer = new Renderer(ctx, game.sprites, new Starfield())

function startRun(): void {
  game.audio.init()
  game.audio.resume()
  game.newRun()
  ui.play()
  ui.banner('SURVIVE')
}

game.onLevelUp = opts => {
  ui.showLevelUp(game.player.level, opts, i => {
    game.chooseUpgrade(i)
    if (game.phase === 'play') ui.play()
  })
}

game.onGameOver = () => {
  setTimeout(() => {
    ui.showGameOver(
      { time: game.time, kills: game.kills, level: game.player.level, best: game.best },
      startRun,
    )
  }, 1400)
}

game.onBanner = text => ui.banner(text)

function togglePause(): void {
  if (game.phase === 'play') {
    game.phase = 'paused'
    ui.showPause()
  } else if (game.phase === 'paused') {
    game.phase = 'play'
    ui.play()
  }
}

function afterChoose(): void {
  if (game.phase === 'play') ui.play()
}

window.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    togglePause()
    return
  }
  if (e.code === 'KeyM') {
    game.audio.muted = !game.audio.muted
    return
  }
  if (game.phase === 'levelup' && ui.cardPick) {
    const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code)
    if (n >= 0 && n < ui.cardCount) {
      game.chooseUpgrade(n)
      afterChoose()
    }
    return
  }
  if ((game.phase === 'menu' || game.phase === 'over') && (e.code === 'Enter' || e.code === 'Space')) {
    // over screen handles restart via button; allow key restart when button exists
    const btn = document.querySelector<HTMLButtonElement>('#start-btn, #restart-btn')
    btn?.click()
  }
})

window.addEventListener('resize', resize)
resize()
ui.showTitle(startRun)

// expose for headless smoke tests / debugging
;(window as unknown as { __game: Game }).__game = game
import('./game/weapons').then(m => {
  ;(window as unknown as { __addWeapon: (id: string) => void }).__addWeapon = id =>
    m.addWeapon(game, id as import('./game/types').WeaponId)
})

// ---- fixed-step loop ----
const STEP = 1 / 60
let acc = 0
let last = performance.now()

function frame(now: number): void {
  const dtReal = Math.min(0.1, (now - last) / 1000)
  last = now
  acc += dtReal

  let guard = 8
  while (acc >= STEP && guard-- > 0) {
    game.update(STEP, input)
    acc -= STEP
  }
  if (guard <= 0) acc = 0

  ui.update(dtReal)

  const vw = game.camera.viewW
  const vh = game.camera.viewH
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
  const { ox, oy } = game.camera.offset(() => Math.random())
  renderer.draw(game, ox, oy, vw, vh, game.time)
  drawHud(ctx, game, vw, vh)

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
