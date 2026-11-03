import { combineTotals, wordTotals } from './metrics'
import type { TestState, TimelinePoint } from './types'

export const MAX_TIMELINE_POINTS = 300

export function initialTimeline(): readonly TimelinePoint[] {
  return [{ elapsedMs: 0, wpm: 0, intervalRawWpm: 0, errors: 0, creditedUnits: 0, retainedUnits: 0, failedAttempts: 0 }]
}

function pointAt(elapsedMs: number, creditedUnits: number, retainedUnits: number, failedAttempts: number, previous: TimelinePoint): TimelinePoint {
  const duration = elapsedMs - previous.elapsedMs
  return {
    elapsedMs, creditedUnits, retainedUnits, failedAttempts,
    wpm: elapsedMs > 0 ? creditedUnits * 12_000 / elapsedMs : 0,
    intervalRawWpm: duration > 0 ? Math.max(0, retainedUnits - previous.retainedUnits) * 12_000 / duration : 0,
    errors: Math.max(0, failedAttempts - previous.failedAttempts),
  }
}

// Flush old boundaries before input, then the exact boundary/final partial
// interval after input. A delayed tick never assigns new input to past time.
export function sampleTimeline(state: TestState, inclusive: boolean, final = false): TestState {
  if (state.startedAtMs === null || state.elapsedMs <= 0) return state
  const intervalMs = Math.max(state.sampleIntervalMs, 1000 * 2 ** Math.ceil(Math.log2(Math.max(1, state.elapsedMs / ((MAX_TIMELINE_POINTS - 2) * 1000)))))
  let timeline = state.timeline

  if (intervalMs !== state.sampleIntervalMs) {
    const compacted: TimelinePoint[] = [timeline[0]!]
    for (const point of timeline.slice(1)) {
      if (point.elapsedMs % intervalMs === 0) compacted.push(pointAt(point.elapsedMs, point.creditedUnits, point.retainedUnits, point.failedAttempts, compacted.at(-1)!))
    }
    timeline = compacted
  }

  let boundary = (Math.floor(timeline.at(-1)!.elapsedMs / intervalMs) + 1) * intervalMs
  const inRange = () => inclusive ? boundary <= state.elapsedMs : boundary < state.elapsedMs
  const updateCurrent = inclusive && timeline.length > 1 && timeline.at(-1)!.elapsedMs === state.elapsedMs
  if (!inRange() && !updateCurrent && !(final && timeline.at(-1)!.elapsedMs < state.elapsedMs)) {
    return intervalMs === state.sampleIntervalMs ? state : { ...state, timeline, sampleIntervalMs: intervalMs }
  }

  const active = state.words[state.activeWordIndex]!
  const totals = combineTotals(state.completedTotals, wordTotals(active))
  const failedAttempts = state.attempts.total - state.attempts.correct
  const points = [...timeline]
  if (updateCurrent) {
    const last = points.at(-1)!
    if (last.creditedUnits === totals.creditedUnits && last.retainedUnits === totals.retainedUnits && last.failedAttempts === failedAttempts) return intervalMs === state.sampleIntervalMs ? state : { ...state, timeline, sampleIntervalMs: intervalMs }
    points[points.length - 1] = pointAt(state.elapsedMs, totals.creditedUnits, totals.retainedUnits, failedAttempts, points.at(-2)!)
  }
  while (inRange()) {
    points.push(pointAt(boundary, totals.creditedUnits, totals.retainedUnits, failedAttempts, points.at(-1)!))
    boundary += intervalMs
  }
  if (final && points.at(-1)!.elapsedMs < state.elapsedMs) points.push(pointAt(state.elapsedMs, totals.creditedUnits, totals.retainedUnits, failedAttempts, points.at(-1)!))
  return { ...state, timeline: points, sampleIntervalMs: intervalMs }
}
