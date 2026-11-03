import { configurationKey } from '../../features/typing/engine/config'
import { bestSummary, comparisonKey, defaultPreferences, isBetter, mergeProgress } from './model'
import type { LocalResult, Preferences, ProgressData, ProgressSnapshot, Receipt } from './model'
import { parsePreferences, parseProgress } from './validation'

export const PREFERENCES_KEY = 'typedash.preferences'
export const PROGRESS_KEY = 'typedash.progress'
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
type Schedule = (work: () => void) => () => void
const memoryNotice = 'This browser could not save your data. New settings and results will last for this visit.'
const futureNotice = 'Saved data uses a newer format. Changes will stay in memory for this visit.'

export function createProgressStore(getStorage: () => StorageLike | null, schedule: Schedule = work => { const timer = setTimeout(work, 0); return () => clearTimeout(timer) }) {
  let storage: StorageLike | null = null
  let initialNotice: string | null = null
  let preferences = defaultPreferences()
  try {
    storage = getStorage()
    if (!storage) initialNotice = memoryNotice
    else {
      const parsed = parsePreferences(storage.getItem(PREFERENCES_KEY))
      preferences = parsed.value
      if (parsed.future) { storage = null; initialNotice = futureNotice }
      else if (parsed.recovered) initialNotice = 'Saved settings could not be read. Defaults are in use.'
    }
  } catch { storage = null; initialNotice = memoryNotice }

  let snapshot: ProgressSnapshot = { preferences, results: [], bests: [], loaded: false, persistent: storage !== null, notice: initialNotice, receipt: null }
  const listeners = new Set<() => void>()
  const pending = new Map<string, LocalResult>()
  const seen = new Set<string>()
  let cancelScheduled: (() => void) | null = null
  const notify = () => listeners.forEach(listener => listener())
  const memoryFallback = () => { storage = null; snapshot = { ...snapshot, persistent: false, notice: memoryNotice } }

  function readProgress(): ProgressData {
    if (!storage) return { results: snapshot.results, bests: snapshot.bests }
    try {
      const parsed = parseProgress(storage.getItem(PROGRESS_KEY))
      if (parsed.future) { storage = null; snapshot = { ...snapshot, persistent: false, notice: futureNotice } }
      else if (parsed.recovered) snapshot = { ...snapshot, notice: 'Some saved history could not be read. Valid results are still available.' }
      return parsed.value
    } catch { memoryFallback(); return { results: snapshot.results, bests: snapshot.bests } }
  }

  function loadProgress() {
    if (snapshot.loaded) return
    const progress = readProgress()
    progress.results.forEach(result => seen.add(result.id))
    progress.bests.forEach(result => seen.add(result.id))
    snapshot = { ...snapshot, ...progress, loaded: true }
    notify()
  }

  function savePreferences(next: Preferences) {
    const old = snapshot.preferences
    if (configurationKey(old.config) === configurationKey(next.config) && old.time === next.time && old.words === next.words) return
    snapshot = { ...snapshot, preferences: { ...next, config: { ...next.config } } }
    if (storage) {
      try { storage.setItem(PREFERENCES_KEY, JSON.stringify({ schemaVersion: 1, ...next })) }
      catch { memoryFallback() }
    }
    notify()
  }

  function flushPending() {
    cancelScheduled?.()
    cancelScheduled = null
    if (pending.size === 0) return
    const alreadyLoaded = snapshot.loaded
    loadProgress()
    let progress = alreadyLoaded ? mergeProgress(readProgress(), snapshot) : { results: snapshot.results, bests: snapshot.bests }
    let receipt: Receipt | null = snapshot.receipt
    let changed = false
    for (const result of pending.values()) {
      if (seen.has(result.id) || progress.results.some(item => item.id === result.id) || progress.bests.some(item => item.id === result.id)) continue
      const oldBest = progress.bests.find(best => comparisonKey(best) === comparisonKey(result))
      receipt = { resultId: result.id, personalBest: !oldBest ? 'first' : isBetter(bestSummary(result), oldBest) ? 'improved' : null }
      progress = mergeProgress(progress, { results: [result], bests: [] })
      seen.add(result.id)
      changed = true
    }
    pending.clear()
    if (changed && storage) {
      try { storage.setItem(PROGRESS_KEY, JSON.stringify({ schemaVersion: 1, ...progress })) }
      catch { memoryFallback() }
    }
    snapshot = { ...snapshot, ...progress, receipt }
    notify()
  }

  function queueResult(result: LocalResult) {
    if (seen.has(result.id) || pending.has(result.id)) return
    pending.set(result.id, result)
    if (!cancelScheduled) cancelScheduled = schedule(flushPending)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    loadProgress, savePreferences, queueResult, flushPending,
  }
}

export type ProgressStore = ReturnType<typeof createProgressStore>
