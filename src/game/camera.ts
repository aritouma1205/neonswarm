import { clamp, damp } from '../core/math'
import { WORLD_W, WORLD_H } from './config'

export class Camera {
  x = 0
  y = 0
  trauma = 0
  viewW = 1280
  viewH = 720

  follow(tx: number, ty: number, dt: number): void {
    this.x = damp(this.x, tx, 8, dt)
    this.y = damp(this.y, ty, 8, dt)
    this.clampToWorld()
    this.trauma = Math.max(0, this.trauma - dt * 1.8)
  }

  snap(tx: number, ty: number): void {
    this.x = tx
    this.y = ty
    this.clampToWorld()
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  /** Current render offset including shake. */
  offset(rng: () => number): { ox: number; oy: number } {
    const s = this.trauma * this.trauma * 22
    return {
      ox: this.x - this.viewW / 2 + (rng() - 0.5) * s,
      oy: this.y - this.viewH / 2 + (rng() - 0.5) * s,
    }
  }

  private clampToWorld(): void {
    const hw = this.viewW / 2
    const hh = this.viewH / 2
    if (WORLD_W > this.viewW) this.x = clamp(this.x, hw, WORLD_W - hw)
    else this.x = WORLD_W / 2
    if (WORLD_H > this.viewH) this.y = clamp(this.y, hh, WORLD_H - hh)
    else this.y = WORLD_H / 2
  }
}
