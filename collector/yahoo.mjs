// Yahoo Finance — חדשות אנליסטים/שווקים על חברות ישראליות דואליות (TASE + נאסד"ק/NYSE).
// פיד לכל טיקר בנפרד → אז כל ידיעה כבר משויכת לחברה ספציפית. התוכן באנגלית, אז עובר
// דרך שער-AI (gateThematic) שמנסח כותרת + שורה תחתונה בעברית, מסנן רעש, ומדרג.
// שיוך החברה דטרמיניסטי לפי הטיקר (לא ע"י ה-LLM) — מונע הזיות.
import { db, getOrCreateSource, getEnrichedMap } from './db.mjs'
import { parseFeed, publishedAtFrom } from './rss.mjs'
import { gateThematic } from './signal.mjs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const PER_FEED = 4 // כמה ידיעות חדשות לבדוק מכל טיקר
const GATE_CAP = 8 // תקרת קריאות-AI חדשות לכל ריצה (הגנת מכסה/timeout)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// טיקר אמריקאי → שם החברה כפי שהוא ב-DB (לשיוך) + ענף (רמז לשער).
// חברות שאינן ב-DB (נסחרות רק בחו"ל, או טרם נכנסו) פשוט מדולגות — וייכנסו אוטומטית
// כשהחברה תופיע ב-DB. כך הפילטר "נסחרת בת"א" נשמר מעצמו.
export const YAHOO_TICKERS = [
  { ticker: 'TEVA', name: 'טבע', sector: 'ביומד' },
  { ticker: 'TSEM', name: 'טאואר', sector: 'טכנולוגיה' },
  { ticker: 'NICE', name: 'נייס', sector: 'טכנולוגיה' },
  { ticker: 'NVMI', name: 'נובה', sector: 'טכנולוגיה' },
  { ticker: 'CAMT', name: 'קמטק', sector: 'טכנולוגיה' },
  { ticker: 'ORA', name: 'אורמת טכנו', sector: 'אנרגיה מתחדשת' },
  { ticker: 'GILT', name: 'גילת', sector: 'טכנולוגיה' },
  { ticker: 'PERI', name: 'פריון נטוורק', sector: 'טכנולוגיה' },
  { ticker: 'ENLT', name: 'אנלייט אנרגיה', sector: 'אנרגיה מתחדשת' },
  // נוספות — יקושרו אוטומטית כשהחברה תיכנס ל-DB:
  { ticker: 'ESLT', name: 'אלביט מערכות', sector: 'תעשייה' },
  { ticker: 'ICL', name: 'כיל', sector: 'מסחר ושירותים' },
  { ticker: 'SPNS', name: 'סאפיינס', sector: 'טכנולוגיה' },
]

const feedUrl = (ticker) =>
  `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${ticker}&region=US&lang=en-US`

// מפת שם-עברי → company_id מטבלת החברות (לשיוך דטרמיניסטי)
async function loadNameMap() {
  const { data } = await db.from('companies').select('id, name_he')
  const m = new Map()
  for (const c of data || []) if (c.name_he) m.set(c.name_he.trim(), c.id)
  return m
}

// שואב פיד יחיד ומחזיר ידיעות גולמיות
async function fetchTicker(ticker) {
  const r = await fetch(feedUrl(ticker), {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml,application/xml,text/xml' },
  })
  if (!r.ok) {
    console.warn(`yahoo ${ticker}: HTTP ${r.status}`)
    return []
  }
  return parseFeed(await r.text()).slice(0, PER_FEED)
}

export async function collectYahoo({ signalEnabled } = {}) {
  if (!signalEnabled) {
    console.log('💹 Yahoo דורש מנוע SIGNAL (Groq) — מדלג')
    return []
  }
  const nameMap = await loadNameMap()
  // אוסף מועמדים מכל הטיקרים שמשויכים לחברה קיימת
  const candidates = []
  for (const t of YAHOO_TICKERS) {
    const company_id = nameMap.get(t.name)
    if (!company_id) continue // לא ב-DB (לא נסחרת אצלנו) — דלג
    let raw
    try {
      raw = await fetchTicker(t.ticker)
    } catch (e) {
      console.warn(`yahoo ${t.ticker} נכשל:`, e.message)
      continue
    }
    for (const it of raw) {
      if (!it.title || !it.link) continue
      candidates.push({ t, company_id, it, id: `yahoo:${t.ticker}:${it.guid}` })
    }
  }
  if (!candidates.length) return []

  // דה-דופ: דלג על ידיעות שכבר תורגמו ונשמרו (חוסך קריאות AI)
  const known = await getEnrichedMap(candidates.map((c) => c.id))
  const fresh = candidates.filter((c) => !known.has(c.id))

  const sourceId = await getOrCreateSource('Yahoo Finance', {
    type: 'osint',
    reliability: 'reported',
    base_url: 'https://finance.yahoo.com',
  })

  const out = []
  let evaluated = 0
  let passed = 0
  let rejected = 0
  let rateLimited = false
  for (const c of fresh) {
    if (evaluated >= GATE_CAP) break
    const g = await gateThematic({
      title: c.it.title,
      description: `[חברה ישראלית סחירה: ${c.t.name}] ${c.it.description || ''}`,
      sector: c.t.sector,
    })
    // מכסת Groq אזלה — עוצרים את הריצה; פריטים שטרם נבדקו יישארו טריים לריצה הבאה.
    if (g?.rateLimited) {
      rateLimited = true
      break
    }
    evaluated++
    await sleep(2500) // כיבוד מגבלת הקצב של Groq

    if (!g) continue // שגיאה זמנית אחרת — דלג, יינסה שוב בריצה הבאה

    if (!g.relevant || !g.headline_he) {
      // נדחה סופית — שורת "קבר" (draft, לא ציבורית) כדי שה-dedup לא יבדוק אותה שוב.
      out.push({
        source_id: sourceId,
        company_id: c.company_id,
        maya_report_id: c.id,
        title: c.it.title.slice(0, 500),
        body: '',
        bottom_line: '—', // לא-null: getEnrichedMap מזהה לפיו פריט "מטופל"
        original_url: c.it.link,
        published_at: publishedAtFrom(c.it.pubDate),
        source_type: 'osint',
        reliability: 'reported',
        materiality_score: 1,
        direction: 'neutral',
        status: 'draft', // לא 'published' → לא מופיע בפיד
        is_public: false,
        lang: 'he',
      })
      rejected++
      continue
    }
    passed++
    out.push({
      source_id: sourceId,
      company_id: c.company_id, // דטרמיניסטי מהטיקר (לא מה-LLM)
      maya_report_id: c.id,
      title: g.headline_he.slice(0, 500),
      body: '',
      bottom_line: g.bottom_line,
      original_url: c.it.link,
      published_at: publishedAtFrom(c.it.pubDate),
      source_type: 'osint',
      reliability: 'reported',
      materiality_score: g.score,
      direction: g.direction,
      status: 'published',
      is_public: true,
      lang: 'he',
    })
  }
  console.log(
    `💹 Yahoo: ${passed} עברו, ${rejected} נדחו (נשמרו כדי לא להיבדק שוב), מתוך ${evaluated} שנבדקו` +
      `${rateLimited ? ' [נעצר: מכסת Groq אזלה]' : ''} — ${known.size} כבר שמורים, דולגו`,
  )
  return out
}
