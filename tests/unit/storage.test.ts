import { afterEach, describe, expect, it, vi } from 'vitest'
import { selectTime, selectWords } from '../../src/features/typing/engine/config'
import { createTest, testReducer } from '../../src/features/typing/engine/reducer'
import { DEFAULT_CONFIG } from '../../src/features/typing/engine/types'
import type { TestConfig } from '../../src/features/typing/engine/types'
import { comparisonKey, createResult, defaultPreferences } from '../../src/lib/storage/model'
import type { LocalResult } from '../../src/lib/storage/model'
import { createProgressStore, PREFERENCES_KEY, PROGRESS_KEY } from '../../src/lib/storage/repository'
import { parsePreferences, parseProgress, validateResult } from '../../src/lib/storage/validation'

class MemoryStorage {
  data = new Map<string, string>()
  reads: string[] = []
  writes: string[] = []
  failWrites = false
  getItem(key: string) { this.reads.push(key); return this.data.get(key) ?? null }
  setItem(key: string, value: string) { if (this.failWrites) throw new Error('Quota exceeded'); this.writes.push(key); this.data.set(key, value) }
}

function result(id: string, duration = 1000, createdAt = 1000, retry = false, config: TestConfig = selectWords(DEFAULT_CONFIG, 10)): LocalResult {
  let state = createTest(config, 3, undefined, { id, retry })
  if (config.mode === 'time') {
    state = testReducer(state, { type: 'INSERT', text: state.words.slice(0, 3).map(word => word.target).join(' '), nowMs: 0 })
    state = testReducer(state, { type: 'TICK', nowMs: config.durationSeconds * 1000 })
  } else {
    const prefix = state.words.slice(0, -1).map(word => word.target).join(' ') + ' '
    const last = state.words.at(-1)!.target
    state = testReducer(state, { type: 'INSERT', text: prefix, nowMs: 0 })
    state = testReducer(state, { type: 'INSERT', text: last, nowMs: duration })
  }
  const record = createResult(state, createdAt)
  if (!record) throw new Error('Test result fixture did not complete.')
  return record
}

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('local persistence and idempotent completion', () => {
  it('loads only small preferences at startup and defers history serialization', () => {
    vi.useFakeTimers()
    const storage = new MemoryStorage()
    const store = createProgressStore(() => storage)
    expect(storage.reads).toEqual([PREFERENCES_KEY])
    expect(store.getSnapshot().loaded).toBe(false)
    store.queueResult(result('first'))
    expect(storage.writes).toEqual([])
    expect(storage.reads).not.toContain(PROGRESS_KEY)
    vi.runAllTimers()
    expect(storage.writes).toEqual([PROGRESS_KEY])
    expect(store.getSnapshot().results).toHaveLength(1)
  })

  it('saves a stable run ID once across repeated effects and subscriber changes', () => {
    vi.useFakeTimers()
    const storage = new MemoryStorage()
    const store = createProgressStore(() => storage)
    const record = result('same-run')
    const unsubscribe = store.subscribe(() => undefined)
    store.queueResult(record)
    store.queueResult({ ...record, createdAt: record.createdAt + 1 })
    unsubscribe()
    store.flushPending()
    store.queueResult(record)
    vi.runAllTimers()
    expect(store.getSnapshot().results).toHaveLength(1)
    expect(store.getSnapshot().results[0]!.createdAt).toBe(record.createdAt)
    expect(storage.writes.filter(key => key === PROGRESS_KEY)).toHaveLength(1)
    expect(store.getSnapshot().receipt).toEqual({ resultId: 'same-run', personalBest: 'first' })
  })

  it('restores results and mode-specific settings after recreating the store', () => {
    const storage = new MemoryStorage()
    const store = createProgressStore(() => storage)
    const preferences = { config: { ...selectWords(DEFAULT_CONFIG, 50), punctuation: true, numbers: true }, time: 120 as const, words: 50 as const }
    store.savePreferences(preferences)
    store.queueResult(result('saved'))
    store.flushPending()
    const reloaded = createProgressStore(() => storage)
    expect(reloaded.getSnapshot().preferences).toEqual(preferences)
    expect(reloaded.getSnapshot().loaded).toBe(false)
    reloaded.loadProgress()
    expect(reloaded.getSnapshot().results[0]!.id).toBe('saved')
    expect(reloaded.getSnapshot().bests).toHaveLength(1)
    expect(reloaded.getSnapshot().notice).toBeNull()
  })

  it('keeps only the latest 100 records while preserving an older personal best', () => {
    const storage = new MemoryStorage()
    const store = createProgressStore(() => storage)
    store.queueResult(result('old-best', 500, 0))
    store.flushPending()
    for (let index = 1; index <= 101; index++) store.queueResult(result(`new-${index}`, 2000, index))
    store.flushPending()
    expect(store.getSnapshot().results).toHaveLength(100)
    expect(store.getSnapshot().results.some(item => item.id === 'old-best')).toBe(false)
    expect(store.getSnapshot().bests[0]!.id).toBe('old-best')
    store.queueResult(result('old-best', 500, 0))
    store.flushPending()
    expect(store.getSnapshot().results).toHaveLength(100)
    const reloaded = createProgressStore(() => storage)
    reloaded.loadProgress()
    expect(reloaded.getSnapshot().bests[0]!.id).toBe('old-best')
  })

  it('compares fresh tests, retries, modes, modifiers, and scoring versions separately', () => {
    const storage = new MemoryStorage()
    const store = createProgressStore(() => storage)
    const fresh = result('fresh', 2000)
    const retry = result('retry', 500, 2000, true)
    const longer = result('longer', 1000, 3000, false, selectWords(DEFAULT_CONFIG, 25))
    const modified = result('modified', 1000, 4000, false, { ...selectWords(DEFAULT_CONFIG, 10), punctuation: true, numbers: true })
    const timed = result('timed', 1000, 5000, false, selectTime(DEFAULT_CONFIG, 15))
    const newScoring = { ...result('version-two'), scoringVersion: 2 }
    for (const record of [fresh, retry, longer, modified, timed, newScoring]) store.queueResult(record)
    store.flushPending()
    expect(store.getSnapshot().bests).toHaveLength(6)
    expect(store.getSnapshot().bests.find(best => comparisonKey(best) === comparisonKey(fresh))!.id).toBe('fresh')
  })

  it('uses full precision and accuracy to break a genuine speed tie', () => {
    const store = createProgressStore(() => new MemoryStorage())
    const first = result('first', 1000)
    const lowerAccuracy = { ...first, id: 'less-accurate', metrics: { ...first.metrics, accuracy: 90 } }
    store.queueResult(lowerAccuracy)
    store.flushPending()
    store.queueResult(first)
    store.flushPending()
    expect(store.getSnapshot().bests[0]!.id).toBe('first')
    expect(store.getSnapshot().receipt?.personalBest).toBe('improved')
    store.queueResult({ ...first, id: 'identical-score' })
    store.flushPending()
    expect(store.getSnapshot().receipt?.personalBest).toBeNull()
    expect(store.getSnapshot().bests[0]!.id).toBe('first')
  })

  it('merges another writer’s completed result before saving its own', () => {
    const storage = new MemoryStorage()
    const one = createProgressStore(() => storage)
    const two = createProgressStore(() => storage)
    one.loadProgress()
    two.queueResult(result('other-tab'))
    two.flushPending()
    one.queueResult(result('this-tab', 2000, 2000))
    one.flushPending()
    expect(one.getSnapshot().results.map(item => item.id)).toEqual(['this-tab', 'other-tab'])
  })
})

