import { useEffect, useReducer, useRef } from 'react'
import { startClock } from '../engine/clock'
import { configurationKey, selectTime, selectWords } from '../engine/config'
import { createTest, testReducer } from '../engine/reducer'
import type { TestConfig, TimePreset, WordPreset } from '../engine/types'
import { useProgressStore } from '../../../lib/storage/ProgressContext'

function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0]!
}

export function useTypingTest() {
  const store = useProgressStore()
  const preferences = store.getSnapshot().preferences
  const [state, dispatch] = useReducer(testReducer, undefined, () => createTest(store.getSnapshot().preferences.config, newSeed(), undefined, { id: crypto.randomUUID(), retry: false }))
  const lengths = useRef<{ time: TimePreset; words: WordPreset }>({ time: preferences.time, words: preferences.words })
  const durationMs = state.config.mode === 'time' ? state.config.durationSeconds * 1000 : null

  useEffect(() => {
    if (state.status !== 'running' || state.startedAtMs === null) return
    const tick = () => dispatch({ type: 'TICK', nowMs: performance.now() })
    const stop = startClock(nowMs => dispatch({ type: 'TICK', nowMs }), durationMs === null ? null : state.startedAtMs + durationMs)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [state.status, state.startedAtMs, durationMs])

  useEffect(() => {
    store.savePreferences({ config: state.config, time: lengths.current.time, words: lengths.current.words })
  }, [state.config, store])

  function restart(sameText = false, config = state.config) {
    const candidate = sameText ? state.seed : newSeed()
    const seed = !sameText && candidate === state.seed ? (candidate + 1) >>> 0 : candidate
    dispatch({ type: 'RESTART', config, seed, runId: crypto.randomUUID(), retry: sameText })
  }

  function configure(config: TestConfig) {
    if (configurationKey(config) === configurationKey(state.config)) return
    if (config.mode === 'time') lengths.current.time = config.durationSeconds
    else lengths.current.words = config.wordCount
    restart(false, config)
  }

  function selectMode(mode: TestConfig['mode']) {
    if (mode === state.config.mode) return
    configure(mode === 'time' ? selectTime(state.config, lengths.current.time) : selectWords(state.config, lengths.current.words))
  }

  return { state, dispatch, restart, configure, selectMode, remainingSeconds: Math.max(0, Math.ceil(((durationMs ?? 0) - state.elapsedMs) / 1000)) }
}
