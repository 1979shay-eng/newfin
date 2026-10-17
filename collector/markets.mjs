// סיכום מסחר — ישראל וארה"ב, יומי ו-7 ימי מסחר, כולל פילוח סקטוריאלי.
// הפלט: קובץ JSON אחד (market/summary.json) באחסון הציבורי של Supabase, שדף
// "סיכום מסחר" באתר קורא ישירות. אין טבלה — הנתונים נגזרים מחדש בכל ריצה.
//
// מקורות (כולם ציבוריים וחינמיים):
//   ישראל — אתר הבורסה (api.tase.co.il): היסטוריית מדדים, הרכב ת"א-35/125 עם
//           משקלים, היסטוריית כל מניה, וענף רשמי לכל נייר (FullBranch).
//           מוגן ב-Incapsula — לכן דרך דפדפן Playwright, כמו מאיה.
//   ארה"ב — Yahoo Finance: מדדים + 11 קרנות הסקטורים של S&P 500 (SPDR).
//
// עיקרון: אף מספר לא מוצג בלי מקור. נתון שנכשל בשליפה — מושמט ומסומן, לא מנוחש.
//
// הרצה: node collector/markets.mjs
import { chromium } from 'playwright'
import AdmZip from 'adm-zip'
import { db } from './db.mjs'

const TASE = 'https://api.tase.co.il/api'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const BUCKET = 'public-data'
const DAYS = 7 // חלון "7 ימי מסחר"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// מדדי הדגל בישראל, ושני המדדים שמפולחים לסקטורים
const IL_INDICES = [
  { id: '142', name: 'ת"א-35' },
  { id: '137', name: 'ת"א-125' },
  { id: '143', name: 'ת"א-90' },
]
const IL_BREAKDOWN = ['142', '137']

const US_INDICES = [
  { symbol: '^GSPC', name: 'S&P 500', full: 'S&P 500 Index' },
  { symbol: '^IXIC', name: 'נאסד"ק', full: 'NASDAQ Composite Index' },
  { symbol: '^DJI', name: 'דאו ג\'ונס', full: 'Dow Jones Industrial Average' },
]
// 11 הסקטורים של S&P 500 — קרן הסל הרשמית של כל סקטור משקפת את תשואתו
const US_SECTORS = [
  { symbol: 'XLK', name: 'טכנולוגיה', full: 'Technology Select Sector SPDR Fund' },
  { symbol: 'XLF', name: 'פיננסים', full: 'Financial Select Sector SPDR Fund' },
  { symbol: 'XLV', name: 'בריאות', full: 'Health Care Select Sector SPDR Fund' },
  { symbol: 'XLY', name: 'צריכה מחזורית', full: 'Consumer Discretionary Select Sector SPDR Fund' },
  { symbol: 'XLC', name: 'תקשורת', full: 'Communication Services Select Sector SPDR Fund' },
  { symbol: 'XLI', name: 'תעשייה', full: 'Industrial Select Sector SPDR Fund' },
  { symbol: 'XLP', name: 'צריכה בסיסית', full: 'Consumer Staples Select Sector SPDR Fund' },
  { symbol: 'XLE', name: 'אנרגיה', full: 'Energy Select Sector SPDR Fund' },
  { symbol: 'XLU', name: 'תשתיות', full: 'Utilities Select Sector SPDR Fund' },
  { symbol: 'XLRE', name: 'נדל"ן', full: 'Real Estate Select Sector SPDR Fund' },
  { symbol: 'XLB', name: 'חומרים', full: 'Materials Select Sector SPDR Fund' },
]

// ענף הבורסה (FullBranch, "ענף-תת ענף-תת תת ענף", למשל "פיננסי-בנקים-בנקים") →
// קבוצה קריאה לפילוח. הסדר חשוב: הכלל הראשון שמתאים קובע.
const SECTOR_MAP = [
  [/בנקים/, 'בנקים'],
  [/ביטוח/, 'ביטוח'],
  [/שרותים פיננסיים|שירותים פיננסיים/, 'שירותים פיננסיים'],
  [/נדל["״]?ן/, 'נדל"ן ובנייה'],
  [/ביטחוני/, 'ביטחוניות'],
  [/אנרגיה מתחדשת/, 'אנרגיה מתחדשת'],
  [/ביומד/, 'ביומד'],
  [/^הייטק/, 'טכנולוגיה'],
  [/חיפושי נפט/, 'נפט וגז'],
  [/אנרגיה/, 'אנרגיה'],
  [/תקשורת/, 'תקשורת ומדיה'],
  [/מסחר/, 'מסחר ושירותים'],
  [/תעשי/, 'תעשייה'],
  [/השקעה|אחזקות/, 'השקעות ואחזקות'],
]
function sectorOf(fullBranch) {
  if (!fullBranch) return 'לא מסווג'
  // קודם תת-הענף הספציפי (החלק האחרון), ורק אחריו השם המלא. אחרת "ריאלי-אנרגיה
  // וחיפושי נפט וגז-אנרגיה" (חברות חשמל) נספר כנפט וגז בגלל שם הענף העליון.
  const leaf = fullBranch.split('-').at(-1)
  for (const [re, name] of SECTOR_MAP) if (re.test(leaf)) return name
  for (const [re, name] of SECTOR_MAP) if (re.test(fullBranch)) return name
  return fullBranch.split('-')[1] || fullBranch // ענף חדש שלא מופה — מוצג בשמו הרשמי
}

// ── עזרים ─────────────────────────────────────────────────────────
const pct = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b ? (a / b - 1) * 100 : null)
const round = (x, d = 2) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d)
// "14/10/2026" → "2026-10-14"
const isoDate = (d) => {
  const [dd, mm, yy] = d.split('/')
  return `${yy}-${mm}-${dd}`
}
// תשואה מצטברת מרצף שינויים יומיים באחוזים
const compound = (changes) =>
  changes.length ? (changes.reduce((acc, c) => acc * (1 + c / 100), 1) - 1) * 100 : null

