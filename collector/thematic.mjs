// מקורות נושאיים/ענפיים — RSS (לרוב באנגלית) שעובר שער-AI מחמיר: רק ידיעות עם
// השלכה ישראלית סחירה ברורה נשמרות, מנוסחות עובדתית בעברית. זיהוי החברה נעשה
// דטרמיניסטית (matchCompany על טבלת companies) ולא ע"י ה-LLM — כדי למנוע הזיות.
import { getOrCreateSource, getEnrichedMap } from './db.mjs'
import { parseFeed, loadCompanies, matchCompany, publishedAtFrom } from './rss.mjs'
import { gateThematic } from './signal.mjs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const PER_FEED = 10 // כמה פריטים אחרונים למשוך מכל פיד
const GATE_CAP = 14 // תקרת קריאות-שער (AI) לכל ריצה — הגנת מכסה/timeout
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// sector = ענף לתיוג עתידי; lang = שפת המקור (תיעוד). source_name נוצר אוטומטית ב-sources.
export const THEMATIC_FEEDS = [
  {
    key: 'jpost-biz',
    source_name: 'Jerusalem Post',
    sector: 'שוק ההון',
    lang: 'en',
    url: 'https://www.jpost.com/rss/rssbusinessandinnovation',
  },
  {
    key: 'jpost-fin',
    source_name: 'Jerusalem Post',
    sector: 'פיננסים',
    lang: 'en',
    url: 'https://www.jpost.com/rss/rssbankingandfinance',
  },
  {
    key: 'dronexl',
    source_name: 'DroneXL',
    sector: 'ביטחון ורחפנים',
    lang: 'en',
    url: 'https://dronexl.co/feed/',
  },
]

// שזירת רשימות round-robin — כדי ששום פיד לא יבלע את כל תקרת השער
function roundRobin(groups) {
  const out = []
  let i = 0
  let added = true
  while (added) {
    added = false
    for (const g of groups) {
      if (g[i] !== undefined) {
        out.push(g[i])
        added = true
      }
    }
    i++
  }
  return out
}

async function fetchThematicFeed(feed) {
  const r = await fetch(feed.url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml,application/xml,text/xml' },
  })
  if (!r.ok) {
    console.warn(`thematic ${feed.key}: HTTP ${r.status}`)
    return []
  }
  return parseFeed(await r.text()).slice(0, PER_FEED)
}

// מריץ את כל המקורות הנושאיים דרך השער, מחזיר פריטים מוכנים ל-upsertItems.
// signalEnabled נדרש — בלי AI אין שער, ולכן מדלגים (לא מציפים פיד באנגלית גולמית).
export async function collectThematic({ signalEnabled } = {}) {
  if (!signalEnabled) {
    console.log('🎯 מקורות נושאיים דורשים מנוע SIGNAL (Groq) — מדלג')
    return []
  }
  const companies = await loadCompanies()
  // 1) איסוף מועמדים מכל הפידים (כל פיד לקבוצה משלו, לשזירה הוגנת)
  const groups = []
  for (const feed of THEMATIC_FEEDS) {
    let raw
    try {
      raw = await fetchThematicFeed(feed)
    } catch (e) {
      console.warn(`thematic ${feed.key} נכשל:`, e.message)
      continue
    }
    let sourceId
    try {
      sourceId = await getOrCreateSource(feed.source_name, {
        type: 'osint',
        reliability: 'reported',
        base_url: new URL(feed.url).origin,
      })
    } catch (e) {
      console.warn(`thematic ${feed.key}: יצירת מקור נכשלה:`, e.message)
      continue
    }
    groups.push(
      raw
        .filter((it) => it.title)
        .map((it) => ({ feed, sourceId, it, id: `${feed.key}:${it.guid}` })),
    )
  }
  const candidates = roundRobin(groups)
  if (!candidates.length) return []

  // 2) דה-דופ: דלג על פריטים שכבר עברו את השער ונשמרו (חוסך קריאות AI)
  const known = await getEnrichedMap(candidates.map((c) => c.id))
  const fresh = candidates.filter((c) => !known.has(c.id))

  // 3) שער ל-fresh עד GATE_CAP
  const out = []
  let evaluated = 0
  let passed = 0
  let rejected = 0
  let rateLimited = false
  for (const c of fresh) {
    if (evaluated >= GATE_CAP) break
    const g = await gateThematic({ title: c.it.title, description: c.it.description, sector: c.feed.sector })
    // מכסת Groq אזלה — עוצרים את כל הריצה. אין טעם להמשיך לדפוק על מכסה ריקה,
    // והפריטים שטרם נבדקו יישארו "טריים" ויעברו שער בריצה הבאה.
    if (g?.rateLimited) {
      rateLimited = true
      break
    }
    evaluated++
    await sleep(2500) // כיבוד מגבלת הקצב של Groq

    if (!g) continue // שגיאה זמנית אחרת (לא 429) — דלג, יינסה שוב בריצה הבאה

    if (!g.relevant || !g.headline_he) {
      // נדחה סופית ע"י השער. שומרים שורת "קבר" (draft, לא ציבורית) רק כדי שה-dedup
      // יזהה אותה כ"כבר טופלה" ולא יבדוק אותה שוב בכל ריצה — מה ששרף את מכסת Groq.
      out.push({
        source_id: c.sourceId,
        company_id: null,
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
        status: 'draft', // לא 'published' → לא מופיע בפיד (וגם חסום ב-RLS)
        is_public: false,
        lang: 'he',
      })
      rejected++
      continue
    }
    passed++
    // זיהוי חברה דטרמיניסטי: הצלבת ה-headline + רמז החברה מה-LLM מול טבלת החברות
    const { company_id } = matchCompany(`${g.headline_he} ${g.company || ''}`, companies)
    out.push({
      source_id: c.sourceId,
      company_id,
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
    `🎯 שער נושאי: ${passed} עברו, ${rejected} נדחו (נשמרו כדי לא להיבדק שוב), מתוך ${evaluated} שנבדקו` +
      `${rateLimited ? ' [נעצר: מכסת Groq אזלה]' : ''} — ${known.size} כבר שמורים, דולגו`,
  )
  return out
}
