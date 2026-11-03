import { configurationKey } from '../../features/typing/engine/config'
import { calculateMetrics } from '../../features/typing/engine/metrics'
import { DEFAULT_CONFIG, SCORING_VERSION } from '../../features/typing/engine/types'
import { DEFAULT_APPEARANCE } from '../../features/settings/appearance'
import type { Appearance } from '../../features/settings/appearance'
import type { TestConfig, TestMetrics, TestState, TimelineSample, TimePreset, WordPreset } from '../../features/typing/engine/types'

export type TestPreferences = Readonly<{ config: TestConfig; time: TimePreset; words: WordPreset }>
export type Preferences = TestPreferences & Readonly<{ appearance: Appearance }>
export type LocalResult = Readonly<{
  id: string; createdAt: number; seed: number; retry: boolean; scoringVersion: number
  config: TestConfig; metrics: TestMetrics; timeline: readonly TimelineSample[]
}>
export type PersonalBest = Omit<LocalResult, 'timeline'>
export type ProgressData = Readonly<{ results: readonly LocalResult[]; bests: readonly PersonalBest[] }>
export type Receipt = Readonly<{ resultId: string; personalBest: 'first' | 'improved' | null }>
export type ProgressSnapshot = ProgressData & Readonly<{
  preferences: Preferences; loaded: boolean; persistent: boolean; notice: string | null; receipt: Receipt | null
}>

export function defaultPreferences(): Preferences {
  return { config: { ...DEFAULT_CONFIG }, time: 30, words: 25, appearance: { ...DEFAULT_APPEARANCE } }
}

export function comparisonKey(result: Pick<LocalResult, 'config' | 'retry' | 'scoringVersion'>): string {
  return `${result.scoringVersion}:${configurationKey(result.config)}:${result.retry ? 'retry' : 'fresh'}`
}

export function isBetter(candidate: PersonalBest, current: PersonalBest): boolean {
  return candidate.metrics.wpm > current.metrics.wpm || (candidate.metrics.wpm === current.metrics.wpm && candidate.metrics.accuracy > current.metrics.accuracy)
}

export function bestSummary(result: LocalResult): PersonalBest {
  return { id: result.id, createdAt: result.createdAt, seed: result.seed, retry: result.retry, scoringVersion: result.scoringVersion, config: result.config, metrics: result.metrics }
}

export function mergeProgress(...sources: ProgressData[]): ProgressData {
  const results = new Map<string, LocalResult>()
  const bests = new Map<string, PersonalBest>()
  const consider = (best: PersonalBest) => {
    const key = comparisonKey(best)
    const current = bests.get(key)
    if (!current || isBetter(best, current)) bests.set(key, best)
  }
  for (const source of sources) {
    source.bests.forEach(consider)
    for (const result of source.results) { results.set(result.id, result); consider(bestSummary(result)) }
  }
  return { results: [...results.values()].sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(0, 100), bests: [...bests.values()] }
}

export function createResult(state: TestState, createdAt: number): LocalResult | null {
  const metrics = calculateMetrics(state)
  if (state.status !== 'finished' || metrics.elapsedMs <= 0 || metrics.rawWpm <= 0 || state.attempts.total === 0) return null
  const round = (number: number) => Math.round(number * 1000) / 1000
  return {
    id: state.runId, createdAt, seed: state.seed, retry: state.retry, scoringVersion: SCORING_VERSION,
    config: { ...state.config }, metrics,
    timeline: state.timeline.map(point => ({ elapsedMs: point.elapsedMs, wpm: round(point.wpm), intervalRawWpm: round(point.intervalRawWpm), errors: point.errors })),
  }
}
