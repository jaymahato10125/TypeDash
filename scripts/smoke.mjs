import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

// Own this preview process and always terminate it; never reuse a user's server.
const port = 4184
const origin = `http://127.0.0.1:${port}`
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''
child.stdout.on('data', chunk => { output += chunk })
child.stderr.on('data', chunk => { output += chunk })
const exited = new Promise(resolve => { child.on('exit', resolve); child.on('error', resolve) })
try {
  let ready = false
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(output)
    if (output.includes(origin)) { ready = true; break }
    await delay(100)
  }
  assert(ready, `Preview did not start: ${output}`)
  const response = await fetch(origin, { signal: AbortSignal.timeout(5000) })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/html/)
  const html = await response.text()
  assert(html.includes('TypeDash — Find your rhythm'))
  const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
  const files = new Set(['favicon.svg'])
  for (const chunk of Object.values(manifest)) for (const file of [chunk.file, ...chunk.css ?? [], ...chunk.assets ?? []]) files.add(file)
  for (const file of files) {
    const asset = await fetch(`${origin}/${file}`, { signal: AbortSignal.timeout(5000) })
    assert.equal(asset.status, 200, file)
    assert(!(asset.headers.get('content-type') ?? '').includes('text/html'), `HTML returned for ${file}`)
    assert((await asset.arrayBuffer()).byteLength > 0, `Empty ${file}`)
  }
  console.log(`Production HTTP smoke passed: root document and ${files.size} static/lazy assets.`)
} finally {
  child.kill('SIGTERM')
  await exited
}
