import { useRef } from 'react'
import { Icon } from '../../../components/Icon'
import { ResultSummary } from '../../results/ResultSummary'
import { useTypingTest } from '../hooks/useTypingTest'
import { TypingPrompt } from './TypingPrompt'
import styles from './TypingTest.module.css'

export function TypingTest() {
  const { state, dispatch, restart, remainingSeconds } = useTypingTest()
  const input = useRef<HTMLTextAreaElement>(null)

  function restartAndFocus(sameText = false) {
    restart(sameText)
    // The result view remounts the input. Focus after React commits the view.
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }))
  }

  return (
    <section className={`${styles.workspace} ${state.status === 'running' ? styles.running : ''}`} aria-label="Typing practice" data-testid="typing-test" data-status={state.status}>
      <div className={styles.toolbar} aria-label="Test configuration">
        <span className={styles.mode}><Icon name="clock" width="16" height="16" /> time</span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.selected}>30 seconds</span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.language}><Icon name="globe" width="15" height="15" /> english</span>
      </div>

      {state.status === 'finished' ? <ResultSummary state={state} restart={restartAndFocus} /> : (
        <>
          <div className={styles.promptHeader}>
            <span className={styles.testLabel}>common words<span className={styles.wordSet}> / find your flow</span></span>
            <span className={styles.timer} aria-label="Seconds remaining" data-testid="timer">{remainingSeconds}<span>s</span></span>
          </div>
          <TypingPrompt key={state.seed} state={state} dispatch={dispatch} inputRef={input} />
          <div className={styles.practiceActions}>
            <button className={styles.refresh} type="button" onClick={() => restartAndFocus()} aria-label="Restart test" title="Restart test"><Icon name="refresh" /></button>
            <p className={styles.instructions} id="typing-instructions">{state.status === 'ready' ? 'Click the words or tab into the test. Your first key starts the clock.' : 'Keep your rhythm. Backspace to correct, space for the next word.'}</p>
          </div>
        </>
      )}
      <span className={styles.srOnly} role="status">{state.status === 'running' ? 'Test started. You have 30 seconds.' : state.status === 'finished' ? 'Test complete. Your results are ready.' : 'Ready for a 30-second typing test.'}</span>
    </section>
  )
}
