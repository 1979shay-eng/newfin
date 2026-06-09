// הרצת איסוף מלאה: מאיה → נירמול → ציון כללים → העשרת SIGNAL (AI) → Supabase
import { openMaya, fetchRecentReports, normalizeReport, fetchUpcomingCorporateActions } from './maya.mjs'
import { scoreReport } from './materiality.mjs'
import { enrich, signalEnabled } from './signal.mjs'
import { db, upsertCompany, getMayaSourceId, upsertItems } from './db.mjs'
import { fetchAllRss } from './rss.mjs'
import { collectThematic } from './thematic.mjs'

const ENRICH_TOP = 24 // כמה פריטים מהותיים להעשיר ב-AI לכל ריצה
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
  const raw = await fetchRecentReports(ctx, { pages: 4, limit: 20 })
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

  // העשרת AI לפריטים המהותיים ביותר
  base.sort((a, b) => b.score.materiality_score - a.score.materiality_score)
  let enriched = 0
  if (signalEnabled) {
    for (let i = 0; i < Math.min(ENRICH_TOP, base.length); i++) {
      const e = await enrich(base[i].norm)
      if (e) {
        base[i].score.materiality_score = e.materiality_score
        base[i].score.direction = e.direction
        base[i].bottom_line = e.bottom_line
        enriched++
      }
      await sleep(2500) // כיבוד מגבלת הקצב של Groq
    }
    console.log(`🧠 הועשרו ${enriched} פריטים ע"י SIGNAL`)
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

  // ── הרחבת מקורות: חדשות RSS (גלובס, TheMarker) + זיהוי חברה מהכותרת ──
  try {
    const rssRaw = await fetchAllRss()
    console.log(`📰 נשלפו ${rssRaw.length} ידיעות RSS`)
    const rssBase = rssRaw.map((it) => ({ it, score: scoreReport(it), bottom_line: null }))
    rssBase.sort((a, b) => b.score.materiality_score - a.score.materiality_score)
    if (signalEnabled) {
      for (let i = 0; i < Math.min(ENRICH_TOP, rssBase.length); i++) {
        const e = await enrich(rssBase[i].it)
        if (e) {
          rssBase[i].score.materiality_score = e.materiality_score
          rssBase[i].score.direction = e.direction
          rssBase[i].bottom_line = e.bottom_line
        }
        await sleep(2500)
      }
    }
    const rssItems = rssBase.map(({ it, score, bottom_line }) => ({
      source_id: it.source_id,
      company_id: it.company_id,
      maya_report_id: it.maya_report_id,
      title: it.title,
      body: '',
      bottom_line,
      original_url: it.original_url,
      published_at: it.published_at,
      source_type: it.source_type,
      reliability: it.reliability,
      materiality_score: score.materiality_score,
      direction: score.direction,
      status: 'published',
      is_public: true,
      lang: it.lang,
    }))
    const rssRes = await upsertItems(rssItems)
    console.log(`✅ נשמרו/עודכנו: ${rssRes.count} ידיעות RSS`)
  } catch (e) {
    console.warn('⚠️  איסוף RSS נכשל:', e.message)
  }

  // ── מקורות נושאיים: שער-AI מחמיר (DroneXL וכו') → השלכה ישראלית בלבד ──
  try {
    const themItems = await collectThematic({ signalEnabled })
    if (themItems.length) {
      const themRes = await upsertItems(themItems)
      console.log(`✅ נשמרו/עודכנו: ${themRes.count} פריטים נושאיים`)
    }
  } catch (e) {
    console.warn('⚠️  איסוף נושאי נכשל:', e.message)
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
