export function startClock(onTick: (nowMs: number) => void, deadlineMs: number, now: () => number = () => performance.now()): () => void {
  let active = true
  let timer: ReturnType<typeof setTimeout>

  function schedule() {
    timer = setTimeout(tick, Math.max(1, Math.min(100, deadlineMs - now())))
  }

  function tick() {
    if (!active) return
    const timestamp = now()
    onTick(timestamp)
    if (active && timestamp < deadlineMs) schedule()
  }

  schedule()
  return () => { active = false; clearTimeout(timer) }
}
