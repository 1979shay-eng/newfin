// הרצת איסוף מלאה: מאיה → נירמול → ציון מהותיות → שמירה ב-Supabase
import { openMaya, fetchRecentReports, normalizeReport, fetchUpcomingCorporateActions } from './maya.mjs'
import { scoreReport } from './materiality.mjs'
import { db, upsertCompany, getMayaSourceId, insertItems } from './db.mjs'

console.log('🕷️  NewFin Collector — מתחיל איסוף ממאיה...')
const t0 = Date.now()

const { browser, ctx } = await openMaya()
try {
  // שליפה
  const raw = await fetchRecentReports(ctx, { pages: 4, limit: 20 })
  console.log(`נשלפו ${raw.length} דיווחים גולמיים ממאיה`)

  // קטליזטורים
  const ca = await fetchUpcomingCorporateActions(ctx, 8)
  console.log(`נשלפו ${ca.length} קטליזטורים קרובים`)

  // מזהה מקור מאיה
  const sourceId = await getMayaSourceId()

  // נירמול + ציון + upsert חברות
  const items = []
  for (const r of raw) {
    const norm = normalizeReport(r)
    const score = scoreReport(norm)

    // מוצא/יוצר חברה
    let company_id = null
    if (norm.maya_company_id && norm.company_name) {
      try {
        company_id = await upsertCompany(norm.maya_company_id, norm.company_name)
      } catch (e) {
        console.warn('upsertCompany:', e.message)
      }
    }

    items.push({
      source_id: sourceId,
      company_id,
      maya_report_id: norm.maya_report_id,
      title: norm.title,
      body: '',
      original_url: norm.original_url,
      published_at: norm.published_at,
      source_type: norm.source_type,
      reliability: norm.reliability,
      materiality_score: score.materiality_score,
      direction: score.direction,
      status: 'published',
      is_public: score.materiality_score >= 4,
      lang: norm.lang,
    })
  }

  // שמירה במסד
  const { inserted, skipped } = await insertItems(items)
  console.log(`✅ נשמרו: ${inserted} חדשים | דולגו (כפולים): ${skipped}`)

  // שמירת קטליזטורים
  if (ca.length > 0) {
    const evts = []
    for (const c of ca) {
      const co = c.companies?.[0]
      if (!co) continue
      let company_id = null
      try {
        company_id = await upsertCompany(String(co.companyId), co.name)
      } catch {}
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
      console.log(`📅 קטליזטורים נשמרו: ${evts.length}`)
    }
  }

  // סיכום
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n⏱️  סה"כ זמן: ${elapsed} שניות`)
  console.log('📊 פיזור ציוני מהותיות:')
  const dist = {}
  for (const it of items) dist[it.materiality_score] = (dist[it.materiality_score] || 0) + 1
  for (const [s, n] of Object.entries(dist).sort((a, b) => b[0] - a[0]))
    console.log(`   ציון ${s}: ${n} פריטים`)

} finally {
  await browser.close()
}
