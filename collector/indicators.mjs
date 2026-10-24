// אינדיקטורים — תמונת מצב-על של השווקים והתנאים הפיננסיים.
// הפלט: market/indicators.json באחסון הציבורי של Supabase, שדף "אינדיקטורים"
// קורא ישירות. אין טבלה — הכל נגזר מחדש בכל ריצה (חוץ מהיסטוריית פרמיית
// הסיכון, שאין לה מקור היסטורי ולכן נצברת כאן יום אחר יום).
//
// מקורות — רשמיים בלבד, בלי מפתח:
//   Cboe            — קובץ ההיסטוריה הרשמי של VIX
//   FRED (הפד בסנט לואיס) — מרווחי ICE BofA, ריביות ותשואות של מועצת הפד, S&P 500
//   בנק ישראל       — ממשק הסטטיסטיקה הרשמי (ריבית, שער יציג)
//   הבורסה בת"א     — היסטוריית ת"א-35 מהמטמון של markets.mjs (market/history.json)
//   פרמיית הסיכון   — מחושבת: מכפיל רווח עתידי (market/summary.json) מול ריבית ריאלית
//
// עיקרון: אף מספר לא מוצג בלי מקור. אינדיקטור שנכשל — נשאר הערך הקודם, מסומן
// בתאריך שלו. לעולם לא מנוחש.
//
// הרצה: node collector/indicators.mjs   (--test כותב לקובץ נפרד)
import { db } from './db.mjs'

const BUCKET = 'public-data'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const DAY = 864e5
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d)
const isoAgo = (iso, days) => new Date(Date.parse(iso) - days * DAY).toISOString().slice(0, 10)

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(45000) })
      if (!r.ok) throw new Error(`${r.status}`)
      return await r.text()
    } catch (e) {
      if (i >= tries) throw new Error(`${new URL(url).host}: ${e.message}`)
      await sleep(i * 5000)
    }
  }
}

// ── שליפה: כל מקור מחזיר [{ date: 'YYYY-MM-DD', value }] ממוין ─────────
async function fred(id) {
  const csv = await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`)
  const rows = csv
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => l.split(','))
    .filter(([d, v]) => /^\d{4}-\d\d-\d\d$/.test(d) && v !== '.' && v !== '' && Number.isFinite(+v))
    .map(([date, v]) => ({ date, value: +v }))
  if (rows.length < 30) throw new Error(`FRED ${id}: היסטוריה קצרה מדי`)
  return rows
}

async function cboe(symbol) {
  const csv = await get(`https://cdn.cboe.com/api/global/us_indices/daily_prices/${symbol}_History.csv`)
  const rows = csv
    .trim()
    .split('\n')
    .slice(1)
    .map((l) => l.split(','))
    .map(([d, , , , close]) => {
      const [m, dd, y] = d.split('/')
      return { date: `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}`, value: +close }
    })
    .filter((r) => Number.isFinite(r.value))
  if (rows.length < 30) throw new Error(`Cboe ${symbol}: היסטוריה קצרה מדי`)
  return rows
}

// בנק ישראל (SDMX). הממשק ממלא סופי שבוע בערך האחרון — זה הערך הרשמי בתוקף.
async function boi(flow, key) {
  const from = isoAgo(new Date().toISOString().slice(0, 10), 365 * 6)
  const csv = await get(`https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/${flow}/1.0/${key}?startperiod=${from}&format=csv`)
  const [head, ...lines] = csv.trim().split('\n')
  const cols = head.split(',')
  const di = cols.indexOf('TIME_PERIOD')
  const vi = cols.indexOf('OBS_VALUE')
  const rows = lines
    .map((l) => l.split(','))
    .map((c) => ({ date: c[di], value: +c[vi] }))
    .filter((r) => /^\d{4}-\d\d-\d\d$/.test(r.date) && Number.isFinite(r.value))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  if (rows.length < 30) throw new Error(`בנק ישראל ${key}: היסטוריה קצרה מדי`)
  return rows
}

