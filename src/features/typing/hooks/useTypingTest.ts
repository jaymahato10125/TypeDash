import { useEffect, useReducer } from 'react'
import { startClock } from '../engine/clock'
import { createTest, testReducer } from '../engine/reducer'
import { DEFAULT_CONFIG } from '../engine/types'

function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0]!
}

export function useTypingTest() {
  const [state, dispatch] = useReducer(testReducer, undefined, () => createTest(DEFAULT_CONFIG, newSeed()))
  const durationMs = state.config.mode === 'time' ? state.config.durationSeconds * 1000 : 0

  useEffect(() => {
    if (state.status !== 'running' || state.startedAtMs === null) return
    const tick = () => dispatch({ type: 'TICK', nowMs: performance.now() })
    const stop = startClock(nowMs => dispatch({ type: 'TICK', nowMs }), state.startedAtMs + durationMs)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [state.status, state.startedAtMs, durationMs])

  function restart(sameText = false) {
    const candidate = sameText ? state.seed : newSeed()
    const seed = !sameText && candidate === state.seed ? (candidate + 1) >>> 0 : candidate
    dispatch({ type: 'RESTART', config: DEFAULT_CONFIG, seed })
  }

  return { state, dispatch, restart, remainingSeconds: Math.max(0, Math.ceil((durationMs - state.elapsedMs) / 1000)) }
}
