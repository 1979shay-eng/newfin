import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

// אינדיקטורים — תמונת מצב-על של השווקים והתנאים הפיננסיים.
// הנתונים מגיעים מקובץ JSON שהאספן (collector/indicators.mjs) מעדכן בכל סבב.
// כל מספר מגיע ממקור רשמי. שם המקור והקישור אליו פנימיים ולא מוצגים לגולשים
// (האספן לא כותב אותם לקובץ הציבורי). נתון חסר — "—", לא מנוחש.
// כל אינדיקטור מוצג על מד של שלושה אזורים (אדום משמאל, ירוק מימין), והכרטיס
// כולו נצבע באחד משבעה גוונים לפי המיקום על המד.

type Shade = -3 | -2 | -1 | 0 | 1 | 2 | 3
type Unit = 'pct' | 'pp' | 'pts' | 'ils' | 'z'
interface Indicator {
  id: string
  group: string
  since?: string // סדרה חודשית: האחוזון מחושב על כל ההיסטוריה מאז
  name: string
  nick: string
  nickHe: string
  term: string
  valueHelp: string
  what: string
  unit: Unit
  kind: 'pct' | 'trend' | 'curve'
  date: string
  extra?: { id: string; label: string; value: number; help: string }[] // צמיחה: מבטים יציבים יותר
  prevLabel?: string // "חודש קודם" / "רבעון קודם" במקום "חודש"
  period?: string // נתון חודשי/רבעוני — "ספטמבר 2026" / "רבעון 2 2026"
  value: number
  close?: number
  ma?: number
  dist?: number
  ch1m: number | null
  ch1y: number | null
  years: number | null
  min: number | null
  max: number | null
  pct: number | null
  zones: [string, string, string]
  gauge: number | null
  shade: Shade
  reading: string | null
  spark: [string, number][]
  neutral?: boolean
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
  overall: { gauge: number; shade: Shade; zones: [string, string, string]; reading: string; text: string } | null
  groups: { id: string; title: string; items: Indicator[] }[]
  erpLong?: Indicator[]
  erp: {
    date: string
    real: { value: number; nominal: number; inflation: number; inflationDate: string }
    index: ErpRow
    sectors: ErpRow[]
    since: string
  } | null
}

const UP = '#16a34a'
const DOWN = '#dc2626'
const REFRESH_MS = 5 * 60 * 1000
const dataUrl = supabase.storage.from('public-data').getPublicUrl('market/indicators-v2.json').data.publicUrl

const GROUP_HINT: Record<string, string> = {
  macro: 'אינפלציה וצמיחה — הנתונים הרשמיים האחרונים. באינפלציה המד ירוק כשהיא קרובה ליעד של 2%.',
  macro_il: 'אינפלציה וצמיחה בישראל. יעד האינפלציה: בין 1% ל-3%.',
  risk: 'כמה פחד השוק מתמחר, והאם המדדים במגמה ארוכה עולה או יורדת.',
  credit: 'כמה המלווים דורשים מחברות מעל ממשלת ארה"ב. המיקום מחושב מול 3 שנים — זה כל מה שמתפרסם בחינם.',
  rates: 'מחיר הכסף בארה"ב, צורת העקום וציפיות האינפלציה. ריבית גבוהה = תנאים מהדקים לשוק, ולכן נצבעת באדום.',
  israel: 'הריבית ושער הדולר בישראל.',
}

// שבעה גוונים: רקע הכרטיס, מסגרת וצבע התווית
const mix = (c: string, p: number, base = 'var(--surface)') => `color-mix(in oklab, ${c} ${p}%, ${base})`
const SHADE: Record<Shade, { bg: string; border: string; fg: string; chip: string; chipFg: string }> = {
  [-3]: { bg: mix(DOWN, 62), border: DOWN, fg: DOWN, chip: DOWN, chipFg: '#fff' },
  [-2]: { bg: mix(DOWN, 40), border: mix(DOWN, 80), fg: DOWN, chip: DOWN, chipFg: '#fff' },
  [-1]: { bg: mix(DOWN, 20), border: mix(DOWN, 55), fg: DOWN, chip: mix(DOWN, 30, 'transparent'), chipFg: DOWN },
  0: { bg: 'var(--surface)', border: 'var(--line2)', fg: 'var(--ink2)', chip: 'var(--chip)', chipFg: 'var(--ink2)' },
  1: { bg: mix(UP, 20), border: mix(UP, 55), fg: UP, chip: mix(UP, 30, 'transparent'), chipFg: UP },
  2: { bg: mix(UP, 40), border: mix(UP, 80), fg: UP, chip: UP, chipFg: '#fff' },
  3: { bg: mix(UP, 62), border: UP, fg: UP, chip: UP, chipFg: '#fff' },
}

