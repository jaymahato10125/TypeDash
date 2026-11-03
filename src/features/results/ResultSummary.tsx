import { lazy, Suspense, useEffect, useRef } from 'react'
import { Icon } from '../../components/Icon'
import { calculateMetrics } from '../typing/engine/metrics'
import { describeConfiguration } from '../typing/engine/config'
import { SCORING_VERSION } from '../typing/engine/types'
import type { TestState } from '../typing/engine/types'
import { useProgressSnapshot, useProgressStore } from '../../lib/storage/ProgressContext'
import { comparisonKey, createResult } from '../../lib/storage/model'
import { CharacterBreakdown } from './CharacterBreakdown'
import details from './Results.module.css'
import styles from '../typing/components/TypingTest.module.css'

const SpeedChart = lazy(() => import('./SpeedChart'))

export function ResultSummary({ state, restart }: { state: TestState; restart: (sameText?: boolean) => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const metrics = calculateMetrics(state)
  const store = useProgressStore()
  const snapshot = useProgressSnapshot()
  useEffect(() => { heading.current?.focus() }, [])
  useEffect(() => {
    const result = createResult(state, Date.now())
    if (result) store.queueResult(result)
    // The store owns pending saves so a quick restart cannot discard a result.
  }, [state, store])
  const receipt = snapshot.receipt?.resultId === state.runId ? snapshot.receipt : null
  const best = snapshot.bests.find(item => comparisonKey(item) === comparisonKey({ config: state.config, retry: state.retry, scoringVersion: SCORING_VERSION }))
  const saved = receipt !== null || snapshot.results.some(result => result.id === state.runId)

  return (
    <section className={styles.results} aria-labelledby="result-title">
      <div className={styles.resultHeader}><span className={styles.resultEyebrow}>ONE SESSION. A LITTLE PROGRESS.</span><span className={styles.testLabel} data-testid="result-configuration">{describeConfiguration(state.config)}</span></div>
      <h2 id="result-title" className={styles.resultTitle} ref={heading} tabIndex={-1}>Your rhythm, in numbers<span>.</span></h2>
      <div className={details.completion} role="status" data-testid="save-status">
        {state.retry && <span className={details.retryBadge}>Same-text retry</span>}
        {receipt?.personalBest ? <span className={details.bestBadge}>{state.retry ? 'New retry best' : 'New personal best'}</span> : best ? <span>{state.retry ? 'Retry best' : 'Personal best'}: {best.metrics.wpm.toFixed(1)} WPM</span> : null}
        <span>{metrics.rawWpm <= 0 || metrics.elapsedMs <= 0 ? 'Empty tests are not saved.' : saved ? snapshot.persistent ? 'Saved on this device' : 'Kept for this visit' : 'Saving result…'}</span>
      </div>
      <dl className={styles.metrics}>
        <div className={styles.primaryMetric}><dt>words per minute</dt><dd data-testid="result-wpm">{Math.round(metrics.wpm)}</dd></div>
        <div className={styles.primaryMetric}><dt>accuracy</dt><dd data-testid="result-accuracy">{metrics.accuracy.toFixed(1)}<span>%</span></dd></div>
        <div><dt>raw wpm</dt><dd data-testid="result-raw">{Math.round(metrics.rawWpm)}</dd></div>
        <div><dt>time</dt><dd data-testid="result-time">{(metrics.elapsedMs / 1000).toFixed(state.config.mode === 'time' ? 0 : 1)}<span>s</span></dd></div>
      </dl>
      <CharacterBreakdown characters={metrics.characters} />
      <Suspense fallback={<div className={details.chartPlaceholder}>Loading your speed graph…</div>}><SpeedChart samples={state.timeline} /></Suspense>
      <p className={styles.scoreExplanation}>WPM credits correct words{state.config.mode === 'time' ? ' and an exact unfinished prefix' : ''}. Accuracy keeps every typing attempt, including corrected errors.</p>
      <div className={styles.resultActions}>
        <button type="button" className={styles.newTest} onClick={() => restart()}>New test <Icon name="arrow" width="17" height="17" /></button>
        <button type="button" className={styles.retry} onClick={() => restart(true)}><Icon name="refresh" width="17" height="17" /> Retry same text</button>
      </div>
    </section>
  )
}
