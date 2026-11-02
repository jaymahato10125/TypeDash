import { ENGLISH_WORDS } from '../../../data/english'

export function generateWords(seed: number, count: number, startIndex = 0): string[] {
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(startIndex) || startIndex < 0) {
    throw new RangeError('Word count and offset must be nonnegative integers.')
  }

  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset
    let hash = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0
    hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad)
    hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97)
    hash = (hash ^ (hash >>> 15)) >>> 0
    const poolSize = Math.floor(ENGLISH_WORDS.length / 2)
    return ENGLISH_WORDS[(hash % poolSize) * 2 + (index % 2)]!
  })
}
