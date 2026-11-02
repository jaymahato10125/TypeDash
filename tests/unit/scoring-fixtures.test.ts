import { describe, expect, it } from 'vitest'
import { scoringFixtures } from '../fixtures/scoring'

// These checks validate the written scoring contract, not a typing engine.
// Phase 2 will replay the same traces against the engine implementation.
describe('hand-calculated scoring contract', () => {
  it.each(scoringFixtures)('$id: expected metrics agree with the documented counts', fixture => {
    const minutes = fixture.expected.elapsedMs / 60_000
    expect(fixture.expected.wpm).toBeCloseTo(fixture.creditedUnits / 5 / minutes, 10)
    expect(fixture.expected.rawWpm).toBeCloseTo(fixture.retainedUnits / 5 / minutes, 10)
    expect(fixture.expected.accuracy).toBeCloseTo(fixture.correctAttempts / fixture.totalAttempts * 100, 10)
    const { correct, incorrect, extra } = fixture.expected.characters
    expect(correct + incorrect + extra).toBe(fixture.retainedUnits)
    const insertionAttempts = fixture.actions.reduce((count, action) => count + (action.type === 'INSERT' ? action.text.length : action.type === 'SUBMIT_WORD' ? 1 : 0), 0)
    expect(insertionAttempts).toBe(fixture.totalAttempts)
  })
})
