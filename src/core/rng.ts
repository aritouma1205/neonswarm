export type Rng = () => number

/** Deterministic seeded PRNG (mulberry32). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function range(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo)
}

export function intRange(rng: Rng, lo: number, hi: number): number {
  return Math.floor(range(rng, lo, hi + 1))
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Weighted pick; weights need not be normalized. Returns index. */
export function pickWeighted(rng: Rng, weights: readonly number[]): number {
  let total = 0
  for (const w of weights) total += w
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return i
  }
  return weights.length - 1
}

/** Sample `n` distinct indices from weighted candidates (without replacement). */
export function sampleWeighted(rng: Rng, weights: readonly number[], n: number): number[] {
  const idx = weights.map((_, i) => i)
  const w = weights.slice()
  const out: number[] = []
  while (out.length < n && idx.length > 0) {
    const k = pickWeighted(rng, w)
    out.push(idx[k])
    idx.splice(k, 1)
    w.splice(k, 1)
  }
  return out
}
