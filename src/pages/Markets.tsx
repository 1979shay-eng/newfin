import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// סיכום מסחר — ישראל וארה"ב: יום המסחר האחרון ותשואה מצטברת של 7 ימי מסחר,
// עם פילוח סקטוריאלי (עמודות או מפת חום).
// הנתונים מגיעים מקובץ JSON שהאספן (collector/markets.mjs) מעדכן בכל סבב.
// אין כאן אף מספר שלא הגיע מהמקור: נתון חסר מוצג כ"—", לא מנוחש.

type Period = 'd1' | 'd7'
type Market = 'il' | 'us'
type View = 'bars' | 'heat'

interface Day {
  date: string
  close: number
  change: number | null
}
interface IndexRow {
  name: string
  source?: string // שם מלא במקור — לאימות
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
  source?: string
  weight?: number
  d1: number | null
  d7: number | null
  stocks?: Stock[]
}
interface Summary {
  updated_at: string
  il: {
    indices: IndexRow[]
    sectorIndices: { name: string; source?: string; last: number; d1: number | null; d7: number | null }[]
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
const PERIOD_LABEL: Record<Period, string> = { d1: 'יום אחרון', d7: '7 ימים מצטבר' }

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
  const [period, setPeriod] = useState<Period>('d7')
  const [view, setView] = useState<View>('bars')
  const [ilIndex, setIlIndex] = useState('ת"א-35')

  const updated = data ? new Date(data.updated_at) : null
  const m = data?.[market]
  const lead = m?.indices[0]
  const windowLabel =
    lead && lead.days.length > 1 ? `${shortDate(lead.days[0].date)}–${shortDate(lead.days[lead.days.length - 1].date)}` : ''

  return (
    <div className="mx-auto max-w-[1200px]">
      <h1 className="font-serif text-[38px] font-black leading-[1.05] tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
        סיכום מסחר
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]" style={{ color: 'var(--muted)' }}>
        <span>מדדים וסקטורים בישראל ובארה"ב — יום המסחר האחרון ותשואה מצטברת של 7 ימי המסחר האחרונים</span>
        {updated && (
          <>
            <Dot />
            <span>
              עודכן {updated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}
            </span>
          </>
        )}
      </p>

      {/* בחירת שוק */}
      <div className="mt-5 flex gap-2">
        <Tab active={market === 'il'} onClick={() => setMarket('il')}>
          ישראל
        </Tab>
        <Tab active={market === 'us'} onClick={() => setMarket('us')}>
          ארה"ב
        </Tab>
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
          {/* שתי השורות התחתונות — המוקד של הדף, תמיד שתיהן */}
          <Card className="mt-4 divide-y" style={{ borderColor: 'var(--line2)' }}>
            <Note label={`יום המסחר האחרון · ${lead ? shortDate(lead.date) : ''}`} text={m.notes.d1} />
            <Note label={`7 ימי מסחר, מצטבר · ${windowLabel}`} text={m.notes.d7} />
          </Card>

          {/* מדדי הדגל */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {m.indices.map((ix) => (
              <IndexCard key={ix.name} ix={ix} />
            ))}
          </div>

          {/* תצוגת הסקטורים: תקופה + עמודות/מפת חום */}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Seg
              label="תקופה"
              opts={[
                { key: 'd1', label: 'יום אחרון' },
                { key: 'd7', label: '7 ימי מסחר מצטבר' },
              ]}
              value={period}
              onChange={setPeriod}
            />
            <Seg
              label="תצוגה"
              opts={[
                { key: 'bars', label: 'עמודות' },
                { key: 'heat', label: 'מפת חום' },
              ]}
              value={view}
              onChange={setView}
            />
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
                <Sectors rows={data.il.breakdown[ilIndex] ?? []} period={period} view={view} weighted />
              </Section>

              <Section title="מדדי הענף של הבורסה" hint="מדדי הענף הרשמיים של הבורסה לניירות ערך בתל אביב.">
                <Sectors
                  rows={data.il.sectorIndices.map((s) => ({ sector: s.name, source: s.source, d1: s.d1, d7: s.d7 }))}
                  period={period}
                  view={view}
                />
              </Section>
            </>
          ) : (
            <Section title="סקטורים ב-S&P 500" hint="כל סקטור נמדד לפי קרן הסל הרשמית שלו (Select Sector SPDR).">
              <Sectors rows={data.us.sectors} period={period} view={view} />
            </Section>
          )}

