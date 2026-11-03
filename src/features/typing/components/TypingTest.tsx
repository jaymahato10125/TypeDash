import { useEffect, useRef } from 'react'
import { Icon } from '../../../components/Icon'
import { ResultSummary } from '../../results/ResultSummary'
import { useTypingTest } from '../hooks/useTypingTest'
import type { TestConfig } from '../engine/types'
import { TestControls } from './TestControls'
import { TypingPrompt } from './TypingPrompt'
import styles from './TypingTest.module.css'

export function TypingTest() {
  const { state, dispatch, restart, configure, selectMode, remainingSeconds } = useTypingTest()
  const input = useRef<HTMLTextAreaElement>(null)
  const focusFrame = useRef<number | null>(null)

  useEffect(() => () => {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current)
  }, [])

  function cancelPendingFocus() {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current)
    focusFrame.current = null
  }

  function restartAndFocus(sameText = false) {
    cancelPendingFocus()
    restart(sameText)
    // The result view remounts the input. Focus after React commits the view.
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null
      input.current?.focus({ preventScroll: true })
    })
  }

  function configureTest(config: TestConfig) { cancelPendingFocus(); configure(config) }
  function configureMode(mode: TestConfig['mode']) { cancelPendingFocus(); selectMode(mode) }
  const testDescription = state.config.mode === 'time' ? `${state.config.durationSeconds}-second` : `${state.config.wordCount}-word`

  return (
    <section className={`${styles.workspace} ${state.status === 'running' ? styles.running : ''}`} aria-label="Typing practice" data-testid="typing-test" data-status={state.status}>
      <TestControls config={state.config} configure={configureTest} selectMode={configureMode} />

      {state.status === 'finished' ? <ResultSummary state={state} restart={restartAndFocus} /> : (
        <>
          <div className={styles.promptHeader}>
            <span className={styles.language}><Icon name="globe" width="15" height="15" /> english<span className={styles.wordSet}> / common words</span></span>
            {state.config.mode === 'time' ? <span className={styles.timer} aria-label="Seconds remaining" data-testid="timer">{remainingSeconds}<span>s</span></span> : <span className={styles.timer} aria-label="Words completed" data-testid="word-progress">{state.activeWordIndex}<span>/ {state.config.wordCount} words</span></span>}
          </div>
          <TypingPrompt key={state.seed} state={state} dispatch={dispatch} inputRef={input} />
          <div className={styles.practiceActions}>
            <button className={styles.refresh} type="button" onClick={() => restartAndFocus()} aria-label="Restart test" title="Restart test"><Icon name="refresh" /></button>
            <p className={styles.instructions} id="typing-instructions">{state.status === 'ready' ? 'Your first key starts the test. Backspace to correct, space to move on.' : 'Keep your rhythm. Backspace to correct, space for the next word.'}</p>
          </div>
        </>
      )}
      <span className={styles.srOnly} role="status">{state.status === 'running' ? `Your ${testDescription} test has started.` : state.status === 'finished' ? 'Test complete. Your results are ready.' : `Ready for a ${testDescription} typing test.`}</span>
    </section>
  )
}
