import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { calculateMetrics } from '../engine/metrics'
import type { TestState } from '../engine/types'
import styles from './TypingTest.module.css'

export function LiveStats({ state, wpm, accuracy }: { state: TestState; wpm: boolean; accuracy: boolean }) {
  const latest = useRef(state)
  const [metrics, setMetrics] = useState(() => calculateMetrics(state))
  useLayoutEffect(() => { latest.current = state })
  useEffect(() => {
    if (state.status !== 'running' || (!wpm && !accuracy)) return
    // Input remains immediate; aggregate display work is capped at ten updates/second.
    const timer = setInterval(() => setMetrics(calculateMetrics(latest.current)), 100)
    return () => clearInterval(timer)
  }, [state.status, wpm, accuracy])
  return <dl className={styles.liveStats} aria-label="Live typing statistics" aria-live="off">
    {wpm && <div><dt>WPM</dt><dd data-testid="live-wpm">{state.status === 'ready' ? '—' : Math.round(metrics.wpm)}</dd></div>}
    {accuracy && <div><dt>accuracy</dt><dd data-testid="live-accuracy">{state.status === 'ready' ? '—' : `${metrics.accuracy.toFixed(1)}%`}</dd></div>}
  </dl>
}