// ── ישראל ─────────────────────────────────────────────────────────
async function openTase() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ locale: 'he-IL', userAgent: UA })
  const page = await ctx.newPage()
  await page
    .goto('https://market.tase.co.il/he/market_data/index/142/components', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    .catch(() => {})
  await page.waitForTimeout(3000)
  await page.close()
  return { browser, ctx }
}

function taseClient(ctx) {
  const headers = { Accept: 'application/json', Referer: 'https://market.tase.co.il/' }
  const parse = async (r, path) => {
    if (r.status() !== 200) throw new Error(`${path} -> ${r.status()}`)
    return r.json()
  }
  // קצב מתון + עד 3 ניסיונות: Incapsula מנתק מדי פעם חיבור בודד
  const withRetry = async (path, call) => {
    for (let attempt = 1; ; attempt++) {
      await sleep(250)
      try {
        return await parse(await call(), path)
      } catch (e) {
        if (attempt >= 3) throw new Error(e.message.split('\n')[0])
        await sleep(1500 * attempt)
      }
    }
  }
  return {
    get: (path) => withRetry(path, () => ctx.request.get(TASE + path, { headers, timeout: 20000 })),
    post: (path, data) =>
      withRetry(path, () =>
        ctx.request.post(TASE + path, {
          headers: { ...headers, 'Content-Type': 'application/json' },
          data,
          timeout: 20000,
        }),
      ),
  }
}

// ── טווחי זמן ─────────────────────────────────────────────────────
// כל התשואות נמדדות מ"יום בסיס" (סגירה) ועד יום המסחר האחרון:
//   d1  — היום שלפני האחרון        d7  — 7 ימי מסחר אחורה
//   mtd — יום המסחר האחרון של החודש הקודם (מתחילת החודש)
//   m1  — יום המסחר האחרון שלפני "אותו תאריך בחודש הקודם" (חודש אחרון)
//   ytd — יום המסחר האחרון של השנה הקודמת (מתחילת השנה)
const RANGES = ['d1', 'd7', 'mtd', 'm1', 'ytd']

// ימי בסיס מתוך לוח ימי מסחר ממוין (ISO, מהישן לחדש)
function baseDates(dates) {
  const latest = dates[dates.length - 1]
  const lastBefore = (iso) => [...dates].reverse().find((d) => d < iso) ?? null
  const lastOnOrBefore = (iso) => [...dates].reverse().find((d) => d <= iso) ?? null
  const [y, m, d] = latest.split('-').map(Number)
  const monthAgo = new Date(Date.UTC(y, m - 2, Math.min(d, 28))).toISOString().slice(0, 10)
  const i = dates.length - 1
  return {
    latest,
    d1: dates[i - 1] ?? null,
    d7: dates[i - DAYS] ?? null,
    mtd: lastBefore(`${latest.slice(0, 7)}-01`),
    m1: lastOnOrBefore(monthAgo),
    ytd: lastBefore(`${latest.slice(0, 4)}-01-01`),
  }
}

// ── מטמון היסטוריה (market/history.json) ─────────────────────────
// שליפת שנה של היסטוריה ל-126 מניות = כ-1,000 בקשות. במקום להציף את אתר
// הבורסה, ההיסטוריה נשמרת ומושלמת בהדרגה (תקציב עמודים לכל ריצה); אחר כך כל
// ריצה מוסיפה רק את העמוד האחרון. עד שסדרה מכוסה עד יום הבסיס — הטווח שלה
// מוצג "—", לעולם לא מספר חלקי.
//   series = { rows: { 'YYYY-MM-DD': value }, from: 'YYYY-MM-DD' }
//   from — התאריך המוקדם שממנו הסדרה רציפה ושלמה (או '0000' כשאין עוד היסטוריה)
const PAGE = 30 // שורות לעמוד בהיסטוריית הבורסה
const BOOTSTRAP_BUDGET = 100 // עמודי השלמה לכל ריצה (מעבר לעמוד הראשון) — 220 גרם לחסימה (403)

