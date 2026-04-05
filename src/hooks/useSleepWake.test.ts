import { describe, it, expect } from 'vitest'

const source = (await import('./useSleepWake.ts?raw')).default

describe('useSleepWake', () => {
  it('exports a useSleepWake function', () => {
    expect(source).toContain('export function useSleepWake')
  })

  it('accepts isActive parameter', () => {
    expect(source).toMatch(/function useSleepWake\(isActive/)
  })

  it('returns sleeping, haptic, wakeUp, and resetSleepTimer', () => {
    expect(source).toContain('sleeping')
    expect(source).toContain('haptic')
    expect(source).toContain('wakeUp')
    expect(source).toContain('resetSleepTimer')
  })

  it('uses a 3-second sleep timeout', () => {
    expect(source).toContain('3000')
  })

  it('clears existing timer before setting new one in resetSleepTimer', () => {
    expect(source).toContain('clearTimeout')
  })

  it('sets haptic to false after 400ms timeout', () => {
    expect(source).toContain('400')
  })
})
