/**
 * Fully procedural WebAudio engine — synthesized SFX + a 16-step
 * sequencer whose intensity scales with game difficulty.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfx!: GainNode
  private music!: GainNode
  private noiseBuf!: AudioBuffer

  private step = 0
  private nextStepT = 0
  private readonly bpm = 132
  private lastPickup = 0

  /** 0..1 — drives which layers of the music pattern are audible. */
  intensity = 0
  muted = false

  init(): void {
    if (this.ctx) return
    const ctx = new AudioContext()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0.8
    this.master.connect(ctx.destination)

    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.5
    this.sfx.connect(this.master)

    this.music = ctx.createGain()
    this.music.gain.value = 0.3
    this.music.connect(this.master)

    const len = ctx.sampleRate
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = this.noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

    this.nextStepT = ctx.currentTime + 0.1
  }

  resume(): void {
    void this.ctx?.resume()
  }

  // ---------- SFX ----------

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    t: number,
    dur: number,
    vol: number,
    dest: GainNode = this.sfx,
  ): void {
    const ctx = this.ctx
    if (!ctx) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(dest)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private noise(t: number, dur: number, vol: number, fLo: number, fHi: number, dest: GainNode = this.sfx): void {
    const ctx = this.ctx
    if (!ctx) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.playbackRate.value = 1
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(fHi, t)
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, fLo), t + dur)
    bp.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bp).connect(g).connect(dest)
    src.start(t, Math.random())
    src.stop(t + dur + 0.02)
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0
  }

  shoot(): void {
    if (!this.ctx || this.muted) return
    this.tone('square', 880, 320, this.now(), 0.07, 0.05)
  }

  missile(): void {
    if (!this.ctx || this.muted) return
    this.tone('sawtooth', 300, 90, this.now(), 0.16, 0.06)
  }

  nova(): void {
    if (!this.ctx || this.muted) return
    const t = this.now()
    this.tone('sine', 200, 40, t, 0.4, 0.22)
    this.noise(t, 0.35, 0.12, 100, 2400)
  }

  lance(): void {
    if (!this.ctx || this.muted) return
    const t = this.now()
    this.tone('sawtooth', 1400, 120, t, 0.28, 0.1)
    this.noise(t, 0.2, 0.1, 300, 5000)
  }

  explode(): void {
    if (!this.ctx || this.muted) return
    const t = this.now()
    this.noise(t, 0.3, 0.16, 60, 1400)
    this.tone('sine', 140, 35, t, 0.3, 0.14)
  }

  enemyDie(): void {
    if (!this.ctx || this.muted) return
    const t = this.now()
    this.noise(t, 0.18, 0.07, 200, 2600)
    this.tone('triangle', 500, 90, t, 0.14, 0.05)
  }

  pickup(): void {
    if (!this.ctx || this.muted) return
    const t = this.now()
    if (t - this.lastPickup < 0.05) return
    this.lastPickup = t
    this.tone('sine', 660 + Math.random() * 240, 1320, t, 0.09, 0.05)
  }

  hurt(): void {
    if (!this.ctx || this.muted) return
    const t = this.now()
    this.tone('sawtooth', 220, 60, t, 0.25, 0.18)
    this.noise(t, 0.2, 0.14, 80, 900)
  }

  levelup(): void {
    if (!this.ctx || this.muted) return
    const t = this.now()
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => this.tone('triangle', f, f, t + i * 0.07, 0.22, 0.09))
  }

  spit(): void {
    if (!this.ctx || this.muted) return
    this.tone('square', 340, 180, this.now(), 0.08, 0.035)
  }

  bossShot(): void {
    if (!this.ctx || this.muted) return
    this.tone('sawtooth', 160, 70, this.now(), 0.2, 0.09)
  }

  warn(): void {
    if (!this.ctx || this.muted) return
    const t = this.now()
    for (let i = 0; i < 3; i++) {
      this.tone('square', 220, 220, t + i * 0.22, 0.14, 0.1)
      this.tone('square', 174, 174, t + i * 0.22 + 0.1, 0.1, 0.08)
    }
  }

  uiClick(): void {
    if (!this.ctx || this.muted) return
    this.tone('sine', 700, 900, this.now(), 0.06, 0.06)
  }

  gameOver(): void {
    if (!this.ctx || this.muted) return
    const t = this.now()
    ;[440, 349, 293, 220].forEach((f, i) => this.tone('triangle', f, f * 0.98, t + i * 0.18, 0.4, 0.11))
  }

  // ---------- music sequencer ----------

  update(): void {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    const stepDur = 60 / this.bpm / 4
    const ahead = ctx.currentTime + 0.18
    let guard = 32
    while (this.nextStepT < ahead && guard-- > 0) {
      this.scheduleStep(this.step, this.nextStepT, stepDur)
      this.step++
      this.nextStepT += stepDur
    }
  }

  private scheduleStep(step: number, t: number, stepDur: number): void {
    const s16 = step % 16
    const bar = Math.floor(step / 16) % 4
    // A minor progression: A, F, C, G (roots in Hz)
    const roots = [55, 43.65, 65.41, 49]
    const root = roots[bar]
    const k = this.intensity

    // kick on quarters
    if (k > 0.3 && s16 % 4 === 0) {
      this.tone('sine', 130, 40, t, 0.16, 0.3, this.music)
    }
    // snare-ish noise on beats 2 & 4 at high intensity
    if (k > 0.62 && (s16 === 4 || s16 === 12)) {
      this.noise(t, 0.09, 0.07, 900, 4200, this.music)
    }
    // bass eighth notes
    if (k > 0.12 && s16 % 2 === 0) {
      const oct = s16 === 14 ? 2 : 1
      this.tone('sawtooth', root * oct, root * oct * 0.99, t, stepDur * 1.8, 0.11, this.music)
    }
    // arp 16ths
    if (k > 0.2) {
      const arpNotes = [root * 4, root * 4 * 1.2, root * 4 * 1.5, root * 8]
      const f = arpNotes[step % 4]
      this.tone('square', f, f * 0.995, t, stepDur * 0.9, 0.028 + k * 0.03, this.music)
    }
    // hats
    if (k > 0.45 && s16 % 2 === 1) {
      this.noise(t, 0.03, 0.035, 6000, 9000, this.music)
    }
  }
}