async function loadJson(path) {
  const { data } = await db.storage.from(BUCKET).download(path)
  if (!data) return null
  try {
    return JSON.parse(await data.text())
  } catch {
    return null
  }
}

// מרחק המדד מהממוצע הנע של 200 ימי מסחר, באחוזים — סדרה יומית
function vsMA200(closes) {
  const out = []
  let sum = 0
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i].value
    if (i >= 200) sum -= closes[i - 200].value
    if (i >= 199) out.push({ date: closes[i].date, value: (closes[i].value / (sum / 200) - 1) * 100, close: closes[i].value, ma: sum / 200 })
  }
  return out
}

// ── הגדרת האינדיקטורים ────────────────────────────────────────────
// kind קובע את הפרשנות:
// (מרווחי ICE BofA הם level ולא stress: FRED מפרסם בחינם רק 3 שנים אחרונות,
// ושלוש שנים רגועות הופכות מרווח נמוך היסטורית ל"לחוץ" — מטעה)
//   stress — גבוה = לחץ (אחוזון מול ההיסטוריה: רגוע / תקין / לחוץ)
//   level  — אין "טוב" או "רע", רק מיקום מול ההיסטוריה (נמוך / בינוני / גבוה)
//   curve  — שיפוע עקום: הפוך / שטוח / חיובי לפי סימן וגודל
//   trend  — מרחק מממוצע 200 יום: מעל / מתחת
// unit: pct = אחוזים (שינוי בנקודות בסיס), pts = נקודות מדד, ils = שקלים
// (שינוי באחוזים), dist = מרחק באחוזים (שינוי בנקודות אחוז)
const FRED_URL = (id) => `https://fred.stlouisfed.org/series/${id}`
const H15 = 'מועצת הפדרל ריזרב, דרך FRED'
const ICE = 'ICE Data Indices, דרך FRED'

