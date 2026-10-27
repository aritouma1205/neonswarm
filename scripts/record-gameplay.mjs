// Headless gameplay recording: boot the built bundle, drive ~55s with a
// kiting-style input pattern, pick level-up cards, capture video via
// playwright recordVideo (webm → convert separately).
// Usage: node scripts/record-gameplay.mjs [url] [seconds]
import { chromium } from 'playwright-core'
import { mkdirSync, readdirSync } from 'node:fs'

const EXE = '/home/aritouma/.cache/ms-playwright/chromium-1148/chrome-linux/chrome'
const URL = process.argv[2] ?? 'http://localhost:4173/'
const SECONDS = Number(process.argv[3] ?? 55)

mkdirSync('artifacts/video', { recursive: true })

const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: ['--disable-gpu', '--mute-audio'],
})
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: 'artifacts/video', size: { width: 1280, height: 800 } },
})
const page = await context.newPage()
page.on('pageerror', e => console.error('PAGEERROR:', e.message))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.click('#start-btn')
await page.waitForTimeout(400)

// Kiting: hold a direction ~1.2s, rotate through a loose circle so the player
// skirts the swarm edge instead of getting surrounded.
const circle = [
  ['KeyD', 1300], ['KeyW', 900], ['KeyW', 800], ['KeyA', 1200],
  ['KeyS', 900], ['KeyS', 800], ['KeyD', 900], ['KeyA', 700],
]
let i = 0
const t0 = Date.now()
while (Date.now() - t0 < SECONDS * 1000) {
  const card = await page.$('.card')
  if (card) {
    await card.click()
    await page.waitForTimeout(300)
    continue
  }
  const state = await page.evaluate(() => window.__game?.phase)
  if (state === 'gameover') {
    const btn = await page.$('#restart-btn')
    if (btn) { await btn.click(); await page.waitForTimeout(300) }
    continue
  }
  const [key, ms] = circle[i++ % circle.length]
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
}

const hud = await page.evaluate(() => window.__game ? {
  phase: window.__game.phase,
  time: window.__game.time,
  kills: window.__game.kills,
  level: window.__game.player.level,
  hp: window.__game.player.hp,
  enemies: window.__game.enemies.liveCount,
} : null)
console.log('FINAL:', JSON.stringify(hud))

await context.close() // flushes the video
const webm = readdirSync('artifacts/video').find(f => f.endsWith('.webm'))
console.log('VIDEO:', `artifacts/video/${webm}`)
await browser.close()
