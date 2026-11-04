import { lazy, Suspense, useRef, useState } from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { TypingTest } from '../features/typing/components/TypingTest'
import styles from './App.module.css'
import { ProgressProvider, useProgressStore } from '../lib/storage/ProgressContext'
import { StorageNotice } from '../lib/storage/StorageNotice'
import { AppearanceController } from '../features/settings/AppearanceController'
import { containDialogFocus } from '../components/dialogFocus'
import { PanelBoundary } from '../components/PanelBoundary'

const HistoryPanel = lazy(() => import('../features/history/HistoryPanel'))
const SettingsPanel = lazy(() => import('../features/settings/SettingsPanel'))

export function App() {
  return <ProgressProvider><AppearanceController /><AppShell /></ProgressProvider>
}

function AppShell() {
  const aboutDialog = useRef<HTMLDialogElement>(null)
  const historyDialog = useRef<HTMLDialogElement>(null)
  const settingsDialog = useRef<HTMLDialogElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const historyButton = useRef<HTMLButtonElement>(null)
  const aboutButton = useRef<HTMLButtonElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const store = useProgressStore()

  function openHistory() {
    store.loadProgress()
    setHistoryOpen(true)
    historyDialog.current?.showModal()
  }

  return (
    <div className={styles.page}>
      <a tabIndex={0} className={styles.skipLink} href="#main">Skip to practice</a>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Brand />
          <span className={styles.headerDivider} aria-hidden="true" />
          <span className={styles.currentView}><Icon name="keyboard" width="18" height="18" /> practice</span>
        </div>
        <div className={styles.headerActions}>
        <button tabIndex={0} ref={settingsButton} className={styles.aboutButton} type="button" aria-label="Settings" onClick={() => { setSettingsOpen(true); settingsDialog.current?.showModal() }}><Icon name="settings" width="18" height="18" /><span>settings</span></button>
        <button tabIndex={0} ref={historyButton} className={styles.aboutButton} type="button" aria-label="History" onClick={openHistory}><Icon name="clock" width="18" height="18" /><span>history</span></button>
        <button tabIndex={0} ref={aboutButton} className={styles.aboutButton} type="button" aria-label="About TypeDash" onClick={() => aboutDialog.current?.showModal()}>
          <Icon name="info" width="19" height="19" /><span>about</span>
        </button>
        </div>
      </header>
      <StorageNotice />

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

      <dialog ref={historyDialog} className={`${styles.dialog} ${styles.historyDialog}`} aria-labelledby="history-title" onKeyDown={containDialogFocus} onClose={() => { setHistoryOpen(false); historyButton.current?.focus({ preventScroll: true }) }}>
        <div className={styles.dialogHeader}><h2 id="history-title">Your recent practice<span>.</span></h2><form method="dialog"><button tabIndex={0} className={styles.closeButton} aria-label="Close history"><Icon name="close" /></button></form></div>
        {historyOpen && <PanelBoundary fallback={<p role="status">History couldn’t load. Reload the page to try again.</p>}><Suspense fallback={<p>Loading your local history…</p>}><HistoryPanel /></Suspense></PanelBoundary>}
      </dialog>

      <dialog ref={settingsDialog} className={`${styles.dialog} ${styles.settingsDialog}`} aria-labelledby="settings-title" onKeyDown={containDialogFocus} onClose={() => { setSettingsOpen(false); settingsButton.current?.focus({ preventScroll: true }) }}>
        <div className={styles.dialogHeader}><h2 id="settings-title">Your space<span>.</span></h2><form method="dialog"><button tabIndex={0} className={styles.closeButton} aria-label="Close settings"><Icon name="close" /></button></form></div>
        {settingsOpen && <PanelBoundary fallback={<p role="status">Settings couldn’t load. Reload the page to try again.</p>}><Suspense fallback={<p>Loading settings…</p>}><SettingsPanel /></Suspense></PanelBoundary>}
      </dialog>

      <dialog ref={aboutDialog} className={styles.dialog} aria-labelledby="about-title" aria-describedby="about-description" onKeyDown={containDialogFocus} onClose={() => aboutButton.current?.focus({ preventScroll: true })}>
        <div className={styles.dialogHeader}>
          <span className={styles.dialogEyebrow}>A QUIETER KIND OF PRACTICE</span>
          <form method="dialog"><button tabIndex={0} className={styles.closeButton} aria-label="Close about panel"><Icon name="close" /></button></form>
        </div>
        <h2 id="about-title">A little focus.<br />A little faster.</h2>
        <p id="about-description">TypeDash is a space to find your typing rhythm and build speed at your own pace.</p>
        <p>No accounts, no distractions. Your practice belongs to you.</p>
        <p>Your settings, latest 100 results, and personal bests stay in this browser. Clearing browser data removes them.</p>
        <p className={styles.dialogNote}>Choose a time or word count, then type what you see. Your first key starts the test. Use backspace to correct and space to move on. Changing the test mode, length, punctuation, or numbers starts a fresh test. Appearance settings keep your current test.</p>
        <form method="dialog"><button tabIndex={0} className={styles.dialogAction}>Back to practice <Icon name="arrow" width="17" height="17" /></button></form>
      </dialog>
    </div>
  )
}
