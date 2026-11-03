import { useEffect, useRef } from 'react'
import { Icon } from '../../components/Icon'
import { calculateMetrics } from '../typing/engine/metrics'
import { describeConfiguration } from '../typing/engine/config'
import type { TestState } from '../typing/engine/types'
import styles from '../typing/components/TypingTest.module.css'

export function ResultSummary({ state, restart }: { state: TestState; restart: (sameText?: boolean) => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const metrics = calculateMetrics(state)
  useEffect(() => { heading.current?.focus() }, [])

  return (
    <section className={styles.results} aria-labelledby="result-title">
      <div className={styles.resultHeader}><span className={styles.resultEyebrow}>ONE SESSION. A LITTLE PROGRESS.</span><span className={styles.testLabel} data-testid="result-configuration">{describeConfiguration(state.config)}</span></div>
      <h2 id="result-title" className={styles.resultTitle} ref={heading} tabIndex={-1}>Your rhythm, in numbers<span>.</span></h2>
      <dl className={styles.metrics}>
        <div className={styles.primaryMetric}><dt>words per minute</dt><dd data-testid="result-wpm">{Math.round(metrics.wpm)}</dd></div>
        <div className={styles.primaryMetric}><dt>accuracy</dt><dd data-testid="result-accuracy">{metrics.accuracy.toFixed(1)}<span>%</span></dd></div>
        <div><dt>raw wpm</dt><dd data-testid="result-raw">{Math.round(metrics.rawWpm)}</dd></div>
        <div><dt>time</dt><dd data-testid="result-time">{(metrics.elapsedMs / 1000).toFixed(state.config.mode === 'time' ? 0 : 1)}<span>s</span></dd></div>
      </dl>
      <p className={styles.scoreExplanation}>WPM credits correct words{state.config.mode === 'time' ? ' and an exact unfinished prefix' : ''}. Accuracy keeps every typing attempt, including corrected errors.</p>
      <div className={styles.resultActions}>
        <button type="button" className={styles.newTest} onClick={() => restart()}>New test <Icon name="arrow" width="17" height="17" /></button>
        <button type="button" className={styles.retry} onClick={() => restart(true)}><Icon name="refresh" width="17" height="17" /> Retry same text</button>
      </div>
    </section>
  )
}
