// אינדיקטורים — תמונת מצב-על של השווקים והתנאים הפיננסיים.
// הפלט: market/indicators-v2.json (v2 = מבנה עם מד וגוונים) באחסון הציבורי של Supabase, שדף "אינדיקטורים"
// קורא ישירות. אין טבלה — הכל נגזר מחדש בכל ריצה (חוץ מהיסטוריית פרמיית
// הסיכון, שאין לה מקור היסטורי ולכן נצברת כאן יום אחר יום).
//
// מקורות — רשמיים בלבד, בלי מפתח:
//   Cboe            — קובץ ההיסטוריה הרשמי של VIX
//   FRED (הפד בסנט לואיס) — מרווחי ICE BofA, ריביות ותשואות של מועצת הפד, S&P 500,
//                     ציפיות אינפלציה של הפד בקליבלנד
//   בנק ישראל       — ממשק הסטטיסטיקה הרשמי (ריבית, שער יציג)
//   דמודרן ושילר    — פרמיות סיכון היסטוריות (ERP_LONG)
//
// 27.10.2026: הוסרו ת"א-35 מול ממוצע 200 יום ופרמיית הסיכון המחושבת. שתיהן נשענו
// על markets.mjs — נתוני הבורסה (בלי רישיון הפצה) ומכפילי Yahoo (API לא רשמי) —
// שהושבת. לחידוש: אחרי הסדרת רישיון נתונים (ראה git log).
//
// עיקרון: אף מספר לא מוצג בלי מקור. אינדיקטור שנכשל — נשאר הערך הקודם, מסומן
// בתאריך שלו. לעולם לא מנוחש.
//
// הרצה: node collector/indicators.mjs   (--test כותב לקובץ נפרד)
import AdmZip from 'adm-zip'
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
async function boi(flow, key, minRows = 30) {
  const from = isoAgo(new Date().toISOString().slice(0, 10), 365 * 6)
  const csv = await get(`https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/${flow}/1.0/${key}?startperiod=${from}&format=csv`)
  const [head, ...lines] = csv.trim().split('\n')
  const cols = head.split(',')
  const di = cols.indexOf('TIME_PERIOD')
  const vi = cols.indexOf('OBS_VALUE')
  const rows = lines
    .map((l) => l.split(','))
    // תקופה: יומי "2026-10-23", חודשי "2026-09", רבעוני "2026-Q2" → תאריך תחילת התקופה
    .map((c) => ({
      date: c[di].replace(/^(\d{4})-Q([1-4])$/, (_, y, q) => `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`).replace(/^(\d{4}-\d\d)$/, '$1-01'),
      value: +c[vi],
    }))
    .filter((r) => /^\d{4}-\d\d-\d\d$/.test(r.date) && Number.isFinite(r.value))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  if (rows.length < minRows) throw new Error(`בנק ישראל ${key}: היסטוריה קצרה מדי`)
  return rows
}

// ── קבצי Excel, בלי ספרייה ────────────────────────────────────────
// xlsx (דמודרן) = zip של XML. שומרים על מיקום העמודה (תאים ריקים נשמטים בקובץ).
function xlsxSheet(buf, sheetName) {
  const zip = new AdmZip(buf)
  const xml = (name) => zip.getEntry(name)?.getData().toString('utf8') ?? ''
  const rid = xml('xl/workbook.xml').match(new RegExp(`<sheet [^>]*name="${sheetName}"[^>]*r:id="([^"]+)"`))?.[1]
  const target = rid && xml('xl/_rels/workbook.xml.rels').match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${rid}"`))
  const path = target && `xl/${(target[1] ?? target[2]).replace(/^\/?xl\//, '')}`
  if (!path) throw new Error(`xlsx: אין גיליון "${sheetName}"`)
  const colNum = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
  // קבצים שנשמרו ב-Excel למק סופרים תאריכים מ-1904 ולא מ-1900
  const epoch = Date.UTC(...(/date1904="(1|true)"/.test(xml('xl/workbook.xml')) ? [1904, 0, 1] : [1899, 11, 30]))
  const rows = [...xml(path).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const cells = []
    for (const [, col, attrs, v] of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>[\s\S]*?(?:<v>([^<]*)<\/v>)?[\s\S]*?<\/c>)/g)) {
      if (v != null && !/t="(s|str|inlineStr)"/.test(attrs)) cells[colNum(col)] = Number(v)
    }
    return cells
  })
  return { rows, toDate: (serial) => new Date(epoch + serial * DAY).toISOString().slice(0, 10) }
}

