// מקורות נושאיים/ענפיים — RSS (לרוב באנגלית) שעובר שער-AI מחמיר: רק ידיעות עם
// השלכה ישראלית סחירה ברורה נשמרות, מנוסחות עובדתית בעברית. זיהוי החברה נעשה
// דטרמיניסטית (matchCompany על טבלת companies) ולא ע"י ה-LLM — כדי למנוע הזיות.
import { getOrCreateSource } from './db.mjs'
import { parseFeed, loadCompanies, matchCompany } from './rss.mjs'
import { gateThematic } from './signal.mjs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const PER_FEED = 15 // כמה פריטים חדשים לבדוק בשער מכל פיד (כל אחד = קריאת Groq)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// sector = ענף לתיוג עתידי; lang = שפת המקור (תיעוד). source_name נוצר אוטומטית ב-sources.
export const THEMATIC_FEEDS = [
  {
    key: 'dronexl',
    source_name: 'DroneXL',
    sector: 'ביטחון ורחפנים',
    lang: 'en',
    url: 'https://dronexl.co/feed/',
  },
]

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
  const out = []
  let checked = 0
  let passed = 0
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
    for (const it of raw) {
      checked++
      const g = await gateThematic({ title: it.title, description: it.description, sector: feed.sector })
      await sleep(2500) // כיבוד מגבלת הקצב של Groq
      if (!g || !g.relevant) continue
      passed++
      // זיהוי חברה דטרמיניסטי: הצלבת ה-headline + רמז החברה מה-LLM מול טבלת החברות
      const { company_id } = matchCompany(`${g.headline_he} ${g.company || ''}`, companies)
      const pub = it.pubDate ? new Date(it.pubDate) : null
      out.push({
        source_id: sourceId,
        company_id,
        maya_report_id: `${feed.key}:${it.guid}`,
        title: g.headline_he.slice(0, 500),
        body: '',
        bottom_line: g.bottom_line,
        original_url: it.link,
        published_at: pub && !isNaN(pub) ? pub.toISOString() : new Date().toISOString(),
        source_type: 'osint',
        reliability: 'reported',
        materiality_score: g.score,
        direction: g.direction,
        status: 'published',
        is_public: true,
        lang: 'he',
      })
    }
  }
  console.log(`🎯 שער נושאי: ${passed}/${checked} ידיעות עברו (השאר נפסלו — אין השלכה ישראלית ברורה)`)
  return out
}