          <p className="mt-6 text-[13px]" style={{ color: 'var(--muted)' }}>
            מקור: {market === 'il' ? 'הבורסה לניירות ערך בתל אביב' : 'Yahoo Finance'}. הנתונים מוצגים לצורכי מידע בלבד
            ואינם מהווים ייעוץ השקעות.
          </p>
        </>
      )}
    </div>
  )
}

function Note({ label, text }: { label: string; text: string | null }) {
  if (!text) return null
  return (
    <div className="px-6 py-4" style={{ borderColor: 'var(--line2)' }}>
      <div className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <p className="mt-1 font-display text-[19px] font-semibold leading-[1.45]" style={{ color: 'var(--ink)' }}>
        {text}
      </p>
    </div>
  )
}

// ── כרטיס מדד: שתי התקופות זו לצד זו + מגמת 7 הימים ──────────────────
function IndexCard({ ix }: { ix: IndexRow }) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[17px] font-extrabold" style={{ color: 'var(--ink)' }}>
          {ix.name}
        </span>
        <span className="text-[14px] tabular-nums" style={{ color: 'var(--muted)' }}>
          {fmtNum(ix.last)}
        </span>
      </div>
      {ix.source && (
        <div className="mt-0.5 text-[13px]" dir="auto" style={{ color: 'var(--muted)' }}>
          {ix.source}
        </div>
      )}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex gap-5">
          {(['d1', 'd7'] as Period[]).map((p) => (
            <div key={p}>
              <div className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>
                {PERIOD_LABEL[p]}
              </div>
              <div className="text-[22px] font-extrabold leading-tight tracking-[-0.01em] tabular-nums" dir="ltr" style={{ color: tone(ix[p]) }}>
                <span className="ml-1 text-[13px]" aria-hidden>
                  {arrow(ix[p])}
                </span>
                {fmtPct(ix[p])}
              </div>
            </div>
          ))}
        </div>
        <Sparkline days={ix.days} />
      </div>
    </Card>
  )
}

