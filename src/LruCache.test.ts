import { describe, it, expect } from 'vitest'
import { LruCache } from './LruCache'

describe('LruCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LruCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBeUndefined()
  })

  it('reports size correctly', () => {
    const cache = new LruCache<string, number>(5)
    expect(cache.size).toBe(0)
    cache.set('a', 1)
    expect(cache.size).toBe(1)
    cache.set('b', 2)
    expect(cache.size).toBe(2)
  })

  it('evicts oldest entry when capacity is exceeded', () => {
    const cache = new LruCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    cache.set('d', 4) // should evict 'a'

    expect(cache.size).toBe(3)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('d')).toBe(4)
  })

  it('accessing an entry promotes it so it is not evicted next', () => {
    const cache = new LruCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    // Access 'a' to promote it
    cache.get('a')

    cache.set('d', 4) // should evict 'b' (oldest untouched)

    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe(3)
    expect(cache.get('d')).toBe(4)
  })

  it('overwriting a key updates value and promotes it', () => {
    const cache = new LruCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    // Overwrite 'a' with new value
    cache.set('a', 10)

    cache.set('d', 4) // should evict 'b'

    expect(cache.get('a')).toBe(10)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.size).toBe(3)
  })

  it('has() returns correct boolean without promoting', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)

    expect(cache.has('a')).toBe(true)
    expect(cache.has('z')).toBe(false)

    // has() does not promote, so 'a' should still be evicted first
    cache.set('c', 3) // evicts 'a'
    expect(cache.has('a')).toBe(false)
  })

  it('handles capacity of 1', () => {
    const cache = new LruCache<string, number>(1)
    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)

    cache.set('b', 2)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.size).toBe(1)
  })
})
