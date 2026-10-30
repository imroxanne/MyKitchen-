import type { ReactNode } from 'react'

// Линейные иконки интерфейса (24×24, цвет — currentColor). Только декоративные:
// подпись всегда есть рядом текстом или в aria-label кнопки.
const paths: Record<string, ReactNode> = {
  cook: (
    <>
      <path d="M4 11h16v2a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z" />
      <path d="M2 11h20" />
      <path d="M9 7c0-1.5 1-2 1-3.5M14 7c0-1.5 1-2 1-3.5" />
    </>
  ),
  pantry: (
    <>
      <path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  diary: (
    <>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h11" />
    </>
  ),
  plan: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </>
  ),
}

export type IconName = keyof typeof paths

export function Icon({ name, filled = false }: { name: IconName; filled?: boolean }) {
  return (
    <svg
      className={filled ? 'icon icon-filled' : 'icon'}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}
