import { ENGLISH_WORDS } from '../../../data/english'
import type { TextOptions } from './types'

function hashAt(seed: number, index: number): number {
  let hash = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad)
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97)
  return (hash ^ (hash >>> 15)) >>> 0
}

export function generateWords(seed: number, count: number, startIndex = 0, options: TextOptions = { punctuation: false, numbers: false }): string[] {
  if (!Number.isInteger(count) || count < 0 || !Number.isInteger(startIndex) || startIndex < 0) {
    throw new RangeError('Word count and offset must be nonnegative integers.')
  }

  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset
    const hash = hashAt(seed, index)
    const poolSize = Math.floor(ENGLISH_WORDS.length / 2)
    let word: string = ENGLISH_WORDS[(hash % poolSize) * 2 + (index % 2)]!

    // Fixed absolute positions keep separately generated batches identical.
    if (options.numbers && index % 7 === 2 + ((seed >>> 0) % 4)) word = String(10 + hashAt(seed ^ 0x51ed270b, index) % 9990)
    if (options.punctuation) {
      if (index % 6 === 0) word = word[0]!.toUpperCase() + word.slice(1)
      if (index % 6 === 2) word += ','
      if (index % 6 === 5) word += ['.', '?', '!'][hash % 3]
    }
    return word
  })
}