function mergeSeries(entry, freshRows) {
  const dates = Object.keys(freshRows).sort()
  if (!dates.length) return entry
  const cached = entry ? Object.keys(entry.rows).sort() : []
  // פער: המטמון נגמר לפני תחילת העמוד הטרי (האיסוף עמד יותר מחודש) — מתחילים מחדש
  if (!entry || !cached.length || cached[cached.length - 1] < dates[0]) {
    return { rows: { ...freshRows }, from: dates[0] }
  }
  return { rows: { ...entry.rows, ...freshRows }, from: entry.from < dates[0] ? entry.from : dates[0] }
}

// מביא עמוד ראשון + משלים אחורה עד needFrom, בכפוף לתקציב המשותף
async function syncSeries(fetchPage, entry, needFrom, budget) {
  entry = mergeSeries(entry, await fetchPage(1))
  let page = Math.floor(Object.keys(entry.rows).filter((d) => d >= entry.from).length / PAGE) + 1
  while (needFrom && entry.from > needFrom && entry.from !== '0000' && budget.left > 0 && page <= 15) {
    budget.left--
    const rows = await fetchPage(page)
    const dates = Object.keys(rows).sort()
    if (!dates.length) {
      entry.from = '0000' // אין היסטוריה מוקדמת יותר (נייר שנרשם השנה)
      break
    }
    entry.rows = { ...entry.rows, ...rows }
    if (dates[0] < entry.from) entry.from = dates[0]
    page++
  }
  return entry
}

const covered = (entry, base) => Boolean(entry && base && (entry.from === '0000' || entry.from <= base))

// ── ישראל ─────────────────────────────────────────────────────────
// היסטוריית מדד: סגירות לפי תאריך (pType 4 = שנה, בעמודים של 30)
function taseIndexPager(api, id) {
  return async (pageNum) => {
    const h = await api.post('/index/historyeod', { pType: 4, TotalRec: 1, pageNum, oId: id, lang: '0' })
    const out = {}
    for (const r of h.Items || []) if (Number.isFinite(r.CloseRate)) out[isoDate(r.TradeDate)] = r.CloseRate
    return out
  }
}

// היסטוריית מניה: [שינוי יומי %, סגירה, יום אקס-דיבידנד?]. השינוי של הבורסה (Change)
// מותאם לדיבידנד — כלומר תשואה כוללת. מדדי הבורסה הם מדדי מחיר (לא מתואמים
// לדיבידנד), ולכן ביום "בלי דיבידנד" התשואה מחושבת מהמחיר בפועל — אחרת סכום
// הסקטורים ברח מהמדד ב-~2% מתחילת השנה (בדיקה מול ת"א-35, 16.10.2026).
function taseSecurityPager(api, securityNumber) {
  return async (pageNum) => {
    const h = await api.post('/security/historyeod', {
      pType: 4,
      TotalRec: 1,
      pageNum,
      oId: String(securityNumber).padStart(8, '0'),
      lang: '0',
    })
    const out = {}
    for (const r of h.Items || [])
      if (r.IfTraded !== false && Number.isFinite(r.Change))
        out[isoDate(r.TradeDate)] = [r.Change, r.CloseRate, /דיבידנד/.test(r.ExeDesc || '') ? 1 : 0]
    return out
  }
}

// תשואה של מדד מסגירות: סגירה אחרונה מול סגירת יום הבסיס
function indexReturns(entry, b) {
  const out = {}
  const last = entry?.rows[b.latest]
  for (const k of RANGES) out[k] = covered(entry, b[k]) && entry.rows[b[k]] != null ? round(pct(last, entry.rows[b[k]])) : null
  return out
}

// תשואה של מניה: מכפלת השינויים היומיים מאחרי יום הבסיס ועד היום האחרון
function stockReturns(entry, b) {
  const out = {}
  const dates = entry ? Object.keys(entry.rows).sort() : []
  for (const k of RANGES) {
    if (!covered(entry, b[k])) {
      out[k] = null
      continue
    }
    const daily = []
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i]
      if (d <= b[k] || d > b.latest) continue
      const [change, close, div] = entry.rows[d]
      const prev = i > 0 ? entry.rows[dates[i - 1]] : null
      daily.push(div && prev && prev[1] ? (close / prev[1] - 1) * 100 : change)
    }
    out[k] = daily.length ? compound(daily) : 0
  }
  return out
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