// קו מגמה של 7 הסגירות האחרונות — צבע לפי כיוון החלון כולו
function Sparkline({ days }: { days: Day[] }) {
  const W = 88
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

// ── סקטורים: עמודות או מפת חום, אותה מיון ואותה פתיחת מניות ─────────
function Sectors({ rows, period, view, weighted }: { rows: SectorRow[]; period: Period; view: View; weighted?: boolean }) {
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
  const toggle = (s: string) => setOpen((o) => (o === s ? null : s))
  const opened = sorted.find((r) => r.sector === open)

  if (view === 'heat') {
    return (
      <div className="p-3">
        <div className="flex flex-wrap gap-2">
          {/* עם משקלים — מהגדול לקטן, כמו מפות שוק מקובלות; בלי — לפי תשואה */}
          {(weighted ? [...sorted].sort((x, y) => (y.weight ?? 0) - (x.weight ?? 0)) : sorted).map((r) => (
            <HeatTile key={r.sector} r={r} period={period} scale={scale} weighted={weighted} open={open === r.sector} onClick={() => toggle(r.sector)} />
          ))}
        </div>
        {opened?.stocks && (
          <div className="mt-3">
            <div className="mb-1 px-1 text-[15px] font-bold" style={{ color: 'var(--ink)' }}>
              {opened.sector}
            </div>
            <StockList stocks={opened.stocks} period={period} />
          </div>
        )}
      </div>
    )
  }

  // עמודות: שורת כותרות + שורה לכל סקטור. בטלפון העמודה הגרפית נושרת —
  // המספרים הם העיקר, ומפת החום זמינה כתצוגה חלופית.
  const cols = weighted
    ? 'grid-cols-[1fr_44px_60px_60px] sm:grid-cols-[minmax(180px,1.3fr)_72px_2fr_88px_88px]'
    : 'grid-cols-[1fr_60px_60px] sm:grid-cols-[minmax(180px,1.3fr)_2fr_88px_88px]'
  return (
    <div>
      <div
        className={`grid ${cols} items-center gap-2 px-4 py-2.5 text-[13px] font-bold sm:gap-4 sm:px-5`}
        style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line2)' }}
      >
        <span>{weighted ? 'סקטור' : 'מדד'}</span>
        {weighted && <span className="text-left">משקל</span>}
        <span className="hidden sm:block" />
        <span className="text-left" style={period === 'd1' ? { color: 'var(--ink)' } : undefined}>
          יום אחרון
        </span>
        <span className="text-left" style={period === 'd7' ? { color: 'var(--ink)' } : undefined}>
          7 ימים
        </span>
      </div>
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
                onClick={() => toggle(r.sector)}
                aria-expanded={expandable ? isOpen : undefined}
                className={`grid w-full ${cols} items-center gap-2 px-4 py-3 text-right transition-colors sm:px-5 enabled:hover:bg-[var(--hover)] sm:gap-4`}
              >
                <span className="min-w-0">
                  <span className="block text-[16px] font-bold leading-snug sm:truncate" style={{ color: 'var(--ink)' }}>
                    {r.sector}
                  </span>
                  {r.source && (
                    <span className="block truncate text-[13px]" dir="auto" title={r.source} style={{ color: 'var(--muted)' }}>
                      {r.source}
                    </span>
                  )}
                </span>
                {weighted && (
                  <span className="text-left text-[16px] font-bold tabular-nums" dir="ltr" style={{ color: 'var(--ink)' }}>
                    {r.weight != null ? `${r.weight}%` : '—'}
                  </span>
                )}
                {/* מסלול LTR כדי שעלייה תימשך ימינה מהציר, כמקובל בגרפים */}
                <span className="relative hidden h-2.5 rounded-full sm:block" dir="ltr" style={{ background: 'var(--chip)' }}>
                  <span className="absolute inset-y-[-3px] left-1/2 w-px" style={{ background: 'var(--line2)' }} />
                  <span
                    className="absolute inset-y-0 rounded-full"
                    style={{ background: tone(v), width: `${pct}%`, ...(v >= 0 ? { left: '50%' } : { right: '50%' }) }}
                  />
                </span>
                {(['d1', 'd7'] as Period[]).map((p) => (
                  <span
                    key={p}
                    className={`text-left tabular-nums ${p === period ? 'text-[16px] font-extrabold' : 'text-[15px] font-semibold'}`}
                    dir="ltr"
                    style={{ color: tone(r[p]) }}
                  >
                    {fmtPct(r[p])}
                  </span>
                ))}
              </button>
              {isOpen && r.stocks && (
                <div className="px-5 pb-3">
                  <StockList stocks={r.stocks} period={period} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// אריח במפת החום: צבע מתפצל (ירוק/אדום, אפור בנקודת האפס), עוצמה לפי גודל
// התשואה ביחס לגדול ביותר בתצוגה. כשיש משקלים — רוחב האריח גדל עם המשקל.
// המספר כתוב באריח תמיד, כך שהצבע לעולם אינו הנשא היחיד של המידע.
function HeatTile({
  r,
  period,
  scale,
  weighted,
  open,
  onClick,
}: {
  r: SectorRow
  period: Period
  scale: number
  weighted?: boolean
  open: boolean
  onClick: () => void
}) {
  const v = r[period] ?? 0
  const t = Math.min(1, Math.abs(v) / scale)
  const flat = Math.abs(v) < 0.05
  const bg = flat ? 'var(--chip)' : `color-mix(in oklab, ${v > 0 ? UP : DOWN} ${Math.round(14 + t * 46)}%, var(--surface))`
  const w = weighted && r.weight ? r.weight : 1
  const expandable = Boolean(r.stocks?.length)
  return (
    <button
      type="button"
      disabled={!expandable}
      onClick={onClick}
      aria-expanded={expandable ? open : undefined}
      title={`${r.source ?? r.sector} · יום אחרון ${fmtPct(r.d1)} · 7 ימים ${fmtPct(r.d7)}`}
      className="min-h-[96px] rounded-[11px] px-3 py-2.5 text-right transition-opacity enabled:hover:opacity-90"
      style={{
        flex: weighted ? `${w} 1 ${Math.max(116, w * 9)}px` : '1 1 150px',
        background: bg,
        outline: open ? '2px solid var(--ink)' : undefined,
        outlineOffset: open ? '-2px' : undefined,
      }}
    >
      <div className="truncate text-[15px] font-bold" style={{ color: 'var(--ink)' }}>
        {r.sector}
      </div>
      <div className="mt-1 text-[22px] font-extrabold leading-tight tabular-nums" dir="ltr" style={{ color: 'var(--ink)', textAlign: 'right' }}>
        {fmtPct(v)}
      </div>
      {weighted && r.weight != null && (
        <div className="mt-0.5 text-[13px] font-semibold" style={{ color: 'var(--ink2)' }}>
          משקל {r.weight}%
        </div>
      )}
    </button>
  )
}

function StockList({ stocks, period }: { stocks: Stock[]; period: Period }) {
  return (
    <div className="rounded-[11px] px-4 py-2" style={{ background: 'var(--field)' }}>
      {stocks.map((s) => (
        <div key={s.name} className="flex items-center justify-between gap-3 py-1.5 text-[15px]">
          <span style={{ color: 'var(--ink2)' }}>
            {s.name}
            <span className="mr-2 text-[14px] font-semibold" style={{ color: 'var(--muted)' }}>
              משקל {s.weight}%
            </span>
          </span>
          <span className="flex gap-4 tabular-nums" dir="ltr">
            {(['d1', 'd7'] as Period[]).map((p) => (
              <span key={p} className={p === period ? 'font-extrabold' : 'font-semibold'} style={{ color: tone(s[p]) }} title={PERIOD_LABEL[p]}>
                {fmtPct(s[p])}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── מעטפות — אותה שפה ויזואלית כמו הפיד ─────────────────────────────
function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
            {title}
          </h2>
          {hint && (
            <p className="mt-0.5 text-[14px]" style={{ color: 'var(--muted)' }}>
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
    <div className="mt-4 grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="טוען נתוני מסחר">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[120px] animate-pulse rounded-[18px]" style={{ background: 'var(--chip)' }} />
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

function Seg<T extends string>({
  label,
  opts,
  value,
  onChange,
}: {
  label?: string
  opts: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-[14px] font-bold" style={{ color: 'var(--muted)' }}>
          {label}
        </span>
      )}
      <div className="inline-flex gap-0.5 rounded-[11px] p-[3px]" style={{ background: 'var(--seg)' }}>
        {opts.map((o) => {
          const on = value === o.key
          return (
            <button
              key={o.key}
              onClick={() => onChange(o.key)}
              aria-pressed={on}
              className="rounded-lg px-3 py-2 text-[14px] font-bold transition-colors"
              style={on ? { background: 'var(--seg-active)', color: 'var(--ink)', boxShadow: 'var(--seg-active-shadow)' } : { color: 'var(--muted)' }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
