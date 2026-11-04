import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

const output = resolve('dist')
const manifest = JSON.parse(await readFile(resolve(output, '.vite/manifest.json'), 'utf8'))
const html = await readFile(resolve(output, 'index.html'), 'utf8')
const config = JSON.parse(await readFile('vercel.json', 'utf8'))
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))

assert.equal(config.framework, 'vite')
assert.equal(config.installCommand, 'npm ci')
assert.equal(config.buildCommand, 'npm run build')
assert.equal(config.outputDirectory, 'dist')
assert.equal(packageJson.engines.node, '24.x')
assert.equal(config.rewrites, undefined, 'TypeDash uses one root document and hash links; no fallback rewrite is needed.')
const header = source => config.headers.find(rule => rule.source === source)?.headers.find(item => item.key.toLowerCase() === 'cache-control')?.value
assert.equal(header('/assets/:path*'), 'public, max-age=31536000, immutable')
for (const source of ['/', '/index.html']) assert.equal(header(source), 'public, max-age=0, must-revalidate')

const assets = new Set()
for (const chunk of Object.values(manifest)) {
  for (const file of [chunk.file, ...chunk.css ?? [], ...chunk.assets ?? []]) {
    const absolute = resolve(output, file)
    assert(absolute.startsWith(output + sep), 'A manifest path escapes dist.')
    assert((await stat(absolute)).isFile(), `Missing ${file}`)
    assert.match(file, /^assets\/.+-[\w-]{8}\.[\w]+$/, `Unhashed immutable asset: ${file}`)
    assets.add(file)
  }
}
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (!url.startsWith('/')) continue
  assert((await stat(resolve(output, url.slice(1)))).isFile(), `Missing HTML reference: ${url}`)
}
assert(!/node_modules|\/src\/|localhost|127\.0\.0\.1/.test(html), 'Unbuilt or local-only HTML references remain.')
const fonts = [...assets].filter(file => /\.woff2?$/.test(file))
assert.equal(fonts.length, 1, 'Ship only the WOFF2 font used by supported browsers.')
assert(html.includes(`href="/${fonts[0]}" as="font"`), 'The bundled font must be preloaded.')
assert(html.includes('crossorigin'), 'Font preload must use anonymous CORS.')
for (const file of await readdir(resolve(output, 'assets'))) {
  assert(!/\.map$|benchmark|profiling/i.test(file), `Development artifact in dist: ${file}`)
}
assert((await readdir(resolve(output, 'licenses'))).length > 0, 'Retain font attribution.')
console.log(`Release artifact checks passed: ${assets.size} hashed assets, one preloaded local font, Vercel build and cache rules.`)