// xls ישן (שילר) = קובץ OLE2 שבתוכו זרם BIFF8. קוראים רק תאים מספריים
// (NUMBER / RK / MULRK / תוצאת FORMULA) של גיליון אחד.
function xlsNumbers(buf, sheetName) {
  const u16 = (o) => buf.readUInt16LE(o)
  const u32 = (o) => buf.readUInt32LE(o)
  const ss = 1 << u16(0x1e)
  const sector = (i) => buf.subarray((i + 1) * ss, (i + 2) * ss)
  // טבלת ה-FAT: 109 הראשונים בכותרת, השאר בשרשרת DIFAT
  const fatIds = []
  for (let i = 0; i < 109; i++) fatIds.push(u32(0x4c + i * 4))
  for (let d = u32(0x44), n = u32(0x48); n-- > 0 && d < 0xfffffffa; ) {
    const s = sector(d)
    for (let i = 0; i < ss / 4 - 1; i++) fatIds.push(s.readUInt32LE(i * 4))
    d = s.readUInt32LE(ss - 4)
  }
  const fat = []
  for (const id of fatIds.slice(0, u32(0x2c))) for (let i = 0, s = sector(id); i < ss / 4; i++) fat.push(s.readUInt32LE(i * 4))
  const stream = (start, size) => {
    const parts = []
    for (let s = start; s < 0xfffffffa && parts.length * ss < size; s = fat[s]) parts.push(sector(s))
    return Buffer.concat(parts).subarray(0, size)
  }
  const dir = stream(u32(0x30), Infinity)
  let wb = null
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const name = dir.subarray(o, o + Math.max(0, dir.readUInt16LE(o + 0x40) - 2)).toString('utf16le')
    if (name === 'Workbook' || name === 'Book') wb = stream(dir.readUInt32LE(o + 0x74), dir.readUInt32LE(o + 0x78))
  }
  if (!wb || wb.length < 4096) throw new Error('xls: אין זרם Workbook')
  // רשימת הגיליונות (BOUNDSHEET) → מיקום הגיליון המבוקש בזרם
  let pos = null
  for (let o = 0; o + 4 <= wb.length; ) {
    const type = wb.readUInt16LE(o)
    const len = wb.readUInt16LE(o + 2)
    if (type === 0x85) {
      const cch = wb[o + 10]
      const wide = wb[o + 11] & 1
      const name = wb.subarray(o + 12, o + 12 + cch * (wide ? 2 : 1)).toString(wide ? 'utf16le' : 'latin1')
      if (name === sheetName) pos = wb.readUInt32LE(o + 4)
    }
    if (type === 0x0a) break // סוף הגלובלים
    o += 4 + len
  }
  if (pos == null) throw new Error(`xls: אין גיליון "${sheetName}"`)
  const rk = (v) => {
    let x
    if (v & 2) x = v >> 2
    else {
      const b = Buffer.alloc(8)
      b.writeUInt32LE(v & 0xfffffffc, 4)
      x = b.readDoubleLE(0)
    }
    return v & 1 ? x / 100 : x
  }
  const cells = {} // `${row},${col}` → מספר
  for (let o = pos; o + 4 <= wb.length; ) {
    const type = wb.readUInt16LE(o)
    const len = wb.readUInt16LE(o + 2)
    const d = o + 4
    if (type === 0x203) cells[`${wb.readUInt16LE(d)},${wb.readUInt16LE(d + 2)}`] = wb.readDoubleLE(d + 6)
    else if (type === 0x27e) cells[`${wb.readUInt16LE(d)},${wb.readUInt16LE(d + 2)}`] = rk(wb.readUInt32LE(d + 6))
    else if (type === 0xbd) {
      const row = wb.readUInt16LE(d)
      const first = wb.readUInt16LE(d + 2)
      const n = (len - 6) / 6
      for (let i = 0; i < n; i++) cells[`${row},${first + i}`] = rk(wb.readUInt32LE(d + 4 + i * 6 + 2))
    } else if (type === 0x06 && wb.readUInt16LE(d + 12) !== 0xffff) cells[`${wb.readUInt16LE(d)},${wb.readUInt16LE(d + 2)}`] = wb.readDoubleLE(d + 6)
    else if (type === 0x0a) break
    o += 4 + len
  }
  return cells
}

// ── פרמיות סיכון היסטוריות (חודשי) ────────────────────────────────
// דמודרן: פרמיית הסיכון הגלומה מול אג"ח 10 שנים, עמודת "ERP (T12m)" — המספר
// שהוא מפרסם כל חודש. תאריכים כמספר סידורי של Excel.
async function damodaran() {
  const r = await fetch('https://pages.stern.nyu.edu/~adamodar/pc/implprem/ERPbymonth.xlsx', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })
  if (!r.ok) throw new Error(`דמודרן: ${r.status}`)
  const { rows, toDate } = xlsxSheet(Buffer.from(await r.arrayBuffer()), 'Historical ERP')
  const out = rows.filter((c) => c[0] > 30000 && Number.isFinite(c[9])).map((c) => ({ date: toDate(c[0]), value: c[9] * 100 }))
  if (out.length < 100 || out.some((x) => x.value < -5 || x.value > 20)) throw new Error('דמודרן: מבנה הקובץ השתנה')
  return out
}

// שילר: Excess CAPE Yield, גיליון Data עמודה Q (16). תאריך בפורמט 2026.1 = אוקטובר.
// הכתובת של הקובץ משתנה בכל עדכון — נלקחת מדף הבית.
async function shiller() {
  const home = await get('https://shillerdata.com/')
  const href = home.match(/href="([^"]*ie_data\.xls[^"]*)"/)?.[1]
  if (!href) throw new Error('שילר: לא נמצא קישור לקובץ')
  const r = await fetch(href.startsWith('//') ? `https:${href}` : href, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })
  if (!r.ok) throw new Error(`שילר: ${r.status}`)
  const cells = xlsNumbers(Buffer.from(await r.arrayBuffer()), 'Data')
  const out = []
  for (let row = 0; row < 5000; row++) {
    const t = cells[`${row},0`]
    const v = cells[`${row},16`]
    if (!(t > 1800) || !Number.isFinite(v)) continue
    const y = Math.floor(t)
    const m = Math.round((t - y) * 100)
    out.push({ date: `${y}-${String(m).padStart(2, '0')}-01`, value: v * 100 })
  }
  if (out.length < 1000 || out.some((x) => x.value < -10 || x.value > 30) || out.some((x, i) => i && x.date <= out[i - 1].date)) throw new Error('שילר: מבנה הקובץ השתנה')
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

// מרחק המדד מהממוצע הנע של 200 ימי מסחר — בסטיות תקן (z), כמו רצועות בולינגר:
// (סגירה − ממוצע) ÷ סטיית התקן של הסגירות באותו חלון. כך מרחק של 5% במדד
// תנודתי ובמדד רגוע לא נראים זהים. dist = אותו מרחק באחוזים, להקשר.
function vsMA200(closes) {
  const out = []
  let sum = 0
  let sq = 0
  for (let i = 0; i < closes.length; i++) {
    const v = closes[i].value
    sum += v
    sq += v * v
    if (i >= 200) {
      sum -= closes[i - 200].value
      sq -= closes[i - 200].value ** 2
    }
    if (i >= 199) {
      const ma = sum / 200
      const sd = Math.sqrt(Math.max(0, sq / 200 - ma * ma))
      out.push({ date: closes[i].date, value: sd ? (v - ma) / sd : 0, dist: (v / ma - 1) * 100, close: v, ma })
    }
  }
  return out
}

