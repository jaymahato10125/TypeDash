import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE, validateAppearance } from '../../src/features/settings/appearance'
import { previousLineStart, scrollForCaret } from '../../src/features/typing/components/promptLayout'

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(value => {
    const channel = parseInt(value, 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}

describe('appearance accessibility', () => {
  const css = readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8')
  for (const [name, selector] of [['dark', ':root'], ['light', ":root[data-theme='light']"]]) {
    const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0]!
    const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-fA-F]{6});/g)].map(match => [match[1], match[2]!]))
    it(`${name} text, prompt, accent and error colors meet 4.5:1 on both surfaces`, () => {
      for (const foreground of ['text', 'subtle-text', 'muted', 'prompt-text', 'accent', 'error']) {
        for (const background of ['background', 'surface']) {
          const values = [luminance(tokens[foreground]!), luminance(tokens[background]!)].sort((a, b) => b - a)
          expect((values[0]! + 0.05) / (values[1]! + 0.05), `${name}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    })
  }

  it('accepts the documented sizes and rejects unrecognized or incomplete settings', () => {
    for (const fontSize of [22, 28, 34]) expect(validateAppearance({ ...DEFAULT_APPEARANCE, fontSize })).not.toBeNull()
    for (const value of [{}, { ...DEFAULT_APPEARANCE, smoothCaret: 1 }, { ...DEFAULT_APPEARANCE, fontSize: 200 }, null]) expect(validateAppearance(value)).toBeNull()
  })
})

describe('prompt continuity', () => {
  it('keeps the first two lines still and brings subsequent lines into the middle', () => {
    expect(scrollForCaret(10, 50, 0)).toBe(0)
    expect(scrollForCaret(60, 50, 0)).toBe(0)
    expect(scrollForCaret(110, 50, 0)).toBe(50)
    expect(scrollForCaret(160, 50, 50)).toBe(100)
    expect(scrollForCaret(110, 50, 100)).toBe(100)
    expect(scrollForCaret(60, 50, 100)).toBe(0)
  })

  it('rebases on the beginning of the previous line, preserving wrapping', () => {
    const lines = [0, 0, 0, 50, 50, 100, 100, 100, 150].map((top, index) => ({ index: index + 40, top }))
    expect(previousLineStart(lines, 46)).toBe(43)
    expect(previousLineStart(lines, 48)).toBe(45)
    expect(previousLineStart(lines, 40)).toBeNull()
    expect(previousLineStart(lines, 999)).toBeNull()
  })
})
