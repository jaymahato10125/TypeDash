import { readFile, writeFile } from 'node:fs/promises'

const trace = JSON.parse(await readFile('performance-results/browser-trace.json', 'utf8'))
const events = trace.traceEvents
const inputs = events.filter(event => event.name.startsWith('typedash:input:'))
const commits = new Map()
for (const event of events) {
  if (event.name.startsWith('typedash:commit:')) {
    const key = event.name.split(':').at(-1)
    if (!commits.has(key)) commits.set(key, event)
  }
}
const timings = events.filter(event => event.name === 'EventTiming' && event.ph === 'b' && event.args?.data?.type === 'keydown' && Number.isFinite(event.args.data.duration))
const durations = timings.map(event => event.args.data.duration).sort((a, b) => a - b)
const samples = inputs.map(input => {
  const commit = commits.get(input.name.split(':').at(-1))
  return { id: input.name, inputToCommitMs: commit ? (commit.ts - input.ts) / 1000 : null }
})
const screenshots = events.filter(event => event.name === 'Screenshot' && event.args?.snapshot)
const report = {
  scope: 'Diagnostic trace with screenshot capture enabled. Trace overhead can affect presentation. EventTiming durations use browser presentation data; screenshot capture timestamps and expected_display_time estimates are not substituted for presentation.',
  inputs: inputs.length, commits: commits.size, screenshotFrames: screenshots.length,
  keyboardPresentation: { samples: durations.length, medianMs: durations[Math.floor(durations.length / 2)], p95Ms: durations[Math.ceil(durations.length * 0.95) - 1], maxMs: durations.at(-1) },
  inputToCommit: samples,
}
await writeFile('performance-results/trace-summary.json', JSON.stringify(report, null, 2) + '\n')
for (const index of [0, Math.floor(screenshots.length / 2), screenshots.length - 1]) {
  const screenshot = screenshots[index]
  if (screenshot) await writeFile(`performance-results/trace-frame-${index}.jpg`, Buffer.from(screenshot.args.snapshot, 'base64'))
}
console.log(JSON.stringify({ inputs: report.inputs, commits: report.commits, screenshotFrames: report.screenshotFrames, keyboardPresentation: report.keyboardPresentation }, null, 2))
