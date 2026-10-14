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
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'נאסד"ק' },
  { symbol: '^DJI', name: 'דאו ג\'ונס' },
]
// 11 הסקטורים של S&P 500 — קרן הסל הרשמית של כל סקטור משקפת את תשואתו
const US_SECTORS = [
  { symbol: 'XLK', name: 'טכנולוגיה' },
  { symbol: 'XLF', name: 'פיננסים' },
  { symbol: 'XLV', name: 'בריאות' },
  { symbol: 'XLY', name: 'צריכה מחזורית' },
  { symbol: 'XLC', name: 'תקשורת' },
  { symbol: 'XLI', name: 'תעשייה' },
  { symbol: 'XLP', name: 'צריכה בסיסית' },
  { symbol: 'XLE', name: 'אנרגיה' },
  { symbol: 'XLU', name: 'תשתיות' },
  { symbol: 'XLRE', name: 'נדל"ן' },
  { symbol: 'XLB', name: 'חומרים' },
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
      await sleep(150)
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

// היסטוריית מדד → { last, d1, d7, days[] } לפי ימי מסחר בפועל
async function taseIndexHistory(api, id) {
  const h = await api.post('/index/historyeod', { pType: 1, TotalRec: 1, pageNum: 1, oId: id, lang: '0' })
  const rows = (h.Items || []).filter((r) => Number.isFinite(r.CloseRate))
  if (rows.length < 2) throw new Error(`אין היסטוריה למדד ${id}`)
  const days = rows.slice(0, DAYS).map((r) => ({
    date: isoDate(r.TradeDate),
    close: r.CloseRate,
    change: round(pct(r.CloseRate, r.BaseRate)),
  }))
  return {
    date: days[0].date,
    last: rows[0].CloseRate,
    d1: round(pct(rows[0].CloseRate, rows[0].BaseRate)),
    // שער הבסיס של היום הוותיק בחלון = הסגירה שלפני תחילת החלון
    d7: round(pct(rows[0].CloseRate, rows[Math.min(DAYS, rows.length) - 1].BaseRate)),
    days: days.reverse(),
  }
}

// היסטוריית מניה → שינויים יומיים (מותאמים לדיבידנד — שדה Change של הבורסה)
async function taseSecurityChanges(api, securityNumber) {
  const h = await api.post('/security/historyeod', {
    pType: 1,
    TotalRec: 1,
    pageNum: 1,
    oId: String(securityNumber).padStart(8, '0'),
    lang: '0',
  })
  return (h.Items || [])
    .filter((r) => r.IfTraded !== false && Number.isFinite(r.Change))
    .slice(0, DAYS)
    .map((r) => ({ date: isoDate(r.TradeDate), change: r.Change }))
}

// מטמון ענפים — הענף של חברה כמעט לא משתנה, אז לא שולפים אותו בכל ריצה
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
  try {
    // מדדי דגל
    const indices = []
    for (const ix of IL_INDICES) {
      try {
        indices.push({ id: ix.id, name: ix.name, ...(await taseIndexHistory(api, ix.id)) })
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
          const h = await taseIndexHistory(api, ix.IndexId)
          sectorIndices.push({ id: ix.IndexId, name: ix.Text, last: h.last, d1: h.d1, d7: h.d7 })
        } catch (e) {
          errors.push(`מדד ענף ${ix.Text}: ${e.message}`)
        }
      }
    } catch (e) {
      errors.push(`רשימת מדדי ענף: ${e.message}`)
    }

    // פילוח סקטוריאלי בתוך ת"א-35 ות"א-125: ממוצע משוקלל של המניות בכל ענף
    const branchCache = (await loadJson('market/branches.json')) ?? {}
    const changesBySec = new Map()
    const breakdown = {}
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
        if (!changesBySec.has(sec)) {
          try {
            changesBySec.set(sec, await taseSecurityChanges(api, sec))
          } catch (e) {
            changesBySec.set(sec, [])
            errors.push(`היסטוריית ${c.ShortName}: ${e.message}`)
          }
        }
        const ch = changesBySec.get(sec)
        if (!ch.length) continue
        const sector = sectorOf(branchCache[sec])
        const g = groups.get(sector) ?? { sector, weight: 0, w1: 0, w7: 0, stocks: [] }
        const d1 = ch[0].change
        const d7 = compound(ch.map((x) => x.change))
        g.weight += c.Weight
        g.w1 += c.Weight * d1
        g.w7 += c.Weight * d7
        g.stocks.push({ name: c.ShortName, weight: round(c.Weight), d1: round(d1), d7: round(d7) })
        groups.set(sector, g)
      }
      breakdown[name] = [...groups.values()]
        .map((g) => ({
          sector: g.sector,
          weight: round(g.weight, 1),
          d1: round(g.w1 / g.weight),
          d7: round(g.w7 / g.weight),
          stocks: g.stocks.sort((a, b) => b.weight - a.weight),
        }))
        .sort((a, b) => b.weight - a.weight)
    }
    await db.storage.from(BUCKET).upload('market/branches.json', JSON.stringify(branchCache), {
      upsert: true,
      contentType: 'application/json',
    })

    return { indices, sectorIndices, breakdown, errors }
  } finally {
    await browser.close()
  }
}

