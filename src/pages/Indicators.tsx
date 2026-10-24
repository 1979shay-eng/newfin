import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// אינדיקטורים — תמונת מצב-על של השווקים והתנאים הפיננסיים.
// הנתונים מגיעים מקובץ JSON שהאספן (collector/indicators.mjs) מעדכן בכל סבב.
// כל מספר מגיע ממקור רשמי, עם שמו הרשמי וקישור. נתון חסר — "—", לא מנוחש.

type Tone = 'calm' | 'normal' | 'stress' | 'level'
type Unit = 'pct' | 'pts' | 'ils' | 'dist'
interface Indicator {
  id: string
  name: string
  official: string
  code: string
  org: string
  url: string
  what: string
  unit: Unit
  kind: 'stress' | 'level' | 'curve' | 'trend'
  date: string
  value: number
  close?: number
  ma?: number
  ch1m: number | null
  ch1y: number | null
  years: number | null
  min: number | null
  max: number | null
  pct: number | null
  reading: { label: string; tone: Tone } | null
  spark: [string, number][]
  stale?: boolean
}
interface ErpRow {
  name?: string
  sector?: string
  weight?: number
  fpe: number
  ey: number | null
  erp: number | null
}
interface Data {
  updated_at: string
  overall: { label: string; tone: Tone; text: string } | null
  groups: { id: string; title: string; items: Indicator[] }[]
  erp: { date: string; real10: number; index: ErpRow; sectors: ErpRow[]; history: [string, number][]; since: string } | null
}

const UP = '#16a34a'
const DOWN = '#dc2626'
const REFRESH_MS = 5 * 60 * 1000
const dataUrl = supabase.storage.from('public-data').getPublicUrl('market/indicators.json').data.publicUrl

const GROUP_HINT: Record<string, string> = {
  risk: 'כמה פחד השוק מתמחר, והאם המדדים במגמה ארוכה עולה או יורדת.',
  credit: 'כמה המלווים דורשים מחברות מעל ממשלת ארה"ב. המיקום מחושב מול 3 שנים — זה כל מה שמתפרסם בחינם.',
  rates: 'מחיר הכסף בארה"ב, צורת העקום וציפיות האינפלציה.',
  israel: 'הריבית ושער הדולר — מבנק ישראל.',
}

function useData() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const r = await fetch(`${dataUrl}?t=${Date.now()}`)
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as Data
        if (alive) {
          setData(j)
          setError(false)
        }
      } catch {
        if (alive) setError(true)
      }
    }
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  return { data, error }
}

const sign = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '')
const fmtValue = (u: Unit, v: number) =>
  u === 'pct' ? `${v.toFixed(2)}%` : u === 'ils' ? `₪${v.toFixed(3)}` : u === 'dist' ? `${sign(v)}${Math.abs(v).toFixed(1)}%` : v.toFixed(2)
const fmtChange = (u: Unit, x: number | null) => {
  if (x == null) return '—'
  const a = Math.abs(x)
  if (u === 'pct') return `${sign(x)}${a.toFixed(0)} נ״ב`
  if (u === 'ils') return `${sign(x)}${a.toFixed(1)}%`
  if (u === 'dist') return `${sign(x)}${a.toFixed(1)} נק׳`
  return `${sign(x)}${a.toFixed(2)}`
}
const fmtRange = (u: Unit, v: number) => (u === 'pct' ? `${v.toFixed(2)}%` : u === 'ils' ? v.toFixed(2) : u === 'dist' ? `${sign(v)}${Math.abs(v).toFixed(0)}%` : v.toFixed(1))
// "2026-10-14" → "14.10.26"
const shortDate = (iso: string) => `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}.${iso.slice(2, 4)}`
const fmtNum = (x: number) => x.toLocaleString('he-IL', { maximumFractionDigits: 0 })

const TONE: Record<Tone, { fg: string; bg: string }> = {
  calm: { fg: UP, bg: `color-mix(in oklab, ${UP} 13%, transparent)` },
  stress: { fg: DOWN, bg: `color-mix(in oklab, ${DOWN} 13%, transparent)` },
  normal: { fg: 'var(--ink2)', bg: 'var(--chip)' },
  level: { fg: 'var(--ink2)', bg: 'var(--chip)' },
}