const INDICATORS = [
  {
    id: 'vix', group: 'risk', name: 'מדד הפחד', official: 'Cboe Volatility Index', code: 'VIX',
    org: 'Cboe', url: 'https://www.cboe.com/tradable_products/vix/', unit: 'pts', kind: 'stress', years: 5, maxAge: 7,
    what: 'התנודתיות שהשוק מתמחר ב-S&P 500 ל-30 הימים הקרובים, מתוך מחירי האופציות.',
    fetch: () => cboe('VIX'),
  },
  {
    id: 'spx200', group: 'risk', name: 'S&P 500 מול ממוצע 200 יום', official: 'S&P 500 Index vs. 200-day moving average', code: 'SP500',
    org: 'S&P Dow Jones Indices, דרך FRED', url: FRED_URL('SP500'), unit: 'dist', kind: 'trend', years: 5, maxAge: 7,
    what: 'כמה המדד רחוק מהממוצע של 200 ימי המסחר האחרונים — המדד המקובל למגמה ארוכה.',
    fetch: async (ctx) => {
      const rows = await fred('SP500')
      // FRED מתעדכן ביום-יומיים איחור. סגירות מאוחרות יותר — מדף השווקים (אותו מדד)
      const last = rows[rows.length - 1].date
      for (const d of ctx.spxDays) if (d.date > last) rows.push({ date: d.date, value: d.close })
      return vsMA200(rows)
    },
  },
  {
    id: 'ta35200', group: 'risk', name: 'ת"א-35 מול ממוצע 200 יום', official: 'TA-35 Index vs. 200-day moving average', code: 'TA-35',
    org: 'הבורסה לניירות ערך בתל אביב', url: 'https://market.tase.co.il/he/market_data/index/142/major_data', unit: 'dist', kind: 'trend', years: 5, maxAge: 7,
    what: 'כמה המדד רחוק מהממוצע של 200 ימי המסחר האחרונים — המדד המקובל למגמה ארוכה.',
    fetch: async (ctx) => {
      const e = ctx.history?.idx?.['142']
      if (!e) throw new Error('ת"א-35: אין היסטוריה במטמון')
      const rows = Object.keys(e.rows)
        .filter((d) => d >= e.from)
        .sort()
        .map((date) => ({ date, value: Array.isArray(e.rows[date]) ? e.rows[date][1] : e.rows[date] }))
        .filter((r) => Number.isFinite(r.value))
      const out = vsMA200(rows)
      if (!out.length) throw new Error('ת"א-35: פחות מ-200 ימי מסחר במטמון')
      return out
    },
  },
  {
    id: 'hy', group: 'credit', name: 'מרווח אג"ח בדירוג נמוך', official: 'ICE BofA US High Yield Index Option-Adjusted Spread', code: 'BAMLH0A0HYM2',
    org: ICE, url: FRED_URL('BAMLH0A0HYM2'), unit: 'pct', kind: 'level', years: 3, maxAge: 7,
    what: 'התוספת שחברות בדירוג נמוך משלמות מעל אג"ח ממשלת ארה"ב. עלייה = המלווים דורשים יותר על הסיכון.',
    fetch: () => fred('BAMLH0A0HYM2'),
  },
  {
    id: 'ig', group: 'credit', name: 'מרווח אג"ח בדירוג השקעה', official: 'ICE BofA US Corporate Index Option-Adjusted Spread', code: 'BAMLC0A0CM',
    org: ICE, url: FRED_URL('BAMLC0A0CM'), unit: 'pct', kind: 'level', years: 3, maxAge: 7,
    what: 'התוספת שחברות בדירוג השקעה משלמות מעל אג"ח ממשלת ארה"ב.',
    fetch: () => fred('BAMLC0A0CM'),
  },
  {
    id: 'ff', group: 'rates', name: 'ריבית הפד', official: 'Federal Funds Effective Rate', code: 'DFF',
    org: H15, url: FRED_URL('DFF'), unit: 'pct', kind: 'level', years: 5, maxAge: 7,
    what: 'הריבית בפועל על הלוואות לילה בין בנקים בארה"ב — הכלי המרכזי של הפד.',
    fetch: () => fred('DFF'),
  },
  {
    id: 'us2', group: 'rates', name: 'תשואת אג"ח ארה"ב ל-2 שנים', official: 'Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity', code: 'DGS2',
    org: H15, url: FRED_URL('DGS2'), unit: 'pct', kind: 'level', years: 5, maxAge: 7,
    what: 'משקפת בעיקר את ציפיות השוק לריבית הפד בשנתיים הקרובות.',
    fetch: () => fred('DGS2'),
  },
  {
    id: 'us10', group: 'rates', name: 'תשואת אג"ח ארה"ב ל-10 שנים', official: 'Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity', code: 'DGS10',
    org: H15, url: FRED_URL('DGS10'), unit: 'pct', kind: 'level', years: 5, maxAge: 7,
    what: 'ריבית העוגן של העולם — משמשת להיוון כמעט כל נכס.',
    fetch: () => fred('DGS10'),
  },
  {
    id: 'curve', group: 'rates', name: 'שיפוע העקום: 10 מול 2 שנים', official: '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity', code: 'T10Y2Y',
    org: 'הפד בסנט לואיס (FRED)', url: FRED_URL('T10Y2Y'), unit: 'pct', kind: 'curve', years: 5, maxAge: 7,
    what: 'הפרש התשואות בין 10 ל-2 שנים. שלילי = עקום הפוך, שקדם היסטורית למיתונים.',
    fetch: () => fred('T10Y2Y'),
  },
  {
    id: 'bei', group: 'rates', name: 'ציפיות אינפלציה ל-10 שנים', official: '10-Year Breakeven Inflation Rate', code: 'T10YIE',
    org: 'הפד בסנט לואיס (FRED)', url: FRED_URL('T10YIE'), unit: 'pct', kind: 'level', years: 5, maxAge: 7,
    what: 'האינפלציה השנתית שהשוק מתמחר — הפער בין אג"ח רגיל לאג"ח צמוד. יעד הפד: 2%.',
    fetch: () => fred('T10YIE'),
  },
  {
    id: 'real10', group: 'rates', name: 'ריבית ריאלית ל-10 שנים', official: 'Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity, Inflation-Indexed', code: 'DFII10',
    org: H15, url: FRED_URL('DFII10'), unit: 'pct', kind: 'level', years: 5, maxAge: 7,
    what: 'התשואה על אג"ח ממשלתי צמוד (TIPS) — מחיר הכסף אחרי אינפלציה.',
    fetch: () => fred('DFII10'),
  },
  {
    id: 'boi', group: 'israel', name: 'ריבית בנק ישראל', official: 'Bank of Israel interest rate', code: 'MNT_RIB_BOI_D',
    org: 'בנק ישראל', url: 'https://www.boi.org.il/roles/monetarypolicy/', unit: 'pct', kind: 'level', years: 5, maxAge: 7,
    what: 'הריבית שקובעת הוועדה המוניטרית של בנק ישראל.',
    fetch: () => boi('BR', 'MNT_RIB_BOI_D'),
  },
  {
    id: 'usdils', group: 'israel', name: 'שער יציג דולר-שקל', official: 'Representative exchange rate USD/ILS', code: 'RER_USD_ILS',
    org: 'בנק ישראל', url: 'https://www.boi.org.il/roles/markets/exchangerates/', unit: 'ils', kind: 'level', years: 5, maxAge: 7,
    what: 'השער היציג שמפרסם בנק ישראל בכל יום עסקים.',
    fetch: () => boi('EXR', 'RER_USD_ILS'),
  },
]

