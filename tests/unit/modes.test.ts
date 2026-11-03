import { describe, expect, it } from 'vitest'
import { configurationKey, describeConfiguration, selectTime, selectWords } from '../../src/features/typing/engine/config'
import { generateWords } from '../../src/features/typing/engine/generator'
import { calculateMetrics } from '../../src/features/typing/engine/metrics'
import { createTest, testReducer } from '../../src/features/typing/engine/reducer'
import { DEFAULT_CONFIG, TIME_PRESETS, WORD_PRESETS } from '../../src/features/typing/engine/types'
import type { TestConfig, TextOptions } from '../../src/features/typing/engine/types'

const options: readonly TextOptions[] = [
  { punctuation: false, numbers: false },
  { punctuation: true, numbers: false },
  { punctuation: false, numbers: true },
  { punctuation: true, numbers: true },
]
const timeCases = TIME_PRESETS.flatMap(seconds => options.map(modifiers => ({ seconds, ...modifiers })))
const wordCases = WORD_PRESETS.flatMap(count => options.map(modifiers => ({ count, ...modifiers })))

describe('all time presets and text options', () => {
  it.each(timeCases)('$seconds seconds, punctuation=$punctuation, numbers=$numbers', ({ seconds, ...modifiers }) => {
    const config = { ...selectTime(DEFAULT_CONFIG, seconds), ...modifiers }
    const initial = createTest(config, 123)
    const text = initial.words.slice(0, 8).map(word => word.target).join(' ')
    let state = testReducer(initial, { type: 'INSERT', text, nowMs: 500 })
    state = testReducer(state, { type: 'TICK', nowMs: 500 + seconds * 1000 - 1 })
    expect(state.status).toBe('running')
    state = testReducer(state, { type: 'INSERT', text: '!', nowMs: 500 + seconds * 1000 })
    expect(state.status).toBe('finished')
    expect(state.elapsedMs).toBe(seconds * 1000)
    expect(state.attempts).toEqual({ correct: text.length, total: text.length })
    expect(calculateMetrics(state).wpm).toBeCloseTo(text.length / 5 / (seconds / 60), 10)
  })
})

describe('all word presets and text options', () => {
  it.each(wordCases)('$count words, punctuation=$punctuation, numbers=$numbers', ({ count, ...modifiers }) => {
    const config = { ...selectWords(DEFAULT_CONFIG, count), ...modifiers }
    const initial = createTest(config, 777)
    expect(initial.words).toHaveLength(count)
    const prefix = initial.words.slice(0, -1).map(word => word.target).join(' ') + ' '
    const last = initial.words.at(-1)!.target
    let state = testReducer(initial, { type: 'INSERT', text: prefix, nowMs: 0 })
    expect(state.status).toBe('running')
    state = testReducer(state, { type: 'TICK', nowMs: 30_000 })
    expect(state.status).toBe('running')
    state = testReducer(state, { type: 'INSERT', text: last, nowMs: 60_000 })
    expect(state.status).toBe('finished')
    expect(state.activeWordIndex).toBe(count - 1)
    expect(state.attempts).toEqual({ correct: prefix.length + last.length, total: prefix.length + last.length })
    expect(calculateMetrics(state).wpm).toBeCloseTo((prefix.length + last.length) / 5, 10)
    expect(calculateMetrics(state).accuracy).toBe(100)
  })
})

describe('deterministic modifiers and long tests', () => {
  it.each(options)('modifier batches: punctuation=$punctuation, numbers=$numbers', modifiers => {
    const words = generateWords(45, 400, 0, modifiers)
    expect(words.slice(127)).toEqual(generateWords(45, 273, 127, modifiers))
    expect(words.every((word, index) => index === 0 || word !== words[index - 1])).toBe(true)
    expect(words.slice(0, 10).some(word => /\d/.test(word))).toBe(modifiers.numbers)
    expect(words.slice(0, 10).some(word => /[,.?!]/.test(word))).toBe(modifiers.punctuation)
    if (modifiers.punctuation) expect(words[0]).toMatch(/^[A-Z0-9]/)
    expect(words.every(word => !/\s/.test(word))).toBe(true)
  })

  it.each(options)('120-second prompt extension: punctuation=$punctuation, numbers=$numbers', modifiers => {
    const config = { ...selectTime(DEFAULT_CONFIG, 120), ...modifiers }
    const targets = generateWords(123, 320, 0, modifiers)
    const text = targets.join(' ')
    let state = testReducer(createTest(config, 123), { type: 'INSERT', text, nowMs: 0 })
    expect(state.status).toBe('running')
    expect(state.activeWordIndex).toBe(319)
    expect(state.words.slice(0, 320).map(word => word.target)).toEqual(targets)
    expect(state.words.length).toBeLessThanOrEqual(384)
    state = testReducer(state, { type: 'TICK', nowMs: 120_000 })
    expect(state.status).toBe('finished')
    expect(calculateMetrics(state).wpm).toBeCloseTo(text.length / 10, 10)
    expect(calculateMetrics(state).accuracy).toBe(100)
  })
})

