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
  bull: { text: 'חיובי', icon: '▲', className: 'text-emerald-400' },
  bear: { text: 'שלילי', icon: '▼', className: 'text-rose-400' },
  neutral: { text: 'ניטרלי', icon: '◆', className: 'text-slate-500' },
}

export type MaterialityTier = 'high' | 'mid' | 'low'

export function materialityTier(score: number): MaterialityTier {
  if (score >= 8) return 'high'
  if (score >= 4) return 'mid'
  return 'low'
}

// תג מהותיות קטן — גרסה כהה. שם המניה הוא הכוכב; הציון תג עזר בלבד.
export const materialityStyle: Record<MaterialityTier, string> = {
  high: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/25',
  mid: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25',
  low: 'bg-white/5 text-slate-400 ring-1 ring-white/10',
}

// נקודת צבע למהימנות (במקום אימוג'י) — לשורת המטא של הכרטיס
export const reliabilityDot: Record<Reliability, string> = {
  verified: 'bg-emerald-400',
  reported: 'bg-brand-light',
  estimate: 'bg-amber-400',
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
