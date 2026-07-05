// הרצת מאיה: מאיה → נירמול → ציון כללים → העשרת SIGNAL (AI) → Supabase
// שאר המקורות (RSS/נושאי/Yahoo) פוצלו ל-run-news.mjs — ריצה קלה נפרדת
// שרצה בתדירות גבוהה יותר בלי דפדפן. הפיצול מכפיל את קצב רענון הפיד.
import { openMaya, fetchRecentReports, normalizeReport, fetchUpcomingCorporateActions } from './maya.mjs'
import { scoreReport } from './materiality.mjs'
import { enrich, signalEnabled } from './signal.mjs'
import { db, upsertCompany, getMayaSourceId, upsertItems, getEnrichedMap } from './db.mjs'
import { classifyCompanySectors } from './sectors.mjs'

const ENRICH_TOP = 16 // כמה פריטים מהותיים להעשיר ב-AI לכל ריצה (מאוזן מול מגבלת 15 דק')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log('🕷️  NewFin Collector — מתחיל איסוף ממאיה...')
console.log(
  signalEnabled
    ? '🧠 מנוע SIGNAL (AI) פעיל'
    : '⚠️  מנוע SIGNAL כבוי (אין GROQ_API_KEY) — ציון מבוסס-כללים בלבד',
)
const t0 = Date.now()

const { browser, ctx } = await openMaya()
try {
  // 6 עמודים × 20 × 2 זרמים — הזרם המלא מכסה ~יום גם בעומס דיווחים
  const raw = await fetchRecentReports(ctx, { pages: 6, limit: 20 })
  console.log(`נשלפו ${raw.length} דיווחים גולמיים ממאיה`)
  const ca = await fetchUpcomingCorporateActions(ctx, 8)
  const sourceId = await getMayaSourceId()

  // בסיס: נירמול + ציון כללים + חברה
  const base = []
  for (const r of raw) {
    const norm = normalizeReport(r)
    const score = scoreReport(norm)
    let company_id = null
    if (norm.maya_company_id && norm.company_name) {
      try {
        company_id = await upsertCompany(norm.maya_company_id, norm.company_name)
      } catch {
        /* ignore */
      }
    }
    base.push({ norm, score, company_id, bottom_line: null })
  }

  // טעינת העשרה קיימת: פריטים שכבר יש להם bottom_line ב-DB — נשמר אותו ונדלג על
  // העשרה חוזרת (אחרת שורפים את מכסת Groq היומית על אותם פריטים בכל ריצה, וגם
  // דורסים bottom_line קיים ל-null כשהפריט נופל מ-top-ENRICH_TOP).
  const enrichedMap = await getEnrichedMap(base.map((b) => b.norm.maya_report_id))
  for (const b of base) {
    const ex = enrichedMap.get(b.norm.maya_report_id)
    if (ex) {
      b.bottom_line = ex.bottom_line
      b.score.materiality_score = ex.materiality_score
      b.score.direction = ex.direction
    }
  }

  // העשרת AI לפריטים המהותיים ביותר שעדיין לא הועשרו
  base.sort((a, b) => b.score.materiality_score - a.score.materiality_score)
  let enriched = 0
  if (signalEnabled) {
    for (let i = 0; i < base.length && enriched < ENRICH_TOP; i++) {
      if (base[i].bottom_line) continue // כבר מועשר — דילוג, לא שורפים טוקנים
      const e = await enrich(base[i].norm)
      if (e) {
        base[i].score.materiality_score = e.materiality_score
        base[i].score.direction = e.direction
        base[i].bottom_line = e.bottom_line
        enriched++
      }
      await sleep(2500) // כיבוד מגבלת הקצב של Groq
    }
    console.log(`🧠 הועשרו ${enriched} פריטים חדשים ע"י SIGNAL (${enrichedMap.size} כבר מועשרים — דולגו)`)
  }

  // בניית רשומות ל-DB
  const items = base.map(({ norm, score, company_id, bottom_line }) => ({
    source_id: sourceId,
    company_id,
    maya_report_id: norm.maya_report_id,
    title: norm.title,
    body: '',
    bottom_line,
    original_url: norm.original_url,
    published_at: norm.published_at,
    source_type: norm.source_type,
    reliability: norm.reliability,
    materiality_score: score.materiality_score,
    direction: score.direction,
    status: 'published',
    is_public: true,
    lang: norm.lang,
  }))

  const { count } = await upsertItems(items)
  console.log(`✅ נשמרו/עודכנו: ${count} פריטים ממאיה`)

  // ── סיווג חברות לסקטור (ממלא בהדרגה את companies.sector) ──
  try {
    const { updated, ruled, aied } = await classifyCompanySectors({ aiBatches: 3, batchSize: 20 })
    if (updated) console.log(`🏷️  סווגו ${updated} חברות לסקטור (כללים: ${ruled}, AI: ${aied})`)
  } catch (e) {
    console.warn('⚠️  סיווג סקטורים נכשל:', e.message)
  }

  // קטליזטורים → events
  if (ca.length) {
    const evts = []
    for (const c of ca) {
      const co = c.companies?.[0]
      if (!co) continue
      let company_id = null
      try {
        company_id = await upsertCompany(String(co.companyId), co.name)
      } catch {
        /* ignore */
      }
      evts.push({
        company_id,
        type: 'corporate_action',
        title: c.title,
        event_date: c.publishDate?.slice(0, 10),
        source_id: sourceId,
      })
    }
    if (evts.length) {
      await db.from('events').upsert(evts, { ignoreDuplicates: true })
      console.log(`📅 קטליזטורים: ${evts.length}`)
    }
  }

  console.log(`\n⏱️  ${((Date.now() - t0) / 1000).toFixed(1)} שניות`)
} finally {
  await browser.close()
}
