import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// סיכום מסחר — ישראל וארה"ב: יום המסחר האחרון ותשואה מצטברת של 7 ימי מסחר,
// עם פילוח סקטוריאלי (עמודות או מפת חום).
// הנתונים מגיעים מקובץ JSON שהאספן (collector/markets.mjs) מעדכן בכל סבב.
// אין כאן אף מספר שלא הגיע מהמקור: נתון חסר מוצג כ"—", לא מנוחש.

type Period = 'd1' | 'd7' | 'mtd' | 'm1' | 'ytd'
type Market = 'il' | 'us'
type View = 'bars' | 'heat'
type SortKey = Period | 'weight' | 'pe' | 'fpe'
interface Sort {
  key: SortKey
  dir: 'desc' | 'asc'
}

interface Day {
  date: string
  close: number
  change: number | null
}
interface IndexRow {
  name: string
  pe?: number | null
  fpe?: number | null
  source?: string // שם מלא במקור — לאימות
  date: string
  last: number
  d1: number | null
  d7: number | null
  mtd: number | null
  m1: number | null
  ytd: number | null
  days: Day[]
}
interface Stock {
  name: string
  pe?: number | null // מכפיל רווח נוכחי (12 חודשים אחרונים)
  fpe?: number | null // מכפיל רווח עתידי (תחזית אנליסטים לשנה הבאה)
  full?: string // שם החברה המלא (ארה"ב — name הוא הסימול)
  weight: number
  d1: number | null
  d7: number | null
  mtd: number | null
  m1: number | null
  ytd: number | null
}
interface SectorRow {
  sector: string
  pe?: number | null
  fpe?: number | null
  source?: string
  weight?: number
  d1: number | null
  d7: number | null
  mtd: number | null
  m1: number | null
  ytd: number | null
  stocks?: Stock[]
  bench?: boolean // שורת המדד עצמו — נקודת ההשוואה לתשואה עודפת
}
interface Summary {
  updated_at: string
  il: {
    stale_since?: string
    indices: IndexRow[]
    sectorIndices: ({ name: string; source?: string; last: number } & Record<Period, number | null>)[]
    breakdown: Record<string, SectorRow[]>
    notes: { d1: string | null; d7: string | null }
  }
  us: {
    stale_since?: string
    indices: IndexRow[]
    sectors: SectorRow[]
    breakdown?: SectorRow[] | null
    holdingsAsOf?: string | null
    notes: { d1: string | null; d7: string | null }
  }
}

const UP = '#16a34a'
const DOWN = '#dc2626'
const REFRESH_MS = 2 * 60 * 1000
const PERIODS: Period[] = ['d1', 'd7', 'mtd', 'm1', 'ytd']
const PERIOD_LABEL: Record<Period, string> = {
  d1: 'יום אחרון',
  d7: '7 ימים',
  mtd: 'מתחילת החודש',
  m1: 'חודש אחרון',
  ytd: 'מתחילת השנה',
}

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
const fmtPE = (x: number | null | undefined) => (x == null ? '—' : x.toFixed(1))
const fmtNum = (x: number) => x.toLocaleString('he-IL', { maximumFractionDigits: 2 })
const tone = (x: number | null | undefined) => (x == null || x === 0 ? 'var(--sent-flat)' : x > 0 ? UP : DOWN)
const arrow = (x: number | null | undefined) => (x == null || x === 0 ? '' : x > 0 ? '▲' : '▼')
// "2026-10-14" → "14.10"
const shortDate = (iso: string) => `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}`
// מדד דגל → שורת השוואה בטבלת הסקטורים
const benchOf = (indices: IndexRow[], name: string): SectorRow | undefined => {
  const ix = indices.find((i) => i.name === name)
  return ix && { sector: ix.name, pe: ix.pe, fpe: ix.fpe, weight: 100, d1: ix.d1, d7: ix.d7, mtd: ix.mtd, m1: ix.m1, ytd: ix.ytd, bench: true }
}

