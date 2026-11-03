import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch, RefObject } from 'react'
import { bindTypingInput } from '../engine/input'
import { Icon } from '../../../components/Icon'
import type { TestAction, TestState, TypedWord } from '../engine/types'
import styles from './TypingTest.module.css'
import type { Appearance } from '../../settings/appearance'
import { useSystemReducedMotion } from '../../settings/useReducedMotion'
import { previousLineStart, scrollForCaret } from './promptLayout'

const PromptWord = memo(function PromptWord({ word, active, index: wordIndex }: { word: TypedWord; active: boolean; index: number }) {
  const input = Array.from(word.input)
  const target = Array.from(word.target)
  const length = Math.max(target.length, input.length)
  const error = word.submitted && word.input !== word.target

  return (
    <span className={`${styles.word} ${error ? styles.wordError : ''}`} data-active={active || undefined} data-target={word.target} data-word-index={wordIndex}>
      {Array.from({ length }, (_, index) => {
        const status = index >= target.length ? 'extra' : index >= input.length ? word.submitted ? 'missed' : 'pending' : input[index] === target[index] ? 'correct' : 'incorrect'
        return (
          <span key={index} className={styles.letter} data-state={status}>
            {active && input.length === index && <span className={styles.caretAnchor} data-caret-anchor aria-hidden="true" />}
            {input[index] ?? target[index]}
          </span>
        )
      })}
      {active && input.length === length && <span className={styles.letter}><span className={styles.caretAnchor} data-caret-anchor aria-hidden="true" /></span>}
    </span>
  )
})

export function TypingPrompt({ state, dispatch, inputRef, appearance }: { state: TestState; dispatch: Dispatch<TestAction>; inputRef: RefObject<HTMLTextAreaElement | null>; appearance: Appearance }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLSpanElement>(null)
  const [focused, setFocused] = useState(false)
  const [windowFocused, setWindowFocused] = useState(true)
  const activeLength = state.words[state.activeWordIndex]!.input.length
  const [start, setStart] = useState(0)
  const systemReduced = useSystemReducedMotion()
  const reduceMotion = appearance.reduceMotion || systemReduced
  const lastPosition = useRef<{ y: number; start: number } | null>(null)
  const scrollTarget = useRef(0)
  const measureRef = useRef<(() => void) | null>(null)
  const visibleWords = state.words.slice(start, start + 64)

  function focusInput() {
    setFocused(true)
    setWindowFocused(true)
    inputRef.current?.focus({ preventScroll: true })
    dispatch({ type: 'TICK', nowMs: performance.now() })
  }

  useEffect(() => {
    const blur = () => setWindowFocused(false)
    const focus = () => setWindowFocused(true)
    window.addEventListener('blur', blur)
    window.addEventListener('focus', focus)
    return () => { window.removeEventListener('blur', blur); window.removeEventListener('focus', focus) }
  }, [])

  useEffect(() => {
    if (!inputRef.current) return
    return bindTypingInput(inputRef.current, dispatch)
  }, [inputRef, dispatch])

  useLayoutEffect(() => {
    const frame = frameRef.current
    const words = wordsRef.current
    const caret = caretRef.current
    if (!frame || !words || !caret) return
    if (state.activeWordIndex < start || state.activeWordIndex >= start + 48) {
      const lines = Array.from(words.querySelectorAll<HTMLElement>('[data-word-index]'), node => ({ index: Number(node.dataset.wordIndex), top: node.offsetTop }))
      const next = state.activeWordIndex < start ? Math.max(0, state.activeWordIndex - 16) : previousLineStart(lines, state.activeWordIndex)
      if (next !== null && next !== start) {
        // This state reflects measured line wrapping; commit it before the next paint.
        setStart(next)
        return
      }
    }
    const measure = (instant: boolean) => {
      const anchor = words.querySelector<HTMLElement>('[data-caret-anchor]')
      if (!anchor) return
      // Read geometry together, then update the one floating caret and scroll target.
      const bounds = anchor.getBoundingClientRect()
      const container = frame.getBoundingClientRect()
      const lineHeight = parseFloat(getComputedStyle(frame).lineHeight)
      const x = bounds.left - container.left + frame.scrollLeft
      const y = bounds.top - container.top + frame.scrollTop
      const previous = lastPosition.current
      const rebased = previous?.start !== start
      const target = scrollForCaret(y, lineHeight, rebased ? 0 : scrollTarget.current)
      caret.dataset.smooth = String(!instant && !reduceMotion && appearance.smoothCaret && !rebased && previous !== null && Math.abs(previous.y - y) < lineHeight / 2)
      caret.style.height = `${bounds.height}px`
      caret.style.transform = `translate3d(${x}px, ${y}px, 0)`
      if (target !== scrollTarget.current || rebased || instant) {
        frame.scrollTo({ top: target, behavior: instant || rebased || reduceMotion || Math.abs(target - frame.scrollTop) > lineHeight * 2 ? 'instant' : 'smooth' })
        scrollTarget.current = target
      }
      lastPosition.current = { y, start }
    }
    measureRef.current = () => measure(true)
    measure(false)
  }, [state.activeWordIndex, activeLength, start, appearance.fontSize, appearance.smoothCaret, reduceMotion])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let active = true
    let resizeFrame: number | null = null
    const onResize = () => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => { resizeFrame = null; if (active) measureRef.current?.() })
    }
    const observer = new ResizeObserver(onResize)
    observer.observe(frame)
    void document.fonts.ready.then(() => { if (active) measureRef.current?.() })
    return () => { active = false; observer.disconnect(); if (resizeFrame !== null) cancelAnimationFrame(resizeFrame) }
  }, [])

  return (
    <div className={`${styles.inputArea} ${!focused || !windowFocused ? styles.unfocused : ''}`}>
      <div className={styles.promptFrame} ref={frameRef} aria-hidden="true">
        <div className={styles.words} ref={wordsRef}>
          {visibleWords.map((word, index) => <PromptWord key={`${state.seed}-${start + index}`} word={word} index={start + index} active={start + index === state.activeWordIndex} />)}
        </div>
        <span ref={caretRef} className={styles.caret} data-caret data-testid="typing-caret" />
      </div>
      <label className={styles.srOnly} htmlFor="typing-input">Typing input</label>
      <textarea
        id="typing-input" ref={inputRef} className={styles.input} rows={1}
        aria-describedby="typing-instructions current-word" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        onClick={focusInput} onBlur={() => setFocused(false)} onFocus={() => { setFocused(true); setWindowFocused(true); dispatch({ type: 'TICK', nowMs: performance.now() }) }}
      />
      {(!focused || !windowFocused) && <button type="button" className={styles.focusOverlay} tabIndex={-1} onClick={focusInput} aria-label="Focus typing area">
        <span className={styles.focusTitle}><Icon name="keyboard" width="21" height="21" /> Click to focus</span>
        <span>{state.status === 'ready' ? 'or tab into the test. Your first key starts it.' : state.config.mode === 'time' ? 'The timer keeps running.' : 'Elapsed time keeps running.'}</span>
      </button>}
      <span id="current-word" className={styles.srOnly}>Current word: {state.words[state.activeWordIndex]!.target}</span>
    </div>
  )
}
