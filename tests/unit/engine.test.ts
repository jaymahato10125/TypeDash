import { describe, expect, it } from 'vitest'
import { generateWords } from '../../src/features/typing/engine/generator'
import { calculateMetrics } from '../../src/features/typing/engine/metrics'
import { createTest, testReducer } from '../../src/features/typing/engine/reducer'
import { DEFAULT_CONFIG } from '../../src/features/typing/engine/types'
import type { TestState } from '../../src/features/typing/engine/types'
import { scoringFixtures } from '../fixtures/scoring'

function insert(state: TestState, text: string, nowMs = 100) {
  return testReducer(state, { type: 'INSERT', text, nowMs })
}

describe('engine scoring against independent golden traces', () => {
  it.each(scoringFixtures)('$id', fixture => {
    const initial = createTest(DEFAULT_CONFIG, 42, fixture.targets)
    const result = fixture.actions.reduce(testReducer, initial)
    expect(result.status).toBe('finished')
    expect(result.attempts).toEqual({ correct: fixture.correctAttempts, total: fixture.totalAttempts })
    expect(result.words.slice(0, fixture.finalInputs.length).map(word => word.input)).toEqual(fixture.finalInputs)
    const metrics = calculateMetrics(result)
    expect(metrics.wpm).toBeCloseTo(fixture.expected.wpm, 10)
    expect(metrics.rawWpm).toBeCloseTo(fixture.expected.rawWpm, 10)
    expect(metrics.accuracy).toBeCloseTo(fixture.expected.accuracy, 10)
    expect(metrics.characters).toEqual(fixture.expected.characters)
  })
})

