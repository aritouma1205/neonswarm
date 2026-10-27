export interface Poolable {
  active: boolean
}

/**
 * Fixed-capacity object pool. Objects keep an `active` flag; obtain()
 * revives the first inactive slot. Iteration order stays stable so a
 * release during forEach is safe.
 */
export class Pool<T extends Poolable> {
  readonly items: T[] = []
  liveCount = 0

  constructor(factory: () => T, capacity: number) {
    for (let i = 0; i < capacity; i++) this.items.push(factory())
  }

  obtain(): T | null {
    for (const it of this.items) {
      if (!it.active) {
        it.active = true
        this.liveCount++
        return it
      }
    }
    return null
  }

  release(it: T): void {
    if (it.active) {
      it.active = false
      this.liveCount--
    }
  }

  forEach(fn: (it: T) => void): void {
    for (const it of this.items) if (it.active) fn(it)
  }

  clear(): void {
    for (const it of this.items) it.active = false
    this.liveCount = 0
  }
}
