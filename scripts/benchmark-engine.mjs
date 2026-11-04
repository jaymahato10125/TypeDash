import { build } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

await build({ configFile: false, logLevel: 'error', build: { ssr: 'scripts/benchmarks/engine.ts', outDir: 'node_modules/.cache/typedash-benchmark', target: 'node24', minify: false, emptyOutDir: true } })
const { runBenchmark } = await import(pathToFileURL(resolve('node_modules/.cache/typedash-benchmark/engine.js')).href)
const report = runBenchmark()
await mkdir('performance-results', { recursive: true })
await writeFile('performance-results/engine.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
if (!report.passed) process.exitCode = 1
