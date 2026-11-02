import { memo, useEffect, useLayoutEffect, useRef } from 'react'
import type { Dispatch, RefObject } from 'react'
import { bindTypingInput } from '../engine/input'
import type { TestAction, TestState, TypedWord } from '../engine/types'
import styles from './TypingTest.module.css'

const PromptWord = memo(function PromptWord({ word, active }: { word: TypedWord; active: boolean }) {
  const input = Array.from(word.input)
  const target = Array.from(word.target)
  const length = Math.max(target.length, input.length)
  const error = word.submitted && word.input !== word.target

  return (
    <span className={`${styles.word} ${error ? styles.wordError : ''}`} data-active={active || undefined} data-target={word.target}>
      {Array.from({ length }, (_, index) => {
        const status = index >= target.length ? 'extra' : index >= input.length ? word.submitted ? 'missed' : 'pending' : input[index] === target[index] ? 'correct' : 'incorrect'
        return (
          <span key={index} className={styles.letter} data-state={status}>
            {active && input.length === index && <span className={styles.caret} data-caret aria-hidden="true" />}
            {input[index] ?? target[index]}
          </span>
        )
      })}
      {active && input.length === length && <span className={styles.letter}><span className={styles.caret} data-caret aria-hidden="true" /></span>}
    </span>
  )
})

export function TypingPrompt({ state, dispatch, inputRef }: { state: TestState; dispatch: Dispatch<TestAction>; inputRef: RefObject<HTMLTextAreaElement | null> }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef<HTMLDivElement>(null)
  const activeLength = state.words[state.activeWordIndex]!.input.length
  const start = Math.max(0, state.activeWordIndex - 8)
  const visibleWords = state.words.slice(start, start + 64)

  useEffect(() => {
    if (!inputRef.current) return
    return bindTypingInput(inputRef.current, dispatch)
  }, [inputRef, dispatch])

  useLayoutEffect(() => {
    const frame = frameRef.current
    const caret = wordsRef.current?.querySelector<HTMLElement>('[data-caret]')
    if (!frame || !caret) return
    const bounds = caret.getBoundingClientRect()
    const container = frame.getBoundingClientRect()
    const lineHeight = parseFloat(getComputedStyle(frame).lineHeight)
    if (bounds.bottom > container.bottom - 5) frame.scrollTop += bounds.bottom - container.bottom + lineHeight / 2
    else if (bounds.top < container.top) frame.scrollTop -= container.top - bounds.top + 4
  }, [state.activeWordIndex, activeLength, state.seed])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let active = true
    const keepCaretVisible = () => {
      if (!active) return
      const caret = wordsRef.current?.querySelector<HTMLElement>('[data-caret]')
      if (!caret) return
      const bounds = caret.getBoundingClientRect()
      const container = frame.getBoundingClientRect()
      if (bounds.bottom > container.bottom) frame.scrollTop += bounds.bottom - container.bottom + 8
      else if (bounds.top < container.top) frame.scrollTop -= container.top - bounds.top + 8
    }
    const observer = new ResizeObserver(keepCaretVisible)
    observer.observe(frame)
    void document.fonts.ready.then(keepCaretVisible)
    return () => { active = false; observer.disconnect() }
  }, [])

  return (
    <div className={styles.inputArea}>
      <div className={styles.promptFrame} ref={frameRef} aria-hidden="true">
        <div className={styles.words} ref={wordsRef}>
          {visibleWords.map((word, index) => <PromptWord key={`${state.seed}-${start + index}`} word={word} active={start + index === state.activeWordIndex} />)}
        </div>
      </div>
      <label className={styles.srOnly} htmlFor="typing-input">Typing input</label>
      <textarea
        id="typing-input" ref={inputRef} className={styles.input} rows={1}
        aria-describedby="typing-instructions current-word" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        onClick={() => inputRef.current?.focus()} onFocus={() => dispatch({ type: 'TICK', nowMs: performance.now() })}
      />
      <span id="current-word" className={styles.srOnly}>Current word: {state.words[state.activeWordIndex]!.target}</span>
    </div>
  )
}
