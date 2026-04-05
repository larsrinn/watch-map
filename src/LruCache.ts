/**
 * Generic LRU cache backed by a Map (which preserves insertion order).
 * On access, entries are moved to the end. Eviction removes from the front.
 */
export class LruCache<K, V> {
  private map = new Map<K, V>()

  constructor(private readonly capacity: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    // Move to end (most recently used)
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    // If key already exists, delete first so re-insert moves it to end
    if (this.map.has(key)) {
      this.map.delete(key)
    }
    this.map.set(key, value)
    // Evict oldest entries from front
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value!
      this.map.delete(oldest)
    }
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  get size(): number {
    return this.map.size
  }
}