async function collectIsrael() {
  const { browser, ctx } = await openTase()
  const api = taseClient(ctx)
  const errors = []
  const hist = (await loadJson('market/history.json')) ?? { idx: {}, sec: {} }
  // מבנה ישן (מספר בודד ליום) — נבנה מחדש
  for (const [k, e] of Object.entries(hist.sec)) if (!Array.isArray(Object.values(e.rows)[0])) delete hist.sec[k]
  const budget = { left: BOOTSTRAP_BUDGET }
  try {
    // לוח ימי המסחר נגזר מת"א-35, ואיתו ימי הבסיס של כל הטווחים
    hist.idx['142'] = await syncSeries(taseIndexPager(api, '142'), hist.idx['142'], null, budget)
    let b = baseDates(Object.keys(hist.idx['142'].rows).sort())
    hist.idx['142'] = await syncSeries(taseIndexPager(api, '142'), hist.idx['142'], b.ytd ?? '0000', budget)
    b = baseDates(Object.keys(hist.idx['142'].rows).sort())
    const need = b.ytd

    const indexRow = async (id) => {
      hist.idx[id] = await syncSeries(taseIndexPager(api, id), hist.idx[id], need, budget)
      const e = hist.idx[id]
      const dates = Object.keys(e.rows).sort().filter((d) => d <= b.latest).slice(-DAYS)
      return {
        date: b.latest,
        last: e.rows[b.latest],
        ...indexReturns(e, b),
        days: dates.map((d) => ({ date: d, close: e.rows[d] })),
      }
    }

    // מדדי דגל
    const indices = []
    for (const ix of IL_INDICES) {
      try {
        indices.push({ id: ix.id, name: ix.name, source: `מדד ${ix.name} · מספר מדד ${ix.id} באתר הבורסה`, ...(await indexRow(ix.id)) })
      } catch (e) {
        errors.push(`מדד ${ix.name}: ${e.message}`)
      }
    }

    // מדדי ענף כלליים של הבורסה (קטגוריה 03 ברשימת המדדים)
    const sectorIndices = []
    try {
      const list = await api.get('/index/getindiceslistfornavigatorcombo?lang=0')
      const cat = list.find((c) => c.CategoryId === '03')?.Items ?? []
      for (const ix of cat) {
        try {
          const { days, date, ...r } = await indexRow(ix.IndexId)
          sectorIndices.push({ id: ix.IndexId, name: ix.Text, source: `מספר מדד ${ix.IndexId} באתר הבורסה`, ...r })
        } catch (e) {
          errors.push(`מדד ענף ${ix.Text}: ${e.message}`)
        }
      }
    } catch (e) {
      errors.push(`רשימת מדדי ענף: ${e.message}`)
    }

    // פילוח סקטוריאלי בתוך ת"א-35 ות"א-125: ממוצע משוקלל של המניות בכל ענף.
    // טווח של ענף מוצג רק כשלכל מניותיו יש היסטוריה מלאה לאותו טווח.
    const branchCache = (await loadJson('market/branches.json')) ?? {}
    const retBySec = new Map()
    const breakdown = {}
    let pending = 0
    for (const id of IL_BREAKDOWN) {
      const name = IL_INDICES.find((i) => i.id === id).name
      // הרכב המדד מגיע בעמודים של 30 — ת"א-125 = 5 עמודים
      const comps = []
      try {
        for (let page = 1; page <= 10; page++) {
          const r = await api.post('/index/components', { dType: 1, TotalRec: 1, pageNum: page, oId: id, lang: '0' })
          comps.push(...(r.Items ?? []))
          if (!r.Items?.length || comps.length >= (r.TotalRec ?? 0)) break
        }
      } catch (e) {
        errors.push(`הרכב ${name}: ${e.message}`)
        continue
      }
      const groups = new Map()
      for (const c of comps) {
        const sec = c.SecurityNumber
        if (!branchCache[sec]) {
          try {
            branchCache[sec] = (await api.get(`/company/securitydata?securityId=${sec}&lang=0`)).FullBranch || ''
          } catch {
            branchCache[sec] = ''
          }
        }
        if (!retBySec.has(sec)) {
          try {
            hist.sec[sec] = await syncSeries(taseSecurityPager(api, sec), hist.sec[sec], need, budget)
            if (!covered(hist.sec[sec], need)) pending++
            retBySec.set(sec, stockReturns(hist.sec[sec], b))
          } catch (e) {
            retBySec.set(sec, null)
            errors.push(`היסטוריית ${c.ShortName}: ${e.message}`)
          }
        }
        const r = retBySec.get(sec)
        if (!r || r.d1 == null) continue
        const sector = sectorOf(branchCache[sec])
        const g = groups.get(sector) ?? { sector, weight: 0, start: {}, missing: {}, stocks: [], branches: new Set() }
        if (branchCache[sec]) g.branches.add(branchCache[sec])
        g.weight += c.Weight
        for (const k of RANGES) {
          if (r[k] == null) g.missing[k] = true
          // שווי תחילת התקופה של המניה (משקל היום ÷ (1+תשואה)) — שקלול לפי
          // המשקל בתחילת התקופה. שקלול לפי משקל היום מנפח את המנצחות (שמשקלן
          // גדל בדרך): ת"א-35 יצא +21.7% מתחילת השנה מול 14.5% במדד.
          else g.start[k] = (g.start[k] ?? 0) + c.Weight / (1 + r[k] / 100)
        }
        g.stocks.push({ name: c.ShortName, weight: round(c.Weight), ...Object.fromEntries(RANGES.map((k) => [k, round(r[k])])) })
        groups.set(sector, g)
      }
      breakdown[name] = [...groups.values()]
        .map((g) => ({
          sector: g.sector,
          // שם הענף הרשמי בבורסה — כדי שאפשר יהיה לאמת את השיוך באתר הבורסה
          source: [...g.branches].join(' | ') || 'לא מסווג',
          weight: round(g.weight, 1),
          ...Object.fromEntries(RANGES.map((k) => [k, g.missing[k] ? null : round((g.weight / g.start[k] - 1) * 100)])),
          stocks: g.stocks.sort((a, b) => b.weight - a.weight),
        }))
        .sort((a, b) => b.weight - a.weight)
    }
    if (pending) errors.push(`היסטוריה בהשלמה: ${pending} מניות — הטווחים הארוכים יושלמו בריצות הבאות`)

    await db.storage.from(BUCKET).upload('market/branches.json', JSON.stringify(branchCache), {
      upsert: true,
      contentType: 'application/json',
    })
    await db.storage.from(BUCKET).upload('market/history.json', JSON.stringify(hist), {
      upsert: true,
      contentType: 'application/json',
    })

    return { indices, sectorIndices, breakdown, bases: b, errors }
  } finally {
    await browser.close()
  }
}