// ── ארה"ב ─────────────────────────────────────────────────────────
async function yahooHistory(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`Yahoo ${symbol} -> ${r.status}`)
  const res = (await r.json()).chart?.result?.[0]
  if (!res) throw new Error(`Yahoo ${symbol}: אין נתונים`)
  const ts = res.timestamp ?? []
  const closes = res.indicators?.quote?.[0]?.close ?? []
  // ימים עם סגירה בלבד; התאריך לפי שעון ניו יורק
  const rows = ts
    .map((t, i) => ({
      date: new Date(t * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
      close: closes[i],
    }))
    .filter((r) => Number.isFinite(r.close))
  if (rows.length < DAYS + 1) throw new Error(`Yahoo ${symbol}: היסטוריה קצרה מדי`)
  const last = rows.length - 1
  const window = rows.slice(-(DAYS + 1)) // 8 סגירות → 7 שינויים
  return {
    date: rows[last].date,
    last: round(rows[last].close),
    d1: round(pct(rows[last].close, rows[last - 1].close)),
    d7: round(pct(rows[last].close, window[0].close)),
    days: window.slice(1).map((r, i) => ({ date: r.date, close: round(r.close), change: round(pct(r.close, window[i].close)) })),
  }
}

async function collectUS() {
  const errors = []
  const indices = []
  for (const ix of US_INDICES) {
    try {
      indices.push({ symbol: ix.symbol, name: ix.name, ...(await yahooHistory(ix.symbol)) })
    } catch (e) {
      errors.push(e.message)
    }
  }
  const sectors = []
  for (const s of US_SECTORS) {
    try {
      const h = await yahooHistory(s.symbol)
      sectors.push({ symbol: s.symbol, sector: s.name, d1: h.d1, d7: h.d7 })
    } catch (e) {
      errors.push(e.message)
    }
  }
  return { indices, sectors, errors }
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
    if (top[key] > 0) text += `. הבולט לטובה: ${top.sector} (${fmt(top[key])})`
    if (bottom[key] < 0) text += `${top[key] > 0 ? ';' : '.'} הבולט לרעה: ${bottom.sector} (${fmt(bottom[key])})`
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

// אם שני השווקים נכשלו לגמרי — לא דורסים סיכום תקין קודם בקובץ ריק
if (!il.indices.length && !us.indices.length) {
  console.error('⛔ לא התקבל אף נתון — הקובץ הקיים נשאר ללא שינוי')
  for (const e of summary.errors) console.error('  ', e)
  process.exit(1)
}

const { error } = await db.storage.from(BUCKET).upload('market/summary.json', JSON.stringify(summary), {
  upsert: true,
  contentType: 'application/json',
  cacheControl: '60',
})
if (error) throw error

console.log(`✅ ישראל: ${il.indices.length} מדדים, ${il.sectorIndices.length} מדדי ענף, פילוח: ${Object.keys(il.breakdown).join(', ')}`)
console.log(`✅ ארה"ב: ${us.indices.length} מדדים, ${us.sectors.length} סקטורים`)
if (summary.errors.length) console.warn(`⚠️ ${summary.errors.length} שגיאות:`, summary.errors.slice(0, 5))
console.log('📝', summary.il.notes.d1)
console.log('📝', summary.us.notes.d1)
console.log(`⏱️ ${((Date.now() - t0) / 1000).toFixed(1)} שניות`)