describe('corrupted and unavailable browser storage', () => {
  it('recovers malformed preferences and can save valid replacements', () => {
    const storage = new MemoryStorage()
    storage.data.set(PREFERENCES_KEY, '{broken')
    const store = createProgressStore(() => storage)
    expect(store.getSnapshot().preferences).toEqual(defaultPreferences())
    expect(store.getSnapshot().notice).not.toBeNull()
    store.savePreferences({ config: selectTime(DEFAULT_CONFIG, 60), time: 60, words: 25 })
    expect(parsePreferences(storage.data.get(PREFERENCES_KEY)!).recovered).toBe(false)
  })

  it('retains valid rows and reconstructs bests when individual history rows are invalid', () => {
    const storage = new MemoryStorage()
    const valid = result('valid')
    storage.data.set(PROGRESS_KEY, JSON.stringify({ schemaVersion: 1, results: [valid, { ...valid, id: 'broken', timeline: [] }], bests: [] }))
    const store = createProgressStore(() => storage)
    store.loadProgress()
    expect(store.getSnapshot().results.map(item => item.id)).toEqual(['valid'])
    expect(store.getSnapshot().bests[0]!.id).toBe('valid')
    expect(store.getSnapshot().notice).not.toBeNull()
  })

  it('falls back to memory when localStorage access is blocked', () => {
    const store = createProgressStore(() => { throw new Error('Access denied') })
    store.queueResult(result('memory'))
    store.flushPending()
    expect(store.getSnapshot()).toMatchObject({ persistent: false, loaded: true })
    expect(store.getSnapshot().results[0]!.id).toBe('memory')
    expect(store.getSnapshot().notice).toContain('visit')
  })

  it('keeps new results in memory when a quota failure prevents writing', () => {
    const storage = new MemoryStorage()
    const store = createProgressStore(() => storage)
    storage.failWrites = true
    store.queueResult(result('quota'))
    store.flushPending()
    expect(store.getSnapshot().persistent).toBe(false)
    expect(store.getSnapshot().results[0]!.id).toBe('quota')
    expect(store.getSnapshot().bests[0]!.id).toBe('quota')
    expect(store.getSnapshot().notice).toContain('visit')
  })

  it.each([PREFERENCES_KEY, PROGRESS_KEY])('preserves an unknown newer schema in %s', key => {
    const storage = new MemoryStorage()
    const raw = JSON.stringify({ schemaVersion: 99, privateFutureField: 'preserve' })
    storage.data.set(key, raw)
    const store = createProgressStore(() => storage)
    store.loadProgress()
    store.queueResult(result('new-format'))
    store.flushPending()
    expect(store.getSnapshot().persistent).toBe(false)
    expect(storage.data.get(key)).toBe(raw)
  })

  it('rejects invalid metrics, unordered graph data, and mismatched endpoints', () => {
    const valid = result('valid')
    expect(validateResult(valid)).not.toBeNull()
    expect(validateResult({ ...valid, metrics: { ...valid.metrics, wpm: Infinity } })).toBeNull()
    expect(validateResult({ ...valid, timeline: [...valid.timeline].reverse() })).toBeNull()
    expect(validateResult({ ...valid, timeline: valid.timeline.slice(0, 1) })).toBeNull()
    expect(parseProgress('invalid JSON').recovered).toBe(true)
  })

  it('does not construct persisted results from abandoned or empty tests', () => {
    expect(createResult(createTest(), 1000)).toBeNull()
    let state = testReducer(createTest(DEFAULT_CONFIG, 1), { type: 'INSERT', text: 'x', nowMs: 0 })
    state = testReducer(state, { type: 'DELETE_BACKWARD', nowMs: 100 })
    state = testReducer(state, { type: 'TICK', nowMs: 30_000 })
    expect(createResult(state, 1000)).toBeNull()
  })
})
