// Stage a dense action frame: play ~25s, inject a horde ring + orbiting blades,
// let explosions bloom, then screenshot — real engine state, posed.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const EXE = '/home/aritouma/.cache/ms-playwright/chromium-1148/chrome-linux/chrome'
const URL = process.argv[2] ?? 'http://localhost:4173/'

mkdirSync('artifacts', { recursive: true })

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--disable-gpu', '--mute-audio'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on('pageerror', e => console.error('PAGEERROR:', e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.click('#start-btn')
await page.waitForTimeout(500)

// survive ~24s with circular strafing + auto-pick upgrades
const t0 = Date.now()
while (Date.now() - t0 < 24_000) {
  const card = await page.$('.card')
  if (card) {
    await card.click()
    await page.waitForTimeout(200)
    continue
  }
  const t = (Date.now() - t0) / 1000
  const kx = Math.cos(t * 1.6) > 0 ? 'KeyD' : 'KeyA'
  const ky = Math.sin(t * 1.6) > 0 ? 'KeyS' : 'KeyW'
  await page.keyboard.down(kx)
  await page.keyboard.down(ky)
  await page.waitForTimeout(220)
  await page.keyboard.up(kx)
  await page.keyboard.up(ky)
}

// pose the money shot: a dense ring of enemies + nova burst + orbitals
await page.waitForFunction(() => typeof window.__addWeapon === 'function', null, { timeout: 10000 })
await page.evaluate(() => {
  const g = window.__game
  const p = g.player
  const defs = {
    mite: { hp: 9, speed: 148, dmg: 8, r: 9, xp: 1 },
    drone: { hp: 26, speed: 96, dmg: 12, r: 14, xp: 2 },
    wasp: { hp: 18, speed: 205, dmg: 10, r: 10, xp: 3 },
    bulwark: { hp: 150, speed: 44, dmg: 22, r: 23, xp: 7 },
    spitter: { hp: 36, speed: 72, dmg: 10, r: 13, xp: 4 },
  }
  const kinds = Object.keys(defs)
  for (let i = 0; i < 110; i++) {
    const e = g.enemies.obtain()
    if (!e) break
    const kind = kinds[i % kinds.length]
    const d = defs[kind]
    const a = (i / 110) * Math.PI * 2 + (i % 7) * 0.05
    const r = 270 + (i % 5) * 80
    e.kind = kind
    e.x = p.x + Math.cos(a) * r
    e.y = p.y + Math.sin(a) * r
    e.vx = e.vy = 0
    e.maxHp = e.hp = d.hp * 3
    e.r = d.r
    e.speed = d.speed
    e.dmg = d.dmg
    e.xp = d.xp
    e.flash = 0
    e.orbCd = 0
    e.shootCd = 2
    e.t = Math.random() * 5
    e.seed = Math.random() * 6.28
    e.elite = i % 17 === 0
    e.boss = false
  }
  // a sentinel boss looming top-left
  const b = g.enemies.obtain()
  if (b) {
    b.kind = 'sentinel'
    b.x = p.x - 420
    b.y = p.y - 260
    b.vx = b.vy = 0
    b.maxHp = b.hp = 950
    b.r = 34
    b.speed = 55
    b.dmg = 26
    b.xp = 45
    b.flash = 0
    b.orbCd = 0
    b.shootCd = 1
    b.t = 0
    b.seed = 0
    b.elite = false
    b.boss = true
  }
  g.camera.snap(p.x, p.y)
  // arm the player for the shot
  for (const id of ['orbit', 'nova', 'missile', 'lance']) {
    if (!g.weapons.some(w => w.def.id === id)) window.__addWeapon?.(id)
  }
  for (const w of g.weapons) w.level = Math.max(w.level, 3)
  // freeze progression so no level-up overlay opens over the shot
  g.player.xpNeed = 1e9
  g.pendingLevels = 0
  if (g.phase === 'levelup') {
    g.phase = 'play'
    document.querySelectorAll('.screen').forEach(el => el.remove())
  }
})

// let the sim chew on it — weapons will fire into the swarm
await page.waitForTimeout(1400)
await page.screenshot({ path: 'artifacts/hero-1.png' })
await page.waitForTimeout(900)
await page.screenshot({ path: 'artifacts/hero-2.png' })
await page.waitForTimeout(900)
await page.screenshot({ path: 'artifacts/hero-3.png' })

const state = await page.evaluate(() => ({
  phase: window.__game.phase,
  hp: window.__game.player.hp,
  level: window.__game.player.level,
  kills: window.__game.kills,
  enemies: window.__game.enemies.liveCount,
  weapons: window.__game.weapons.map(w => `${w.def.id}:${w.level}`),
}))
console.log(JSON.stringify(state))
await browser.close()
