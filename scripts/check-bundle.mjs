import { readFile, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { gzipSync } from 'node:zlib'

const output = resolve('dist')
const manifest = JSON.parse(await readFile(resolve(output, '.vite/manifest.json'), 'utf8'))
const initialFiles = new Set(['index.html', 'favicon.svg'])
const visited = new Set()

function collectEntry(key) {
  if (visited.has(key)) return
  visited.add(key)
  const chunk = manifest[key]
  if (!chunk) throw new Error(`Missing build manifest entry: ${key}`)
  initialFiles.add(chunk.file)
  for (const file of [...(chunk.css ?? []), ...(chunk.assets ?? [])]) initialFiles.add(file)
  for (const dependency of chunk.imports ?? []) collectEntry(dependency)
}

for (const [key, chunk] of Object.entries(manifest)) {
  if (chunk.isEntry) collectEntry(key)
}

// Count referenced font fallbacks conservatively, even when only WOFF2 loads.
for (const file of initialFiles) {
  if (!file.endsWith('.css')) continue
  const css = await readFile(resolve(output, file), 'utf8')
  for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    const asset = match[1]
    if (asset.startsWith('data:') || /^https?:/.test(asset)) continue
    initialFiles.add(asset.startsWith('/') ? asset.slice(1) : new URL(asset, `https://local/${file}`).pathname.slice(1))
  }
}

let javascriptBytes = 0
let totalBytes = 0
const files = []

for (const file of [...initialFiles].sort()) {
  const absolute = resolve(output, file)
  if (!absolute.startsWith(output + sep)) throw new Error('Build asset escapes the output directory.')
  const source = await readFile(absolute)
  const bytes = gzipSync(source).byteLength
  totalBytes += bytes
  if (file.endsWith('.js')) javascriptBytes += bytes
  files.push({ file, bytes: (await stat(absolute)).size, gzipBytes: bytes })
}

const budget = { initialJavaScriptGzipBytes: 100_000, initialAssetsGzipBytes: 200_000 }
console.log(JSON.stringify({ initialJavaScriptGzipBytes: javascriptBytes, initialAssetsGzipBytes: totalBytes, budget, files }, null, 2))

if (javascriptBytes > budget.initialJavaScriptGzipBytes || totalBytes > budget.initialAssetsGzipBytes) {
  console.error('TypeDash exceeds its initial-load asset budget.')
  process.exitCode = 1
}
