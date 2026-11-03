import { TIME_PRESETS, WORD_PRESETS } from '../../features/typing/engine/types'
import type { TestConfig, TestMetrics, TimelineSample, TimePreset, WordPreset } from '../../features/typing/engine/types'
import { defaultPreferences, mergeProgress } from './model'
import type { LocalResult, PersonalBest, Preferences, ProgressData } from './model'

type Parsed<T> = { value: T; recovered: boolean; future: boolean }
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const integer = (value: unknown): value is number => nonnegative(value) && Number.isSafeInteger(value)

function config(value: unknown): TestConfig | null {
  if (!object(value) || value.language !== 'english' || value.wordListVersion !== 'english-v1' || typeof value.punctuation !== 'boolean' || typeof value.numbers !== 'boolean') return null
  const base = { language: 'english' as const, wordListVersion: 'english-v1' as const, punctuation: value.punctuation, numbers: value.numbers }
  if (value.mode === 'time' && TIME_PRESETS.includes(value.durationSeconds as TimePreset)) return { ...base, mode: 'time', durationSeconds: value.durationSeconds as TimePreset }
  if (value.mode === 'words' && WORD_PRESETS.includes(value.wordCount as WordPreset)) return { ...base, mode: 'words', wordCount: value.wordCount as WordPreset }
  return null
}

function metrics(value: unknown): TestMetrics | null {
  if (!object(value) || !object(value.characters) || !nonnegative(value.elapsedMs) || value.elapsedMs === 0 || !nonnegative(value.wpm) || !nonnegative(value.rawWpm) || value.rawWpm <= 0 || value.wpm > value.rawWpm + 1e-6 || !nonnegative(value.accuracy) || value.accuracy > 100) return null
  const chars = value.characters
  if (!integer(chars.correct) || !integer(chars.incorrect) || !integer(chars.extra) || !integer(chars.missed)) return null
  return { elapsedMs: value.elapsedMs, wpm: value.wpm, rawWpm: value.rawWpm, accuracy: value.accuracy, characters: { correct: chars.correct, incorrect: chars.incorrect, extra: chars.extra, missed: chars.missed } }
}

function summary(value: unknown): PersonalBest | null {
  if (!object(value) || typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 128 || !integer(value.createdAt) || !integer(value.seed) || value.seed > 0xffffffff || typeof value.retry !== 'boolean' || !integer(value.scoringVersion) || value.scoringVersion < 1) return null
  const parsedConfig = config(value.config)
  const parsedMetrics = metrics(value.metrics)
  if (!parsedConfig || !parsedMetrics) return null
  return { id: value.id, createdAt: value.createdAt, seed: value.seed, retry: value.retry, scoringVersion: value.scoringVersion, config: parsedConfig, metrics: parsedMetrics }
}

export function validateResult(value: unknown): LocalResult | null {
  const base = summary(value)
  if (!base || !object(value) || !Array.isArray(value.timeline) || value.timeline.length < 2 || value.timeline.length > 300) return null
  const timeline: TimelineSample[] = []
  for (const point of value.timeline) {
    if (!object(point) || !nonnegative(point.elapsedMs) || !nonnegative(point.wpm) || !nonnegative(point.intervalRawWpm) || !integer(point.errors)) return null
    if (timeline.length > 0 && point.elapsedMs <= timeline.at(-1)!.elapsedMs) return null
    timeline.push({ elapsedMs: point.elapsedMs, wpm: point.wpm, intervalRawWpm: point.intervalRawWpm, errors: point.errors })
  }
  if (timeline[0]!.elapsedMs !== 0 || Math.abs(timeline.at(-1)!.elapsedMs - base.metrics.elapsedMs) > 0.001 || Math.abs(timeline.at(-1)!.wpm - base.metrics.wpm) > 0.0011) return null
  return { ...base, timeline }
}

export function parsePreferences(raw: string | null): Parsed<Preferences> {
  const fallback = defaultPreferences()
  if (raw === null) return { value: fallback, recovered: false, future: false }
  try {
    const value: unknown = JSON.parse(raw)
    if (object(value) && typeof value.schemaVersion === 'number' && value.schemaVersion > 1) return { value: fallback, recovered: true, future: true }
    if (!object(value) || value.schemaVersion !== 1 || !TIME_PRESETS.includes(value.time as TimePreset) || !WORD_PRESETS.includes(value.words as WordPreset)) throw new Error('Invalid preferences')
    const parsed = config(value.config)
    if (!parsed) throw new Error('Invalid configuration')
    return { value: { config: parsed, time: parsed.mode === 'time' ? parsed.durationSeconds : value.time as TimePreset, words: parsed.mode === 'words' ? parsed.wordCount : value.words as WordPreset }, recovered: false, future: false }
  } catch { return { value: fallback, recovered: true, future: false } }
}

export function parseProgress(raw: string | null): Parsed<ProgressData> {
  const fallback: ProgressData = { results: [], bests: [] }
  if (raw === null) return { value: fallback, recovered: false, future: false }
  try {
    const value: unknown = JSON.parse(raw)
    if (object(value) && typeof value.schemaVersion === 'number' && value.schemaVersion > 1) return { value: fallback, recovered: true, future: true }
    if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.results)) throw new Error('Invalid history')
    const results = value.results.map(validateResult).filter((result): result is LocalResult => result !== null)
    const rawBests: unknown[] = Array.isArray(value.bests) ? value.bests : []
    const bests = rawBests.map(summary).filter((best): best is PersonalBest => best !== null)
    return { value: mergeProgress({ results, bests }), recovered: results.length !== value.results.length || bests.length !== rawBests.length || !Array.isArray(value.bests), future: false }
  } catch { return { value: fallback, recovered: true, future: false } }
}