export default function Markets() {
  const { data, error } = useSummary()
  const [market, setMarket] = useState<Market>('il')
  const [view, setView] = useState<View>('bars')
  const [ilIndex, setIlIndex] = useState('ת"א-35')

  const updated = data ? new Date(data.updated_at) : null
  const m = data?.[market]
  const lead = m?.indices[0]
  const windowLabel =
    lead && lead.days.length > 1 ? `${shortDate(lead.days[0].date)}–${shortDate(lead.days[lead.days.length - 1].date)}` : ''

  return (
    <div>
      <h1 className="font-serif text-[38px] font-black leading-[1.05] tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
        סיכום מסחר
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]" style={{ color: 'var(--muted)' }}>
        <span>מדדים וסקטורים בישראל ובארה"ב — יום המסחר האחרון, 7 ימים, מתחילת החודש, חודש אחרון ומתחילת השנה</span>
        {updated && (
          <>
            <Dot />
            <span>
              עודכן {updated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}
            </span>
          </>
        )}
      </p>

      {/* שוק מימין, תצוגה משמאל */}
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
            { key: 'bars', label: 'עמודות' },
            { key: 'heat', label: 'מפת חום' },
          ]}
          value={view}
          onChange={setView}
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
          {m.stale_since && (
            <p className="mt-4 rounded-[11px] px-4 py-2.5 text-[14px] font-semibold" style={{ background: 'var(--chip)', color: 'var(--ink2)' }}>
              העדכון האחרון נכשל — מוצגים הנתונים מ-
              {new Date(m.stale_since).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}

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

          {market === 'il' ? (
            <>
              <Section
                title="סקטורים בתוך המדד"
                hint={`רק המניות שבתוך ${ilIndex}, מחולקות לפי ענף. התשואה של כל ענף משוקללת לפי משקל המניות שלו במדד. המדד עצמו ממוין יחד עם הענפים — מה שמעליו הניב תשואה עודפת. לחיצה על ענף מציגה את המניות.`}
                action={
                  <Seg
                    opts={Object.keys(data.il.breakdown).map((k) => ({ key: k, label: k }))}
                    value={ilIndex}
                    onChange={setIlIndex}
                  />
                }
              >
                <Sectors rows={data.il.breakdown[ilIndex] ?? []} bench={benchOf(data.il.indices, ilIndex)} view={view} weighted />
              </Section>

              <Section title="מדדי הענף של הבורסה" hint='מדדי הענף הרשמיים של הבורסה לניירות ערך בתל אביב, מול ת"א-125 — המדד הרחב.'>
                <Sectors
                  rows={data.il.sectorIndices.map(({ name, ...s }) => ({ sector: name, ...s }))}
                  bench={benchOf(data.il.indices, 'ת"א-125')}
                  view={view}
                />
              </Section>
            </>
          ) : (
            <>
              {data.us.breakdown && (
                <Section
                  title="סקטורים בתוך S&P 500"
                  hint="כל 500 המניות במדד, מחולקות לפי סקטור. התשואה של כל סקטור משוקללת לפי משקל המניות שלו במדד. המדד עצמו ממוין יחד עם הסקטורים — מה שמעליו הניב תשואה עודפת. מכפיל נוכחי — לפי הרווח ב-12 החודשים האחרונים; עתידי — לפי תחזית האנליסטים לשנה הבאה. לחיצה על סקטור מציגה את המניות."
                >
                  <Sectors rows={data.us.breakdown} bench={benchOf(data.us.indices, 'S&P 500')} view={view} weighted valuation />
                </Section>
              )}
              <Section title="קרנות הסקטורים של S&P 500" hint="קרן הסל הרשמית של כל סקטור (Select Sector SPDR), מול המדד עצמו.">
                <Sectors rows={data.us.sectors} bench={benchOf(data.us.indices, 'S&P 500')} view={view} />
              </Section>
            </>
          )}

          <p className="mt-6 text-[13px]" style={{ color: 'var(--muted)' }}>
            מקור:{' '}
            {market === 'il'
              ? 'הבורסה לניירות ערך בתל אביב'
              : `מחירים — Yahoo Finance; הרכב המדד, משקלים וסקטורים — קבצי האחזקות הרשמיים של קרנות SPDR (State Street)${data.us.holdingsAsOf ? `, ${data.us.holdingsAsOf.replace('As of ', 'נכון ל-')}` : ''}`}
            . פילוח הסקטורים מחושב לפי ההרכב הנוכחי של המדד.{market === 'us' ? ' מכפילי רווח — ממוצע הרמוני משוקלל לפי משקל במדד, כולל חברות מפסידות (Yahoo Finance; עתידי = תחזית האנליסטים לשנה הבאה).' : ''} הנתונים מוצגים לצורכי מידע בלבד ואינם מהווים ייעוץ השקעות.
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

// ── כרטיס מדד: יום ו-7 ימים בגדול + מגמה, והטווחים הארוכים מתחת ─────
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
      {(ix.pe != null || ix.fpe != null) && (
        <div className="mt-3 flex gap-5 text-[14px] font-bold" style={{ color: 'var(--ink2)' }}>
          <span>
            מכפיל נוכחי <span className="tabular-nums">{fmtPE(ix.pe)}</span>
          </span>
          <span>
            מכפיל עתידי <span className="tabular-nums">{fmtPE(ix.fpe)}</span>
          </span>
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: 'var(--line2)' }}>
        {(['mtd', 'm1', 'ytd'] as Period[]).map((p) => (
          <div key={p}>
            <div className="text-[12px] font-bold" style={{ color: 'var(--muted)' }}>
              {PERIOD_LABEL[p]}
            </div>
            <div className="text-[16px] font-extrabold tabular-nums" dir="ltr" style={{ color: tone(ix[p]), textAlign: 'right' }}>
              {fmtPct(ix[p])}
            </div>
          </div>
        ))}
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
function Sectors({
  rows,
  bench,
  view,
  weighted,
  valuation,
}: {
  rows: SectorRow[]
  bench?: SectorRow
  view: View
  weighted?: boolean
  valuation?: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)
  // מיון בלחיצה על כותרת: לחיצה ראשונה — מהגבוה לנמוך, שנייה — הפוך.
  // התקופה של העמודה הממוינת קובעת גם את העמודה הגרפית ואת צבעי מפת החום.
  const [sort, setSort] = useState<Sort>({ key: 'd7', dir: 'desc' })
  const period: Period = sort.key === 'weight' || sort.key === 'pe' || sort.key === 'fpe' ? 'd7' : sort.key
  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
  const sorted = useMemo(() => {
    const val = (r: SectorRow) => r[sort.key] ?? -Infinity
    // המדד נכנס למיון כמו כל שורה — כך הוא חוצץ בין מי שהכה אותו למי שפיגר
    return (bench ? [...rows, bench] : rows)
      .filter((r) => r[period] != null)
      .sort((a, b) => (sort.dir === 'desc' ? val(b) - val(a) : val(a) - val(b)))
  }, [rows, bench, sort, period])
  // תשואה עודפת מול המדד — מוצגת בריחוף על המספר
  const excess = (r: SectorRow, p: Period) =>
    bench && !r.bench && r[p] != null && bench[p] != null ? `מול ${bench.sector}: ${fmtPct(r[p]! - bench[p]!)}` : undefined
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
        <div className="mb-2 flex flex-wrap items-center gap-1 px-1 text-[13px] font-bold" style={{ color: 'var(--muted)' }}>
          <span className="ml-1">מיון וצבע לפי</span>
          {weighted && <SortHead k="weight" sort={sort} onSort={onSort} label="משקל" />}
          {PERIODS.map((p) => (
            <SortHead key={p} k={p} sort={sort} onSort={onSort} label={PERIOD_LABEL[p]} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {sorted.map((r) => (
            <HeatTile key={r.sector} r={r} excess={excess(r, period)} period={period} scale={scale} weighted={weighted} open={open === r.sector} onClick={() => toggle(r.sector)} />
          ))}
        </div>
        {opened?.stocks && (
          <div className="mt-3">
            <div className="mb-1 px-1 text-[15px] font-bold" style={{ color: 'var(--ink)' }}>
              {opened.sector}
            </div>
            <div className="overflow-x-auto">
              <div className={valuation ? 'min-w-[680px]' : 'min-w-[560px] sm:min-w-0'}>
              <StockList stocks={opened.stocks} period={period} cols={valuation ? STOCK_COLS_PE : STOCK_COLS} valuation={valuation} />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // עמודות: שורת כותרות + שורה לכל סקטור, חמישה טווחים. בטלפון העמודה הגרפית
  // נושרת והטבלה נגללת לרוחב בתוך הכרטיס (הדף עצמו לא זז).
  const cols = valuation
    ? 'grid-cols-[132px_52px_repeat(5,68px)_repeat(2,60px)] sm:grid-cols-[minmax(150px,1.2fr)_60px_minmax(56px,0.6fr)_repeat(5,80px)_repeat(2,72px)]'
    : weighted
      ? 'grid-cols-[132px_52px_repeat(5,68px)] sm:grid-cols-[minmax(160px,1.3fr)_64px_minmax(80px,1fr)_repeat(5,84px)]'
      : 'grid-cols-[150px_repeat(5,68px)] sm:grid-cols-[minmax(200px,1.5fr)_minmax(80px,1fr)_repeat(5,84px)]'
  return (
    <div className="overflow-x-auto">
      <div className={valuation ? 'min-w-[680px] sm:min-w-[960px]' : weighted ? 'min-w-[560px] sm:min-w-0' : 'min-w-[520px] sm:min-w-0'}>
      <div
        className={`grid ${cols} items-center gap-2 px-4 py-2.5 text-[13px] font-bold sm:gap-4 sm:px-5`}
        style={{ color: 'var(--muted)', borderBottom: '1px solid var(--line2)' }}
      >
        <span>{weighted ? 'סקטור' : 'מדד'}</span>
        {weighted && <SortHead k="weight" sort={sort} onSort={onSort} label="משקל" end />}
        <span className="hidden sm:block" />
        {PERIODS.map((p) => (
          <SortHead key={p} k={p} sort={sort} onSort={onSort} label={PERIOD_LABEL[p]} end />
        ))}
        {valuation && (
          <>
            <SortHead k="pe" sort={sort} onSort={onSort} label="מכפיל נוכחי" end />
            <SortHead k="fpe" sort={sort} onSort={onSort} label="מכפיל עתידי" end />
          </>
        )}
      </div>
      <ul>
        {sorted.map((r, i) => {
          const v = r[period] ?? 0
          const pct = (Math.abs(v) / scale) * 50
          const expandable = Boolean(r.stocks?.length)
          const isOpen = open === r.sector
          return (
            <li
              key={r.sector}
              style={{
                borderTop: i ? `1px solid ${r.bench || sorted[i - 1]?.bench ? 'var(--line2)' : 'var(--line)'}` : undefined,
                background: r.bench ? BENCH_BG : undefined,
              }}
            >
              <button
                type="button"
                disabled={!expandable}
                onClick={() => toggle(r.sector)}
                aria-expanded={expandable ? isOpen : undefined}
                className={`grid w-full ${cols} items-center gap-2 px-4 py-3 text-right transition-colors sm:px-5 enabled:hover:bg-[var(--hover)] sm:gap-4`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[16px] font-bold leading-snug" style={{ color: 'var(--ink)' }}>
                    <span className={r.bench ? 'font-extrabold' : 'sm:truncate'}>{r.sector}</span>
                    {r.bench && <BenchTag />}
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
                    style={{ background: r.bench ? 'var(--accent)' : tone(v), width: `${pct}%`, ...(v >= 0 ? { left: '50%' } : { right: '50%' }) }}
                  />
                </span>
                {PERIODS.map((p) => (
                  <span
                    key={p}
                    className={`text-left tabular-nums ${p === period ? 'text-[16px] font-extrabold' : 'text-[15px] font-semibold'}`}
                    dir="ltr"
                    title={excess(r, p)}
                    style={{ color: tone(r[p]) }}
                  >
                    {fmtPct(r[p])}
                  </span>
                ))}
                {valuation &&
                  (['pe', 'fpe'] as const).map((k) => (
                    <span key={k} className={`text-left tabular-nums ${sort.key === k ? 'text-[16px] font-extrabold' : 'text-[15px] font-semibold'}`} dir="ltr" style={{ color: 'var(--ink)' }}>
                      {fmtPE(r[k])}
                    </span>
                  ))}
              </button>
              {isOpen && r.stocks && (
                <div className="pb-3">
                  <StockList stocks={r.stocks} period={period} cols={cols} valuation={valuation} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
      </div>
    </div>
  )
}

// שורת המדד: גוון עדין של צבע ההדגשה + תווית, כדי שלא תיראה כעוד סקטור
const BENCH_BG = 'color-mix(in oklab, var(--accent) 7%, transparent)'
function BenchTag() {
  return (
    <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>
      המדד
    </span>
  )
}

// מפת החום: רשימת המניות של אריח פתוח — בלי עמודה גרפית
const STOCK_COLS = 'grid-cols-[132px_52px_repeat(5,68px)] sm:grid-cols-[minmax(160px,1.3fr)_64px_repeat(5,84px)]'
const STOCK_COLS_PE = 'grid-cols-[132px_52px_repeat(5,68px)_repeat(2,60px)] sm:grid-cols-[minmax(160px,1.3fr)_64px_repeat(5,80px)_repeat(2,72px)]'

// אריח במפת החום: צבע מתפצל (ירוק/אדום, אפור בנקודת האפס), עוצמה לפי גודל
// התשואה ביחס לגדול ביותר בתצוגה. כשיש משקלים — רוחב האריח גדל עם המשקל.
// המספר כתוב באריח תמיד, כך שהצבע לעולם אינו הנשא היחיד של המידע.
function HeatTile({
  r,
  excess,
  period,
  scale,
  weighted,
  open,
  onClick,
}: {
  r: SectorRow
  excess?: string
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
  // המדד לא מתפרש לרוחב לפי משקל 100% — אריח בגודל רגיל
  const w = weighted && r.weight && !r.bench ? r.weight : 1
  const expandable = Boolean(r.stocks?.length)
  return (
    <button
      type="button"
      disabled={!expandable}
      onClick={onClick}
      aria-expanded={expandable ? open : undefined}
      title={[r.source ?? r.sector, ...PERIODS.map((p) => `${PERIOD_LABEL[p]} ${fmtPct(r[p])}`), excess].filter(Boolean).join(' · ')}
      className="min-h-[96px] rounded-[11px] px-3 py-2.5 text-right transition-opacity enabled:hover:opacity-90"
      style={{
        flex: weighted ? `${w} 1 ${Math.max(116, w * 9)}px` : '1 1 150px',
        background: bg,
        outline: open || r.bench ? `2px solid ${r.bench ? 'var(--accent)' : 'var(--ink)'}` : undefined,
        outlineOffset: open || r.bench ? '-2px' : undefined,
      }}
    >
      <div className="flex items-center gap-2 text-[15px] font-bold" style={{ color: 'var(--ink)' }}>
        <span className="truncate">{r.sector}</span>
        {r.bench && <BenchTag />}
      </div>
      <div className="mt-1 text-[22px] font-extrabold leading-tight tabular-nums" dir="ltr" style={{ color: 'var(--ink)', textAlign: 'right' }}>
        {fmtPct(v)}
      </div>
      <div className="text-[13px] font-semibold" style={{ color: 'var(--ink2)' }}>
        {PERIOD_LABEL[period]}
      </div>
      {weighted && r.weight != null && !r.bench && (
        <div className="mt-0.5 text-[13px] font-semibold" style={{ color: 'var(--ink2)' }}>
          משקל {r.weight}%
        </div>
      )}
    </button>
  )
}

// כותרת עמודה ממיינת — החץ מראה את כיוון המיון הנוכחי
function SortHead({ k, sort, onSort, label, end }: { k: SortKey; sort: Sort; onSort: (k: SortKey) => void; label: string; end?: boolean }) {
  const active = sort.key === k
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      aria-sort={active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}
      title={active ? (sort.dir === 'desc' ? 'מהגבוה לנמוך — לחיצה להיפוך' : 'מהנמוך לגבוה — לחיצה להיפוך') : 'לחיצה למיון'}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-bold transition-colors hover:bg-[var(--hover)] ${end ? 'justify-self-end' : ''}`}
      style={active ? { color: 'var(--accent)', background: 'var(--chip)' } : { color: 'var(--muted)' }}
    >
      {label}
      <span aria-hidden className="text-[10px]">
        {active ? (sort.dir === 'desc' ? '▼' : '▲') : '↕'}
      </span>
    </button>
  )
}

function StockList({ stocks, period, cols, valuation }: { stocks: Stock[]; period: Period; cols: string; valuation?: boolean }) {
  const withBar = cols.includes('minmax(80px,1fr)') || cols.includes('minmax(56px,0.6fr)')
  return (
    <div className="mx-3 rounded-[11px] py-1" style={{ background: 'var(--field)' }}>
      {stocks.map((s) => (
        <div key={s.name} className={`grid ${cols} items-center gap-2 px-2 py-1.5 text-[14px] sm:gap-4 sm:px-3`}>
          <span className="min-w-0 truncate" style={{ color: 'var(--ink2)' }} title={s.full ?? s.name}>
            <span className="font-semibold">{s.name}</span>
            {s.full && (
              <span className="mr-1.5 text-[12px]" dir="ltr" style={{ color: 'var(--muted)' }}>
                {s.full}
              </span>
            )}
          </span>
          <span className="text-left font-semibold tabular-nums" dir="ltr" style={{ color: 'var(--muted)' }}>
            {s.weight}%
          </span>
          {withBar && <span className="hidden sm:block" />}
          {PERIODS.map((p) => (
            <span key={p} className={`text-left tabular-nums ${p === period ? 'font-extrabold' : 'font-semibold'}`} dir="ltr" style={{ color: tone(s[p]) }}>
              {fmtPct(s[p])}
            </span>
          ))}
          {valuation &&
            (['pe', 'fpe'] as const).map((k) => (
              <span key={k} className="text-left font-semibold tabular-nums" dir="ltr" style={{ color: 'var(--ink2)' }}>
                {fmtPE(s[k])}
              </span>
            ))}
        </div>
      ))}
    </div>
  )
}

// ── מעטפות — אותה שפה ויזואלית כמו הפיד ─────────────────────────────
function Section({ title, hint, action, children }: { title: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
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