// ── הגדרת האינדיקטורים ────────────────────────────────────────────
// כל אינדיקטור מקבל מיקום על מד (gauge) של 0–100: 0 = הקצה האדום (לחץ / תנאים
// מהדקים לשוק), 100 = הקצה הירוק. שלושה אזורים: 0–33, 33–67, 67–100.
//   kind 'pct'   — המיקום = אחוזון הערך מתוך החלון ההיסטורי (years), הפוך:
//                  ערך גבוה = אדום (VIX, מרווחים, ריביות).
//                  dir 'none' — אין טוב או רע (דולר-שקל): מד בלי צבע.
//   kind 'trend' — מרחק מממוצע 200 יום בסטיות תקן: ±1 ס"ת = גבול האזור.
//   kind 'curve' — שיפוע העקום: 0 = גבול הפוך/שטוח, 1% = גבול שטוח/חיובי.
// zones — שמות שלושת האזורים, משמאל (אדום) לימין (ירוק).
// מרווחי ICE BofA: FRED מפרסם בחינם רק 3 שנים, ולכן השמות "גבוה/נמוך" ולא
// "לחוץ/רגוע" — שלוש שנים רגועות לא מספיקות כדי לקרוא לרמה "לחץ".
// unit: pct = אחוזים (שינוי בנ"ב), pp = אחוזים (שינוי בנקודות אחוז — מאקרו), pts = נקודות,
// ils = שקלים (שינוי ב-%), z = סטיות תקן
const FRED_URL = (id) => `https://fred.stlouisfed.org/series/${id}`
const H15 = 'מועצת הפדרל ריזרב, דרך FRED'
const ICE = 'ICE Data Indices, דרך FRED'
const RATE_ZONES = ['גבוה', 'בינוני', 'נמוך']
const MA_ZONES = ['מתחת לממוצע', 'סביב הממוצע', 'מעל הממוצע']
const MA_WHAT = 'המרחק מהממוצע של 200 ימי המסחר האחרונים, בסטיות תקן של אותה תקופה. מעל 1 או מתחת ל-1- = מגמה ברורה.'

