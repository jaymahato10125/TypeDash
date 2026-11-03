export function startClock(onTick: (nowMs: number) => void, deadlineMs: number | null, now: () => number = () => performance.now()): () => void {
  let active = true
  let timer: ReturnType<typeof setTimeout>

  function schedule() {
    timer = setTimeout(tick, deadlineMs === null ? 1000 : Math.max(1, Math.min(100, deadlineMs - now())))
  }

  function tick() {
    if (!active) return
    const timestamp = now()
    onTick(timestamp)
    if (active && (deadlineMs === null || timestamp < deadlineMs)) schedule()
  }

  schedule()
  return () => { active = false; clearTimeout(timer) }
}