export default function Indicators() {
  const { data, error } = useData()
  const updated = data ? new Date(data.updated_at) : null

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="font-serif text-[38px] font-black leading-[1.05] tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
        אינדיקטורים
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]" style={{ color: 'var(--muted)' }}>
        <span>תמונת מצב של השווקים והתנאים הפיננסיים — ממקורות רשמיים בלבד</span>
        {updated && (
          <>
            <span aria-hidden>·</span>
            <span>
              עודכן {updated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}
            </span>
          </>
        )}
      </p>

      {!data && !error && <Loading />}
      {!data && error && (
        <Card className="mt-5 px-6 py-8 text-center">
          <p className="text-[15px]" style={{ color: 'var(--muted)' }}>
            נתוני האינדיקטורים אינם זמינים כרגע. ננסה שוב בעוד כמה דקות.
          </p>
        </Card>
      )}

      {data && (
        <>
          {data.overall && (
            <Card className="mt-5 px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>
                  תנאי השוק
                </span>
                <Chip tone={data.overall.tone}>{data.overall.label}</Chip>
              </div>
              <p className="mt-2 font-display text-[19px] font-semibold leading-[1.5]" style={{ color: 'var(--ink)' }}>
                {data.overall.text}
              </p>
            </Card>
          )}

          {data.groups.map((g) => (
            <section key={g.id} className="mt-8">
              <h2 className="text-[20px] font-extrabold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
                {g.title}
              </h2>
              {GROUP_HINT[g.id] && (
                <p className="mt-0.5 text-[14px]" style={{ color: 'var(--muted)' }}>
                  {GROUP_HINT[g.id]}
                </p>
              )}
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((it) => (
                  <IndicatorCard key={it.id} it={it} />
                ))}
              </div>
            </section>
          ))}

          {data.erp && <Erp erp={data.erp} />}

          <p className="mt-8 text-[13px] leading-[1.6]" style={{ color: 'var(--muted)' }}>
            שיטה: המיקום של כל אינדיקטור הוא האחוזון של הערך הנוכחי מתוך כל הערכים בחלון — 5 שנים, ולמרווחי האשראי 3 שנים. במדדי פחד "רגוע" = 20% התחתונים
            ו"לחוץ" = 20% העליונים; בריביות אין טוב או רע, רק נמוך, בינוני או גבוה. שורת "תנאי השוק" נגזרת מהמספרים, בלי בינה מלאכותית. הנתונים מוצגים לצורכי
            מידע בלבד ואינם מהווים ייעוץ השקעות.
          </p>
        </>
      )}
    </div>
  )
}

// ── כרטיס אינדיקטור ──────────────────────────────────────────────
function IndicatorCard({ it }: { it: Indicator }) {
  return (
    <Card className="flex flex-col px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-extrabold leading-snug" style={{ color: 'var(--ink)' }}>
          {it.name}
        </h3>
        {it.reading && <Chip tone={it.reading.tone}>{it.reading.label}</Chip>}
      </div>
      <div className="mt-0.5 text-[12px] leading-snug" dir="ltr" style={{ color: 'var(--muted)', textAlign: 'right' }}>
        {it.official} · {it.code}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-[30px] font-extrabold leading-none tracking-[-0.02em] tabular-nums" dir="ltr" style={{ color: 'var(--ink)' }}>
          {fmtValue(it.unit, it.value)}
        </div>
        <Sparkline points={it.spark} zero={it.kind === 'curve' || it.kind === 'trend'} />
      </div>
      {it.close != null && it.ma != null && (
        <div className="mt-1.5 text-[13px] tabular-nums" style={{ color: 'var(--ink2)' }}>
          מדד {fmtNum(it.close)} · ממוצע 200 יום {fmtNum(it.ma)}
        </div>
      )}

      {it.pct != null && it.min != null && it.max != null && it.years && <RangeBar it={it} />}

      <p className="mt-3 text-[13px] leading-[1.55]" style={{ color: 'var(--ink2)' }}>
        {it.what}
      </p>

      <div className="mt-auto pt-3">
        <div className="flex gap-5 border-t pt-3 text-[13px]" style={{ borderColor: 'var(--line2)' }}>
          {(['ch1m', 'ch1y'] as const).map((k) => (
            <span key={k} style={{ color: 'var(--muted)' }}>
              {k === 'ch1m' ? 'חודש' : 'שנה'}{' '}
              <span className="font-bold tabular-nums" dir="ltr" style={{ color: 'var(--ink)' }}>
                {fmtChange(it.unit, it[k])}
              </span>
            </span>
          ))}
        </div>
        <a
          href={it.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-[12px] underline-offset-2 hover:underline"
          style={{ color: it.stale ? DOWN : 'var(--muted)' }}
        >
          {it.org} · {it.stale ? 'לא עודכן מאז ' : 'נכון ל-'}
          {shortDate(it.date)}
        </a>
      </div>
    </Card>
  )
}

// מיקום הערך הנוכחי בטווח החלון: מינימום משמאל למקסימום מימין (LTR, כמו ציר)
function RangeBar({ it }: { it: Indicator }) {
  const span = it.max! - it.min! || 1
  const at = Math.min(100, Math.max(0, ((it.value - it.min!) / span) * 100))
  return (
    <div className="mt-3">
      <div className="relative h-1.5 rounded-full" dir="ltr" style={{ background: 'var(--chip)' }}>
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ left: `${at}%`, background: 'var(--surface)', borderColor: it.reading ? TONE[it.reading.tone].fg : 'var(--ink2)' }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[12px] tabular-nums" dir="ltr" style={{ color: 'var(--muted)' }}>
        <span>{fmtRange(it.unit, it.min!)}</span>
        <span dir="rtl">
          גבוה מ-{it.pct}% מהימים ב-{it.years} השנים האחרונות
        </span>
        <span>{fmtRange(it.unit, it.max!)}</span>
      </div>
    </div>
  )
}