// בגוונים החזקים הטקסט המשני (מקור, אחוזון) מוחשך — אחרת הוא נבלע ברקע הצבעוני
const cardStyle = (shade: Shade) =>
  ({ background: SHADE[shade].bg, borderColor: SHADE[shade].border, ...(Math.abs(shade) >= 1 ? { '--muted': 'var(--ink2)' } : {}) }) as CSSProperties

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
  u === 'pct' || u === 'pp' ? `${v.toFixed(2)}%` : u === 'ils' ? `₪${v.toFixed(3)}` : u === 'z' ? `${sign(v)}${Math.abs(v).toFixed(2)}` : v.toFixed(2)
const fmtChange = (u: Unit, x: number | null) => {
  if (x == null) return '—'
  const a = Math.abs(x)
  if (u === 'pct') return `${sign(x)}${a.toFixed(0)} נ״ב`
  if (u === 'pp') return `${sign(x)}${a.toFixed(2)} נק׳ אחוז`
  if (u === 'ils') return `${sign(x)}${a.toFixed(1)}%`
  if (u === 'z') return `${sign(x)}${a.toFixed(2)} ס״ת`
  return `${sign(x)}${a.toFixed(2)}`
}
const fmtRange = (u: Unit, v: number) => (u === 'pct' || u === 'pp' ? `${v.toFixed(2)}%` : u === 'ils' ? v.toFixed(2) : v.toFixed(1))
// "2026-10-14" → "14.10.26"
const shortDate = (iso: string) => `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}.${iso.slice(2, 4)}`
const fmtNum = (x: number) => x.toLocaleString('he-IL', { maximumFractionDigits: 0 })

