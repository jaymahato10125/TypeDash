import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { TIME_PRESETS } from '../engine/types'
import styles from './PracticePreview.module.css'

const samples = [
  'a little focus can take you a long way find your own rhythm and let the words flow one key at a time there is no rush just a quiet moment to make a little progress',
  'take a breath and begin again every small step will bring you closer to where you want to be keep your eyes ahead and your hands at ease the next word is a new beginning',
  'the best way forward is to start with what you have a few words a little time and room to grow let the noise fall away as you settle into the simple joy of getting better',
]

export function PracticePreview() {
  const [sampleIndex, setSampleIndex] = useState(0)

  return (
    <section className={styles.workspace} aria-label="Typing practice preview">
      <div className={styles.toolbar} aria-label="Sample test configuration">
        <div className={styles.mode}><Icon name="clock" width="16" height="16" /><span>time</span></div>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.presets} aria-label="Time presets preview">
          {TIME_PRESETS.map(seconds => <span key={seconds} className={seconds === 30 ? styles.selected : styles.preset}>{seconds}</span>)}
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.modifier}><span aria-hidden="true">@</span> punctuation</span>
        <span className={styles.modifier}><span aria-hidden="true">#</span> numbers</span>
      </div>

      <div className={styles.promptHeader}>
        <span className={styles.language}><Icon name="globe" width="15" height="15" /> english<span className={styles.wordSet}> / common words</span></span>
        <span className={styles.previewBadge}><span aria-hidden="true" /> practice preview</span>
      </div>

      <div className={styles.promptFrame}>
        <p className={styles.words} aria-label="Sample typing prompt" key={sampleIndex}>
          {samples[sampleIndex]!.split(' ').map((word, index) => (
            <span className={styles.word} key={`${index}-${word}`}>
              {index === 0 && <span className={styles.caret} aria-hidden="true" />}{word}{' '}
            </span>
          ))}
        </p>
      </div>

      <div className={styles.previewActions}>
        <button className={styles.refresh} type="button" onClick={() => setSampleIndex(index => (index + 1) % samples.length)} aria-label="Refresh sample text" title="Refresh sample text">
          <Icon name="refresh" />
        </button>
        <p className={styles.previewNote}>A little look at what’s next. Interactive typing is coming soon.</p>
      </div>
    </section>
  )
}
