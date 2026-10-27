export class Input {
  private keys = new Set<string>()

  constructor() {
    window.addEventListener('keydown', e => {
      if (e.repeat) return
      this.keys.add(e.code)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
    })
    window.addEventListener('keyup', e => this.keys.delete(e.code))
    window.addEventListener('blur', () => this.keys.clear())
  }

  /** -1..1 movement axes (WASD + arrows). */
  get moveX(): number {
    return (
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0)
    )
  }

  get moveY(): number {
    return (
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0)
    )
  }

  pressed(code: string): boolean {
    return this.keys.has(code)
  }
}
