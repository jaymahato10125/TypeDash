import type { ReactNode, SVGProps } from 'react'

type IconName = 'keyboard' | 'clock' | 'globe' | 'refresh' | 'info' | 'shield' | 'close' | 'arrow' | 'settings'

type IconProps = SVGProps<SVGSVGElement> & { name: IconName }

const paths: Record<IconName, ReactNode> = {
  settings: <><path d="M4 7h6m4 0h6M4 17h10m4 0h2" /><circle cx="12" cy="7" r="2" /><circle cx="16" cy="17" r="2" /></>,
  keyboard: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 15h10" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7.5 7.5 0 0 1 12.5-.5L20 9M4 15l1.5 2.5A7.5 7.5 0 0 0 18 17" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  shield: <><path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6l8-3Z" /><path d="m8.5 11.5 2.5 2.5 4.5-5" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
}

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  )
}
