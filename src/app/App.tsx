import { useRef } from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { TypingTest } from '../features/typing/components/TypingTest'
import styles from './App.module.css'

export function App() {
  const aboutDialog = useRef<HTMLDialogElement>(null)

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main">Skip to practice</a>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Brand />
          <span className={styles.headerDivider} aria-hidden="true" />
          <span className={styles.currentView}><Icon name="keyboard" width="18" height="18" /> practice</span>
        </div>
        <button className={styles.aboutButton} type="button" aria-label="About TypeDash" onClick={() => aboutDialog.current?.showModal()}>
          <Icon name="info" width="19" height="19" /><span>about</span>
        </button>
      </header>

      <main className={styles.main} id="main" tabIndex={-1}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}><span aria-hidden="true" /> LESS NOISE. MORE FLOW.</p>
          <h1>Find your rhythm<span>.</span></h1>
          <p className={styles.tagline}>Just you, the keys, and a little progress.</p>
        </div>
        <TypingTest />
      </main>

      <div className={styles.bottom}>
        <div className={styles.keyHints} aria-label="Keyboard navigation tips">
          <span><kbd>tab</kbd> navigate</span>
          <span><kbd>enter</kbd> select</span>
        </div>
        <footer className={styles.footer}>
          <span className={styles.footerTagline}>a little better, one word at a time.</span>
          <span className={styles.privacy}><Icon name="shield" width="14" height="14" /> no accounts. just practice.</span>
        </footer>
      </div>

      <dialog ref={aboutDialog} className={styles.dialog} aria-labelledby="about-title" aria-describedby="about-description">
        <div className={styles.dialogHeader}>
          <span className={styles.dialogEyebrow}>A QUIETER KIND OF PRACTICE</span>
          <form method="dialog"><button className={styles.closeButton} aria-label="Close about panel"><Icon name="close" /></button></form>
        </div>
        <h2 id="about-title">A little focus.<br />A little faster.</h2>
        <p id="about-description">TypeDash is a space to find your typing rhythm and build speed at your own pace.</p>
        <p>No accounts, no distractions. Your practice belongs to you.</p>
        <p className={styles.dialogNote}>Type the words you see. Your first key starts a 30-second test. Use backspace to correct a mistake and space to move on.</p>
        <form method="dialog"><button className={styles.dialogAction}>Back to practice <Icon name="arrow" width="17" height="17" /></button></form>
      </dialog>
    </div>
  )
}
