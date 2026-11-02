import { generateWords } from './generator'
import { combineTotals, emptyTotals, wordTotals } from './metrics'
import { DEFAULT_CONFIG } from './types'
import type { TestAction, TestConfig, TestState, TypedWord } from './types'

function pendingWord(target: string): TypedWord {
  return { target, input: '', submitted: false, separator: false }
}

export function createTest(config: TestConfig = DEFAULT_CONFIG, seed = 1, targets?: readonly string[]): TestState {
  const words = targets ?? generateWords(seed, config.mode === 'words' ? config.wordCount : 128)
  if (words.length === 0 || words.some(word => word.length === 0 || /\s/.test(word))) {
    throw new RangeError('A test needs nonempty words without internal whitespace.')
  }
  return {
    status: 'ready', config: { ...config }, seed: seed >>> 0,
    words: words.map(pendingWord), activeWordIndex: 0,
    attempts: { correct: 0, total: 0 }, completedTotals: emptyTotals(),
    startedAtMs: null, finishedAtMs: null, elapsedMs: 0, timeline: [],
  }
}

function advanceClock(state: TestState, nowMs: number): TestState {
  if (state.status !== 'running' || state.startedAtMs === null || !Number.isFinite(nowMs)) return state
  const elapsedMs = Math.max(state.elapsedMs, nowMs - state.startedAtMs, 0)
  if (state.config.mode === 'time' && elapsedMs >= state.config.durationSeconds * 1000) {
    return { ...state, status: 'finished', elapsedMs: state.config.durationSeconds * 1000, finishedAtMs: state.startedAtMs + state.config.durationSeconds * 1000 }
  }
  return elapsedMs === state.elapsedMs ? state : { ...state, elapsedMs }
}

function replaceActive(state: TestState, word: TypedWord): TestState {
  const words = state.words.slice()
  words[state.activeWordIndex] = word
  return { ...state, words }
}

function attempt(state: TestState, correct: boolean): TestState {
  return { ...state, attempts: { correct: state.attempts.correct + Number(correct), total: state.attempts.total + 1 } }
}

function submitWord(state: TestState, nowMs: number): TestState {
  const active = state.words[state.activeWordIndex]!
  if (active.input.length === 0) return state
  let next = attempt(state, active.input === active.target)
  const terminal = state.config.mode === 'words' && state.activeWordIndex === state.words.length - 1
  const submitted = { ...active, submitted: true, separator: !terminal }
  next = replaceActive(next, submitted)

  if (terminal) return { ...next, status: 'finished', finishedAtMs: nowMs }

  const words = next.words.slice()
  // Constant-time indexed generation lets a timed test continue indefinitely.
  // Only a small nearby subset is mounted by the prompt renderer.
  if (state.activeWordIndex + 1 >= words.length) {
    words.push(...generateWords(state.seed, 64, words.length).map(pendingWord))
  }
  return { ...next, words, completedTotals: combineTotals(state.completedTotals, wordTotals(submitted)), activeWordIndex: state.activeWordIndex + 1 }
}

function insertCharacter(state: TestState, character: string, nowMs: number): TestState {
  if (character === ' ') return submitWord(state, nowMs)
  if (/\p{C}/u.test(character) || /\s/u.test(character)) return state
  let next = state.status === 'ready' ? { ...state, status: 'running' as const, startedAtMs: nowMs } : state
  const active = next.words[next.activeWordIndex]!
  const offset = Array.from(active.input).length
  next = attempt(next, Array.from(active.target)[offset] === character)
  const word = { ...active, input: active.input + character }
  next = replaceActive(next, word)
  if (next.config.mode === 'words' && next.activeWordIndex === next.words.length - 1 && word.input === word.target) {
    return { ...next, status: 'finished', finishedAtMs: nowMs }
  }
  return next
}

function deleteBackward(state: TestState, wholeWord: boolean): TestState {
  const active = state.words[state.activeWordIndex]!
  if (active.input.length > 0) {
    return replaceActive(state, { ...active, input: wholeWord ? '' : Array.from(active.input).slice(0, -1).join('') })
  }
  if (state.activeWordIndex === 0) return state
  const previous = state.words[state.activeWordIndex - 1]!
  if (previous.input === previous.target) return state

  const words = state.words.slice()
  words[state.activeWordIndex - 1] = { ...previous, submitted: false, separator: false, input: wholeWord ? '' : Array.from(previous.input).slice(0, -1).join('') }
  return {
    ...state, words, activeWordIndex: state.activeWordIndex - 1,
    completedTotals: combineTotals(state.completedTotals, wordTotals(previous), -1),
  }
}

export function testReducer(state: TestState, action: TestAction): TestState {
  if (action.type === 'RESTART') return createTest(action.config, action.seed)
  if (state.status === 'finished' || !Number.isFinite(action.nowMs)) return state
  let next = advanceClock(state, action.nowMs)
  if (next.status === 'finished') return next

  switch (action.type) {
    case 'TICK': return next
    case 'INSERT':
      for (const character of action.text) {
        next = insertCharacter(next, character, action.nowMs)
        if (next.status === 'finished') break
      }
      return next
    case 'SUBMIT_WORD': return next.status === 'running' ? submitWord(next, action.nowMs) : next
    case 'DELETE_BACKWARD': return next.status === 'running' ? deleteBackward(next, false) : next
    case 'DELETE_WORD_BACKWARD': return next.status === 'running' ? deleteBackward(next, true) : next
  }
}