export default function Indicators() {
  const { data, error } = useData()
  const updated = data ? new Date(data.updated_at) : null
  const [view, setView] = useView()
  // לחיצה על אריח במפת החום — עוברים לכרטיסים וגוללים לכרטיס של אותו אינדיקטור
  const pick = (id: string) => {
    setView('cards')
    // קפיצה ישירה (גלילה רכה של אלפי פיקסלים נקטעת) + הבהוב קצר שמסמן איפה נחתנו
    setTimeout(() => {
      const el = document.getElementById(`ind-${id}`)
      if (!el) return
      el.scrollIntoView({ block: 'center' })
      el.animate([{ boxShadow: '0 0 0 3px var(--accent)' }, { boxShadow: '0 0 0 3px transparent' }], { duration: 1600, easing: 'ease-out' })
    }, 60)
  }

  return (
    <div>
      <h1 className="font-serif text-[38px] font-black leading-[1.05] tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
        אינדיקטורים
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]" style={{ color: 'var(--muted)' }}>
        <span>תמונת מצב של השווקים והתנאים הפיננסיים — ממקורות רשמיים בלבד</span>
        <span aria-hidden>·</span>
        <span>לחיצה על כל חלק בכרטיס מסבירה אותו</span>
        {updated && (
          <>
            <span aria-hidden>·</span>
            <span>
              עודכן {updated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}
            </span>
          </>
        )}
      </p>

      {data && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <ViewToggle view={view} onChange={setView} />
          {view === 'heat' && <Legend />}
        </div>
      )}

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
          {data.overall && (view === 'cards' ? <Overall o={data.overall} /> : <OverallLine o={data.overall} />)}

          {view === 'heat' && <Heatmap data={data} onPick={pick} />}

          {view === 'cards' && data.groups.map((g) => (
            <section key={g.id} className="mt-8">
              <h2 className="text-[20px] font-extrabold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
                {g.title}
              </h2>
              {GROUP_HINT[g.id] && (
                <p className="mt-0.5 text-[14px]" style={{ color: 'var(--muted)' }}>
                  {GROUP_HINT[g.id]}
                </p>
              )}
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {g.items.map((it) => (
                  <IndicatorCard key={it.id} it={it} />
                ))}
              </div>
            </section>
          ))}

          {view === 'cards' && data.erp && <Erp erp={data.erp} />}

          {view === 'cards' && !!data.erpLong?.length && (
            <section className="mt-6">
              <h3 className="text-[17px] font-extrabold" style={{ color: 'var(--ink)' }}>
                בפרספקטיבה היסטורית
              </h3>
              <p className="mt-0.5 text-[14px]" style={{ color: 'var(--muted)' }}>
                שתי מדידות מקובלות של פרמיית הסיכון, עם היסטוריה ארוכה. השיטה שונה מהחישוב שלנו, ולכן הן נותנות פרופורציה ולא השוואה של אחד לאחד.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {data.erpLong.map((it) => (
                  <IndicatorCard key={it.id} it={it} />
                ))}
              </div>
            </section>
          )}

          <p className="mt-8 text-[13px] leading-[1.6]" style={{ color: 'var(--muted)' }}>
            שיטה: לכל אינדיקטור מד של שלושה אזורים — אדום משמאל, ניטרלי באמצע, ירוק מימין — וגוון הכרטיס נקבע לפי המיקום על המד, משבעה גוונים. ברוב
            האינדיקטורים המיקום הוא האחוזון של הערך הנוכחי מתוך 5 השנים האחרונות (למרווחי האשראי 3 שנים), כשערך גבוה נוטה לאדום. מרחק מממוצע 200 יום נמדד
            בסטיות תקן של אותה תקופה: ±1 הוא גבול האזור. בשיפוע העקום: מתחת ל-0 = הפוך, מעל 1% = חיובי. מד "תנאי השוק" הוא ממוצע המדדים של הפחד, המגמה בשני
            השווקים והעקום, ונגזר מהמספרים בלי בינה מלאכותית. הנתונים מוצגים לצורכי מידע בלבד ואינם מהווים ייעוץ השקעות.
          </p>
        </>
      )}
    </div>
  )
}

