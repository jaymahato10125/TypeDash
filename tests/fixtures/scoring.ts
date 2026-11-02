import type { TestAction, TestMetrics } from '../../src/features/typing/engine/types'

export type ScoringFixture = Readonly<{
  id: string
  description: string
  targets: readonly string[]
  actions: readonly TestAction[]
  finalInputs: readonly string[]
  creditedUnits: number
  retainedUnits: number
  correctAttempts: number
  totalAttempts: number
  expected: TestMetrics
}>

export const scoringFixtures: readonly ScoringFixture[] = [
  {
    id: 'perfect-time-test',
    description: 'Exact words and a separating space, with an idle finish at the deadline.',
    targets: ['cat', 'dog'],
    actions: [
      { type: 'INSERT', text: 'c', nowMs: 0 },
      { type: 'INSERT', text: 'a', nowMs: 100 },
      { type: 'INSERT', text: 't', nowMs: 200 },
      { type: 'SUBMIT_WORD', nowMs: 300 },
      { type: 'INSERT', text: 'd', nowMs: 400 },
      { type: 'INSERT', text: 'o', nowMs: 500 },
      { type: 'INSERT', text: 'g', nowMs: 600 },
      { type: 'TICK', nowMs: 30_000 },
    ],
    finalInputs: ['cat', 'dog'], creditedUnits: 7, retainedUnits: 7,
    correctAttempts: 7, totalAttempts: 7,
    expected: { elapsedMs: 30_000, wpm: 2.8, rawWpm: 2.8, accuracy: 100, characters: { correct: 7, incorrect: 0, extra: 0, missed: 0 } },
  },
  {
    id: 'corrected-error',
    description: 'Deleting an error restores final text but cannot erase the input-attempt error.',
    targets: ['cat', 'dog'],
    actions: [
      { type: 'INSERT', text: 'cat', nowMs: 0 },
      { type: 'SUBMIT_WORD', nowMs: 300 },
      { type: 'INSERT', text: 'x', nowMs: 400 },
      { type: 'DELETE_BACKWARD', nowMs: 500 },
      { type: 'INSERT', text: 'dog', nowMs: 600 },
      { type: 'TICK', nowMs: 30_000 },
    ],
    finalInputs: ['cat', 'dog'], creditedUnits: 7, retainedUnits: 7,
    correctAttempts: 7, totalAttempts: 8,
    expected: { elapsedMs: 30_000, wpm: 2.8, rawWpm: 2.8, accuracy: 87.5, characters: { correct: 7, incorrect: 0, extra: 0, missed: 0 } },
  },
  {
    id: 'incorrect-active-word',
    description: 'A wrong active word contributes raw units but earns no word-level WPM credit.',
    targets: ['cat', 'dog'],
    actions: [
      { type: 'INSERT', text: 'cat', nowMs: 0 },
      { type: 'SUBMIT_WORD', nowMs: 300 },
      { type: 'INSERT', text: 'dig', nowMs: 400 },
      { type: 'TICK', nowMs: 30_000 },
    ],
    finalInputs: ['cat', 'dig'], creditedUnits: 4, retainedUnits: 7,
    correctAttempts: 6, totalAttempts: 7,
    expected: { elapsedMs: 30_000, wpm: 1.6, rawWpm: 2.8, accuracy: 600 / 7, characters: { correct: 6, incorrect: 1, extra: 0, missed: 0 } },
  },
  {
    id: 'timeout-correct-prefix',
    description: 'An exact active prefix earns credit without treating the unfinished suffix as missed.',
    targets: ['cat', 'dog'],
    actions: [{ type: 'INSERT', text: 'ca', nowMs: 0 }, { type: 'TICK', nowMs: 30_000 }],
    finalInputs: ['ca'], creditedUnits: 2, retainedUnits: 2,
    correctAttempts: 2, totalAttempts: 2,
    expected: { elapsedMs: 30_000, wpm: 0.8, rawWpm: 0.8, accuracy: 100, characters: { correct: 2, incorrect: 0, extra: 0, missed: 0 } },
  },
  {
    id: 'timeout-incorrect-prefix',
    description: 'A mismatched active prefix earns no WPM credit.',
    targets: ['cat', 'dog'],
    actions: [{ type: 'INSERT', text: 'cx', nowMs: 0 }, { type: 'TICK', nowMs: 30_000 }],
    finalInputs: ['cx'], creditedUnits: 0, retainedUnits: 2,
    correctAttempts: 1, totalAttempts: 2,
    expected: { elapsedMs: 30_000, wpm: 0, rawWpm: 0.8, accuracy: 50, characters: { correct: 1, incorrect: 1, extra: 0, missed: 0 } },
  },
  {
    id: 'early-space',
    description: 'An early separator is a failed attempt; skipped characters are missed, not insertion errors.',
    targets: ['cat', 'dog'],
    actions: [
      { type: 'INSERT', text: 'ca', nowMs: 0 },
      { type: 'SUBMIT_WORD', nowMs: 200 },
      { type: 'INSERT', text: 'dog', nowMs: 300 },
      { type: 'TICK', nowMs: 30_000 },
    ],
    finalInputs: ['ca', 'dog'], creditedUnits: 3, retainedUnits: 6,
    correctAttempts: 5, totalAttempts: 6,
    expected: { elapsedMs: 30_000, wpm: 1.2, rawWpm: 2.4, accuracy: 500 / 6, characters: { correct: 5, incorrect: 1, extra: 0, missed: 1 } },
  },
]