const INDICATORS = [
  {
    id: 'vix', group: 'risk', name: 'מדד הפחד', nick: 'VIX · Fear Index', official: 'Cboe Volatility Index', code: 'VIX',
    nickHe: 'מדד התנודתיות · מדד הפחד',
    term: 'VIX = Volatility Index, מדד התנודתיות. מחושב ממחירי אופציות על S&P 500, ומכונה "מדד הפחד" כי הוא מזנק כשמשקיעים ממהרים לקנות הגנה מירידות.',
    valueHelp: 'נקודות מדד. VIX של 20 פירושו שהשוק מתמחר תנודה שנתית של כ-20% — כ-1.25% ביום.',
    org: 'Cboe', url: 'https://www.cboe.com/tradable_products/vix/', unit: 'pts', kind: 'pct', years: 5, maxAge: 7,
    zones: ['לחוץ', 'תקין', 'רגוע'],
    what: 'התנודתיות שהשוק מתמחר ב-S&P 500 ל-30 הימים הקרובים, מתוך מחירי האופציות.',
    fetch: () => cboe('VIX'),
  },
  {
    id: 'spx200', group: 'risk', name: 'S&P 500 מול ממוצע 200 יום', nick: '200DMA', official: 'S&P 500 Index vs. 200-day moving average', code: 'SP500',
    nickHe: 'ממוצע נע 200 יום',
    term: '200-Day Moving Average — הממוצע של מחירי הסגירה ב-200 ימי המסחר האחרונים (כ-10 חודשים). מדד שנסחר מעליו נחשב במגמה ארוכה עולה, ומתחתיו — יורדת.',
    valueHelp: 'סטיות תקן: המרחק מהממוצע חלקי התנודתיות הרגילה של המדד באותם 200 יום. 0 = על הממוצע; 1 או 1- = מרחק משמעותי; 2 או 2- = קיצוני.',
    org: 'S&P Dow Jones Indices, דרך FRED', url: FRED_URL('SP500'), unit: 'z', kind: 'trend', maxAge: 7, zones: MA_ZONES, what: MA_WHAT,
    // FRED מתעדכן ביום-יומיים איחור — מקובל למדד מגמה של 200 יום
    fetch: async () => vsMA200(await fred('SP500')),
  },
  {
    id: 'hy', group: 'credit', name: 'מרווח אג"ח בדירוג נמוך', nick: 'Junk Spread · HY OAS', official: 'ICE BofA US High Yield Index Option-Adjusted Spread', code: 'BAMLH0A0HYM2',
    nickHe: 'מרווח הזבל · מרווח תשואה גבוהה',
    term: 'High Yield (תשואה גבוהה) = אג"ח של חברות בדירוג נמוך מ-BBB-, המכונות "אג"ח זבל". OAS = Option-Adjusted Spread, מרווח מתוקנן לאופציות של פדיון מוקדם.',
    valueHelp: 'אחוזים מעל אג"ח ממשלת ארה"ב באותו מח"מ. 1% = 100 נקודות בסיס (נ״ב).',
    org: ICE, url: FRED_URL('BAMLH0A0HYM2'), unit: 'pct', kind: 'pct', years: 3, maxAge: 7, zones: RATE_ZONES,
    what: 'התוספת שחברות בדירוג נמוך משלמות מעל אג"ח ממשלת ארה"ב. עלייה = המלווים דורשים יותר על הסיכון.',
    fetch: () => fred('BAMLH0A0HYM2'),
  },
  {
    id: 'ig', group: 'credit', name: 'מרווח אג"ח בדירוג השקעה', nick: 'IG OAS', official: 'ICE BofA US Corporate Index Option-Adjusted Spread', code: 'BAMLC0A0CM',
    nickHe: 'מרווח דירוג השקעה',
    term: 'Investment Grade (דירוג השקעה) = אג"ח בדירוג BBB- ומעלה. OAS = Option-Adjusted Spread, מרווח מתוקנן לאופציות של פדיון מוקדם.',
    valueHelp: 'אחוזים מעל אג"ח ממשלת ארה"ב באותו מח"מ. 1% = 100 נקודות בסיס (נ״ב).',
    org: ICE, url: FRED_URL('BAMLC0A0CM'), unit: 'pct', kind: 'pct', years: 3, maxAge: 7, zones: RATE_ZONES,
    what: 'התוספת שחברות בדירוג השקעה משלמות מעל אג"ח ממשלת ארה"ב.',
    fetch: () => fred('BAMLC0A0CM'),
  },
  {
    id: 'ff', group: 'rates', name: 'ריבית הפד', nick: 'Fed Funds', official: 'Federal Funds Effective Rate', code: 'DFF',
    nickHe: 'ריבית הפדרל פאנדס',
    term: 'Federal Funds Rate — הריבית שבה בנקים בארה"ב מלווים זה לזה ללילה אחד. הפד קובע לה טווח יעד; Effective = הריבית שנסחרה בפועל.',
    valueHelp: 'אחוזים בשנה.',
    org: H15, url: FRED_URL('DFF'), unit: 'pct', kind: 'pct', years: 5, maxAge: 7, zones: RATE_ZONES,
    what: 'הריבית בפועל על הלוואות לילה בין בנקים בארה"ב — הכלי המרכזי של הפד.',
    fetch: () => fred('DFF'),
  },
  {
    id: 'us2', group: 'rates', name: 'תשואת אג"ח ארה"ב ל-2 שנים', nick: '2Y Treasury', official: 'Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity', code: 'DGS2',
    nickHe: 'אג"ח ממשלת ארה"ב לשנתיים',
    term: 'Treasury = אג"ח של משרד האוצר האמריקאי. Constant Maturity = תשואה מחושבת למח"מ קבוע של שנתיים בדיוק, גם כשאין אג"ח שנפדה בדיוק אז.',
    valueHelp: 'התשואה לפדיון, באחוזים בשנה.',
    org: H15, url: FRED_URL('DGS2'), unit: 'pct', kind: 'pct', years: 5, maxAge: 7, zones: RATE_ZONES,
    what: 'משקפת בעיקר את ציפיות השוק לריבית הפד בשנתיים הקרובות.',
    fetch: () => fred('DGS2'),
  },
  {
    id: 'us10', group: 'rates', name: 'תשואת אג"ח ארה"ב ל-10 שנים', nick: '10Y Treasury', official: 'Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity', code: 'DGS10',
    nickHe: 'אג"ח ממשלת ארה"ב ל-10 שנים',
    term: 'Treasury = אג"ח של משרד האוצר האמריקאי. Constant Maturity = תשואה מחושבת למח"מ קבוע של 10 שנים בדיוק, גם כשאין אג"ח שנפדה בדיוק אז.',
    valueHelp: 'התשואה לפדיון, באחוזים בשנה.',
    org: H15, url: FRED_URL('DGS10'), unit: 'pct', kind: 'pct', years: 5, maxAge: 7, zones: RATE_ZONES,
    what: 'ריבית העוגן של העולם — משמשת להיוון כמעט כל נכס.',
    fetch: () => fred('DGS10'),
  },
  {
    id: 'curve', group: 'rates', name: 'שיפוע העקום: 10 מול 2 שנים', nick: '2s10s', official: '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity', code: 'T10Y2Y',
    nickHe: 'שנתיים-עשר',
    term: '2s10s ("twos-tens") — הפרש התשואות בין אג"ח ל-10 שנים לאג"ח לשנתיים. כשהוא שלילי העקום "הפוך": הריבית הקצרה גבוהה מהארוכה.',
    valueHelp: 'נקודות אחוז: תשואת ה-10 שנים פחות תשואת השנתיים.',
    org: 'הפד בסנט לואיס (FRED)', url: FRED_URL('T10Y2Y'), unit: 'pct', kind: 'curve', maxAge: 7, zones: ['הפוך', 'שטוח', 'חיובי'],
    what: 'הפרש התשואות בין 10 ל-2 שנים. שלילי = עקום הפוך, שקדם היסטורית למיתונים.',
    fetch: () => fred('T10Y2Y'),
  },
  {
    id: 'bei', group: 'rates', name: 'ציפיות אינפלציה ל-10 שנים', nick: 'Breakeven 10Y', official: '10-Year Breakeven Inflation Rate', code: 'T10YIE',
    nickHe: 'נקודת האיזון ל-10 שנים',
    term: 'Breakeven (נקודת איזון) = שיעור האינפלציה שבו אג"ח רגיל ואג"ח צמוד מניבים בדיוק אותו דבר — כלומר האינפלציה שהשוק מתמחר.',
    valueHelp: 'אחוזי אינפלציה בשנה, בממוצע ל-10 השנים הקרובות.',
    org: 'הפד בסנט לואיס (FRED)', url: FRED_URL('T10YIE'), unit: 'pct', kind: 'pct', years: 5, maxAge: 7, zones: RATE_ZONES,
    what: 'האינפלציה השנתית שהשוק מתמחר — הפער בין אג"ח רגיל לאג"ח צמוד. יעד הפד: 2%.',
    fetch: () => fred('T10YIE'),
  },
  {
    id: 'real10', group: 'rates', name: 'ריבית ריאלית ל-10 שנים', nick: 'TIPS 10Y', official: 'Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity, Inflation-Indexed', code: 'DFII10',
    nickHe: 'אג"ח צמוד מדד ל-10 שנים',
    term: 'TIPS = Treasury Inflation-Protected Securities — אג"ח ממשלת ארה"ב שהקרן שלהן צמודה למדד המחירים. התשואה שלהן היא הריבית הריאלית.',
    valueHelp: 'אחוזים בשנה, מעל האינפלציה.',
    org: H15, url: FRED_URL('DFII10'), unit: 'pct', kind: 'pct', years: 5, maxAge: 7, zones: RATE_ZONES,
    what: 'התשואה על אג"ח ממשלתי צמוד (TIPS) — מחיר הכסף אחרי אינפלציה.',
    fetch: () => fred('DFII10'),
  },
  {
    id: 'boi', group: 'israel', name: 'ריבית בנק ישראל', nick: 'BoI Rate', official: 'Bank of Israel interest rate', code: 'MNT_RIB_BOI_D',
    nickHe: 'ריבית בנק ישראל',
    term: 'הריבית שבנק ישראל משלם ולוקח מהבנקים על פיקדונות והלוואות קצרים. הוועדה המוניטרית קובעת אותה 8 פעמים בשנה.',
    valueHelp: 'אחוזים בשנה.',
    org: 'בנק ישראל', url: 'https://www.boi.org.il/roles/monetarypolicy/', unit: 'pct', kind: 'pct', years: 5, maxAge: 7, zones: RATE_ZONES,
    what: 'הריבית שקובעת הוועדה המוניטרית של בנק ישראל.',
    fetch: () => boi('BR', 'MNT_RIB_BOI_D'),
  },
  {
    id: 'usdils', group: 'israel', name: 'שער יציג דולר-שקל', nick: 'USD/ILS', official: 'Representative exchange rate USD/ILS', code: 'RER_USD_ILS',
    nickHe: 'דולר-שקל',
    term: 'שער יציג — שער החליפין הרשמי שבנק ישראל קובע בכל יום עסקים לפי המסחר בין הבנקים. משמש בחוזים, בדיווחים ובהצמדות.',
    valueHelp: 'שקלים לדולר אחד.',
    org: 'בנק ישראל', url: 'https://www.boi.org.il/roles/markets/exchangerates/', unit: 'ils', kind: 'pct', dir: 'none', years: 5, maxAge: 7,
    zones: ['שקל חלש', 'בינוני', 'שקל חזק'],
    what: 'השער היציג של בנק ישראל. אין כאן טוב או רע: שקל חזק פוגע ביצואנים, שקל חלש מייקר את המחירים.',
    fetch: () => boi('EXR', 'RER_USD_ILS'),
  },
  // ── מאקרו (חודשי/רבעוני). kind 'target' — מרחק מיעד האינפלציה של הפד (2%);
  // kind 'growth' — צמיחת התוצר: 0% = גבול התכווצות/חלשה, 3% = גבול מתונה/חזקה.
  {
    id: 'cpi', group: 'macro', name: 'אינפלציה שנתית', nick: 'CPI YoY', nickHe: 'מדד המחירים לצרכן, שנתי',
    official: 'Consumer Price Index for All Urban Consumers: All Items, change from a year ago', code: 'CPIAUCNS',
    term: 'CPI = Consumer Price Index, מדד המחירים לצרכן של הלשכה האמריקאית לסטטיסטיקה של העבודה (BLS). YoY = Year over Year, השינוי לעומת אותו חודש לפני שנה — הנתון שמתפרסם בכותרות.',
    valueHelp: 'עליית המחירים ב-12 החודשים האחרונים, באחוזים. יעד הפד: 2%.',
    org: 'הלשכה לסטטיסטיקה של העבודה (BLS), דרך FRED', url: FRED_URL('CPIAUCNS'), unit: 'pp', kind: 'target', period: 'month', maxAge: 80, sparkYears: 3,
    zones: ['רחוק מהיעד', 'קרוב ליעד', 'ביעד'],
    what: 'כמה עלו המחירים לצרכן בארה"ב בשנה האחרונה. המד: ככל שהאינפלציה קרובה יותר ליעד של 2% — ירוק יותר.',
    fetch: async () => {
      // אחוז שינוי שנתי מתוך המדד החודשי (לא מנוכה עונתיות — כמו הנתון הרשמי)
      const idx = await fred('CPIAUCNS')
      const at = Object.fromEntries(idx.map((r) => [r.date, r.value]))
      return idx
        .map((r) => {
          const prev = at[`${+r.date.slice(0, 4) - 1}${r.date.slice(4)}`]
          return prev ? { date: r.date, value: (r.value / prev - 1) * 100 } : null
        })
        .filter(Boolean)
    },
  },
  {
    id: 'exp1y', group: 'macro', name: 'תחזית אינפלציה לשנה קדימה', nick: 'Expected Inflation 1Y', nickHe: 'ציפיות אינפלציה לשנה',
    official: '1-Year Expected Inflation (Federal Reserve Bank of Cleveland)', code: 'EXPINF1YR',
    term: 'מודל של הפד בקליבלנד שמשלב תשואות אג"ח, נתוני אינפלציה, תחזיות של חזאים מקצועיים ומחירי חוזי החלפה — ומחלץ מהם את האינפלציה הצפויה ב-12 החודשים הקרובים.',
    valueHelp: 'אינפלציה צפויה ב-12 החודשים הקרובים, באחוזים. יעד הפד: 2%.',
    org: 'הפד בקליבלנד, דרך FRED', url: FRED_URL('EXPINF1YR'), unit: 'pp', kind: 'target', period: 'month', maxAge: 80, sparkYears: 3,
    zones: ['רחוק מהיעד', 'קרוב ליעד', 'ביעד'],
    what: 'האינפלציה שצפויה בארה"ב בשנה הקרובה. מתעדכן פעם בחודש.',
    fetch: () => fred('EXPINF1YR'),
  },
  {
    id: 'gdp', group: 'macro', name: 'צמיחת התוצר האמריקאי', nick: 'Real GDP Growth', nickHe: 'צמיחת התוצר הריאלי',
    official: 'Real Gross Domestic Product, Percent Change from Preceding Period, Seasonally Adjusted Annual Rate', code: 'A191RL1Q225SBEA',
    term: 'GDP = Gross Domestic Product, התוצר המקומי הגולמי — שווי כל הסחורות והשירותים שהמשק מייצר. Real = במחירים קבועים, בניכוי אינפלציה. מתפרסם בידי הלשכה לניתוח כלכלי (BEA).',
    valueHelp: 'הצמיחה ברבעון האחרון לעומת הרבעון שלפניו, בקצב שנתי (כפי שמקובל בארה"ב) ובניכוי עונתיות. 2% ≈ קצב הצמיחה הארוך של המשק.',
    org: 'הלשכה לניתוח כלכלי (BEA), דרך FRED', url: FRED_URL('A191RL1Q225SBEA'), unit: 'pp', kind: 'growth', period: 'quarter', maxAge: 240, sparkYears: 5,
    zones: ['חלשה', 'מתונה', 'חזקה'],
    what: 'קצב הצמיחה של כלכלת ארה"ב ברבעון האחרון. שלילי = המשק מתכווץ.',
    fetch: () => fred('A191RL1Q225SBEA'),
    extra: async () => gdpViews(await fred('GDPC1'), 'GDPC1'),
  },
]

