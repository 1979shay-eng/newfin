// מיפויים ויזואליים לפיד לפי ה-handoff: חשיבות, סנטימנט, סקטור, אווטר.
// צבעים מבוססי-hex כדי לעבוד זהה בכהה ובהיר (tint דרך alpha); הצבעים תלויי-התמה
// (חשיבות נמוכה / ניטרלי / נקודה ריקה) מגיעים כ-CSS variables.
import type { Direction, Reliability } from '../types/db'

export type ImpLevel = 'high' | 'mid' | 'low'

// ציון 1–10 → רמת חשיבות. תואם לסקאלת ה-handoff (high≥80 / mid 60–79 / low<60).
export function impLevel(score: number): ImpLevel {
  if (score >= 8) return 'high'
  if (score >= 4) return 'mid'
  return 'low'
}

export const impLabel: Record<ImpLevel, string> = {
  high: 'חשיבות גבוהה',
  mid: 'חשיבות בינונית',
  low: 'חשיבות נמוכה',
}

export const impColor: Record<ImpLevel, string> = {
  high: '#d6492f',
  mid: '#c07d2a',
  low: 'var(--imp-low)',
}

// כמה נקודות מלאות מתוך 5 (handoff: round(materiality/20) על 0–100 → אצלנו /2)
export function impDots(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score / 2)))
}

// עדיפות מקור: מאיה (verified) = מקור ראשוני #1 ("הלב"). דיווח רשמי גובר על תקשורת.
// ה-boost מתווסף לציון המהותיות בדירוג "משולב": מצף דיווחי מאיה מהותיים לראש הפיד,
// אך עדיין מאפשר לכתבה עיתונאית מהותית מאוד לעקוף רעש טכני של מאיה ("הרעש שוקע").
export function reliabilityBoost(r: Reliability): number {
  if (r === 'verified') return 3 // מאיה — מקור ראשוני, מאומת
  if (r === 'estimate') return -1 // הערכה לא מאומתת
  return 0 // דיווח עיתונאי
}

// ציון דירוג מורכב לפיד ("משולב"): מהותיות + עדיפות מקור + טריות. גבוה = ראש הפיד.
// רכיב הטריות מונע מדיווחים ישנים-וחשובים להישאר תקועים בראש: בונוס שדועך עם הזמן
// (עד +8 לידיעה טרייה, ~1 פחות לכל 6 שעות, מתאפס אחרי ~48 שעות).
export function rankScore(item: {
  materiality_score: number
  reliability: Reliability
  published_at: string
}): number {
  const ageH = (Date.now() - new Date(item.published_at).getTime()) / 3_600_000
  const recency = Number.isFinite(ageH) ? Math.max(0, 8 - ageH / 6) : 0
  return item.materiality_score + reliabilityBoost(item.reliability) + recency
}

// אופי הידיעה לעסקי החברה — לא תחזית למחיר המניה. בלי חיצי ▲/▼ בכוונה: חץ ליד
// שם מניה נקרא כאיתות מסחר, וזה מתקרב לייעוץ השקעות (חוק הייעוץ, סעיף 1).
export const SENTIMENT_NOTE =
  'הערכה אוטומטית של אופי הידיעה לעסקי החברה. אינה תחזית למחיר המניה ואינה המלצה.'
export type Sentiment = { color: string; bg: string; symbol: string; label: string }
export function sentiment(dir: Direction): Sentiment {
  if (dir === 'bull') return { color: '#16a34a', bg: 'rgba(22,163,74,.12)', symbol: '●', label: 'ידיעה חיובית' }
  if (dir === 'bear') return { color: '#dc2626', bg: 'rgba(220,38,38,.12)', symbol: '●', label: 'ידיעה שלילית' }
  return { color: 'var(--sent-flat)', bg: 'rgba(100,116,139,.14)', symbol: '●', label: 'ניטרלית' }
}

// צבע סקטור (hue; ה-tint = אותו hue ב-~0.12 alpha). כולל את טקסונומיית הבורסה שלנו.
const SECTOR: Record<string, string> = {
  'מסחר ושירותים': '#6366f1',
  בנקים: '#3b82f6',
  ביטוח: '#0ea5e9',
  פיננסים: '#0284c7',
  טכנולוגיה: '#8b5cf6',
  ביטחון: '#64748b',
  תשתיות: '#14b8a6',
  'נדל"ן ובינוי': '#d97706',
  אנרגיה: '#f59e0b',
  'אנרגיה מתחדשת': '#14b8a6',
  'נפט וגז': '#f59e0b',
  ביומד: '#ec4899',
  פארמה: '#ec4899',
  תעשייה: '#ea580c',
  'כימיה גומי ופלסטיק': '#0d9488',
  'השקעה ואחזקות': '#6366f1',
  מאקרו: '#64748b',
}
export function sectorColor(name?: string | null): string {
  return (name && SECTOR[name]) || '#64748b'
}

// hex → rgba עם alpha (ל-tint רקע)
export function tint(hex: string, a = 0.12): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// צבע אווטר יציב לפי שם החברה
const AVATAR = ['#3056d3', '#0e7c52', '#7c3aed', '#475569', '#0d8f86', '#b45309', '#c2410c', '#be185d']
export function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR[h % AVATAR.length]
}

// ── קיבוץ לפי יום ─────────────────────────────────────────────────
// מפריד את הפיד ל"היום / אתמול / יום ג׳, 3.8" — כשגוללים עשרות דיווחים
// אי אפשר לדעת לאיזה יום הגעת. מפתח היום מחושב בשעון ישראל, לא UTC.
const IL_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function dayKey(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : IL_DAY.format(d)
}

export function dayLabel(iso: string): string {
  const key = dayKey(iso)
  const now = Date.now()
  if (key === IL_DAY.format(new Date(now))) return 'היום'
  if (key === IL_DAY.format(new Date(now - 86400e3))) return 'אתמול'
  return new Date(iso).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
  })
}

// ── "חדש מאז הביקור האחרון" ────────────────────────────────────────
// הקריאה והכתיבה מופרדות בכוונה: כתיבה בתוך אתחול useState נשברת ב-StrictMode,
// שמריץ את האתחול פעמיים — הקריאה השנייה הייתה מקבלת את החותמת שהרגע נכתבה
// ולכן שום פריט לא היה "חדש". הקריאה טהורה, החתימה יושבת ב-useEffect.
const SEEN_KEY = 'nf:lastSeen'

// חותמת הביקור הקודם (ms), או null בביקור ראשון / כשהאחסון חסום
export function readLastSeen(): number | null {
  try {
    const prev = localStorage.getItem(SEEN_KEY)
    if (!prev) return null // ביקור ראשון — אין "חדש", הכל חדש
    const t = new Date(prev).getTime()
    return Number.isFinite(t) ? t : null
  } catch {
    return null // מצב פרטי / אחסון חסום
  }
}

export function markSeenNow(): void {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
  } catch {
    /* אחסון חסום — הסימון פשוט לא יישמר */
  }
}

// "HH:MM" ו-"DD.MM" בשעון ישראל (להצגה: זמן · תאריך)
export function clockParts(iso: string): { time: string; date: string } {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
  })
  const date = d.toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
  })
  return { time, date }
}