const GROUPS = [
  { id: 'risk', title: 'פחד ומגמה' },
  { id: 'credit', title: 'אשראי' },
  { id: 'rates', title: 'ריביות ועקום התשואות — ארה"ב' },
  { id: 'israel', title: 'ישראל' },
]

// ── חישוב ─────────────────────────────────────────────────────────
// הערך האחרון עד תאריך (כולל) — לשינוי מול חודש/שנה
const valueAt = (rows, iso) => {
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].date <= iso) return rows[i].value
  return null
}

function change(unit, now, then) {
  if (then == null) return null
  if (unit === 'pct') return round((now - then) * 100, 0) // נקודות בסיס
  if (unit === 'ils') return round((now / then - 1) * 100) // אחוזים
  return round(now - then) // נקודות / נקודות אחוז
}

function reading(spec, value, pct, rows) {
  if (spec.kind === 'trend') {
    return value >= 0
      ? { label: 'מעל הממוצע', tone: 'calm' }
      : { label: 'מתחת לממוצע', tone: 'stress' }
  }
  if (spec.kind === 'curve') {
    if (value < 0) return { label: 'עקום הפוך', tone: 'stress' }
    if (value < 0.5) return { label: 'עקום שטוח', tone: 'normal' }
    return { label: 'עקום חיובי', tone: 'calm' }
  }
  if (pct == null) return null
  if (spec.kind === 'stress') {
    if (pct <= 20) return { label: 'רגוע', tone: 'calm' }
    if (pct >= 80) return { label: 'לחוץ', tone: 'stress' }
    return { label: 'תקין', tone: 'normal' }
  }
  if (pct <= 33) return { label: 'נמוך', tone: 'level' }
  if (pct >= 67) return { label: 'גבוה', tone: 'level' }
  return { label: 'בינוני', tone: 'level' }
}

// קו מגמה של שנה — דילול לנקודה בשבוע בערך, כדי שהקובץ יישאר קטן
function spark(rows, from) {
  const yr = rows.filter((r) => r.date >= from)
  const step = Math.max(1, Math.floor(yr.length / 60))
  const out = yr.filter((_, i) => i % step === 0)
  if (out[out.length - 1] !== yr[yr.length - 1]) out.push(yr[yr.length - 1])
  return out.map((r) => [r.date, round(r.value, 3)])
}