describe('input, editing, and absolute timing', () => {
  it('does not start on leading spaces, control text, empty deletion, or clock ticks', () => {
    const initial = createTest(DEFAULT_CONFIG, 1, ['cat', 'dog'])
    let state = insert(initial, '   \n\t', 0)
    state = testReducer(state, { type: 'DELETE_BACKWARD', nowMs: 50 })
    state = testReducer(state, { type: 'TICK', nowMs: 40_000 })
    expect(state).toBe(initial)
    expect(calculateMetrics(state)).toMatchObject({ wpm: 0, rawWpm: 0, accuracy: 0 })
  })

  it('starts on a wrong first character, including at timestamp zero', () => {
    const initial = createTest(DEFAULT_CONFIG, 1, ['cat'])
    const state = insert(initial, 'x', 0)
    expect(state).toMatchObject({ status: 'running', startedAtMs: 0, attempts: { correct: 0, total: 1 } })
    expect(initial.words[0]!.input).toBe('')
  })

  it('processes a committed multi-character insertion and ignores repeated spaces', () => {
    const state = insert(createTest(DEFAULT_CONFIG, 1, ['cat', 'dog']), 'cat   dog', 0)
    expect(state.activeWordIndex).toBe(1)
    expect(state.attempts).toEqual({ correct: 7, total: 7 })
  })

  it('counts extra characters separately and removes them without erasing errors', () => {
    let state = insert(createTest(DEFAULT_CONFIG, 1, ['cat']), 'catxy', 0)
    expect(calculateMetrics(state).characters).toEqual({ correct: 3, incorrect: 0, extra: 2, missed: 0 })
    state = testReducer(state, { type: 'DELETE_BACKWARD', nowMs: 1000 })
    state = testReducer(state, { type: 'DELETE_BACKWARD', nowMs: 2000 })
    expect(calculateMetrics(state)).toMatchObject({ accuracy: 60, characters: { correct: 3, extra: 0 } })
  })

  it('backtracks into an incorrect word and retracts its separator and missed units', () => {
    let state = insert(createTest(DEFAULT_CONFIG, 1, ['cat', 'dog']), 'ca ', 0)
    state = testReducer(state, { type: 'DELETE_BACKWARD', nowMs: 1000 })
    expect(state.activeWordIndex).toBe(0)
    expect(state.words[0]).toMatchObject({ input: 'c', submitted: false, separator: false })
    expect(calculateMetrics(state)).toMatchObject({ rawWpm: 12, characters: { correct: 1, incorrect: 0, missed: 0 } })
    expect(calculateMetrics(state).accuracy).toBeCloseTo(200 / 3, 10)
    state = insert(state, 'at dog', 2000)
    expect(state.completedTotals.retainedUnits).toBe(4)
    expect(calculateMetrics(state).characters.correct).toBe(7)
  })

  it('cannot backtrack across an exact submitted word', () => {
    const initial = insert(createTest(DEFAULT_CONFIG, 1, ['cat', 'dog']), 'cat ', 0)
    const state = testReducer(initial, { type: 'DELETE_BACKWARD', nowMs: 1000 })
    expect(state.activeWordIndex).toBe(1)
    expect(state.words[0]!.input).toBe('cat')
  })

  it('word deletion clears only the current word or a previous incorrect word', () => {
    let state = insert(createTest(DEFAULT_CONFIG, 1, ['cat', 'dog']), 'ca dog', 0)
    state = testReducer(state, { type: 'DELETE_WORD_BACKWARD', nowMs: 100 })
    expect(state.words[1]!.input).toBe('')
    state = testReducer(state, { type: 'DELETE_WORD_BACKWARD', nowMs: 200 })
    expect(state.activeWordIndex).toBe(0)
    expect(state.words[0]!.input).toBe('')
    expect(state.attempts.total).toBe(6)
    expect(calculateMetrics(state).rawWpm).toBe(0)
  })

  it('finalizes before accepting input or deletion exactly at the deadline', () => {
    const started = insert(createTest(DEFAULT_CONFIG, 1, ['cat']), 'ca', 500)
    for (const action of [{ type: 'INSERT' as const, text: 't', nowMs: 30_500 }, { type: 'DELETE_BACKWARD' as const, nowMs: 30_500 }]) {
      const state = testReducer(started, action)
      expect(state.status).toBe('finished')
      expect(state.words[0]!.input).toBe('ca')
      expect(state.finishedAtMs).toBe(30_500)
      expect(calculateMetrics(state).wpm).toBe(0.8)
    }
  })

  it('caps elapsed time after a delayed tick and ignores post-finish input', () => {
    const state = testReducer(insert(createTest(DEFAULT_CONFIG, 1, ['cat']), 'cat', 0), { type: 'TICK', nowMs: 300_000 })
    expect(state.elapsedMs).toBe(30_000)
    expect(state.finishedAtMs).toBe(30_000)
    expect(insert(state, 'x', 301_000)).toBe(state)
  })

  it('does not move elapsed time backwards', () => {
    let state = insert(createTest(DEFAULT_CONFIG, 1, ['cat']), 'c', 100)
    state = testReducer(state, { type: 'TICK', nowMs: 2100 })
    state = testReducer(state, { type: 'TICK', nowMs: 1100 })
    expect(state.elapsedMs).toBe(2000)
  })

  it('resets every counter and clock on restart and reproduces the seed', () => {
    const initial = createTest(DEFAULT_CONFIG, 99)
    const active = insert(initial, 'bad text', 0)
    const restarted = testReducer(active, { type: 'RESTART', config: DEFAULT_CONFIG, seed: 99 })
    expect(restarted).toEqual(initial)
    const lateTick = testReducer(restarted, { type: 'TICK', nowMs: 300_000 })
    expect(lateTick).toBe(restarted)
  })

  it('extends a timed prompt without losing the run or repeating neighboring generated words', () => {
    const initial = createTest(DEFAULT_CONFIG, 5, ['cat'])
    const state = insert(initial, 'cat ', 0)
    expect(state.status).toBe('running')
    expect(state.words.length).toBe(65)
    expect(state.activeWordIndex).toBe(1)
  })

  it('finishes the last exact word without a trailing space', () => {
    const config = { ...DEFAULT_CONFIG, mode: 'words' as const, wordCount: 10 as const }
    let state = insert(createTest(config, 1, ['cat', 'dog']), 'cat ', 0)
    state = insert(state, 'dog', 60_000)
    expect(state.status).toBe('finished')
    expect(calculateMetrics(state).wpm).toBeCloseTo(1.4, 10)
    expect(calculateMetrics(state).rawWpm).toBeCloseTo(1.4, 10)
    expect(calculateMetrics(state).accuracy).toBe(100)
  })

  it('counts an incorrect final submission as an attempt without retaining its trailing space', () => {
    const config = { ...DEFAULT_CONFIG, mode: 'words' as const, wordCount: 10 as const }
    let state = insert(createTest(config, 1, ['cat', 'dog']), 'cat ', 0)
    state = insert(state, 'di ', 60_000)
    expect(state.status).toBe('finished')
    expect(state.words[1]).toMatchObject({ submitted: true, separator: false })
    expect(calculateMetrics(state)).toMatchObject({ wpm: 0.8, characters: { correct: 5, incorrect: 1, extra: 0, missed: 1 } })
    expect(calculateMetrics(state).rawWpm).toBeCloseTo(1.2, 10)
    expect(calculateMetrics(state).accuracy).toBeCloseTo(500 / 7, 10)
  })
})

describe('seeded English generation', () => {
  it('reproduces prefixes across independently generated batches', () => {
    const full = generateWords(1234, 200)
    expect(full.slice(100)).toEqual(generateWords(1234, 100, 100))
    expect(full).toEqual(generateWords(1234, 200))
    expect(full).not.toEqual(generateWords(1235, 200))
    expect(full.every((word, index) => index === 0 || word !== full[index - 1])).toBe(true)
  })

  it('rejects invalid batch dimensions and empty prompt fixtures', () => {
    expect(() => generateWords(1, -1)).toThrow(RangeError)
    expect(() => createTest(DEFAULT_CONFIG, 1, [])).toThrow(RangeError)
  })
})