// ── ארה"ב ─────────────────────────────────────────────────────────
// שנה של סגירות מתואמות (adjclose — כולל דיבידנדים של קרנות הסל)
async function yahooHistory(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`Yahoo ${symbol} -> ${r.status}`)
  const res = (await r.json()).chart?.result?.[0]
  if (!res) throw new Error(`Yahoo ${symbol}: אין נתונים`)
  const ts = res.timestamp ?? []
  const closes = res.indicators?.adjclose?.[0]?.adjclose ?? res.indicators?.quote?.[0]?.close ?? []
  const raw = res.indicators?.quote?.[0]?.close ?? []
  // ימים עם סגירה בלבד; התאריך לפי שעון ניו יורק
  const rows = ts
    .map((t, i) => ({
      date: new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
      close: closes[i],
      raw: raw[i],
    }))
    .filter((r) => Number.isFinite(r.close))
  if (rows.length < DAYS + 1) throw new Error(`Yahoo ${symbol}: היסטוריה קצרה מדי`)
  const b = baseDates(rows.map((r) => r.date))
  const byDate = Object.fromEntries(rows.map((r) => [r.date, r.close]))
  const last = rows[rows.length - 1]
  return {
    date: last.date,
    last: round(last.raw ?? last.close),
    ...Object.fromEntries(RANGES.map((k) => [k, b[k] && byDate[b[k]] != null ? round(pct(last.close, byDate[b[k]])) : null])),
    days: rows.slice(-DAYS).map((r) => ({ date: r.date, close: round(r.close) })),
    bases: b,
  }
}

async function collectUS() {
  const errors = []
  const indices = []
  let bases = null
  for (const ix of US_INDICES) {
    try {
      const { bases: b, ...h } = await yahooHistory(ix.symbol)
      bases ??= b
      indices.push({ symbol: ix.symbol, name: ix.name, source: `${ix.full} (${ix.symbol})`, ...h })
    } catch (e) {
      errors.push(e.message)
    }
  }
  const sectors = []
  for (const s of US_SECTORS) {
    try {
      const { days, date, last, bases: _b, ...h } = await yahooHistory(s.symbol)
      sectors.push({ symbol: s.symbol, sector: s.name, source: `${s.full} (${s.symbol})`, ...h })
    } catch (e) {
      errors.push(e.message)
    }
  }
  // פילוח S&P 500 לפי סקטורים מתוך 500 המניות (כמו ת"א-35/125)
  let breakdown = null
  let holdingsAsOf = null
  if (bases) {
    try {
      const r = await collectSpxBreakdown(bases)
      breakdown = r.breakdown
      holdingsAsOf = r.asOf
      errors.push(...r.errors)
      const spx = indices.find((i) => i.symbol === '^GSPC')
      if (spx) Object.assign(spx, { pe: r.pe, fpe: r.fpe })
    } catch (e) {
      errors.push(e.message)
    }
  }
  return { indices, sectors, breakdown, holdingsAsOf, bases, errors }
}

// ── פילוח S&P 500 לפי סקטורים — אותה שיטה כמו ת"א-35/125 ─────────────
// הרכב ומשקלים: קובץ האחזקות היומי הרשמי של קרן SPY (State Street).
// סקטור לכל מניה: קבצי האחזקות של 11 קרנות ה-Select Sector SPDR של אותו מנהל —
// כל אחת מחזיקה בדיוק את מניות S&P 500 בסקטור שלה (סיווג GICS רשמי).
// מחירים: Yahoo spark, 20 מניות לבקשה (~25 בקשות לשנה מלאה של 500 מניות).
// תשואות לפי מחיר (כמו המדד עצמו, שאינו כולל דיבידנדים), שקלול לפי משקל
// תחילת התקופה. ההרכב/סקטורים נשמרים במטמון יומי (market/spx-holdings.json).
const SSGA = 'https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-'

// קורא גיליון ראשון של xlsx לשורות של מחרוזות (בלי ספרייה — xlsx הוא zip של XML)
function readXlsxRows(buf) {
  const zip = new AdmZip(buf)
  const xml = (name) => zip.getEntry(name)?.getData().toString('utf8') ?? ''
  const decode = (t) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  const strings = [...xml('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')))
  return [...xml('xl/worksheets/sheet1.xml').matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
    [...row[1].matchAll(/<c r="[A-Z]+\d+"([^>]*?)(?:\/>|>(?:<v>([^<]*)<\/v>)?)/g)].map(([, attrs, v]) =>
      v == null ? null : /t="s"/.test(attrs) ? strings[Number(v)] : decode(v),
    ),
  )
}

