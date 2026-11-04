import styles from './Brand.module.css'

export function Brand() {
  return (
    <a tabIndex={0} className={styles.brand} href="#main" aria-label="TypeDash home">
      <svg className={styles.mark} viewBox="0 0 36 36" fill="currentColor" aria-hidden="true">
        <rect x="3" y="7" width="24" height="4.5" rx="2.25" />
        <rect x="10" y="16" width="23" height="4.5" rx="2.25" />
        <rect x="3" y="25" width="18" height="4.5" rx="2.25" />
      </svg>
      <span className={styles.wordmark}>type<span>dash</span><span className={styles.period}>.</span></span>
    </a>
  )
}
