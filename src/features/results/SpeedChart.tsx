import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { TimelineSample } from '../typing/engine/types'
import styles from './Results.module.css'

export default function SpeedChart({ samples }: { samples: readonly TimelineSample[] }) {
  const id = useId()
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [selected, setSelected] = useState<number | null>(null)
  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(entries => { const entry = entries[0]; if (entry) setWidth(Math.max(240, Math.floor(entry.contentRect.width))) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  if (samples.length < 2) return <p className={styles.chartPlaceholder}>A speed graph will appear after a test with measurable duration.</p>
  const height = 210
  const left = 38, right = width - 15, top = 15, bottom = height - 30
  const duration = samples.at(-1)!.elapsedMs
  const maximum = Math.max(50, Math.ceil(Math.max(...samples.flatMap(point => [point.wpm, point.intervalRawWpm])) / 50) * 50)
  const x = (time: number) => left + time / duration * (right - left)
  const y = (speed: number) => bottom - speed / maximum * (bottom - top)
  const path = (field: 'wpm' | 'intervalRawWpm') => samples.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.elapsedMs).toFixed(2)},${y(point[field]).toFixed(2)}`).join(' ')
  const index = selected === null ? samples.length - 1 : Math.min(selected, samples.length - 1)
  const current = samples[index]!
  const interval = index > 0 ? (current.elapsedMs - samples[index - 1]!.elapsedMs) / 1000 : 0

  function inspect(clientX: number, bounds: DOMRect) {
    const targetTime = Math.max(0, Math.min(1, (clientX - bounds.left - left) / (right - left))) * duration
    let nearest = 0
    for (let cursor = 1; cursor < samples.length; cursor++) if (Math.abs(samples[cursor]!.elapsedMs - targetTime) < Math.abs(samples[nearest]!.elapsedMs - targetTime)) nearest = cursor
    setSelected(nearest)
  }

  return (
    <div className={styles.chart} ref={container} data-testid="speed-chart">
      <div className={styles.legend}><span className={styles.wpmLegend}>WPM</span><span className={styles.rawLegend}>raw, per interval</span><span className={styles.errorLegend}>× errors</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-description`} onPointerMove={event => inspect(event.clientX, event.currentTarget.getBoundingClientRect())}>
        <title id={`${id}-title`}>Typing speed over time</title>
        <desc id={`${id}-description`}>WPM is cumulative average speed. Raw is the speed within each interval. Crosses mark incorrect attempts. Use the slider below to inspect values.</desc>
        {[0, 1, 2, 3, 4].map(step => <g key={step}><line x1={left} x2={right} y1={y(maximum * step / 4)} y2={y(maximum * step / 4)} className={styles.gridLine} /><text x={left - 8} y={y(maximum * step / 4) + 4} textAnchor="end" className={styles.axisText}>{Math.round(maximum * step / 4)}</text></g>)}
        {Array.from({ length: width < 500 ? 3 : 5 }, (_, tick) => { const time = duration * tick / (width < 500 ? 2 : 4); return <text key={tick} x={x(time)} y={height - 7} textAnchor={tick === 0 ? 'start' : tick === (width < 500 ? 2 : 4) ? 'end' : 'middle'} className={styles.axisText}>{(time / 1000).toFixed(duration % 1000 === 0 ? 0 : 1)}s</text> })}
        <path d={path('intervalRawWpm')} className={styles.rawLine} /><path d={path('wpm')} className={styles.wpmLine} />
        {samples.filter(point => point.errors > 0).map(point => <path key={point.elapsedMs} d={`M${x(point.elapsedMs) - 3},${y(point.intervalRawWpm) - 3}l6,6m0,-6l-6,6`} className={styles.errorLine} />)}
        <line x1={x(current.elapsedMs)} x2={x(current.elapsedMs)} y1={top} y2={bottom} className={styles.inspectionLine} />
        <circle cx={x(current.elapsedMs)} cy={y(current.wpm)} r="3.5" className={styles.inspectionPoint} />
      </svg>
      <label className={styles.rangeLabel}>Inspect time <input tabIndex={0} type="range" min="0" max={samples.length - 1} step="1" value={index} aria-label="Inspect speed chart time" aria-valuetext={`${(current.elapsedMs / 1000).toFixed(1)} seconds, ${current.wpm.toFixed(1)} WPM, ${current.intervalRawWpm.toFixed(1)} raw, ${current.errors} errors`} onChange={event => setSelected(Number(event.target.value))} /></label>
      <div className={styles.readout} data-testid="chart-readout"><span>{(current.elapsedMs / 1000).toFixed(1)}s</span><span>WPM <strong>{current.wpm.toFixed(1)}</strong></span><span>raw <strong>{current.intervalRawWpm.toFixed(1)}</strong> <small>over {interval.toFixed(1)}s</small></span><span>errors <strong>{current.errors}</strong></span></div>
    </div>
  )
}
