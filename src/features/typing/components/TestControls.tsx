import { Icon } from '../../../components/Icon'
import { selectTime, selectWords } from '../engine/config'
import { TIME_PRESETS, WORD_PRESETS } from '../engine/types'
import type { TestConfig } from '../engine/types'
import styles from './TypingTest.module.css'

export function TestControls({ config, configure, selectMode }: { config: TestConfig; configure: (config: TestConfig) => void; selectMode: (mode: TestConfig['mode']) => void }) {
  return (
    <div className={styles.toolbar} aria-label="Test configuration" aria-describedby="configuration-hint">
      <div className={styles.controlGroup} role="group" aria-label="Test mode">
        <button tabIndex={0} type="button" className={styles.toolbarButton} aria-label="Time mode" aria-pressed={config.mode === 'time'} onClick={() => selectMode('time')} title="Start a fresh timed test"><Icon name="clock" width="15" height="15" /> time</button>
        <button tabIndex={0} type="button" className={styles.toolbarButton} aria-label="Words mode" aria-pressed={config.mode === 'words'} onClick={() => selectMode('words')} title="Start a fresh word-count test"><Icon name="keyboard" width="16" height="16" /> words</button>
      </div>
      <span className={styles.divider} aria-hidden="true" />
      <div className={`${styles.controlGroup} ${styles.presets}`} role="group" aria-label="Test length">
        {config.mode === 'time' ? TIME_PRESETS.map(seconds => (
          <button tabIndex={0} key={seconds} type="button" className={styles.toolbarButton} aria-label={`${seconds} seconds`} aria-pressed={config.durationSeconds === seconds} onClick={() => configure(selectTime(config, seconds))} title={`Start a fresh ${seconds}-second test`}>{seconds}</button>
        )) : WORD_PRESETS.map(count => (
          <button tabIndex={0} key={count} type="button" className={styles.toolbarButton} aria-label={`${count} words`} aria-pressed={config.wordCount === count} onClick={() => configure(selectWords(config, count))} title={`Start a fresh ${count}-word test`}>{count}</button>
        ))}
      </div>
      <span className={styles.divider} aria-hidden="true" />
      <div className={`${styles.controlGroup} ${styles.modifiers}`} role="group" aria-label="Text options">
        <button tabIndex={0} type="button" className={styles.toolbarButton} aria-label="Punctuation" aria-pressed={config.punctuation} onClick={() => configure({ ...config, punctuation: !config.punctuation })}><span aria-hidden="true">@</span> punctuation</button>
        <button tabIndex={0} type="button" className={styles.toolbarButton} aria-label="Numbers" aria-pressed={config.numbers} onClick={() => configure({ ...config, numbers: !config.numbers })}><span aria-hidden="true">#</span> numbers</button>
      </div>
      <p id="configuration-hint" className={styles.srOnly}>Changing test settings discards the current run and starts a fresh test.</p>
    </div>
  )
}