// ── מד בשלושה אזורים, בסגנון מדד הפחד והתאווה ─────────────────────
// חצי עיגול: 0 בקצה השמאלי (אדום) ו-100 בימני (ירוק). המחוג מצביע על המיקום.
function Gauge({ value, zones, neutral, size = 180, center }: { value: number; zones: [string, string, string]; neutral?: boolean; size?: number; center?: ReactNode }) {
  const W = size
  const r = W / 2 - 10
  const cx = W / 2
  const cy = r + 8
  const H = cy + 10
  const sw = Math.round(W / 13)
  const pt = (g: number, rr = r) => {
    const a = Math.PI * (1 - g / 100)
    return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]
  }
  const arc = (g0: number, g1: number) => {
    const [x0, y0] = pt(g0)
    const [x1, y1] = pt(g1)
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`
  }
  const colors = neutral ? ['var(--chip)', 'var(--line2)', 'var(--chip)'] : [DOWN, 'var(--line2)', UP]
  const [nx, ny] = pt(value, r - sw / 2 - 4)
  const active = value < 33 ? 0 : value < 67 ? 1 : 2
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: W, height: H }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`מד: ${zones[active]}`}>
          {/* רווח קטן בין האזורים */}
          {/* מצע בהיר מתחת לקשת — שהאזורים לא ייבלעו בכרטיס צבוע */}
          <path d={arc(0, 100)} fill="none" stroke="var(--surface)" strokeWidth={sw + 6} strokeLinecap="round" />
          <path d={arc(0, 32.4)} fill="none" stroke={colors[0]} strokeWidth={sw} />
          <path d={arc(33.6, 66.4)} fill="none" stroke={colors[1]} strokeWidth={sw} />
          <path d={arc(67.6, 100)} fill="none" stroke={colors[2]} strokeWidth={sw} />
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--ink)" strokeWidth={Math.max(2.5, W / 70)} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={Math.max(4.5, W / 36)} fill="var(--ink)" />
        </svg>
        {center && <div className="absolute inset-x-0 bottom-[18%] text-center">{center}</div>}
      </div>
      <div className="mt-1 grid w-full grid-cols-3 text-[12px] font-bold leading-tight" dir="ltr" style={{ maxWidth: W + 24 }}>
        {zones.map((z, i) => (
          <span key={z} dir="rtl" className={i === 0 ? 'text-left' : i === 2 ? 'text-right' : 'text-center'} style={{ color: i === active ? 'var(--ink)' : 'var(--muted)' }}>
            {z}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── הסברים בלחיצה ────────────────────────────────────────────────
// כל חלק בכרטיס (כינוי, ערך, מד, אחוזון, שינויים) נפתח בלחיצה להסבר קצר
// שמופיע ממש מתחתיו. פתוח אחד בכל כרטיס.
function Hot({ id, open, onToggle, help, className = '', children }: { id: string; open: string | null; onToggle: (id: string) => void; help: string; className?: string; children: ReactNode }) {
  const isOpen = open === id
  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        title="לחיצה להסבר"
        onClick={() => onToggle(id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(id)
          }
        }}
        className="-mx-1.5 cursor-help rounded-[10px] px-1.5 py-1 transition-colors hover:bg-[var(--hover)] focus-visible:outline focus-visible:outline-2"
        style={{ outlineColor: 'var(--accent)' }}
      >
        {children}
      </div>
      {isOpen && (
        <div className="mt-1.5 flex items-start gap-2 rounded-[11px] border px-3 py-2 text-[13px] leading-[1.55]" style={{ background: 'var(--surface)', borderColor: 'var(--line2)', color: 'var(--ink)' }}>
          <span className="flex-1">{help}</span>
          <button type="button" onClick={() => onToggle(id)} aria-label="סגירת ההסבר" className="shrink-0 text-[15px] leading-none" style={{ color: 'var(--muted)' }}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}

// סדרות חודשיות עם היסטוריה ארוכה (since) — "מהחודשים מאז 2008"; יומיות — "מהימים ב-5 השנים"
const windowText = (it: Indicator) => (it.since ? `מהחודשים מאז ${it.since.slice(0, 4)}` : `מהימים ב-${it.years} השנים האחרונות`)

// בחצי התחתון קל יותר לקרוא "נמוך מ-87%" מאשר "גבוה מ-13%"; בקצוות — שפל/שיא
const pctText = (it: Indicator) => {
  const p = it.pct!
  const since = it.since ? `מאז ${it.since.slice(0, 4)}` : `ב-${it.years} השנים האחרונות`
  if (p <= 0) return `הנמוך ביותר ${since}`
  if (p >= 100) return `הגבוה ביותר ${since}`
  return p >= 50 ? `גבוה מ-${p}% ${windowText(it)}` : `נמוך מ-${100 - p}% ${windowText(it)}`
}

const gaugeHelp = (it: Indicator) => {
  if (it.kind === 'trend') return 'שמאל = מתחת לממוצע, ימין = מעל הממוצע. האזור האמצעי הוא עד סטיית תקן אחת מכל צד — בתוכו המגמה עוד לא מובהקת.'
  if (it.kind === 'curve') return 'שמאל = עקום הפוך (מתחת ל-0), אמצע = עקום שטוח (0 עד 1%), ימין = עקום חיובי (מעל 1%), שהוא המצב הרגיל.'
  if (it.group === 'erp')
    return `המחוג מראה איפה הפרמיה של היום ביחס לכל החודשים מאז ${it.since?.slice(0, 4)}: שמאל = פרמיה נמוכה (מניות יקרות ביחס לאג"ח, באדום), ימין = פרמיה גבוהה (מניות זולות, בירוק). כל אזור הוא שליש מהחודשים.`
  return (
    `המחוג מראה איפה הערך של היום ביחס ל-${it.years ?? 5} השנים האחרונות: שמאל = גבוה מרוב הימים, ימין = נמוך מרוב הימים. כל אזור הוא שליש מהימים.` +
    (it.neutral ? ' כאן אין טוב או רע, ולכן המד בלי צבע.' : ' ערך גבוה נצבע באדום, כי הוא מעיד על לחץ או על תנאים מהדקים לשוק.')
  )
}
const pctHelp = (it: Indicator) =>
  `אחוזון: ב-${it.pct}% ${windowText(it)} הערך היה נמוך מהיום או שווה לו. הטווח — הערך הנמוך והגבוה ביותר באותה תקופה.`
const CH_HELP: Record<Unit, string> = {
  pct: 'השינוי לעומת לפני חודש ולפני שנה, בנקודות בסיס (נ״ב): 100 נ״ב = 1%.',
  pp: 'השינוי לעומת הנתון הקודם (חודש או רבעון) ולעומת לפני שנה, בנקודות אחוז: מ-3.4% ל-3.7% = עלייה של 0.3 נק׳ אחוז.',
  z: 'השינוי לעומת לפני חודש ולפני שנה, בסטיות תקן (ס״ת).',
  ils: 'השינוי בשער לעומת לפני חודש ולפני שנה, באחוזים. עלייה = הדולר התחזק מול השקל.',
  pts: 'השינוי לעומת לפני חודש ולפני שנה, בנקודות מדד.',
}
const OVERALL_HELP =
  'ממוצע המיקום של ארבעה אינדיקטורים שיש להם כיוון ברור והיסטוריה מלאה: מדד הפחד, S&P 500 ות"א-35 מול ממוצע 200 יום, ושיפוע העקום. 0 = לחץ מרבי, 100 = רגיעה מרבית; מתחת ל-33 "לחוצים", מעל 67 "רגועים". מרווחי האשראי לא נכנסים — 3 שנים של היסטוריה זה חלון קצר מדי.'

// ── מד מצב-על בראש הדף ───────────────────────────────────────────
function Overall({ o }: { o: NonNullable<Data['overall']> }) {
  const [open, setOpen] = useState<string | null>(null)
  const toggle = (id: string) => setOpen((x) => (x === id ? null : id))
  return (
    <Card className="mt-5 flex flex-col items-center gap-5 px-6 py-5 sm:flex-row sm:items-center" style={cardStyle(o.shade)}>
      <Hot id="gauge" open={open} onToggle={toggle} help={OVERALL_HELP} className="w-full max-w-[280px] sm:w-auto">
        <Gauge
          value={o.gauge}
          zones={o.zones}
          size={240}
          center={
            <span className="text-[30px] font-extrabold leading-none tabular-nums" style={{ color: 'var(--ink)' }}>
              {o.gauge}
            </span>
          }
        />
      </Hot>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>
            תנאי השוק
          </span>
          <Chip shade={o.shade}>{o.reading}</Chip>
        </div>
        <p className="mt-2 font-display text-[19px] font-semibold leading-[1.5]" style={{ color: 'var(--ink)' }}>
          {o.text}
        </p>
      </div>
    </Card>
  )
}

// במפת החום — מצב-על בשורה אחת, בלי המד הגדול
function OverallLine({ o }: { o: NonNullable<Data['overall']> }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] border px-4 py-2.5" style={cardStyle(o.shade)}>
      <span className="text-[13px] font-bold" style={{ color: 'var(--muted)' }}>
        תנאי השוק
      </span>
      <Chip shade={o.shade}>{o.reading}</Chip>
      <span className="text-[15px] font-extrabold tabular-nums" style={{ color: 'var(--ink)' }}>
        {o.gauge}/100
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px]" title={o.text} style={{ color: 'var(--ink2)' }}>
        {o.text}
      </span>
    </div>
  )
}

