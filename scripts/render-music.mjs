// Render the game's sequencer pattern to a WAV for the promo film.
// Same DNA as src/game/audio.ts: A-minor, 132 BPM, bass 8ths + arp 16ths
// + quarter kicks + off-8th hats; impact hits baked at scene seams.
import { writeFileSync, mkdirSync } from 'node:fs'

const SR = 44100
const BPM = 132
const STEP = 60 / BPM / 4
const DURATION = 20.0
const N = Math.floor(SR * DURATION)
const out = new Float32Array(N)

// deterministic noise source
let seed = 1234567
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const noiseBuf = new Float32Array(SR)
for (let i = 0; i < SR; i++) noiseBuf[i] = rnd() * 2 - 1

const add = (t, fn, len) => {
  const s0 = Math.floor(t * SR)
  const s1 = Math.min(N, s0 + Math.floor(len * SR))
  for (let i = s0; i < s1; i++) {
    out[i] += fn((i - s0) / SR)
  }
}

const kick = t0 => add(t0, t => Math.sin(2 * Math.PI * (40 + 90 * Math.exp(-t * 28)) * t) * Math.exp(-t * 22) * 0.9, 0.3)

const bass = (t0, f) =>
  add(
    t0,
    t =>
      (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t) + 0.2 * Math.sin(6 * Math.PI * f * t)) *
      Math.exp(-t * 9) *
      0.30,
    STEP * 1.9,
  )

const arp = (t0, f) =>
  add(
    t0,
    t => (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(6 * Math.PI * f * t)) * Math.exp(-t * 24) * 0.11,
    STEP * 0.95,
  )

const hat = (t0, vol = 0.06) =>
  add(t0, t => noiseBuf[Math.floor(t * SR * 2.7) % SR] * Math.exp(-t * 160) * vol, 0.05)

const snare = t0 =>
  add(
    t0,
    t => noiseBuf[Math.floor(t * SR) % SR] * Math.exp(-t * 45) * 0.12 + Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 40) * 0.08,
    0.15,
  )

// cinematic impact: boom + noise wash
const impact = t0 => {
  add(t0, t => Math.sin(2 * Math.PI * (36 + 60 * Math.exp(-t * 8)) * t) * Math.exp(-t * 5) * 0.8, 0.9)
  add(t0, t => noiseBuf[Math.floor(t * SR) % SR] * Math.exp(-t * 10) * 0.22, 0.5)
}

// riser into a seam
const riser = (t0, len) =>
  add(t0, t => {
    const k = t / len
    return noiseBuf[Math.floor(t * SR) % SR] * k * k * 0.12 * (1 - Math.exp(-(len - t) * 40)) + Math.sin(2 * Math.PI * (220 + 900 * k * k) * t) * k * 0.05
  }, len)

const roots = [55, 43.65, 65.41, 49] // A F C G
const totalSteps = Math.floor(DURATION / STEP)

for (let s = 0; s < totalSteps; s++) {
  const t = s * STEP
  if (t >= DURATION - 1.2) break
  const s16 = s % 16
  const bar = Math.floor(s / 16) % 4
  const root = roots[bar]
  const intro = Math.min(1, t / 3.2) // fade-in ramp over ~3s

  if (s16 % 4 === 0) kick(t)
  if (s16 === 4 || s16 === 12) snare(t)
  if (s16 % 2 === 0) bass(t, root * (s16 === 14 ? 2 : 1))
  const arpNotes = [root * 4, root * 4 * 1.2, root * 4 * 1.5, root * 8]
  arp(t, arpNotes[s % 4] * (bar === 3 && s16 >= 8 ? 1.19 : 1))
  if (s16 % 2 === 1) hat(t)
  void intro
}

// global intro fade-in is applied in normalize pass below via envelope

// baked scene-seam impacts (swarm→gameplay cut, endcard slam) + risers
riser(3.6, 1.0)
impact(4.6)
riser(14.6, 1.0)
impact(15.6)
// outro tail: last impact rings out
impact(19.2)

// normalize + gentle master fade at both ends
let peak = 0
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(out[i]))
const g = 0.85 / Math.max(peak, 1e-6)
for (let i = 0; i < N; i++) {
  const t = i / SR
  const fade = Math.min(1, t / 0.4, Math.max(0, (DURATION - t) / 1.2))
  out[i] *= g * fade
}

// write 16-bit stereo WAV
const bytesPerSample = 2
const dataSize = N * 2 * bytesPerSample
const buf = Buffer.alloc(44 + dataSize)
buf.write('RIFF', 0)
buf.writeUInt32LE(36 + dataSize, 4)
buf.write('WAVE', 8)
buf.write('fmt ', 12)
buf.writeUInt32LE(16, 16)
buf.writeUInt16LE(1, 20)
buf.writeUInt16LE(2, 22)
buf.writeUInt32LE(SR, 24)
buf.writeUInt32LE(SR * 2 * bytesPerSample, 28)
buf.writeUInt16LE(2 * bytesPerSample, 32)
buf.writeUInt16LE(16, 34)
buf.write('data', 36)
buf.writeUInt32LE(dataSize, 40)
for (let i = 0; i < N; i++) {
  const v = Math.max(-1, Math.min(1, out[i]))
  const s = Math.round(v * 32767)
  buf.writeInt16LE(s, 44 + i * 4)
  buf.writeInt16LE(s, 44 + i * 4 + 2)
}

mkdirSync('promo/assets', { recursive: true })
writeFileSync('promo/assets/bgm.wav', buf)
console.log(`wrote promo/assets/bgm.wav (${(dataSize / 1024 / 1024).toFixed(1)} MB, ${DURATION}s)`)
