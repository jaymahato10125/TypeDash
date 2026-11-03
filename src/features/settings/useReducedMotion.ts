import { useSyncExternalStore } from 'react'

const query = '(prefers-reduced-motion: reduce)'
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
const getSnapshot = () => window.matchMedia(query).matches

export function useSystemReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
