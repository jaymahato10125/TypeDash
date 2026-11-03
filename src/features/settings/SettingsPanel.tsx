import { useProgressSnapshot, useProgressStore } from '../../lib/storage/ProgressContext'
import { FONT_SIZES } from './appearance'
import type { Appearance } from './appearance'
import { useSystemReducedMotion } from './useReducedMotion'
import styles from './Settings.module.css'

export default function SettingsPanel() {
  const store = useProgressStore()
  const { preferences: { appearance }, persistent } = useProgressSnapshot()
  const systemReduced = useSystemReducedMotion()
  const update = (patch: Partial<Appearance>) => store.saveAppearance({ ...store.getSnapshot().preferences.appearance, ...patch })
  return (
    <div className={styles.settings}>
      <p className={styles.intro}>Make a little space for your rhythm. These changes keep your current test.</p>
      <fieldset><legend>Theme</legend><div className={styles.choices}>
        {(['dark', 'light'] as const).map(theme => <button key={theme} type="button" aria-pressed={appearance.theme === theme} onClick={() => update({ theme })}>{theme === 'dark' ? 'Dark' : 'Light'}</button>)}
      </div></fieldset>
      <fieldset><legend>Typing font size</legend><div className={styles.choices}>
        {FONT_SIZES.map(fontSize => <button key={fontSize} type="button" aria-label={`${fontSize} pixels`} aria-pressed={appearance.fontSize === fontSize} onClick={() => update({ fontSize })}>{fontSize}<span>px</span></button>)}
      </div><p className={styles.preview} style={{ fontSize: appearance.fontSize }} aria-hidden="true">find your rhythm<span>.</span></p></fieldset>
      <fieldset><legend>Motion</legend>
        <label className={styles.toggle}><span>Smooth caret<small>A short glide between letters</small></span><input type="checkbox" checked={appearance.smoothCaret} disabled={appearance.reduceMotion || systemReduced} onChange={event => update({ smoothCaret: event.target.checked })} /></label>
        <label className={styles.toggle}><span>Reduce motion<small>Move the caret and scroll instantly</small></span><input type="checkbox" checked={appearance.reduceMotion} onChange={event => update({ reduceMotion: event.target.checked })} /></label>
        {systemReduced && <p className={styles.note}>Your system’s reduced-motion setting is active.</p>}
      </fieldset>
      <fieldset><legend>Live statistics</legend>
        <label className={styles.toggle}><span>Live WPM<small>Correct typing speed during your test</small></span><input type="checkbox" checked={appearance.liveWpm} onChange={event => update({ liveWpm: event.target.checked })} /></label>
        <label className={styles.toggle}><span>Live accuracy<small>Correct input attempts as a percentage</small></span><input type="checkbox" checked={appearance.liveAccuracy} onChange={event => update({ liveAccuracy: event.target.checked })} /></label>
      </fieldset>
      <p className={styles.note}>{persistent ? 'Saved automatically in this browser.' : 'Settings will last for this visit.'}</p>
    </div>
  )
}
