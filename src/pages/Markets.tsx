import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// סיכום מסחר — ישראל וארה"ב, יומי ו-7 ימי מסחר, עם פילוח סקטוריאלי.
// הנתונים מגיעים מקובץ JSON שהאספן (collector/markets.mjs) מעדכן בכל סבב.
// אין כאן אף מספר שלא הגיע מהמקור: נתון חסר מוצג כ"—", לא מנוחש.

type Period = 'd1' | 'd7'
type Market = 'il' | 'us'

interface Day {
  date: string
  close: number
  change: number | null
}
interface IndexRow {
  name: string
  date: string
  last: number
  d1: number | null
  d7: number | null
  days: Day[]
}
interface Stock {
  name: string
  weight: number
  d1: number | null
  d7: number | null
}
interface SectorRow {
  sector: string
  weight?: number
  d1: number | null
  d7: number | null
  stocks?: Stock[]
}
interface Summary {
  updated_at: string
  il: {
    indices: IndexRow[]
    sectorIndices: { name: string; last: number; d1: number | null; d7: number | null }[]
    breakdown: Record<string, SectorRow[]>
    notes: { d1: string | null; d7: string | null }
  }
  us: {
    indices: IndexRow[]
    sectors: SectorRow[]
    notes: { d1: string | null; d7: string | null }
  }
}

const UP = '#16a34a'
const DOWN = '#dc2626'
const REFRESH_MS = 2 * 60 * 1000

const summaryUrl = supabase.storage.from('public-data').getPublicUrl('market/summary.json').data.publicUrl

