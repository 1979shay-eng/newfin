// הרצת מאיה: מאיה → נירמול → ציון כללים → העשרת SIGNAL (AI) → Supabase
// שאר המקורות (RSS/נושאי/Yahoo) פוצלו ל-run-news.mjs — ריצה קלה נפרדת
// שרצה בתדירות גבוהה יותר בלי דפדפן. הפיצול מכפיל את קצב רענון הפיד.
import { openMaya, fetchRecentReports, normalizeReport, fetchUpcomingCorporateActions } from './maya.mjs'
import { scoreReport } from './materiality.mjs'
import { enrich, blendScore, signalEnabled } from './signal.mjs'
import { db, upsertCompany, getMayaSourceId, upsertItems, getEnrichedMap } from './db.mjs'
import { classifyCompanySectors } from './sectors.mjs'
import { classifyReport, matchKeplerEntity, savedReportIds, fetchAndStoreReport } from './kepler-link.mjs'

// שכבת הדוחות של קפלר: כשדוח (רבעוני/שנתי/מצגת/דירוג מעקב/מצבת התחייבויות) של חברה
// שכבר בקפלר עובר בפיד — שומרים אותו מיד (PDF/HTML + טקסט). בלי סריקה: הדיווחים ממילא
// כבר כאן, רק בודקים מי מהם דוח.
async function saveKeplerReports(ctx, raw) {
  const cands = []
  for (const r of raw) {
    const kind = classifyReport(r.title)
    if (!['quarterly', 'annual', 'presentation', 'rating', 'debt'].includes(kind)) continue
    const co = r.companies?.[0]
    if (!co?.companyId) continue
    cands.push({ rep: { id: String(r.id), title: r.title, kind, publishDate: r.publishDate }, company: { maya_company_id: String(co.companyId), name_he: co.name } })
  }
  if (!cands.length) return 0
  const have = await savedReportIds({ ids: cands.map((c) => c.rep.id) })
  let saved = 0
  for (const c of cands) {
    if (have.has(c.rep.id)) continue
    const entity = await matchKeplerEntity(c.company.name_he)
    if (!entity) continue // לא בקפלר — לא מורידים (לפי דרישה בלבד)
    try {
      const row = await fetchAndStoreReport(ctx, c.rep, c.company, entity)
      saved++
      console.log(`📄 קפלר: נשמר "${c.rep.title}" של ${entity.name} (${row.pages ?? '?'} עמ')`)
    } catch (e) {
      console.warn(`⚠️  קפלר: "${c.rep.title}" לא נשמר — ${e.message}`)
    }
  }
  return saved
}

const ENRICH_TOP = 16 // כמה פריטים מהותיים להעשיר ב-AI לכל ריצה (מאוזן מול מגבלת 15 דק')
const ENRICH_MIN = 5 // סף ציון-כללים להעשרה — מתחתיו לא שורפים מכסת Groq על שגרה טכנית
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
  // 6 עמודים × 20 × 2 זרמים — הזרם המלא מכסה ~יום גם בעומס דיווחים.
  // --pages N מאפשר השלמה ידנית של פער (למשל אחרי שהאיסוף נעצר לכמה ימים).
  const pagesArg = process.argv.indexOf('--pages')
  const pages = pagesArg > -1 ? Number(process.argv[pagesArg + 1]) || 6 : 6
  const raw = await fetchRecentReports(ctx, { pages, limit: 20 })
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
      if (base[i].score.materiality_score < ENRICH_MIN) break // ממוין יורד — הבאים נמוכים עוד יותר
      if (base[i].bottom_line) continue // כבר מועשר — דילוג, לא שורפים טוקנים
      const e = await enrich(base[i].norm)
      if (e) {
        base[i].score.materiality_score = blendScore(base[i].score.materiality_score, e.materiality_score)
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

  // דוחות כספיים חדשים של חברות קפלר — נשמרים כשהם עוברים כאן (ראה למעלה)
  try {
    await saveKeplerReports(ctx, raw)
  } catch (e) {
    console.warn('⚠️  שמירת דוחות לקפלר נכשלה:', e.message)
  }

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
