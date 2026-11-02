import { afterEach, describe, expect, it, vi } from 'vitest'
import { startClock } from '../../src/features/typing/engine/clock'

afterEach(() => { vi.useRealTimers() })

describe('browser clock lifecycle', () => {
  it('reaches the exact deadline without decrementing an authoritative counter', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const onTick = vi.fn()
    const stop = startClock(onTick, 30_000, () => Date.now())
    vi.advanceTimersByTime(30_000)
    expect(onTick).toHaveBeenLastCalledWith(30_000)
    expect(vi.getTimerCount()).toBe(0)
    stop()
  })

  it('cancels all pending callbacks on cleanup', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const onTick = vi.fn()
    const stop = startClock(onTick, 30_000, () => Date.now())
    vi.advanceTimersByTime(100)
    stop()
    vi.advanceTimersByTime(30_000)
    expect(onTick).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses the actual timestamp when a callback is delayed', () => {
    vi.useFakeTimers()
    let timestamp = 0
    const onTick = vi.fn()
    startClock(onTick, 30_000, () => timestamp)
    timestamp = 45_000
    vi.advanceTimersByTime(100)
    expect(onTick).toHaveBeenCalledExactlyOnceWith(45_000)
    expect(vi.getTimerCount()).toBe(0)
  })
})