// מאקרו ישראל — נתוני הלמ"ס ובנק ישראל, דרך ממשק בנק ישראל
INDICATORS.push(
  {
    id: 'cpi_il', group: 'macro_il', name: 'אינפלציה שנתית', nick: 'CPI YoY', nickHe: 'מדד המחירים לצרכן, שנתי',
    official: 'Consumer Price Index — General, change over 12 months', code: 'CP_PCHYTY',
    term: 'מדד המחירים לצרכן של הלשכה המרכזית לסטטיסטיקה (למ"ס) — המדד הכללי. YoY = Year over Year, השינוי לעומת אותו חודש לפני שנה.',
    valueHelp: 'עליית המחירים ב-12 החודשים האחרונים, באחוזים. יעד בנק ישראל: בין 1% ל-3%.',
    org: 'הלשכה המרכזית לסטטיסטיקה, דרך בנק ישראל', url: 'https://www.cbs.gov.il/he/subjects/Pages/מדד-המחירים-לצרכן.aspx', unit: 'pp', kind: 'target', period: 'month', maxAge: 80, sparkYears: 3,
    zones: ['רחוק מהיעד', 'קרוב ליעד', 'ביעד'],
    what: 'כמה עלו המחירים לצרכן בישראל בשנה האחרונה. המד: ככל שהאינפלציה קרובה יותר ל-2%, אמצע היעד — ירוק יותר.',
    fetch: () => boi('PRI', 'CP_PCHYTY'),
  },
  {
    id: 'exp1y_il', group: 'macro_il', name: 'תחזית אינפלציה לשנה קדימה', nick: 'Forecasters 1Y', nickHe: 'ממוצע תחזיות החזאים',
    official: 'Inflation expectations, 1 year ahead — average of professional forecasters', code: 'EXP_HAZ_MAD_AVG_01Y_MA',
    term: 'ממוצע התחזיות של החזאים המקצועיים (בנקים, בתי השקעות) לאינפלציה ב-12 החודשים הקרובים, כפי שבנק ישראל מרכז ומפרסם.',
    valueHelp: 'אינפלציה צפויה ב-12 החודשים הקרובים, באחוזים. יעד בנק ישראל: בין 1% ל-3%.',
    org: 'בנק ישראל', url: 'https://www.boi.org.il/roles/statistics/', unit: 'pp', kind: 'target', period: 'month', maxAge: 80, sparkYears: 3,
    zones: ['רחוק מהיעד', 'קרוב ליעד', 'ביעד'],
    what: 'האינפלציה שהחזאים צופים בישראל בשנה הקרובה. מתעדכן פעם בחודש.',
    fetch: () => boi('ZCM', 'EXP_HAZ_MAD_AVG_01Y_MA'),
  },
  {
    id: 'gdp_il', group: 'macro_il', name: 'צמיחת התוצר הישראלי', nick: 'Real GDP Growth', nickHe: 'צמיחת התוצר הריאלי',
    official: 'GDP at constant prices, seasonally adjusted, annualized quarterly change', code: 'GDP_Q_FP_SA_ANNPCH',
    term: 'התוצר המקומי הגולמי (GDP) — שווי כל הסחורות והשירותים שהמשק מייצר, במחירים קבועים (בניכוי אינפלציה). מתפרסם בידי הלמ"ס.',
    valueHelp: 'הצמיחה ברבעון האחרון לעומת הרבעון שלפניו, בקצב שנתי ובניכוי עונתיות. ברבעון בודד הנתון תנודתי — למשל התאוששות אחרי רבעון חלש.',
    org: 'הלשכה המרכזית לסטטיסטיקה, דרך בנק ישראל', url: 'https://www.cbs.gov.il/he/subjects/Pages/חשבונות-לאומיים.aspx', unit: 'pp', kind: 'growth', period: 'quarter', maxAge: 240, sparkYears: 5,
    zones: ['חלשה', 'מתונה', 'חזקה'],
    what: 'קצב הצמיחה של כלכלת ישראל ברבעון האחרון. שלילי = המשק מתכווץ.',
    fetch: () => boi('NA', 'GDP_Q_FP_SA_ANNPCH', 12), // רבעוני: 6 שנים = 24 נקודות
    extra: async () => gdpViews(await boi('NA', 'GDP_Q_FP_SA', 12), 'GDP_Q_FP_SA'),
  },
)