async function ssgaHoldings(fund) {
  const r = await fetch(`${SSGA}${fund.toLowerCase()}.xlsx`, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`אחזקות ${fund} -> ${r.status}`)
  const rows = readXlsxRows(Buffer.from(await r.arrayBuffer()))
  const head = rows.findIndex((x) => x[0] === 'Name' && x[1] === 'Ticker')
  if (head < 0) throw new Error(`אחזקות ${fund}: מבנה קובץ לא מוכר`)
  const asOf = rows.find((x) => /^Holdings:/.test(x[0] ?? ''))?.[1] ?? ''
  const holdings = rows
    .slice(head + 1)
    .filter((x) => x[1] && x[1] !== '-' && Number.isFinite(Number(x[4])) && x[7] === 'USD')
    .map((x) => ({ name: x[0], ticker: x[1], weight: Number(x[4]) }))
  return { asOf, holdings }
}

// הרכב + סקטורים, פעם ביום (הקבצים מתעדכנים פעם ביום ממילא)
async function spxHoldings() {
  const today = new Date().toISOString().slice(0, 10)
  const cached = await loadJson('market/spx-holdings.json')
  if (cached?.fetched === today && cached.holdings?.length > 400) return cached
  const spy = await ssgaHoldings('SPY')
  const sectorOf = {}
  for (const s of US_SECTORS) {
    const { holdings } = await ssgaHoldings(s.symbol)
    for (const h of holdings) sectorOf[h.ticker] = s.symbol
  }
  const out = {
    fetched: today,
    asOf: spy.asOf,
    holdings: spy.holdings.map((h) => ({ ...h, sector: sectorOf[h.ticker] ?? null })),
  }
  await db.storage.from(BUCKET).upload('market/spx-holdings.json', JSON.stringify(out), { upsert: true, contentType: 'application/json' })
  return out
}

// מחירי שנה לקבוצה של עד 20 טיקרים (Yahoo כותב BRK-B במקום BRK.B)
async function yahooSpark(tickers) {
  const symbols = tickers.map((t) => t.replace(/\./g, '-'))
  const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(symbols.join(','))}&range=1y&interval=1d`
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (r.ok) {
      const d = await r.json()
      const out = {}
      tickers.forEach((t, i) => {
        const s = d[symbols[i]]
        if (!s?.timestamp) return
        out[t] = {}
        s.timestamp.forEach((ts, j) => {
          const c = s.close[j]
          if (Number.isFinite(c)) out[t][new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })] = c
        })
      })
      return out
    }
    if (attempt >= 3) throw new Error(`Yahoo spark -> ${r.status}`)
    await sleep(2000 * attempt)
  }
}

// ── מכפילי רווח (ארה"ב) ───────────────────────────────────────────
// Yahoo quote: רווח למניה ב-12 החודשים האחרונים (epsTrailingTwelveMonths) ותחזית
// האנליסטים לשנה הבאה (epsForward). דורש עוגייה + crumb (מנגנון ההגנה של Yahoo).
async function yahooSession() {
  const r0 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' })
  const cookie = (r0.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  const crumb = await (await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } })).text()
  if (!cookie || !crumb || crumb.length > 40) throw new Error('Yahoo: לא התקבל crumb')
  return { cookie, crumb }
}

async function yahooQuotes(tickers) {
  const { cookie, crumb } = await yahooSession()
  const out = {}
  for (let i = 0; i < tickers.length; i += 50) {
    const batch = tickers.slice(i, i + 50)
    const symbols = batch.map((t) => t.replace(/\./g, '-'))
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}&crumb=${encodeURIComponent(crumb)}`
    const r = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie } })
    if (!r.ok) throw new Error(`Yahoo quote -> ${r.status}`)
    const rows = (await r.json()).quoteResponse?.result ?? []
    const bySym = Object.fromEntries(rows.map((x) => [x.symbol, x]))
    batch.forEach((t, j) => {
      const q = bySym[symbols[j]]
      if (!q || !Number.isFinite(q.regularMarketPrice) || q.regularMarketPrice <= 0) return
      // מניה שמדווחת במטבע אחר מהמחיר — לא מערבבים (כמו הבעיה שנמצאה במניות ישראליות)
      if (q.financialCurrency && q.currency && q.financialCurrency !== q.currency) return
      out[t] = {
        price: q.regularMarketPrice,
        eps: Number.isFinite(q.epsTrailingTwelveMonths) ? q.epsTrailingTwelveMonths : null,
        epsF: Number.isFinite(q.epsForward) ? q.epsForward : null,
      }
    })
    await sleep(300)
  }
  return out
}

