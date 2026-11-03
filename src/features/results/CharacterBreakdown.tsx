import type { CharacterCounts } from '../typing/engine/types'
import styles from './Results.module.css'

export function CharacterBreakdown({ characters }: { characters: CharacterCounts }) {
  return (
    <div className={styles.characterBlock}>
      <dl className={styles.characters} aria-label="Character breakdown">
        {(['correct', 'incorrect', 'extra', 'missed'] as const).map(kind => <div key={kind}><dt>{kind}</dt><dd data-testid={`characters-${kind}`} data-kind={kind}>{characters[kind]}</dd></div>)}
      </dl>
      <p className={styles.characterNote}>Includes submitted spaces. Missed characters are letters skipped when moving to the next word.</p>
    </div>
  )
}