// קו מגמה של שנה. צבע ניטרלי — בריבית ובמרווח "עלייה" אינה טובה או רעה מעצמה
function Sparkline({ points, zero }: { points: [string, number][]; zero?: boolean }) {
  const W = 120
  const H = 36
  if (points.length < 2) return null
  const vals = points.map((p) => p[1])
  const min = Math.min(...vals, ...(zero ? [0] : []))
  const max = Math.max(...vals, ...(zero ? [0] : []))
  const span = max - min || 1
  const y = (v: number) => H - 2 - ((v - min) / span) * (H - 4)
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${y(v)}`).join(' ')
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0"
      role="img"
      aria-label={`מגמה ${shortDate(points[0][0])}–${shortDate(points[points.length - 1][0])}`}
      style={{ transform: 'scaleX(-1)' }} // RTL: הזמן זורם מימין לשמאל, כמו הטקסט
    >
      {zero && min < 0 && max > 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line2)" strokeWidth="1" strokeDasharray="3 3" />}
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── פרמיית סיכון המניות ───────────────────────────────────────────
function Erp({ erp }: { erp: NonNullable<Data['erp']> }) {
  // המדד נכנס לטבלה וממוין עם הסקטורים — מעליו: סקטורים שמתומחרים בפרמיה גבוהה ממנו
  const rows = [...erp.sectors, { ...erp.index, bench: true }].sort((a, b) => (b.erp ?? -99) - (a.erp ?? -99))
  const scale = Math.max(...rows.map((r) => Math.abs(r.erp ?? 0)), 0.01)
  const cols = 'grid-cols-[120px_56px_64px_72px_72px] sm:grid-cols-[minmax(150px,1.3fr)_64px_84px_96px_minmax(80px,1fr)_84px]'
  return (
    <section className="mt-8">
      <h2 className="text-[20px] font-extrabold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
        פרמיית הסיכון של המניות
      </h2>
      <p className="mt-0.5 text-[14px]" style={{ color: 'var(--muted)' }}>
        כמה מניות S&P 500 מתומחרות להניב מעל אג"ח ממשלתי צמוד: תשואת הרווח העתידית (1 חלקי מכפיל הרווח העתידי) פחות הריבית הריאלית ל-10 שנים. פרמיה נמוכה =
        מניות יקרות ביחס לאג"ח.
      </p>
      <Card className="mt-3 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>
              S&P 500 · {shortDate(erp.date)}
            </div>
            <div className="mt-1 text-[30px] font-extrabold leading-none tracking-[-0.02em] tabular-nums" dir="ltr" style={{ color: 'var(--ink)', textAlign: 'right' }}>
              {erp.index.erp != null ? fmtValue('pct', erp.index.erp) : '—'}
            </div>
          </div>
          <div className="text-[14px] leading-[1.6]" style={{ color: 'var(--ink2)' }}>
            תשואת רווח עתידית <b className="tabular-nums">{erp.index.ey?.toFixed(2)}%</b> (מכפיל {erp.index.fpe.toFixed(1)})
            <br />
            פחות ריבית ריאלית ל-10 שנים <b className="tabular-nums">{erp.real10.toFixed(2)}%</b>
          </div>
        </div>
        <div className="overflow-x-auto border-t" style={{ borderColor: 'var(--line2)' }}>
          <div className="min-w-[420px] sm:min-w-0">
            <div className={`grid ${cols} items-center gap-2 px-4 py-2.5 text-[13px] font-bold sm:gap-4 sm:px-5`} style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line2)' }}>
              <span>סקטור</span>
              <span className="text-left">משקל</span>
              <span className="text-left">מכפיל עתידי</span>
              <span className="text-left">תשואת רווח</span>
              <span className="hidden sm:block" />
              <span className="text-left">פרמיה</span>
            </div>
            <ul>
              {rows.map((r, i) => {
                const v = r.erp ?? 0
                const bench = 'bench' in r
                return (
                  <li
                    key={r.sector ?? r.name}
                    className={`grid ${cols} items-center gap-2 px-4 py-3 sm:gap-4 sm:px-5`}
                    style={{
                      borderTop: i ? '1px solid var(--line)' : undefined,
                      background: bench ? 'color-mix(in oklab, var(--accent) 7%, transparent)' : undefined,
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-[16px] font-bold" style={{ color: 'var(--ink)' }}>
                      <span className={bench ? 'font-extrabold' : 'truncate'}>{r.sector ?? r.name}</span>
                      {bench && (
                        <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>
                          המדד
                        </span>
                      )}
                    </span>
                    <span className="text-left text-[15px] font-semibold tabular-nums" dir="ltr" style={{ color: 'var(--ink2)' }}>
                      {bench ? '100%' : `${r.weight}%`}
                    </span>
                    <span className="text-left text-[15px] font-semibold tabular-nums" dir="ltr" style={{ color: 'var(--ink2)' }}>
                      {r.fpe.toFixed(1)}
                    </span>
                    <span className="text-left text-[15px] font-semibold tabular-nums" dir="ltr" style={{ color: 'var(--ink2)' }}>
                      {r.ey != null ? `${r.ey.toFixed(2)}%` : '—'}
                    </span>
                    <span className="relative hidden h-2.5 rounded-full sm:block" dir="ltr" style={{ background: 'var(--chip)' }}>
                      <span className="absolute inset-y-[-3px] left-1/2 w-px" style={{ background: 'var(--line2)' }} />
                      <span
                        className="absolute inset-y-0 rounded-full"
                        style={{ background: bench ? 'var(--accent)' : 'var(--ink2)', width: `${(Math.abs(v) / scale) * 50}%`, ...(v >= 0 ? { left: '50%' } : { right: '50%' }) }}
                      />
                    </span>
                    <span className="text-left text-[16px] font-extrabold tabular-nums" dir="ltr" style={{ color: 'var(--ink)' }}>
                      {r.erp != null ? fmtValue('pct', r.erp) : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
        <p className="border-t px-5 py-3 text-[13px] leading-[1.6]" style={{ borderColor: 'var(--line2)', color: 'var(--muted)' }}>
          חישוב של NewFin. מכפילי הרווח העתידי — תחזית האנליסטים לשנה הבאה (Yahoo Finance), ממוצע הרמוני משוקלל לפי משקל במדד, כמו בדף השווקים. הריבית הריאלית —
          מועצת הפדרל ריזרב (DFII10). לפרמיה אין מקור היסטורי חינמי, ולכן ההיסטוריה שלה נצברת מ-{shortDate(erp.since)} ואילך.
        </p>
      </Card>
    </section>
  )
}

// ── מעטפות ───────────────────────────────────────────────────────
function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold" style={{ background: TONE[tone].bg, color: TONE[tone].fg }}>
      {children}
    </span>
  )
}

function Card({ className = '', style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      className={`rounded-[18px] border ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow)', ...style }}
    >
      {children}
    </div>
  )
}

function Loading() {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="טוען אינדיקטורים">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-[230px] animate-pulse rounded-[18px]" style={{ background: 'var(--chip)' }} />
      ))}
    </div>
  )
}