// מכפיל של קבוצה = סכום המשקלים ÷ סכום (משקל × תשואת רווח), כמו בשיטת S&P.
// חברה מפסידה נכנסת עם רווח שלילי — השמטה שלה הייתה מציגה מכפיל נמוך מדי.
// אם ליותר מ-5% ממשקל הקבוצה אין נתון רווח — "—", לא מספר חלקי.
function groupPE(items, key) {
  let w = 0
  let ey = 0
  let gap = 0
  for (const it of items) {
    const q = it.q
    if (!q || q[key] == null) gap += it.weight
    else {
      w += it.weight
      ey += (it.weight * q[key]) / q.price
    }
  }
  const total = w + gap
  if (!total || gap / total > 0.05 || ey <= 0) return null
  return round(w / ey, 1)
}

async function collectSpxBreakdown(bases) {
  const errors = []
  const { asOf, holdings } = await spxHoldings()
  const unsectored = holdings.filter((h) => !h.sector)
  if (unsectored.length) errors.push(`S&P 500: ${unsectored.length} מניות בלי סקטור (${unsectored.slice(0, 5).map((h) => h.ticker).join(', ')})`)

  const prices = {}
  for (let i = 0; i < holdings.length; i += 20) {
    try {
      Object.assign(prices, await yahooSpark(holdings.slice(i, i + 20).map((h) => h.ticker)))
    } catch (e) {
      errors.push(e.message)
    }
    await sleep(300)
  }

  let quotes = {}
  try {
    quotes = await yahooQuotes(holdings.map((h) => h.ticker))
  } catch (e) {
    errors.push(`מכפילים: ${e.message}`)
  }

  const groups = new Map()
  let missing = 0
  for (const h of holdings) {
    const p = prices[h.ticker]
    if (!h.sector || !p || p[bases.latest] == null) {
      missing += h.weight
      continue
    }
    // מחיר ביום הבסיס = הסגירה האחרונה עד אותו יום (עד 5 ימים אחורה) — ל-Yahoo
    // חסרות לפעמים סגירות בודדות, ובלי זה סקטור שלם נעלם בגלל יום אחד חסר
    const dates = Object.keys(p).sort()
    const at = (iso) => {
      for (let i = dates.length - 1; i >= 0; i--) if (dates[i] <= iso) return (Date.parse(iso) - Date.parse(dates[i])) / 864e5 <= 5 ? p[dates[i]] : null
      return null
    }
    const r = Object.fromEntries(RANGES.map((k) => [k, bases[k] && at(bases[k]) != null ? pct(p[bases.latest], at(bases[k])) : null]))
    const meta = US_SECTORS.find((s) => s.symbol === h.sector)
    const g = groups.get(h.sector) ?? { sector: meta.name, symbol: h.sector, weight: 0, start: {}, now: {}, gap: {}, stocks: [], pe: [] }
    g.weight += h.weight
    g.pe.push({ weight: h.weight, q: quotes[h.ticker] })
    // מניה בלי מחיר ביום הבסיס (נרשמה אחריו / חסר אצל Yahoo) — נשמטת מאותו טווח
    // בלבד, ונספרת כפער. אם הפער מהותי — הטווח של הסקטור מוצג "—".
    for (const k of RANGES) {
      if (r[k] == null) g.gap[k] = (g.gap[k] ?? 0) + h.weight
      else {
        g.now[k] = (g.now[k] ?? 0) + h.weight
        g.start[k] = (g.start[k] ?? 0) + h.weight / (1 + r[k] / 100)
      }
    }
    const q = quotes[h.ticker]
    g.stocks.push({
      name: h.ticker,
      full: h.name,
      weight: round(h.weight),
      ...Object.fromEntries(RANGES.map((k) => [k, round(r[k])])),
      // מכפיל של מניה בודדת — רק כשהרווח חיובי (מכפיל שלילי חסר משמעות)
      pe: q?.eps > 0 ? round(q.price / q.eps, 1) : null,
      fpe: q?.epsF > 0 ? round(q.price / q.epsF, 1) : null,
    })
    groups.set(h.sector, g)
  }
  // מעל 1% מהמדד בלי מחיר — לא מציגים פילוח חלקי שמתחזה למלא
  if (missing > 1) throw new Error(`S&P 500: חסרים מחירים ל-${missing.toFixed(1)}% ממשקל המדד`)

  const breakdown = [...groups.values()]
    .map((g) => ({
      sector: g.sector,
      source: `${US_SECTORS.find((s) => s.symbol === g.symbol).full} (${g.symbol})`,
      weight: round(g.weight, 1),
      ...Object.fromEntries(
        // סף לפי משקל במדד כולו: מניות שנפרדו מחברת-אם (HONA, FDXF) לא היו קיימות ביום
        // הבסיס — ערכן היה בתוך החברה-האם, ולכן השמטה שלהן נכונה כל עוד היא זניחה
        RANGES.map((k) => [k, !g.now[k] || (g.gap[k] ?? 0) > 0.5 ? null : round((g.now[k] / g.start[k] - 1) * 100)]),
      ),
      pe: groupPE(g.pe, 'eps'),
      fpe: groupPE(g.pe, 'epsF'),
      stocks: g.stocks.sort((a, b) => b.weight - a.weight),
    }))
    .sort((a, b) => b.weight - a.weight)
  const all = [...groups.values()].flatMap((g) => g.pe)
  return { breakdown, asOf, errors, pe: groupPE(all, 'eps'), fpe: groupPE(all, 'epsF') }
}