function build(spec, rows) {
  const last = rows[rows.length - 1]
  const from = isoAgo(last.date, 365 * spec.years)
  const window = rows.filter((r) => r.date >= from)
  // אחוזון רק כשיש היסטוריה מלאה לחלון — אחוזון על חצי שנה מתחזה לתמונה ארוכה
  const fullWindow = rows[0].date <= isoAgo(last.date, 365 * spec.years - 10)
  const pct = fullWindow ? round((window.filter((r) => r.value <= last.value).length / window.length) * 100, 0) : null
  const values = window.map((r) => r.value)
  return {
    id: spec.id,
    group: spec.group,
    name: spec.name,
    official: spec.official,
    code: spec.code,
    org: spec.org,
    url: spec.url,
    what: spec.what,
    unit: spec.unit,
    kind: spec.kind,
    date: last.date,
    value: round(last.value, spec.unit === 'ils' ? 3 : 2),
    ...(last.close != null ? { close: round(last.close), ma: round(last.ma) } : {}),
    ch1m: change(spec.unit, last.value, valueAt(rows, isoAgo(last.date, 30))),
    ch1y: change(spec.unit, last.value, valueAt(rows, isoAgo(last.date, 365))),
    years: fullWindow ? spec.years : null,
    min: fullWindow ? round(Math.min(...values), 3) : null,
    max: fullWindow ? round(Math.max(...values), 3) : null,
    pct,
    reading: reading(spec, last.value, pct, rows),
    spark: spark(rows, isoAgo(last.date, 365)),
  }
}

// ── פרמיית סיכון המניות ───────────────────────────────────────────
// תשואת הרווח העתידית (1 ÷ מכפיל רווח עתידי) פחות הריבית הריאלית ל-10 שנים.
// המכפיל — מדף השווקים (תחזית האנליסטים ב-Yahoo, ממוצע הרמוני משוקלל), הריבית — הפד.
// אין לזה מקור היסטורי — הסדרה נצברת כאן, נקודה לכל יום.
function erp(summary, real10, prevHist) {
  const spx = summary?.us?.indices?.find((i) => i.symbol === '^GSPC')
  if (!spx?.fpe || real10 == null) return { block: null, hist: prevHist }
  const calc = (fpe) => (fpe > 0 ? { ey: round(100 / fpe), erp: round(100 / fpe - real10) } : { ey: null, erp: null })
  const hist = { ...prevHist, [spx.date]: calc(spx.fpe).erp }
  const series = Object.keys(hist)
    .sort()
    .map((d) => [d, hist[d]])
  return {
    hist,
    block: {
      date: spx.date,
      real10,
      index: { name: 'S&P 500', fpe: spx.fpe, ...calc(spx.fpe) },
      sectors: (summary.us.breakdown ?? [])
        .filter((s) => s.fpe)
        .map((s) => ({ sector: s.sector, weight: s.weight, fpe: s.fpe, ...calc(s.fpe) }))
        .sort((a, b) => b.erp - a.erp),
      history: series,
      since: series[0][0],
    },
  }
}

