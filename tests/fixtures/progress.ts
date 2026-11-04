import { createTest, testReducer } from '../../src/features/typing/engine/reducer'
import { DEFAULT_CONFIG } from '../../src/features/typing/engine/types'
import { createResult } from '../../src/lib/storage/model'

export function fullHistory() {
  let state = createTest({ ...DEFAULT_CONFIG, mode: 'words', wordCount: 10 }, 7)
  state = testReducer(state, { type: 'INSERT', text: state.words.slice(0, -1).map(word => word.target).join(' ') + ' ', nowMs: 0 })
  state = testReducer(state, { type: 'INSERT', text: state.words.at(-1)!.target, nowMs: 1000 })
  const base = createResult(state, 1)!
  return { schemaVersion: 1, results: Array.from({ length: 100 }, (_, index) => ({ ...base, id: `fixture-${index}`, createdAt: index + 1 })), bests: [] }
}
