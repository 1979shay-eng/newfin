// הרצת איסוף מלאה: מאיה → נירמול → ציון כללים → העשרת SIGNAL (AI) → Supabase
import { openMaya, fetchRecentReports, normalizeReport, fetchUpcomingCorporateActions } from './maya.mjs'
import { scoreReport } from './materiality.mjs'
import { enrich, signalEnabled } from './signal.mjs'
import { db, upsertCompany, getMayaSourceId, upsertItems, getEnrichedMap, linkHeadlineTags } from './db.mjs'
import { fetchAllRss } from './rss.mjs'
import { collectThematic } from './thematic.mjs'
import { collectYahoo } from './yahoo.mjs'
import { classifyCompanySectors } from './sectors.mjs'
import { classifyHeadline } from './headlines.mjs'

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

  // ── הרחבת מקורות: חדשות RSS (גלובס, TheMarker) + זיהוי חברה מהכותרת ──
  try {
    const rssRaw = await fetchAllRss()
    // מדיניות תיוג: יש חברה → תיוג חברה. אין חברה → סיווג כותרת: כתבה ענפית→סקטור,
    // מאקרו חשוב→"מאקרו", אחרת נזרק (לא נשמר). כך הפיד לא מוצף ברעש מאקרו/כללי.
    const rssBase = rssRaw
      .map((it) => ({ it, score: scoreReport(it), bottom_line: null, headlineTag: null }))
      .filter((r) => {
        if (r.it.company_id) return true
        const h = classifyHeadline(r.it.title)
        if (!h) return false
        r.headlineTag = h
        return true
      })
    console.log(`📰 ${rssRaw.length} ידיעות RSS → ${rssBase.length} נשמרות (חברה/סקטור/מאקרו)`)
    // אותו עיקרון כמו מאיה: שמירת העשרה קיימת + דילוג על מה שכבר מועשר
    const rssEnrichedMap = await getEnrichedMap(rssBase.map((r) => r.it.maya_report_id))
    for (const r of rssBase) {
      const ex = rssEnrichedMap.get(r.it.maya_report_id)
      if (ex) {
        r.bottom_line = ex.bottom_line
        r.score.materiality_score = ex.materiality_score
        r.score.direction = ex.direction
      }
    }
    rssBase.sort((a, b) => b.score.materiality_score - a.score.materiality_score)
    let rssEnriched = 0
    if (signalEnabled) {
      for (let i = 0; i < rssBase.length && rssEnriched < ENRICH_TOP; i++) {
        if (rssBase[i].bottom_line) continue // כבר מועשר — דילוג
        const e = await enrich(rssBase[i].it)
        if (e) {
          rssBase[i].score.materiality_score = e.materiality_score
          rssBase[i].score.direction = e.direction
          rssBase[i].bottom_line = e.bottom_line
          rssEnriched++
        }
        await sleep(2500)
      }
      console.log(`🧠 הועשרו ${rssEnriched} ידיעות RSS חדשות (${rssEnrichedMap.size} כבר מועשרות — דולגו)`)
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

    // קישור תגיות סקטור/מאקרו לפריטים בלי חברה (item_tags)
    const tagged = rssBase.filter((r) => r.headlineTag)
    if (tagged.length) {
      await linkHeadlineTags(
        tagged.map((r) => ({ maya_report_id: r.it.maya_report_id, ...r.headlineTag })),
      )
      console.log(`🏷️  תויגו ${tagged.length} כתבות ללא חברה (סקטור/מאקרו)`)
    }
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

  // ── Yahoo Finance: חברות ישראליות דואליות (תרגום+שיוך מהטיקר) ─────────
  try {
    const yItems = await collectYahoo({ signalEnabled })
    if (yItems.length) {
      const yRes = await upsertItems(yItems)
      console.log(`✅ נשמרו/עודכנו: ${yRes.count} פריטים מ-Yahoo Finance`)
    }
  } catch (e) {
    console.warn('⚠️  איסוף Yahoo נכשל:', e.message)
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