// ── שורת מצב-על — נגזרת מהמספרים בלבד, בלי AI ──────────────────────
function overall(items) {
  const by = Object.fromEntries(items.map((i) => [i.id, i]))
  // הסימנים שיש להם כיוון ברור: פחד (אחוזון 5 שנים), מגמה בשני השווקים, עקום
  const core = ['vix', 'spx200', 'ta35200', 'curve'].map((k) => by[k]).filter((i) => i?.reading)
  if (core.length < 3) return null
  const stress = core.filter((i) => i.reading.tone === 'stress').length
  const calm = core.filter((i) => i.reading.tone === 'calm').length
  const label = stress >= 2 ? 'לחוצים' : stress === 1 ? 'מעורבים' : calm >= 2 ? 'רגועים' : 'תקינים'
  const tone = stress >= 2 ? 'stress' : stress === 1 ? 'normal' : 'calm'
  const sign = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}%`
  const where = (i) => (i.pct == null ? '' : i.pct >= 67 ? 'גבוה' : i.pct <= 33 ? 'נמוך' : 'בטווח הרגיל')
  const ma = (i, name) => `${name} ${i.value >= 0 ? 'מעל ' : 'מתחת ל'}ממוצע 200 יום (${sign(i.value)})`
  const parts = []
  if (by.vix) parts.push(`מדד הפחד VIX עומד על ${by.vix.value.toFixed(2)}${by.vix.pct != null ? ` — ${where(by.vix)} ביחס ל-${by.vix.years} השנים האחרונות` : ''}`)
  if (by.spx200) parts.push(ma(by.spx200, 'S&P 500'))
  if (by.ta35200) parts.push(ma(by.ta35200, 'ת"א-35'))
  if (by.curve) parts.push(`עקום התשואות ${by.curve.value < 0 ? 'הפוך' : by.curve.value < 0.5 ? 'שטוח' : 'חיובי'} (10 מול 2 שנים: ${by.curve.value > 0 ? '+' : ''}${by.curve.value.toFixed(2)})`)
  if (by.hy?.pct != null) parts.push(`מרווח האשראי בדירוג נמוך ${by.hy.value.toFixed(2)}% — ${where(by.hy)} ביחס ל-${by.hy.years} השנים האחרונות`)
  return { label, tone, text: `${parts.join('; ')}.` }
}

// ── ריצה ──────────────────────────────────────────────────────────
const t0 = Date.now()
console.log('🧭 אינדיקטורים — מתחיל...')

const [summary, history, prev, prevErp] = await Promise.all([
  loadJson('market/summary.json'),
  loadJson('market/history.json'),
  loadJson('market/indicators.json'),
  loadJson('market/erp-history.json'),
])
const ctx = {
  history,
  spxDays: summary?.us?.indices?.find((i) => i.symbol === '^GSPC')?.days ?? [],
}

const errors = []
const items = []
const today = new Date().toISOString().slice(0, 10)
for (const spec of INDICATORS) {
  try {
    const it = build(spec, await spec.fetch(ctx))
    // מקור שהפסיק להתעדכן — מוצג, אבל מסומן
    if ((Date.parse(today) - Date.parse(it.date)) / DAY > spec.maxAge) it.stale = true
    items.push(it)
  } catch (e) {
    errors.push(`${spec.name}: ${e.message}`)
    const old = prev?.groups?.flatMap((g) => g.items).find((i) => i.id === spec.id)
    if (old) items.push({ ...old, stale: true })
  }
}

if (!items.length) {
  console.error('⛔ לא התקבל אף נתון — הקובץ הקיים נשאר ללא שינוי')
  for (const e of errors) console.error('  ', e)
  process.exit(1)
}

const real10 = items.find((i) => i.id === 'real10')?.value ?? null
const { block: erpBlock, hist: erpHist } = erp(summary, real10, prevErp ?? {})
if (!erpBlock) errors.push('פרמיית סיכון: חסר מכפיל עתידי של S&P 500 או ריבית ריאלית')

const out = {
  updated_at: new Date().toISOString(),
  overall: overall(items),
  groups: GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.group === g.id) })).filter((g) => g.items.length),
  erp: erpBlock ?? prev?.erp ?? null,
  errors,
}

const TEST = process.argv.includes('--test')
const put = (path, obj) =>
  db.storage.from(BUCKET).upload(path, JSON.stringify(obj), { upsert: true, contentType: 'application/json', cacheControl: '60' })
const { error } = await put(TEST ? 'market/indicators-test.json' : 'market/indicators.json', out)
if (error) throw error
if (erpBlock && !TEST) {
  const { error: e2 } = await put('market/erp-history.json', erpHist)
  if (e2) throw e2
}

for (const i of items) console.log(`  ${i.stale ? '⚠️' : '✅'} ${i.name}: ${i.value} (${i.date})${i.reading ? ` — ${i.reading.label}` : ''}${i.pct != null ? `, אחוזון ${i.pct}` : ''}`)
if (erpBlock) console.log(`  ✅ פרמיית סיכון S&P 500: ${erpBlock.index.erp}% (${erpBlock.sectors.length} סקטורים)`)
if (out.overall) console.log(`📝 תנאי השוק ${out.overall.label}: ${out.overall.text}`)
if (errors.length) console.warn(`⚠️ ${errors.length} שגיאות:`, errors)
console.log(`⏱️ ${((Date.now() - t0) / 1000).toFixed(1)} שניות`)
