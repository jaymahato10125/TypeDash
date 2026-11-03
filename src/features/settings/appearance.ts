export const FONT_SIZES = [22, 28, 34] as const
export type Appearance = Readonly<{
  theme: 'dark' | 'light'
  fontSize: typeof FONT_SIZES[number]
  smoothCaret: boolean
  reduceMotion: boolean
  liveWpm: boolean
  liveAccuracy: boolean
}>

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'dark', fontSize: 28, smoothCaret: true, reduceMotion: false, liveWpm: false, liveAccuracy: false,
}

export function validateAppearance(value: unknown): Appearance | null {
  if (typeof value !== 'object' || value === null) return null
  const item = value as Record<string, unknown>
  if ((item.theme !== 'dark' && item.theme !== 'light') || !FONT_SIZES.includes(item.fontSize as Appearance['fontSize'])) return null
  if (typeof item.smoothCaret !== 'boolean' || typeof item.reduceMotion !== 'boolean' || typeof item.liveWpm !== 'boolean' || typeof item.liveAccuracy !== 'boolean') return null
  return { theme: item.theme, fontSize: item.fontSize as Appearance['fontSize'], smoothCaret: item.smoothCaret, reduceMotion: item.reduceMotion, liveWpm: item.liveWpm, liveAccuracy: item.liveAccuracy }
}
