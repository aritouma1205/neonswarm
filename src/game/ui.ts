import type { UpgradeOption } from './upgrades'

export interface RunStats {
  time: number
  kills: number
  level: number
  best: number
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const fmtTime = (t: number): string => {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** DOM overlay screens: title / level-up cards / pause / game over. */
export class UI {
  private root: HTMLElement
  private bannerEl: HTMLElement
  private hintEl: HTMLElement
  private bannerTimer = 0
  /** Currently shown level-up options (for 1/2/3 hotkeys). */
  cardPick: ((i: number) => void) | null = null
  cardCount = 0

  constructor() {
    this.root = document.getElementById('ui')!
    this.bannerEl = document.createElement('div')
    this.bannerEl.id = 'banner'
    this.root.appendChild(this.bannerEl)
    this.hintEl = document.createElement('div')
    this.hintEl.id = 'hint'
    this.root.appendChild(this.hintEl)
  }

  private clearScreens(): void {
    this.root.querySelectorAll('.screen').forEach(el => el.remove())
  }

  private screen(html: string): HTMLElement {
    this.clearScreens()
    const el = document.createElement('div')
    el.className = 'screen'
    el.innerHTML = html
    this.root.appendChild(el)
    return el
  }

  showTitle(onStart: () => void): void {
    const el = this.screen(`
      <div class="title">NEON<span class="accent">SWARM</span></div>
      <div class="subtitle">survive the bloom</div>
      <div class="controls">
        <span><b>WASD / ←↑↓→</b></span><span>move</span>
        <span><b>1 / 2 / 3</b></span><span>choose upgrade</span>
        <span><b>P / ESC</b></span><span>pause</span>
        <span><b>M</b></span><span>mute</span>
      </div>
      <button class="btn" id="start-btn">Deploy</button>
    `)
    el.querySelector('#start-btn')!.addEventListener('click', onStart)
    this.hintEl.textContent = ''
  }

  showLevelUp(level: number, opts: UpgradeOption[], onPick: (i: number) => void): void {
    this.cardCount = opts.length
    this.cardPick = onPick
    const cards = opts
      .map(
        (o, i) => `
      <div class="card" data-i="${i}">
        <div class="glyph" style="color:${o.color}">${o.glyph}</div>
        <div class="name" style="color:${o.color}">${esc(o.name)}</div>
        <div class="tag">${o.tag}</div>
        <div class="desc">${esc(o.desc)}</div>
        <div class="key">[ ${i + 1} ]</div>
      </div>`,
      )
      .join('')
    const el = this.screen(`
      <div class="levelup-title">Level ${level} — Choose System</div>
      <div class="cards">${cards}</div>
    `)
    el.querySelectorAll('.card').forEach(c => {
      c.addEventListener('click', () => onPick(Number((c as HTMLElement).dataset.i)))
    })
  }

  showPause(): void {
    this.screen(`
      <div class="title" style="font-size:44px">PAUSED</div>
      <div class="subtitle">press P / ESC to resume</div>
    `)
  }

  showGameOver(stats: RunStats, onRestart: () => void): void {
    const newBest = stats.time >= stats.best
    const el = this.screen(`
      <div class="dead-title">SIGNAL LOST</div>
      <div class="stats">
        <span class="k">survived</span><span class="v">${fmtTime(stats.time)}</span>
        <span class="k">kills</span><span class="v">${stats.kills}</span>
        <span class="k">level</span><span class="v">${stats.level}</span>
        <span class="k">best</span><span class="v">${fmtTime(stats.best)}${newBest ? ' ★' : ''}</span>
      </div>
      <button class="btn" id="restart-btn">Redeploy</button>
    `)
    el.querySelector('#restart-btn')!.addEventListener('click', onRestart)
    this.hintEl.textContent = ''
  }

  /** Hide all screens (resume gameplay). */
  play(): void {
    this.clearScreens()
    this.cardPick = null
    this.cardCount = 0
    this.hintEl.textContent = 'wasd move · p pause · m mute'
  }

  banner(text: string): void {
    this.bannerEl.textContent = text
    this.bannerEl.classList.add('show')
    this.bannerTimer = 3.2
  }

  update(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt
      if (this.bannerTimer <= 0) this.bannerEl.classList.remove('show')
    }
  }
}
