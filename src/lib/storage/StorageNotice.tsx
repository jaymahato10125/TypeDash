import { useProgressSnapshot } from './ProgressContext'
import styles from '../../app/App.module.css'

export function StorageNotice() {
  const snapshot = useProgressSnapshot()
  return snapshot.notice ? <div className={styles.storageNotice} role="status">{snapshot.notice}</div> : null
}
