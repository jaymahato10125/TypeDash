// Retain one line above the active word when sliding the bounded DOM window.
// Rebase at a line boundary so the remaining words keep their horizontal positions.
export function previousLineStart(lines: readonly { index: number; top: number }[], activeIndex: number): number | null {
  const active = lines.find(line => line.index === activeIndex)
  if (!active) return null
  const previousTop = Math.max(...lines.filter(line => line.top < active.top).map(line => line.top))
  return lines.find(line => line.top === previousTop)?.index ?? null
}

export function scrollForCaret(y: number, lineHeight: number, currentTarget: number): number {
  const line = Math.max(0, Math.floor(y / lineHeight))
  if (y < currentTarget || y >= currentTarget + lineHeight * 2) return Math.max(0, (line - 1) * lineHeight)
  return currentTarget
}