describe('configuration changes and repeated restarts', () => {
  it('switches modes without retaining an irrelevant mode length or losing modifiers', () => {
    const source = { ...DEFAULT_CONFIG, punctuation: true, numbers: true }
    const words = selectWords(source, 100)
    expect(words).not.toHaveProperty('durationSeconds')
    const timed = selectTime(words, 120)
    expect(timed).not.toHaveProperty('wordCount')
    expect(timed).toMatchObject({ punctuation: true, numbers: true, durationSeconds: 120 })
    expect(describeConfiguration(words)).toBe('english / words 100 / punctuation + numbers')
  })

  it('gives every supported configuration a distinct comparison key', () => {
    const configs: TestConfig[] = [
      ...timeCases.map(({ seconds, ...modifiers }) => ({ ...selectTime(DEFAULT_CONFIG, seconds), ...modifiers })),
      ...wordCases.map(({ count, ...modifiers }) => ({ ...selectWords(DEFAULT_CONFIG, count), ...modifiers })),
    ]
    expect(new Set(configs.map(configurationKey)).size).toBe(32)
  })

  it('abandons counters and the old deadline when changing a running timed test to words', () => {
    let state = testReducer(createTest(selectTime(DEFAULT_CONFIG, 15), 1), { type: 'INSERT', text: 'bad input', nowMs: 0 })
    const config = { ...selectWords(state.config, 50), punctuation: true, numbers: true }
    state = testReducer(state, { type: 'RESTART', config, seed: 2 })
    expect(state).toMatchObject({ status: 'ready', startedAtMs: null, finishedAtMs: null, elapsedMs: 0, activeWordIndex: 0, attempts: { correct: 0, total: 0 } })
    const ready = state
    expect(testReducer(state, { type: 'TICK', nowMs: 15_000 })).toBe(ready)
    state = testReducer(state, { type: 'INSERT', text: state.words[0]!.target, nowMs: 20_000 })
    state = testReducer(state, { type: 'TICK', nowMs: 300_000 })
    expect(state.status).toBe('running')
    expect(state.config).toEqual(config)
  })

  it('a replacement timed test uses its own start and duration', () => {
    let state = testReducer(createTest(selectTime(DEFAULT_CONFIG, 15), 1), { type: 'INSERT', text: 'x', nowMs: 0 })
    state = testReducer(state, { type: 'RESTART', config: selectTime(DEFAULT_CONFIG, 120), seed: 2 })
    state = testReducer(state, { type: 'INSERT', text: state.words[0]!.target, nowMs: 5000 })
    state = testReducer(state, { type: 'TICK', nowMs: 15_000 })
    expect(state).toMatchObject({ status: 'running', elapsedMs: 10_000 })
    state = testReducer(state, { type: 'TICK', nowMs: 125_000 })
    expect(state).toMatchObject({ status: 'finished', elapsedMs: 120_000 })
  })

  it('same-seed retries preserve the full modified word sequence after repeated runs', () => {
    const config = { ...selectWords(DEFAULT_CONFIG, 25), punctuation: true, numbers: true }
    const initial = createTest(config, 43)
    let state = initial
    for (let run = 0; run < 12; run++) {
      state = testReducer(state, { type: 'INSERT', text: 'wrong', nowMs: run * 5000 })
      state = testReducer(state, { type: 'RESTART', config: state.config, seed: state.seed })
      expect(state).toEqual(initial)
    }
  })
})
