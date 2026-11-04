import { useLayoutEffect, useRef, useState } from 'react'
import { useProgressSnapshot } from '../../lib/storage/ProgressContext'
import { comparisonKey } from '../../lib/storage/model'
import type { LocalResult, PersonalBest } from '../../lib/storage/model'
import { describeConfiguration } from '../typing/engine/config'
import { CharacterBreakdown } from '../results/CharacterBreakdown'
import SpeedChart from '../results/SpeedChart'
import styles from './History.module.css'
import { PanelBoundary } from '../../components/PanelBoundary'

function dateLabel(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp)
}

function ResultRow({ result, inspect }: { result: LocalResult; inspect: () => void }) {
  return (
    <li><button tabIndex={0} className={styles.row} type="button" onClick={inspect} data-result-id={result.id} data-testid="history-result" aria-label={`View ${describeConfiguration(result.config)}, ${dateLabel(result.createdAt)}, ${Math.round(result.metrics.wpm)} words per minute`}>
      <span className={styles.date}>{dateLabel(result.createdAt)}</span>
      <span className={styles.configuration}>{describeConfiguration(result.config)}<small>{result.retry ? 'same-text retry' : 'fresh test'}</small></span>
      <span className={styles.number}><strong>{result.metrics.wpm.toFixed(1)}</strong><small>wpm</small></span>
      <span className={styles.number}><strong>{result.metrics.accuracy.toFixed(1)}%</strong><small>accuracy</small></span>
    </button></li>
  )
}

function BestRows({ bests, retry }: { bests: readonly PersonalBest[]; retry: boolean }) {
  const rows = bests.filter(best => best.retry === retry).sort((a, b) => comparisonKey(a).localeCompare(comparisonKey(b)))
  if (!rows.length) return null
  return <section className={styles.bestSection}><h3>{retry ? 'Same-text retry bests' : 'Fresh-test personal bests'}</h3><ul className={styles.list}>{rows.map(best => <li key={comparisonKey(best)} className={styles.bestRow} data-testid="history-best"><span className={styles.configuration}>{describeConfiguration(best.config)}<small>{dateLabel(best.createdAt)}</small></span><span className={styles.number}><strong>{best.metrics.wpm.toFixed(1)}</strong><small>wpm</small></span><span className={styles.number}><strong>{best.metrics.accuracy.toFixed(1)}%</strong><small>accuracy</small></span></li>)}</ul></section>
}

export default function HistoryPanel() {
  const snapshot = useProgressSnapshot()
  const [tab, setTab] = useState<'recent' | 'bests'>('recent')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const returnTo = useRef<string | null>(null)
  const selected = snapshot.results.find(result => result.id === selectedId)

  useLayoutEffect(() => {
    if (selectedId) panel.current?.querySelector<HTMLHeadingElement>('h3')?.focus()
    else if (returnTo.current) {
      Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('[data-result-id]') ?? []).find(row => row.dataset.resultId === returnTo.current)?.focus()
      returnTo.current = null
    }
  }, [selectedId])

  if (selected) return <div ref={panel} className={styles.detail}>
    <button tabIndex={0} type="button" className={styles.back} onClick={() => setSelectedId(null)}>← Back to history</button>
    <h3 tabIndex={-1}>{describeConfiguration(selected.config)}</h3>
    <div className={styles.detailMeta}>{dateLabel(selected.createdAt)} · {selected.retry ? 'same-text retry' : 'fresh test'}</div>
    <dl className={styles.summary}>
      <div><dt>wpm</dt><dd>{selected.metrics.wpm.toFixed(1)}</dd></div><div><dt>accuracy</dt><dd>{selected.metrics.accuracy.toFixed(1)}%</dd></div><div><dt>raw wpm</dt><dd>{selected.metrics.rawWpm.toFixed(1)}</dd></div><div><dt>time</dt><dd>{(selected.metrics.elapsedMs / 1000).toFixed(1)}s</dd></div>
    </dl>
    <CharacterBreakdown characters={selected.metrics.characters} /><PanelBoundary key={selected.id} fallback={<p role="status">The graph couldn’t load. Your scores are still available.</p>}><SpeedChart samples={selected.timeline} /></PanelBoundary>
  </div>

  return <div ref={panel}>
    <div className={styles.tabs} role="group" aria-label="History view">
      <button tabIndex={0} type="button" aria-pressed={tab === 'recent'} onClick={() => setTab('recent')}>Recent tests <span data-testid="history-count">{snapshot.results.length}</span></button>
      <button tabIndex={0} type="button" aria-pressed={tab === 'bests'} onClick={() => setTab('bests')}>Personal bests</button>
    </div>
    {snapshot.notice && <div className={styles.notice}>{snapshot.notice}</div>}
    {tab === 'recent' ? snapshot.results.length ? <ul className={styles.list}>{snapshot.results.map(result => <ResultRow key={result.id} result={result} inspect={() => { returnTo.current = result.id; setSelectedId(result.id) }} />)}</ul> : <div className={styles.empty}>Your recent practice will appear here.<br /><span>Complete a test to get started.</span></div> : snapshot.bests.length ? <><BestRows bests={snapshot.bests} retry={false} /><BestRows bests={snapshot.bests} retry /></> : <div className={styles.empty}>Your first completed test will set a personal best.</div>}
    <div className={styles.privacy}>{snapshot.persistent ? 'Saved only in this browser.' : 'Kept in memory for this visit.'} The latest 100 results are kept. Personal bests survive older results leaving the list. Fresh tests and retries are compared separately.</div>
  </div>
}
