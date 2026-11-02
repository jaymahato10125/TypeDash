import type { ScoringTotals, TestMetrics, TestState, TypedWord } from './types'

export function emptyTotals(): ScoringTotals {
  return { creditedUnits: 0, retainedUnits: 0, characters: { correct: 0, incorrect: 0, extra: 0, missed: 0 } }
}

export function wordTotals(word: TypedWord): ScoringTotals {
  const input = Array.from(word.input)
  const target = Array.from(word.target)
  const exact = word.input === word.target
  let correct = 0
  let incorrect = 0
  let extra = 0

  for (const [index, character] of input.entries()) {
    if (index >= target.length) extra++
    else if (character === target[index]) correct++
    else incorrect++
  }

  if (word.separator) {
    if (exact) correct++
    else incorrect++
  }

  const prefix = !word.submitted && word.target.startsWith(word.input)
  return {
    creditedUnits: exact || prefix ? input.length + Number(word.separator) : 0,
    retainedUnits: input.length + Number(word.separator),
    characters: { correct, incorrect, extra, missed: word.submitted ? Math.max(0, target.length - input.length) : 0 },
  }
}

export function combineTotals(left: ScoringTotals, right: ScoringTotals, direction: 1 | -1 = 1): ScoringTotals {
  return {
    creditedUnits: left.creditedUnits + right.creditedUnits * direction,
    retainedUnits: left.retainedUnits + right.retainedUnits * direction,
    characters: {
      correct: left.characters.correct + right.characters.correct * direction,
      incorrect: left.characters.incorrect + right.characters.incorrect * direction,
      extra: left.characters.extra + right.characters.extra * direction,
      missed: left.characters.missed + right.characters.missed * direction,
    },
  }
}

export function calculateMetrics(state: TestState): TestMetrics {
  const active = state.words[state.activeWordIndex]
  const totals = active ? combineTotals(state.completedTotals, wordTotals(active)) : state.completedTotals
  const multiplier = state.elapsedMs > 0 ? 12_000 / state.elapsedMs : 0

  return {
    elapsedMs: state.elapsedMs,
    wpm: totals.creditedUnits * multiplier,
    rawWpm: totals.retainedUnits * multiplier,
    accuracy: state.attempts.total > 0 ? state.attempts.correct / state.attempts.total * 100 : 0,
    characters: totals.characters,
  }
}
