import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'nf_theme'

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// מחיל מוקדם (ב-main, לפני render) כדי למנוע הבהוב צבע
export function initTheme() {
  document.documentElement.setAttribute('data-theme', getInitial())
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}
