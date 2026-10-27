export const TAU = Math.PI * 2

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Frame-rate independent exponential approach. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  return dx * dx + dy * dy
}

export function normAngle(a: number): number {
  a = a % TAU
  if (a > Math.PI) a -= TAU
  if (a <= -Math.PI) a += TAU
  return a
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
export const easeInQuad = (t: number): number => t * t
export const easeOutBack = (t: number): number => {
  const c = 1.70158
  const u = t - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}