// ── שורה כתובה — נגזרת מהמספרים בלבד, בלי AI (אפס סיכון להזיה) ─────
const fmt = (x) => `${x > 0 ? '+' : ''}${x.toFixed(1)}%`
function verb(x) {
  if (x >= 0.05) return 'עלה'
  if (x <= -0.05) return 'ירד'
  return 'נותר ללא שינוי'
}
function writeNote(lead, sectors, key) {
  if (!lead || lead[key] == null) return null
  const ranked = sectors.filter((s) => s[key] != null).sort((a, b) => b[key] - a[key])
  let text = `${lead.name} ${verb(lead[key])}${Math.abs(lead[key]) >= 0.05 ? ` ב-${Math.abs(lead[key]).toFixed(1)}%` : ''}`
  if (ranked.length >= 2) {
    const top = ranked[0]
    const bottom = ranked[ranked.length - 1]
    if (top[key] > 0) text += `. הסקטור שהוביל את העליות: ${top.sector} (${fmt(top[key])})`
    if (bottom[key] < 0) text += `${top[key] > 0 ? ';' : '.'} הסקטור שהוביל את הירידות: ${bottom.sector} (${fmt(bottom[key])})`
  }
  return text + '.'
}

// ── ריצה ──────────────────────────────────────────────────────────
const t0 = Date.now()
console.log('📊 סיכום מסחר — מתחיל...')

// אחסון ציבורי לקובץ הסיכום (נוצר פעם אחת)
const { data: buckets } = await db.storage.listBuckets()
if (!buckets?.some((b) => b.name === BUCKET)) {
  const { error } = await db.storage.createBucket(BUCKET, { public: true })
  if (error) throw error
  console.log(`🪣 נוצר אחסון ציבורי ${BUCKET}`)
}

const [il, us] = await Promise.all([
  collectIsrael().catch((e) => ({ indices: [], sectorIndices: [], breakdown: {}, errors: [`ישראל: ${e.message}`] })),
  collectUS().catch((e) => ({ indices: [], sectors: [], errors: [`ארה"ב: ${e.message}`] })),
])

const ta35 = il.indices.find((i) => i.id === '142')
const ta35Sectors = il.breakdown['ת"א-35'] ?? []
const spx = us.indices.find((i) => i.symbol === '^GSPC')

const summary = {
  updated_at: new Date().toISOString(),
  il: {
    ...il,
    errors: undefined,
    notes: { d1: writeNote(ta35, ta35Sectors, 'd1'), d7: writeNote(ta35, ta35Sectors, 'd7') },
  },
  us: {
    ...us,
    errors: undefined,
    notes: { d1: writeNote(spx, us.sectors, 'd1'), d7: writeNote(spx, us.sectors, 'd7') },
  },
  errors: [...il.errors, ...us.errors],
}

// שוק שנכשל לגמרי (למשל חסימה זמנית של אתר הבורסה) — לא מוחקים אותו מהדף:
// נשאר הנתון הקודם, מסומן בתאריך העדכון שלו. רק אם שניהם נכשלו — לא כותבים כלל.
if (!il.indices.length && !us.indices.length) {
  console.error('⛔ לא התקבל אף נתון — הקובץ הקיים נשאר ללא שינוי')
  for (const e of summary.errors) console.error('  ', e)
  process.exit(1)
}
const prev = await loadJson('market/summary.json')
for (const m of ['il', 'us']) {
  if (!summary[m].indices.length && prev?.[m]?.indices?.length) {
    summary[m] = { ...prev[m], stale_since: prev[m].stale_since ?? prev.updated_at }
    console.warn(`⚠️ ${m === 'il' ? 'ישראל' : 'ארה"ב'}: נכשל — נשאר הנתון מ-${summary[m].stale_since}`)
  }
}

// --test: כתיבה לקובץ נפרד, כדי שבדיקה ידנית לא תתנגש בריצת הענן
const OUT = process.argv.includes('--test') ? 'market/summary-test.json' : 'market/summary.json'
const { error } = await db.storage.from(BUCKET).upload(OUT, JSON.stringify(summary), {
  upsert: true,
  contentType: 'application/json',
  cacheControl: '60',
})
if (error) throw error

console.log(`✅ ישראל: ${il.indices.length} מדדים, ${il.sectorIndices.length} מדדי ענף, פילוח: ${Object.keys(il.breakdown).join(', ')}`)
console.log(`✅ ארה"ב: ${us.indices.length} מדדים, ${us.sectors.length} סקטורים, פילוח S&P 500: ${us.breakdown ? `${us.breakdown.reduce((a, g) => a + g.stocks.length, 0)} מניות ב-${us.breakdown.length} סקטורים` : 'לא זמין'}`)
if (summary.errors.length) console.warn(`⚠️ ${summary.errors.length} שגיאות:`, summary.errors.slice(0, 5))
console.log('📝', summary.il.notes.d1)
console.log('📝', summary.us.notes.d1)
console.log(`⏱️ ${((Date.now() - t0) / 1000).toFixed(1)} שניות`)
