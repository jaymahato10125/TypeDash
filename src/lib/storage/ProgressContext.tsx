import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { createProgressStore } from './repository'
import type { ProgressStore } from './repository'

const Context = createContext<ProgressStore | null>(null)

function afterPaint(work: () => void): () => void {
  let active = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = () => { if (!active) return; active = false; cancelAnimationFrame(frame); clearTimeout(fallback); clearTimeout(timer); work() }
  const frame = requestAnimationFrame(() => { timer = setTimeout(run, 0) })
  const fallback = setTimeout(run, 250)
  return () => { active = false; cancelAnimationFrame(frame); clearTimeout(fallback); clearTimeout(timer) }
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createProgressStore(() => window.localStorage, afterPaint))
  useEffect(() => {
    const flush = () => store.flushPending()
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [store])
  return <Context.Provider value={store}>{children}</Context.Provider>
}

export function useProgressStore(): ProgressStore {
  const store = useContext(Context)
  if (!store) throw new Error('TypeDash progress requires its provider.')
  return store
}

export function useProgressSnapshot() {
  const store = useProgressStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
