import { useLayoutEffect } from 'react'
import { useProgressSnapshot } from '../../lib/storage/ProgressContext'
import { useSystemReducedMotion } from './useReducedMotion'

export function AppearanceController() {
  const { preferences: { appearance } } = useProgressSnapshot()
  const systemReduced = useSystemReducedMotion()
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = appearance.theme
    root.dataset.fontSize = String(appearance.fontSize)
    root.dataset.reduceMotion = String(appearance.reduceMotion || systemReduced)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--background').trim())
  }, [appearance, systemReduced])
  return null
}
