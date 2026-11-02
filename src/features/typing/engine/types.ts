export type TestStatus = 'ready' | 'running' | 'finished'
export type CharacterStatus = 'pending' | 'correct' | 'incorrect' | 'extra' | 'missed'

export const TIME_PRESETS = [15, 30, 60, 120] as const
export const WORD_PRESETS = [10, 25, 50, 100] as const
export const SCORING_VERSION = 1 as const

type BaseConfig = Readonly<{
  language: 'english'
  wordListVersion: 'english-v1'
  punctuation: boolean
  numbers: boolean
}>

export type TestConfig = BaseConfig & (
  | Readonly<{ mode: 'time'; durationSeconds: typeof TIME_PRESETS[number] }>
  | Readonly<{ mode: 'words'; wordCount: typeof WORD_PRESETS[number] }>
)

export const DEFAULT_CONFIG = Object.freeze({
  mode: 'time',
  durationSeconds: 30,
  language: 'english',
  wordListVersion: 'english-v1',
  punctuation: false,
  numbers: false,
} satisfies TestConfig)

export type TypedWord = Readonly<{
  target: string
  input: string
  submitted: boolean
  separator: boolean
}>

export type CharacterCounts = Readonly<{
  correct: number
  incorrect: number
  extra: number
  missed: number
}>

export type AttemptCounts = Readonly<{
  correct: number
  total: number
}>

export type ScoringTotals = Readonly<{
  creditedUnits: number
  retainedUnits: number
  characters: CharacterCounts
}>

export type TimelineSample = Readonly<{
  elapsedMs: number
  wpm: number
  intervalRawWpm: number
  errors: number
}>

export type TestState = Readonly<{
  status: TestStatus
  config: TestConfig
  seed: number
  words: readonly TypedWord[]
  activeWordIndex: number
  attempts: AttemptCounts
  completedTotals: ScoringTotals
  startedAtMs: number | null
  finishedAtMs: number | null
  elapsedMs: number
  timeline: readonly TimelineSample[]
}>

export type TestAction =
  | Readonly<{ type: 'INSERT'; text: string; nowMs: number }>
  | Readonly<{ type: 'DELETE_BACKWARD'; nowMs: number }>
  | Readonly<{ type: 'DELETE_WORD_BACKWARD'; nowMs: number }>
  | Readonly<{ type: 'SUBMIT_WORD'; nowMs: number }>
  | Readonly<{ type: 'TICK'; nowMs: number }>
  | Readonly<{ type: 'RESTART'; config: TestConfig; seed: number }>

export type TestMetrics = Readonly<{
  elapsedMs: number
  wpm: number
  rawWpm: number
  accuracy: number
  characters: CharacterCounts
}>