// ── כרטיס אינדיקטור ──────────────────────────────────────────────
function IndicatorCard({ it }: { it: Indicator }) {
  const s = SHADE[it.shade]
  const [open, setOpen] = useState<string | null>(null)
  const toggle = (id: string) => setOpen((x) => (x === id ? null : id))
  return (
    <Card id={`ind-${it.id}`} className="flex scroll-mt-24 flex-col px-5 py-4" style={cardStyle(it.shade)}>
      <h3 className="text-[17px] font-extrabold leading-snug" style={{ color: 'var(--ink)' }}>
        {it.name}
      </h3>
      <Hot id="term" open={open} onToggle={toggle} help={it.term} className="mt-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-md px-1.5 py-0.5 text-[12px] font-bold" dir="ltr" style={{ background: 'var(--chip)', color: 'var(--ink2)' }}>
            {it.nick}
          </span>
          <span className="text-[13px] font-semibold underline decoration-dotted underline-offset-4" style={{ color: 'var(--ink2)' }}>
            {it.nickHe}
          </span>
        </div>
      </Hot>

      <Hot id="value" open={open} onToggle={toggle} help={it.valueHelp} className="mt-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[30px] font-extrabold leading-none tracking-[-0.02em] tabular-nums" dir="ltr" style={{ color: 'var(--ink)', textAlign: 'right' }}>
              {fmtValue(it.unit, it.value)}
              {it.unit === 'z' && <span className="mr-1 text-[15px] font-bold"> ס״ת</span>}
            </div>
            {it.reading && (
              <div className="mt-2">
                <Chip shade={it.shade}>{it.reading}</Chip>
              </div>
            )}
          </div>
          <Sparkline points={it.spark} zero={it.kind !== 'pct'} />
        </div>
        {it.close != null && it.ma != null && it.dist != null && (
          <div className="mt-2 text-[13px] tabular-nums" style={{ color: 'var(--ink2)' }}>
            <span dir="ltr">
              {sign(it.dist)}
              {Math.abs(it.dist).toFixed(1)}%
            </span>{' '}
            מהממוצע · מדד {fmtNum(it.close)} · ממוצע 200 יום {fmtNum(it.ma)}
          </div>
        )}
      </Hot>

      {it.extra && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {it.extra.map((x) => (
            <Hot key={x.id} id={`x-${x.id}`} open={open} onToggle={toggle} help={x.help}>
              <div className="rounded-[11px] px-3 py-2" style={{ background: 'color-mix(in oklab, var(--surface) 70%, transparent)' }}>
                <div className="text-[12px] font-bold leading-snug" style={{ color: 'var(--muted)' }}>
                  {x.label}
                </div>
                <div className="mt-0.5 text-[18px] font-extrabold tabular-nums" dir="ltr" style={{ color: 'var(--ink)', textAlign: 'right' }}>
                  {fmtValue(it.unit, x.value)}
                </div>
              </div>
            </Hot>
          ))}
        </div>
      )}

      {it.gauge != null && (
        <Hot id="gauge" open={open} onToggle={toggle} help={gaugeHelp(it)} className="mt-3">
          <Gauge value={it.gauge} zones={it.zones} neutral={it.neutral} />
        </Hot>
      )}
      {it.pct != null && it.min != null && it.max != null && (
        <Hot id="pct" open={open} onToggle={toggle} help={pctHelp(it)} className="mt-1">
          <div className="text-center text-[12px]" style={{ color: 'var(--muted)' }}>
            {pctText(it)} · טווח{' '}
            <span dir="ltr" className="tabular-nums">
              {fmtRange(it.unit, it.min)}–{fmtRange(it.unit, it.max)}
            </span>
          </div>
        </Hot>
      )}

      <p className="mt-3 text-[13px] leading-[1.55]" style={{ color: 'var(--ink2)' }}>
        {it.what}
      </p>

      <div className="mt-auto pt-3">
        <div className="border-t pt-2" style={{ borderColor: s.border }}>
          <Hot id="ch" open={open} onToggle={toggle} help={CH_HELP[it.unit]}>
            <div className="flex gap-5 text-[13px]">
              {(['ch1m', 'ch1y'] as const).map((k) => (
                <span key={k} style={{ color: 'var(--muted)' }}>
                  {k === 'ch1m' ? (it.prevLabel ?? 'חודש') : 'שנה'}{' '}
                  <span className="font-bold tabular-nums" dir="ltr" style={{ color: 'var(--ink)' }}>
                    {fmtChange(it.unit, it[k])}
                  </span>
                </span>
              ))}
            </div>
          </Hot>
        </div>
        <div className="mt-2 text-[12px]" style={{ color: it.stale ? DOWN : 'var(--muted)' }}>
          {it.period ? `${it.stale ? 'אחרון: ' : ''}${it.period}` : `${it.stale ? 'לא עודכן מאז ' : 'נכון ל-'}${shortDate(it.date)}`}
        </div>
      </div>
    </Card>
  )
}