const GROUPS = [
  { id: 'macro', title: 'מאקרו — ארה"ב' },
  { id: 'macro_il', title: 'מאקרו — ישראל' },
  { id: 'risk', title: 'פחד ומגמה' },
  { id: 'credit', title: 'אשראי' },
  { id: 'rates', title: 'ריביות ועקום התשואות — ארה"ב' },
  { id: 'israel', title: 'ישראל' },
]

// ── צמיחה: שני מבטים יציבים יותר מהנתון הרבעוני בקצב שנתי ─────────────
// מתוך רמת התוצר הריאלי (מנוכה עונתיות). רבעון בודד בקצב שנתי מגדיל כל תנודה
// פי 4 — אחרי רבעון חלש (מלחמה) הוא מזנק. לכן לצדו:
//   שנתי — הרבעון האחרון מול אותו רבעון אשתקד
//   מחצית — שני הרבעונים האחרונים מול השניים שלפניהם, בקצב שנתי (ההשוואה
//           שהלמ"ס ממליצה עליה בתקופה של שתי מלחמות)
function gdpViews(levels, code) {
  const v = levels.map((r) => r.value)
  const n = v.length
  if (n < 5) throw new Error(`${code}: פחות מ-5 רבעונים`)
  const q = (iso) => ({ y: iso.slice(0, 4), h: +iso.slice(5, 7) <= 6 ? 1 : 2, q: Math.floor((+iso.slice(5, 7) - 1) / 3) + 1 })
  const last = q(levels[n - 1].date)
  const yoy = (v[n - 1] / v[n - 5] - 1) * 100
  const half = (((v[n - 1] + v[n - 2]) / (v[n - 3] + v[n - 4])) ** 2 - 1) * 100
  // רבעון 2 / 4 → מחצית קלנדרית; אחרת — שני רבעונים מתגלגלים
  const halfLabel =
    last.q % 2 === 0 ? `מחצית ${last.h} ${last.y} מול מחצית ${last.h === 1 ? 2 : 1} ${last.h === 1 ? +last.y - 1 : last.y}` : 'שני הרבעונים האחרונים מול השניים שלפניהם'
  return [
    {
      id: 'yoy',
      label: 'מול הרבעון המקביל אשתקד',
      value: round(yoy),
      help: `רבעון ${last.q} ${last.y} מול רבעון ${last.q} ${+last.y - 1}: הצמיחה בשנה שלמה, בלי הכפלה לקצב שנתי. פחות רגיש לרבעון חריג אחד.`,
    },
    {
      id: 'half',
      label: halfLabel,
      value: round(half),
      help: `${halfLabel}, בקצב שנתי. ממצע שני רבעונים מול שניים — ההשוואה שהלמ"ס ממליצה עליה כשרבעון בודד מעוות בגלל מלחמה או אירוע חד-פעמי.`,
    },
  ]
}

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
  if (unit === 'pp') return round(now - then) // נקודות אחוז (נתוני מאקרו)
  return round(now - then) // נקודות / סטיות תקן
}

