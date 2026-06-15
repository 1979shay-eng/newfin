// פאנדר (פורטל קרנות/ביטוח/שוק הון) — מאחורי הגנת Cloudflare שחוסמת fetch רגיל (403).
// נאסף דרך דפדפן Playwright: טעינת דף הבית מקבלת clearance, ואז שולפים rssNews.aspx.
//
// ⚠️ לא מחובר ל-run.mjs כרגע: Cloudflare חוסם את Playwright גם מ-IP של GitHub Actions
// (datacenter). זה עובד מקומית (IP ביתי) אך מחזיר 0 מהשרת. כדי להפעיל בעתיד — להריץ
// את הקולקטור מ-IP ביתי/פרוקסי-מגורים ולהחזיר את החיווט ב-run.mjs (import + concat ל-rssRaw).
import { getOrCreateSource } from './db.mjs'
import { parseFeed, loadCompanies, matchCompany, publishedAtFrom } from './rss.mjs'

const HOME = 'https://www.funder.co.il'
const RSS = 'https://www.funder.co.il/rssNews.aspx'
const PER_FEED = 30

// מקבל Playwright BrowserContext (מ-openMaya) ומחזיר פריטים מנורמלים.
export async function fetchFunder(ctx) {
  const page = await ctx.newPage()
  try {
    // טעינת דף הבית — מעבירה את אתגר ה-Cloudflare ומשיגה cookie clearance
    await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2500)
    const resp = await page.goto(RSS, { waitUntil: 'domcontentloaded', timeout: 25000 })
    if (!resp || resp.status() >= 400) {
      console.warn(`funder rssNews.aspx: HTTP ${resp?.status()}`)
      return []
    }
    await page.waitForTimeout(1000)
    // תצוגת XML בדפדפן עדיין כוללת את תגי <item> ב-DOM; אם לא — נופלים ל-innerText
    const raw = await page.content()
    const xml = raw.includes('<item') ? raw : await page.evaluate(() => document.body?.innerText || '')
    const parsed = parseFeed(xml).slice(0, PER_FEED)
    if (!parsed.length) return []
    const companies = await loadCompanies()
    const sourceId = await getOrCreateSource('פאנדר', {
      type: 'osint',
      reliability: 'reported',
      base_url: HOME,
    })
    return parsed
      .filter((it) => it.title && it.link)
      .map((it) => {
        const { company_id, company_name } = matchCompany(it.title, companies)
        return {
          source_id: sourceId,
          company_id,
          company_name,
          maya_report_id: `funder:${it.guid}`,
          title: it.title.slice(0, 500),
          original_url: it.link,
          published_at: publishedAtFrom(it.pubDate),
          source_type: 'osint',
          reliability: 'reported',
          lang: 'he',
        }
      })
  } catch (e) {
    console.warn('funder נכשל:', e.message)
    return []
  } finally {
    await page.close().catch(() => {})
  }
}