// קו מגמה של שנה. צבע ניטרלי — הצבע של הכרטיס כבר אומר את הפרשנות
function Sparkline({ points, zero }: { points: [string, number][]; zero?: boolean }) {
  const W = 110
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
      <polyline points={pts} fill="none" stroke="var(--ink2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── פרמיית סיכון המניות ───────────────────────────────────────────
function Erp({ erp }: { erp: NonNullable<Data['erp']> }) {
  // המדד נכנס לטבלה וממוין עם הסקטורים — מעליו: סקטורים שמתומחרים בפרמיה גבוהה ממנו
  const rows = [...erp.sectors, { ...erp.index, bench: true }].sort((a, b) => (b.erp ?? -99) - (a.erp ?? -99))
  const scale = Math.max(...rows.map((r) => Math.abs(r.erp ?? 0)), 0.01)
  const cols = 'grid-cols-[120px_56px_64px_72px_72px] sm:grid-cols-[minmax(150px,1.3fr)_64px_84px_96px_minmax(80px,1fr)_84px]'
  const { real } = erp
  return (
    <section className="mt-8">
      <h2 className="text-[20px] font-extrabold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
        פרמיית הסיכון של המניות
      </h2>
      <p className="mt-0.5 text-[14px]" style={{ color: 'var(--muted)' }}>
        כמה מניות S&P 500 מתומחרות להניב מעל הריבית הריאלית לשנתיים, בדומה למודל הפד: תשואת הרווח העתידית (1 חלקי מכפיל הרווח העתידי) פחות הריבית הריאלית.
        פרמיה נמוכה = מניות יקרות ביחס לאג"ח.
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
            פחות ריבית ריאלית לשנתיים <b className="tabular-nums">{real.value.toFixed(2)}%</b>
            <span style={{ color: 'var(--muted)' }}>
              {' '}
              = אג"ח לשנתיים {real.nominal.toFixed(2)}% פחות ציפיות אינפלציה לשנתיים {real.inflation.toFixed(2)}%
            </span>
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
          חישוב של NewFin. מכפילי הרווח העתידי — תחזית האנליסטים לשנה הבאה, ממוצע הרמוני משוקלל לפי משקל במדד, כמו בדף השווקים. הריבית
          הריאלית לשנתיים — תשואת אג"ח ממשלת ארה"ב לשנתיים פחות ציפיות האינפלציה לשנתיים (חודשי, נכון ל-
          {shortDate(real.inflationDate)}); אין אג"ח צמוד לשנתיים. לפרמיה אין עדיין היסטוריה ארוכה, ולכן אין לה מד — ההיסטוריה נצברת מ-
          {shortDate(erp.since)} ואילך.
        </p>
      </Card>
    </section>
  )
}

// ── מפת חום: כל האינדיקטורים במסך אחד ─────────────────────────────
type View = 'cards' | 'heat'
const VIEW_KEY = 'nf-indicators-view'
function useView(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'heat' ? 'heat' : 'cards'
    } catch {
      return 'cards'
    }
  })
  const set = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* מצב פרטי — התצוגה פשוט לא נזכרת */
    }
  }
  return [view, set]
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex rounded-[11px] border p-1" style={{ background: 'var(--surface)', borderColor: 'var(--line2)' }} role="group" aria-label="תצוגה">
      {(['cards', 'heat'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => onChange(v)}
          className="rounded-[8px] px-4 py-1.5 text-[14px] font-bold transition-colors"
          style={view === v ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--muted)' }}
        >
          {v === 'cards' ? 'כרטיסים' : 'מפת חום'}
        </button>
      ))}
    </div>
  )
}

