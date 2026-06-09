import type { Reliability, SourceType, Direction } from '../types/db'

// תוויות עברית לסוג מקור (תיוג טכני OSINT/HUMINT/FININT → ממשק)
export const sourceTypeLabel: Record<SourceType, string> = {
  osint: 'דיווח רשמי',
  humint: 'הערכת אנליסט',
  finint: 'נתוני שוק',
}

// דרגת מהימנות גלויה לקורא
export const reliabilityLabel: Record<Reliability, { text: string; icon: string }> = {
  verified: { text: 'מאומת', icon: '✅✅' },
  reported: { text: 'מדווח', icon: '✅' },
  estimate: { text: 'הערכה', icon: '⚠️' },
}

// כיוון השפעה על המניה
export const directionLabel: Record<
  Direction,
  { text: string; icon: string; className: string }
> = {
  bull: { text: 'חיובי', icon: '▲', className: 'text-emerald-600' },
  bear: { text: 'שלילי', icon: '▼', className: 'text-red-600' },
  neutral: { text: 'ניטרלי', icon: '◆', className: 'text-slate-400' },
}

export type MaterialityTier = 'high' | 'mid' | 'low'

export function materialityTier(score: number): MaterialityTier {
  if (score >= 8) return 'high'
  if (score >= 4) return 'mid'
  return 'low'
}

export const materialityStyle: Record<MaterialityTier, string> = {
  high: 'bg-red-100 text-red-700 ring-1 ring-red-200',
  mid: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  low: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
}

// סגנון עוגן הציון הגדול (לב הכרטיס) — מעט מובלט יותר מה-badge הקטן
export const materialityAnchor: Record<MaterialityTier, string> = {
  high: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  mid: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  low: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
}

// נקודת צבע למהימנות (במקום אימוג'י) — לשורת המטא של הכרטיס
export const reliabilityDot: Record<Reliability, string> = {
  verified: 'bg-emerald-500',
  reported: 'bg-brand',
  estimate: 'bg-amber-500',
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