const clamp = (x) => Math.max(0, Math.min(100, x))

// התקופה שהנתון מתאר — "ספטמבר 2026" / "רבעון 2 2026" (התאריך ב-FRED הוא תחילת התקופה)
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const periodOf = (kind, iso) =>
  kind === 'quarter' ? `רבעון ${Math.floor((+iso.slice(5, 7) - 1) / 3) + 1} ${iso.slice(0, 4)}` : `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`

// מיקום על המד (0 = אדום, 100 = ירוק)
function gaugeOf(spec, value, pct) {
  if (spec.kind === 'trend') return clamp(50 + 17 * value) // ±1 ס"ת = 33/67
  if (spec.kind === 'curve') return clamp(33 + 34 * value) // 0% = 33, 1% = 67
  if (spec.kind === 'target') return clamp(100 - 50 * Math.abs(value - 2)) // 2% = 100; ±0.66 = 67; ±1.34 = 33
  if (spec.kind === 'growth') return clamp(33 + 11.33 * value) // 0% = 33, 3% = 67
  if (pct == null) return null
  return spec.dir === 'up-good' ? pct : 100 - pct // בדרך כלל ערך גבוה = שמאלה; בפרמיית סיכון — ימינה
}

// שבעה גוונים — מאדום חזק (-3) דרך ניטרלי (0) לירוק חזק (3)
function shadeOf(g) {
  if (g < 10) return -3
  if (g < 25) return -2
  if (g < 40) return -1
  if (g <= 60) return 0
  if (g <= 75) return 1
  if (g <= 90) return 2
  return 3
}
const zoneOf = (g) => (g < 33 ? 0 : g < 67 ? 1 : 2)

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
  let pct = null
  let years = null
  let min = null
  let max = null
  if (spec.kind === 'pct') {
    const window = rows.filter((r) => r.date >= isoAgo(last.date, 365 * spec.years))
    // אחוזון רק כשיש היסטוריה מלאה לחלון — אחוזון על חצי שנה מתחזה לתמונה ארוכה
    if (rows[0].date <= isoAgo(last.date, 365 * spec.years - 10)) {
      pct = round((window.filter((r) => r.value <= last.value).length / window.length) * 100, 0)
      years = spec.years
      min = round(Math.min(...window.map((r) => r.value)), 3)
      max = round(Math.max(...window.map((r) => r.value)), 3)
    }
  }
  const g = gaugeOf(spec, last.value, pct)
  return {
    id: spec.id,
    group: spec.group,
    name: spec.name,
    nick: spec.nick,
    nickHe: spec.nickHe,
    term: spec.term,
    valueHelp: spec.valueHelp,
    official: spec.official,
    code: spec.code,
    org: spec.org,
    url: spec.url,
    what: spec.what,
    unit: spec.unit,
    kind: spec.kind,
    date: last.date,
    ...(spec.period ? { period: periodOf(spec.period, last.date) } : {}),
    value: round(last.value, spec.unit === 'ils' ? 3 : 2),
    ...(last.close != null ? { close: round(last.close), ma: round(last.ma), dist: round(last.dist) } : {}),
    // נתון חודשי/רבעוני — מול התצפית הקודמת (החודש/הרבעון הקודם); יומי — מול לפני 30 יום
    ch1m: change(spec.unit, last.value, spec.period ? rows[rows.length - 2]?.value : valueAt(rows, isoAgo(last.date, 30))),
    ...(spec.period ? { prevLabel: spec.period === 'quarter' ? 'רבעון קודם' : 'חודש קודם' } : {}),
    ch1y: change(spec.unit, last.value, valueAt(rows, isoAgo(last.date, 365))),
    years,
    min,
    max,
    pct,
    zones: spec.zones,
    gauge: g == null ? null : round(g, 0),
    // dir 'none' — המד מראה מיקום, בלי צבע
    shade: g == null || spec.dir === 'none' ? 0 : shadeOf(g),
    neutral: spec.dir === 'none' || undefined,
    reading: g == null ? null : spec.zones[zoneOf(g)],
    spark: spark(rows, isoAgo(last.date, 365 * (spec.sparkYears ?? 1))),
  }
}


