import { describe, expect, it } from 'vitest'
import { calculateMetrics } from '../../src/features/typing/engine/metrics'
import { createTest, testReducer } from '../../src/features/typing/engine/reducer'
import { selectWords } from '../../src/features/typing/engine/config'
import { DEFAULT_CONFIG } from '../../src/features/typing/engine/types'
import { MAX_TIMELINE_POINTS } from '../../src/features/typing/engine/timeline'

describe('timeline sampling', () => {
  it('records second boundaries and the final partial interval from independent input times', () => {
    let state = createTest(selectWords(DEFAULT_CONFIG, 10), 1, ['cat', 'dog'])
    for (const [text, nowMs] of [['c', 0], ['a', 500], ['t', 1500], [' ', 1700], ['dog', 2300]] as const) state = testReducer(state, { type: 'INSERT', text, nowMs })
    expect(state.timeline.map(point => point.elapsedMs)).toEqual([0, 1000, 2000, 2300])
    expect(state.timeline[1]).toMatchObject({ wpm: 24, intervalRawWpm: 24, errors: 0 })
    expect(state.timeline[2]).toMatchObject({ wpm: 24, intervalRawWpm: 24, errors: 0 })
    expect(state.timeline.at(-1)!.wpm).toBeCloseTo(7 * 12_000 / 2300, 10)
    expect(state.timeline.at(-1)!.intervalRawWpm).toBe(120)
    expect(state.timeline.at(-1)!.wpm).toBeCloseTo(calculateMetrics(state).wpm, 10)
  })

  it('fills idle intervals after delayed ticks without inventing ongoing raw speed', () => {
    let state = testReducer(createTest(DEFAULT_CONFIG, 1, ['cat']), { type: 'INSERT', text: 'c', nowMs: 0 })
    state = testReducer(state, { type: 'TICK', nowMs: 60_000 })
    expect(state.timeline).toHaveLength(31)
    expect(state.timeline[1]!.intervalRawWpm).toBe(12)
    expect(state.timeline.slice(2).every(point => point.intervalRawWpm === 0)).toBe(true)
    expect(state.timeline.at(-1)).toMatchObject({ elapsedMs: 30_000, wpm: 0.4, intervalRawWpm: 0 })
  })

  it('does not backdate a new insertion into earlier unsampled intervals', () => {
    let state = testReducer(createTest(DEFAULT_CONFIG, 1, ['cat']), { type: 'INSERT', text: 'c', nowMs: 0 })
    state = testReducer(state, { type: 'INSERT', text: 'a', nowMs: 2500 })
    expect(state.timeline[1]).toMatchObject({ retainedUnits: 1, wpm: 12 })
    expect(state.timeline[2]).toMatchObject({ retainedUnits: 1, wpm: 6, intervalRawWpm: 0 })
    state = testReducer(state, { type: 'TICK', nowMs: 3000 })
    expect(state.timeline.at(-1)).toMatchObject({ retainedUnits: 2, wpm: 8, intervalRawWpm: 12 })
  })

  it('updates an exact boundary when input follows a tick at the same timestamp', () => {
    let state = testReducer(createTest(selectWords(DEFAULT_CONFIG, 10), 1, ['cat', 'dog']), { type: 'INSERT', text: 'cat ', nowMs: 0 })
    state = testReducer(state, { type: 'TICK', nowMs: 1000 })
    state = testReducer(state, { type: 'INSERT', text: 'dog', nowMs: 1000 })
    expect(state.status).toBe('finished')
    expect(state.timeline).toHaveLength(2)
    expect(state.timeline.at(-1)).toMatchObject({ elapsedMs: 1000, wpm: 84, intervalRawWpm: 84 })
  })

  it('retains corrected error markers and clamps negative retained-character intervals to zero', () => {
    let state = testReducer(createTest(DEFAULT_CONFIG, 1, ['cat']), { type: 'INSERT', text: 'cx', nowMs: 0 })
    state = testReducer(state, { type: 'DELETE_BACKWARD', nowMs: 500 })
    state = testReducer(state, { type: 'INSERT', text: 'at', nowMs: 900 })
    state = testReducer(state, { type: 'TICK', nowMs: 1000 })
    expect(state.timeline[1]).toMatchObject({ errors: 1, retainedUnits: 3, intervalRawWpm: 36 })
    state = testReducer(state, { type: 'DELETE_WORD_BACKWARD', nowMs: 1500 })
    state = testReducer(state, { type: 'TICK', nowMs: 2000 })
    expect(state.timeline[2]).toMatchObject({ errors: 0, intervalRawWpm: 0, retainedUnits: 0 })
  })

  it('bounds sampling work and data for a word test left idle for a day', () => {
    let state = testReducer(createTest(selectWords(DEFAULT_CONFIG, 10), 1, ['cat', 'dog']), { type: 'INSERT', text: 'c', nowMs: 0 })
    state = testReducer(state, { type: 'TICK', nowMs: 86_400_000 })
    state = testReducer(state, { type: 'INSERT', text: 'at dog', nowMs: 86_400_000 })
    expect(state.status).toBe('finished')
    expect(state.timeline.length).toBeLessThanOrEqual(MAX_TIMELINE_POINTS)
    expect(state.sampleIntervalMs).toBeGreaterThan(1000)
    expect(state.timeline.every((point, index) => Number.isFinite(point.wpm) && (index === 0 || point.elapsedMs > state.timeline[index - 1]!.elapsedMs))).toBe(true)
    expect(state.timeline.at(-1)!.elapsedMs).toBe(86_400_000)
    expect(state.timeline.at(-1)!.wpm).toBeCloseTo(calculateMetrics(state).wpm, 10)
  })

  it('ends the graph at the deadline before accepting late input', () => {
    let state = testReducer(createTest(DEFAULT_CONFIG, 1, ['cat']), { type: 'INSERT', text: 'ca', nowMs: 0 })
    state = testReducer(state, { type: 'INSERT', text: 't', nowMs: 30_001 })
    expect(state.timeline.at(-1)).toMatchObject({ elapsedMs: 30_000, retainedUnits: 2, wpm: 0.8 })
    expect(state.words[0]!.input).toBe('ca')
  })
})