// סולם שבעת הגוונים — משמאל (לחץ) לימין (רגיעה), כמו המדים
function Legend() {
  const shades: Shade[] = [-3, -2, -1, 0, 1, 2, 3]
  return (
    <div className="flex items-center gap-2 text-[12px] font-bold" dir="ltr" style={{ color: 'var(--muted)' }}>
      <span>לחץ / מהדק</span>
      <span className="flex overflow-hidden rounded-md border" style={{ borderColor: 'var(--line2)' }}>
        {shades.map((sh) => (
          <span key={sh} className="h-4 w-6" style={{ background: SHADE[sh].bg }} />
        ))}
      </span>
      <span>רגוע / מקל</span>
    </div>
  )
}

function Heatmap({ data, onPick }: { data: Data; onPick: (id: string) => void }) {
  const rows = [...data.groups, ...(data.erpLong?.length ? [{ id: 'erp', title: 'פרמיית סיכון — פרספקטיבה היסטורית', items: data.erpLong }] : [])]
  return (
    // במסך רחב — שתי קבוצות בשורה, כדי שהכל ייכנס במסך אחד
    <div className="mt-4 grid gap-x-6 gap-y-4 xl:grid-cols-2">
      {rows.map((g) => (
        <section key={g.id} className={`flex flex-col gap-2 ${g.items.length > 4 ? 'xl:col-span-2' : ''}`}>
          <h2 className="text-[15px] font-extrabold leading-snug" style={{ color: 'var(--ink)' }}>
            {g.title}
          </h2>
          <div className="flex flex-1 flex-wrap gap-2">
            {g.items.map((it) => (
              <HeatTile key={it.id} it={it} onClick={() => onPick(it.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// אריח: שם, ערך ותווית — צבוע בגוון של האינדיקטור. הערך והתווית כתובים תמיד,
// כך שהצבע לעולם אינו הנשא היחיד של המידע.
function HeatTile({ it, onClick }: { it: Indicator; onClick: () => void }) {
  const s = SHADE[it.shade]
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${it.name} — ${it.nickHe}. לחיצה לכרטיס המלא`}
      className="flex min-h-[96px] min-w-[150px] flex-1 basis-[160px] flex-col rounded-[12px] border px-3 py-2 text-right transition-transform hover:-translate-y-0.5 sm:max-w-[260px]"
      style={{ ...cardStyle(it.shade), boxShadow: 'var(--shadow)' }}
    >
      <span className="line-clamp-2 text-[13px] font-bold leading-snug" style={{ color: 'var(--ink)' }}>
        {it.name}
      </span>
      <span className="mt-auto pt-1.5 text-[22px] font-extrabold leading-none tabular-nums" dir="ltr" style={{ color: 'var(--ink)', textAlign: 'right' }}>
        {fmtValue(it.unit, it.value)}
        {it.unit === 'z' && <span className="mr-1 text-[12px] font-bold"> ס״ת</span>}
      </span>
      <span className="mt-1.5 flex items-center justify-between gap-2">
        {it.reading ? (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: s.chip, color: s.chipFg }}>
            {it.reading}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[11px]" style={{ color: it.stale ? DOWN : 'var(--muted)' }}>
          {it.period ?? shortDate(it.date)}
        </span>
      </span>
    </button>
  )
}

// ── מעטפות ───────────────────────────────────────────────────────
function Chip({ shade, children }: { shade: Shade; children: ReactNode }) {
  const s = SHADE[shade]
  return (
    <span className="inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold" style={{ background: s.chip, color: s.chipFg }}>
      {children}
    </span>
  )
}

function Card({ id, className = '', style, children }: { id?: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      id={id}
      className={`rounded-[18px] border ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow)', ...style }}
    >
      {children}
    </div>
  )
}

function Loading() {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy="true" aria-label="טוען אינדיקטורים">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-[300px] animate-pulse rounded-[18px]" style={{ background: 'var(--chip)' }} />
      ))}
    </div>
  )
}
