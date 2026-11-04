import { cpus, platform, arch, totalmem } from 'node:os'
import { performance } from 'node:perf_hooks'
import { createTest, testReducer } from '../../src/features/typing/engine/reducer'
import { DEFAULT_CONFIG } from '../../src/features/typing/engine/types'
import { createResult } from '../../src/lib/storage/model'
import { createProgressStore, PROGRESS_KEY } from '../../src/lib/storage/repository'

function distribution(values: number[]) {
  const ordered = values.toSorted((a, b) => a - b)
  const at = (fraction: number) => Number(ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)]!.toFixed(4))
  return { samples: values.length, medianMs: at(0.5), p95Ms: at(0.95), p99Ms: at(0.99), maxMs: at(1) }
}

export function runBenchmark() {
  const insertion: number[] = []
  let extendedWords = 0
  const config = { ...DEFAULT_CONFIG, mode: 'time' as const, durationSeconds: 120 as const }
  // 25 characters/s = 300 WPM for 120 seconds. Warm up three complete runs.
  for (let run = 0; run < 13; run++) {
    let state = createTest(config, run + 1)
    for (let offset = 0; offset < 3000; offset++) {
      const word = state.words[state.activeWordIndex]!
      const character = word.target[word.input.length] ?? ' '
      const start = performance.now()
      state = testReducer(state, { type: 'INSERT', text: character, nowMs: offset * 40 })
      if (run >= 3) insertion.push(performance.now() - start)
    }
    extendedWords = Math.max(extendedWords, state.words.length)
    if (state.activeWordIndex < 128) throw new Error('Benchmark never exercised prompt extension.')
  }

  let completed = createTest({ ...DEFAULT_CONFIG, mode: 'words', wordCount: 10 }, 7)
  completed = testReducer(completed, { type: 'INSERT', text: completed.words.slice(0, -1).map(word => word.target).join(' ') + ' ', nowMs: 0 })
  completed = testReducer(completed, { type: 'INSERT', text: completed.words.at(-1)!.target, nowMs: 1000 })
  const base = createResult(completed, 1)!
  const results = Array.from({ length: 100 }, (_, index) => ({ ...base, id: `history-${index}`, createdAt: index + 1 }))
  const saved = JSON.stringify({ schemaVersion: 1, results, bests: [] })
  const store = createProgressStore(() => ({ getItem: key => key === PROGRESS_KEY ? saved : null, setItem: () => { throw new Error('Unexpected benchmark storage write') } }))
  store.loadProgress()
  if (store.getSnapshot().results.length !== 100) throw new Error('History cap fixture did not load.')
  const restarts: number[] = []
  for (let index = 0; index < 1100; index++) {
    const start = performance.now()
    completed = testReducer(completed, { type: 'RESTART', config, seed: index, runId: `restart-${index}` })
    if (index >= 100) restarts.push(performance.now() - start)
  }
  const input = distribution(insertion)
  const restart = distribution(restarts)
  return {
    measuredAt: new Date().toISOString(),
    environment: { node: process.version, platform: platform(), architecture: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: Number((totalmem() / 2 ** 30).toFixed(1)) },
    scope: 'Node engine reducer only. Excludes browser input dispatch, React, layout, paint, display refresh, and loading. Not a browser latency result.',
    trace: { runs: 10, warmupRuns: 3, charactersPerRun: 3000, simulatedWpm: 300, simulatedSeconds: 120, largestLogicalWordBuffer: extendedWords, loadedHistory: 100 },
    insertion: input, restart,
    regressionLimits: { insertionP95Ms: 4, engineRestartP95Ms: 100 },
    passed: input.p95Ms <= 4 && restart.p95Ms <= 100,
  }
}
