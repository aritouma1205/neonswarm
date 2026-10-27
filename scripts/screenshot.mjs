// Headless smoke-run: boot the game, drive it ~40s, capture screenshots.
// Usage: node scripts/screenshot.mjs [url]
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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('pageerror', e => console.error('PAGEERROR:', e.message))
page.on('console', m => {
  if (m.type() === 'error') console.error('CONSOLE:', m.text())
})

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.screenshot({ path: 'artifacts/01-title.png' })

await page.click('#start-btn')
await page.waitForTimeout(400)

const dirs = [
  ['KeyD', 1400], ['KeyW', 1200], ['KeyA', 1400], ['KeyS', 1100],
  ['KeyD', 1600], ['KeyS', 900], ['KeyA', 1200], ['KeyW', 1300],
]

const t0 = Date.now()
let shots = 0
while (Date.now() - t0 < 40_000) {
  const card = await page.$('.card')
  if (card) {
    await page.screenshot({ path: `artifacts/levelup-${Date.now() - t0}ms.png` })
    await card.click()
    await page.waitForTimeout(250)
    continue
  }
  const [key, ms] = dirs[Math.floor(Math.random() * dirs.length)]
  await page.keyboard.down(key)
  await page.waitForTimeout(Math.min(ms, 600))
  await page.keyboard.up(key)
  if (++shots % 14 === 0) {
    await page.screenshot({ path: `artifacts/02-play-${shots}.png` })
    const state = await page.evaluate(() => window.__game?.time ?? null)
    console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s gameTime=${state}`)
  }
}

await page.screenshot({ path: 'artifacts/03-end.png' })
const hud = await page.evaluate(() => window.__game ? {
  phase: window.__game.phase,
  time: window.__game.time,
  kills: window.__game.kills,
  level: window.__game.player.level,
  hp: window.__game.player.hp,
  enemies: window.__game.enemies.liveCount,
} : null)
console.log('FINAL:', JSON.stringify(hud))
await browser.close()
