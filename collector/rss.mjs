// מודול RSS — קריאת חדשות פיננסיות, זיהוי חברה מהכותרת, ונירמול ל-Item.
// מבנה הפלט זהה ל-normalizeReport של מאיה, כך שה-flow (ציון + SIGNAL + שמירה) משותף.
import { db } from './db.mjs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// רשימת הפידים — קל להוסיף עוד (key ייחודי, שם המקור כפי שרשום ב-sources, וכתובת ה-RSS)
export const FEEDS = [
  {
    key: 'globes',
    source_name: 'גלובס',
    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585',
  },
  {
    key: 'themarker',
    source_name: 'TheMarker',
    url: 'https://www.themarker.com/cmlink/1.144',
  },
]

// פענוח ישויות HTML/XML נפוצות
function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '') // הסרת תגיות HTML שנותרו בתיאור
    .trim()
}

// חילוץ ערך תג בודד מתוך בלוק <item>
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? m[1].trim() : ''
}

// פירוק פיד RSS לרשימת פריטים גולמיים
function parseFeed(xml) {
  const out = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = re.exec(xml))) {
    const b = m[1]
    const link = decode(tag(b, 'link')).split('#')[0]
    out.push({
      title: decode(tag(b, 'title')),
      link,
      guid: decode(tag(b, 'guid')) || link,
      description: decode(tag(b, 'description')),
      pubDate: tag(b, 'pubDate'),
    })
  }
  return out
}

// טעינת רשימת החברות פעם אחת, ממוינת לפי אורך השם (ארוך קודם — התאמה מדויקת קודמת).
// סינון לשמות באורך 4+ : שמות בני 3 אותיות (ארד, חמת, עשות) נבלעים בתוך מילים נפוצות.
let companiesCache = null
async function loadCompanies() {
  if (companiesCache) return companiesCache
  const { data } = await db.from('companies').select('id, name_he')
  companiesCache = (data || [])
    .filter((c) => c.name_he && c.name_he.trim().length >= 4)
    .map((c) => ({ id: c.id, name: c.name_he.trim() }))
    .sort((a, b) => b.name.length - a.name.length)
  return companiesCache
}

// תווי גבול-מילה: רווח, פיסוק, מקף, מרכאות, נקודותיים. שם החברה חייב להיות מוקף בהם
// כדי להיחשב התאמה — כך "מלחמת" לא ייתפס כחברת "חמת".
const BOUNDARY = /[\s.,;:!?"'()[\]־–—•·\-/|]/

// שמות-חברה שהם גם מילה עברית נפוצה (תואר/שם-עצם) — מדלגים כדי למנוע התאמות-שווא.
const STOP = new Set(['בינלאומי'])

// מזהה חברה מהכותרת: מחזיר { company_id, company_name } או ריק.
// דורש שם מוקף בגבול-מילה משני הצדדים. ארוך-קודם מצמצם התאמות-שווא.
function matchCompany(title, companies) {
  for (const c of companies) {
    if (STOP.has(c.name)) continue
    let from = 0
    let idx
    while ((idx = title.indexOf(c.name, from)) !== -1) {
      const before = idx === 0 ? ' ' : title[idx - 1]
      const after = idx + c.name.length >= title.length ? ' ' : title[idx + c.name.length]
      if (BOUNDARY.test(before) && BOUNDARY.test(after)) {
        return { company_id: c.id, company_name: c.name }
      }
      from = idx + 1 // אותו שם עשוי להופיע שוב במקום עם גבול תקין
    }
  }
  return { company_id: null, company_name: null }
}

// מיפוי שם מקור → uuid ב-sources (נטען פעם אחת)
let sourceIds = null
async function getSourceId(name) {
  if (!sourceIds) {
    const { data } = await db.from('sources').select('id, name')
    sourceIds = Object.fromEntries((data || []).map((s) => [s.name, s.id]))
  }
  return sourceIds[name] || null
}

// שואב פיד יחיד ומחזיר פריטים מנורמלים (כולל זיהוי חברה)
async function fetchFeed(feed, companies) {
  const r = await fetch(feed.url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml,application/xml,text/xml' },
  })
  if (!r.ok) {
    console.warn(`RSS ${feed.key}: HTTP ${r.status}`)
    return []
  }
  const xml = await r.text()
  const sourceId = await getSourceId(feed.source_name)
  const raw = parseFeed(xml)
  return raw
    .filter((it) => it.title && it.link)
    .map((it) => {
      const { company_id, company_name } = matchCompany(it.title, companies)
      const published_at = it.pubDate ? new Date(it.pubDate) : null
      return {
        source_id: sourceId,
        company_id,
        company_name,
        maya_report_id: `${feed.key}:${it.guid}`, // מזהה ייחודי לכל מקור (משמש ל-upsert)
        title: it.title.slice(0, 500),
        original_url: it.link,
        published_at:
          published_at && !isNaN(published_at) ? published_at.toISOString() : new Date().toISOString(),
        source_type: 'osint',
        reliability: 'reported',
        lang: 'he',
      }
    })
}

// שואב את כל הפידים, מדלל כפילויות לפי maya_report_id
export async function fetchAllRss() {
  const companies = await loadCompanies()
  const byId = new Map()
  for (const feed of FEEDS) {
    try {
      for (const item of await fetchFeed(feed, companies)) byId.set(item.maya_report_id, item)
    } catch (e) {
      console.warn(`RSS ${feed.key} נכשל:`, e.message)
    }
  }
  return [...byId.values()]
}