// ── מד מצב-על — נגזר מהמספרים בלבד, בלי AI ─────────────────────────
// ממוצע המיקום של האינדיקטורים שיש להם כיוון ברור והיסטוריה מלאה: פחד (5 שנים),
// מגמת S&P 500, עקום. מרווחי האשראי בחוץ — 3 שנים זה חלון קצר מדי.
const CORE = ['vix', 'spx200', 'curve']
const OVERALL_ZONES = ['לחוצים', 'מעורבים', 'רגועים']
function overall(items) {
  const by = Object.fromEntries(items.map((i) => [i.id, i]))
  const core = CORE.map((k) => by[k]).filter((i) => i?.gauge != null && !i.stale)
  if (core.length < 2) return null
  const g = round(core.reduce((a, i) => a + i.gauge, 0) / core.length, 0)
  const sgn = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}`
  const ma = (i, name) => `${name} ${i.value >= 0 ? 'מעל ' : 'מתחת ל'}ממוצע 200 יום (${sgn(i.value)} סטיות תקן, ${sgn(i.dist)}%)`
  const parts = []
  if (by.vix?.pct != null) parts.push(`מדד הפחד VIX עומד על ${by.vix.value.toFixed(2)} — גבוה מ-${by.vix.pct}% מהימים ב-5 השנים האחרונות`)
  if (by.spx200?.dist != null) parts.push(ma(by.spx200, 'S&P 500'))
  if (by.curve) parts.push(`עקום התשואות ${by.curve.reading} (10 מול 2 שנים: ${by.curve.value > 0 ? '+' : ''}${by.curve.value.toFixed(2)})`)
  return {
    gauge: g,
    shade: shadeOf(g),
    zones: OVERALL_ZONES,
    reading: OVERALL_ZONES[zoneOf(g)],
    parts: core.map((i) => ({ name: i.name, gauge: i.gauge })),
    text: `${parts.join('; ')}.`,
  }
}

// ── ריצה ──────────────────────────────────────────────────────────
const t0 = Date.now()
console.log('🧭 אינדיקטורים — מתחיל...')

const prev = await loadJson('market/indicators-v2.json')

const errors = []
const items = []
const today = new Date().toISOString().slice(0, 10)
for (const spec of INDICATORS) {
  try {
    const it = build(spec, await spec.fetch())
    // מבטים משלימים (צמיחה שנתית / מחצית) — כישלון בהם לא מפיל את האינדיקטור
    if (spec.extra) {
      try {
        it.extra = await spec.extra()
      } catch (e) {
        errors.push(`${spec.name} (מבטים משלימים): ${e.message}`)
      }
    }
    // מקור שהפסיק להתעדכן — מוצג, אבל מסומן
    if ((Date.parse(today) - Date.parse(it.date)) / DAY > spec.maxAge) it.stale = true
    items.push(it)
  } catch (e) {
    errors.push(`${spec.name}: ${e.message}`)
    const old = prev?.groups?.flatMap((g) => g.items).find((i) => i.id === spec.id)
    // ערך ישן ממבנה קודם (בלי מד) — לא מציגים, כדי לא לשבור את הדף
    if (old && 'gauge' in old) items.push({ ...old, stale: true })
  }
}

if (!items.length) {
  console.error('⛔ לא התקבל אף נתון — הקובץ הקיים נשאר ללא שינוי')
  for (const e of errors) console.error('  ', e)
  process.exit(1)
}

// פרמיות סיכון עם היסטוריה ארוכה — לפרופורציה. שיטות שונות משלנו, ולכן מוצגות
// לצד הפרמיה שלנו ולא מושוות אליה אחד-לאחד. החלון = כל ההיסטוריה של המקור.
const ERP_ZONES = ['פרמיה נמוכה', 'בינונית', 'פרמיה גבוהה']
const ERP_LONG = [
  {
    id: 'damodaran', group: 'erp', name: 'פרמיית הסיכון הגלומה — דמודרן', nick: 'Implied ERP', nickHe: 'פרמיית סיכון גלומה',
    official: 'Implied Equity Risk Premium, S&P 500 (T12m)', code: 'ERPbymonth',
    org: "פרופ' אסוואת' דמודרן, אוניברסיטת ניו יורק", url: 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/implpr.html',
    unit: 'pct', kind: 'pct', dir: 'up-good', maxAge: 70, sparkYears: 10, zones: ERP_ZONES,
    what: 'התשואה העודפת שמחיר S&P 500 מגלם מעל אג"ח ממשלת ארה"ב ל-10 שנים, לפי מודל של תזרים לבעלי המניות (דיבידנדים ורכישות חוזרות) וצמיחה צפויה. מתעדכן בתחילת כל חודש.',
    term: 'Implied ERP — פרמיה "גלומה": לא נמדדת מתשואות העבר, אלא מחולצת ממחיר המדד היום — איזו תשואה עודפת צריך כדי שהמחיר יצדיק את התזרים הצפוי.',
    valueHelp: 'אחוזים בשנה מעל תשואת אג"ח ממשלת ארה"ב ל-10 שנים.',
    fetch: damodaran,
  },
  {
    id: 'shiller', group: 'erp', name: 'תשואת CAPE העודפת — שילר', nick: 'Excess CAPE Yield', nickHe: 'תשואת CAPE עודפת',
    official: 'Excess CAPE Yield (ECY)', code: 'ie_data',
    org: "פרופ' רוברט שילר, אוניברסיטת ייל", url: 'https://shillerdata.com/',
    unit: 'pct', kind: 'pct', dir: 'up-good', maxAge: 70, sparkYears: 10, zones: ERP_ZONES,
    what: 'תשואת הרווח של S&P 500 לפי הרווח הממוצע של 10 שנים מותאם אינפלציה (1 חלקי CAPE), פחות הריבית הריאלית ל-10 שנים. מתעדכן פעם בחודש.',
    term: 'CAPE = Cyclically Adjusted P/E, מכפיל רווח מנוטרל מחזוריות (נקרא גם "מכפיל שילר"): מחיר המדד חלקי הרווח הממוצע של 10 השנים האחרונות, במונחים ריאליים.',
    valueHelp: 'אחוזים בשנה מעל הריבית הריאלית ל-10 שנים.',
    fetch: shiller,
  },
]
const erpLong = []
for (const spec of ERP_LONG) {
  try {
    const rows = await spec.fetch()
    // החלון = כל ההיסטוריה של המקור (שנים שלמות)
    const it = build({ ...spec, years: Math.floor((Date.parse(rows[rows.length - 1].date) - Date.parse(rows[0].date)) / DAY / 365) }, rows)
    it.since = rows[0].date
    if ((Date.parse(today) - Date.parse(it.date)) / DAY > spec.maxAge) it.stale = true
    erpLong.push(it)
  } catch (e) {
    errors.push(`${spec.name}: ${e.message}`)
    const old = prev?.erpLong?.find((i) => i.id === spec.id)
    if (old) erpLong.push({ ...old, stale: true })
  }
}

const out = {
  updated_at: new Date().toISOString(),
  overall: overall(items),
  groups: GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.group === g.id) })).filter((g) => g.items.length),
  erp: null, // פרמיית הסיכון המחושבת הושבתה (מכפילי Yahoo) — ראה הערה בראש הקובץ
  erpLong,
  errors,
}

const TEST = process.argv.includes('--test')
const put = (path, obj) =>
  db.storage.from(BUCKET).upload(path, JSON.stringify(obj), { upsert: true, contentType: 'application/json', cacheControl: '60' })
const { error } = await put(TEST ? 'market/indicators-test.json' : 'market/indicators-v2.json', out)
if (error) throw error

for (const i of items) console.log(`  ${i.stale ? '⚠️' : '✅'} ${i.name}: ${i.value} (${i.date}) — ${i.reading ?? '—'}, מד ${i.gauge ?? '—'}, גוון ${i.shade}`)
for (const i of erpLong) console.log(`  ${i.stale ? '⚠️' : '✅'} ${i.name}: ${i.value}% (${i.date}, מאז ${i.since}) — ${i.reading}, אחוזון ${i.pct}, מד ${i.gauge}, גוון ${i.shade}`)
if (out.overall) console.log(`📝 תנאי השוק ${out.overall.reading} (${out.overall.gauge}): ${out.overall.text}`)
if (errors.length) console.warn(`⚠️ ${errors.length} שגיאות:`, errors)
console.log(`⏱️ ${((Date.now() - t0) / 1000).toFixed(1)} שניות`)