function useSummary() {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        // פרמטר זמן עוקף מטמון — הקובץ מתעדכן כל כמה דקות
        const r = await fetch(`${summaryUrl}?t=${Date.now()}`)
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as Summary
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

const fmtPct = (x: number | null | undefined) =>
  x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(2)}%`
const fmtNum = (x: number) => x.toLocaleString('he-IL', { maximumFractionDigits: 2 })
const tone = (x: number | null | undefined) => (x == null || x === 0 ? 'var(--sent-flat)' : x > 0 ? UP : DOWN)
const arrow = (x: number | null | undefined) => (x == null || x === 0 ? '' : x > 0 ? '▲' : '▼')
// "2026-10-14" → "14.10"
const shortDate = (iso: string) => `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}`

export default function Markets() {
  const { data, error } = useSummary()
  const [market, setMarket] = useState<Market>('il')
  const [period, setPeriod] = useState<Period>('d1')
  const [ilIndex, setIlIndex] = useState('ת"א-35')

  const updated = data ? new Date(data.updated_at) : null
  const m = data?.[market]
  const lead = m?.indices[0]
  const tradeDate = lead?.date

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="font-serif text-[38px] font-black leading-[1.05] tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
        סיכום מסחר
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]" style={{ color: 'var(--muted)' }}>
        <span>מדדים וסקטורים בישראל ובארה"ב — יום המסחר האחרון ו-7 ימי המסחר האחרונים</span>
        {updated && (
          <>
            <Dot />
            <span>
              עודכן {updated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}
            </span>
          </>
        )}
      </p>

      {/* בחירת שוק + תקופה */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Tab active={market === 'il'} onClick={() => setMarket('il')}>
            ישראל
          </Tab>
          <Tab active={market === 'us'} onClick={() => setMarket('us')}>
            ארה"ב
          </Tab>
        </div>
        <Seg
          opts={[
            { key: 'd1', label: 'יום אחרון' },
            { key: 'd7', label: '7 ימי מסחר' },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </div>

      {!data && !error && <Loading />}
      {!data && error && (
        <Card className="mt-4 px-6 py-8 text-center">
          <p className="text-[15px]" style={{ color: 'var(--muted)' }}>
            נתוני המסחר אינם זמינים כרגע. ננסה שוב בעוד כמה דקות.
          </p>
        </Card>
      )}

      {m && (
        <>
          {/* השורה התחתונה — המוקד של הדף */}
          {m.notes[period] && (
            <Card className="mt-4 px-6 py-5">
              <div className="text-[12.5px] font-bold" style={{ color: 'var(--muted2)' }}>
                {period === 'd1' ? `שורה תחתונה · ${tradeDate ? shortDate(tradeDate) : ''}` : 'שורה תחתונה · 7 ימי מסחר'}
              </div>
              <p className="mt-1.5 font-display text-[19px] font-semibold leading-[1.45]" style={{ color: 'var(--ink)' }}>
                {m.notes[period]}
              </p>
            </Card>
          )}

          {/* מדדי הדגל */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {m.indices.map((ix) => (
              <IndexCard key={ix.name} ix={ix} period={period} />
            ))}
          </div>

          {market === 'il' ? (
            <>
              <Section
                title="סקטורים בתוך המדד"
                hint="תשואה משוקללת של המניות בכל ענף, לפי משקלן במדד. לחיצה על ענף מציגה את המניות."
                action={
                  <Seg
                    opts={Object.keys(data.il.breakdown).map((k) => ({ key: k, label: k }))}
                    value={ilIndex}
                    onChange={setIlIndex}
                  />
                }
              >
                <SectorBars rows={data.il.breakdown[ilIndex] ?? []} period={period} showWeight />
              </Section>

              <Section title="מדדי הענף של הבורסה" hint="מדדי הענף הרשמיים של הבורסה לניירות ערך בתל אביב.">
                <SectorBars
                  rows={data.il.sectorIndices.map((s) => ({ sector: s.name, d1: s.d1, d7: s.d7 }))}
                  period={period}
                />
              </Section>
            </>
          ) : (
            <Section
              title="סקטורים ב-S&P 500"
              hint="כל סקטור נמדד לפי קרן הסל הרשמית שלו (Select Sector SPDR)."
            >
              <SectorBars rows={data.us.sectors} period={period} />
            </Section>
          )}

          <p className="mt-6 text-[12.5px]" style={{ color: 'var(--muted2)' }}>
            מקור: {market === 'il' ? 'הבורסה לניירות ערך בתל אביב' : 'Yahoo Finance'}. הנתונים מוצגים לצורכי מידע בלבד
            ואינם מהווים ייעוץ השקעות.
          </p>
        </>
      )}
    </div>
  )
}

// ── כרטיס מדד: ערך, שינוי ומגמת 7 הימים ─────────────────────────────
function IndexCard({ ix, period }: { ix: IndexRow; period: Period }) {
  const v = ix[period]
  return (
    <Card className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>
          {ix.name}
        </span>
        <span className="text-[12.5px] tabular-nums" style={{ color: 'var(--muted2)' }}>
          {fmtNum(ix.last)}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="text-[28px] font-extrabold leading-none tracking-[-0.02em] tabular-nums" style={{ color: tone(v) }} dir="ltr">
          <span className="ml-1 text-[15px]" aria-hidden>
            {arrow(v)}
          </span>
          {fmtPct(v)}
        </span>
        <Sparkline days={ix.days} />
      </div>
    </Card>
  )
}

// קו מגמה של 7 הסגירות האחרונות — צבע לפי כיוון החלון כולו
function Sparkline({ days }: { days: Day[] }) {
  const W = 96
  const H = 32
  if (days.length < 2) return null
  const closes = days.map((d) => d.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const span = max - min || 1
  const pts = closes.map((c, i) => `${(i / (closes.length - 1)) * W},${H - 2 - ((c - min) / span) * (H - 4)}`).join(' ')
  const color = closes[closes.length - 1] >= closes[0] ? UP : DOWN
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0"
      role="img"
      aria-label={`מגמה ${shortDate(days[0].date)}–${shortDate(days[days.length - 1].date)}`}
      style={{ transform: 'scaleX(-1)' }} // RTL: הזמן זורם מימין לשמאל, כמו הטקסט
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── עמודות מתפצלות: עלייה לצד אחד, ירידה לצד השני, מציר אחד ──────────
function SectorBars({ rows, period, showWeight }: { rows: SectorRow[]; period: Period; showWeight?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const sorted = useMemo(
    () => rows.filter((r) => r[period] != null).sort((a, b) => (b[period] ?? 0) - (a[period] ?? 0)),
    [rows, period],
  )
  const scale = Math.max(...sorted.map((r) => Math.abs(r[period] ?? 0)), 0.01)

  if (!sorted.length) {
    return (
      <p className="px-5 py-6 text-[15px]" style={{ color: 'var(--muted)' }}>
        אין נתונים לתקופה זו.
      </p>
    )
  }

  return (
    <ul>
      {sorted.map((r, i) => {
        const v = r[period] ?? 0
        const pct = (Math.abs(v) / scale) * 50
        const expandable = Boolean(r.stocks?.length)
        const isOpen = open === r.sector
        return (
          <li key={r.sector} style={{ borderTop: i ? '1px solid var(--line)' : undefined }}>
            <button
              type="button"
              disabled={!expandable}
              onClick={() => setOpen(isOpen ? null : r.sector)}
              aria-expanded={expandable ? isOpen : undefined}
              className="grid w-full grid-cols-[minmax(96px,1.1fr)_2fr_72px] items-center gap-4 px-5 py-3 text-right transition-colors enabled:hover:bg-[var(--hover)] sm:grid-cols-[minmax(140px,1fr)_3fr_88px]"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold" style={{ color: 'var(--ink)' }}>
                  {r.sector}
                </span>
                {showWeight && r.weight != null && (
                  <span className="text-[12.5px]" style={{ color: 'var(--muted2)' }}>
                    {r.weight}% מהמדד{expandable ? ` · ${r.stocks!.length === 1 ? 'מניה אחת' : `${r.stocks!.length} מניות`}` : ''}
                  </span>
                )}
              </span>
              {/* מסלול הפוך ל-LTR כדי שעלייה תימשך ימינה מהציר, כמקובל בגרפים */}
              <span className="relative h-2.5 rounded-full" dir="ltr" style={{ background: 'var(--chip)' }}>
                <span className="absolute inset-y-[-3px] left-1/2 w-px" style={{ background: 'var(--line2)' }} />
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    background: tone(v),
                    width: `${pct}%`,
                    ...(v >= 0 ? { left: '50%' } : { right: '50%' }),
                  }}
                />
              </span>
              <span className="text-left text-[15px] font-bold tabular-nums" dir="ltr" style={{ color: tone(v) }}>
                {fmtPct(v)}
                <span className="mr-1 text-[11px]" aria-hidden>
                  {arrow(v)}
                </span>
              </span>
            </button>
            {isOpen && r.stocks && <StockList stocks={r.stocks} period={period} />}
          </li>
        )
      })}
    </ul>
  )
}

function StockList({ stocks, period }: { stocks: Stock[]; period: Period }) {
  return (
    <div className="px-5 pb-3">
      <div className="rounded-[11px] px-4 py-2" style={{ background: 'var(--field)' }}>
        {stocks.map((s) => (
          <div key={s.name} className="flex items-center justify-between gap-3 py-1.5 text-[14px]">
            <span style={{ color: 'var(--ink2)' }}>
              {s.name}
              <span className="mr-2 text-[12.5px]" style={{ color: 'var(--muted2)' }}>
                {s.weight}%
              </span>
            </span>
            <span className="font-bold tabular-nums" dir="ltr" style={{ color: tone(s[period]) }}>
              {fmtPct(s[period])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── מעטפות — אותה שפה ויזואלית כמו הפיד ─────────────────────────────
function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-extrabold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
            {title}
          </h2>
          {hint && (
            <p className="mt-0.5 text-[13px]" style={{ color: 'var(--muted)' }}>
              {hint}
            </p>
          )}
        </div>
        {action}
      </div>
      <Card className="overflow-hidden">{children}</Card>
    </section>
  )
}

function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-[18px] border ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow)' }}
    >
      {children}
    </div>
  )
}

function Loading() {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="טוען נתוני מסחר">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[104px] animate-pulse rounded-[18px]" style={{ background: 'var(--chip)' }} />
      ))}
    </div>
  )
}

function Dot() {
  return <span aria-hidden>·</span>
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="rounded-[11px] px-[18px] py-[9px] text-sm font-bold transition-colors"
      style={
        active
          ? { background: 'var(--accent)', color: '#fff' }
          : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--line2)' }
      }
    >
      {children}
    </button>
  )
}

function Seg<T extends string>({ opts, value, onChange }: { opts: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex gap-0.5 rounded-[11px] p-[3px]" style={{ background: 'var(--seg)' }}>
      {opts.map((o) => {
        const on = value === o.key
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={on}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors"
            style={on ? { background: 'var(--seg-active)', color: 'var(--ink)', boxShadow: 'var(--seg-active-shadow)' } : { color: 'var(--muted)' }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
