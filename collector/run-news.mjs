// הרצת חדשות קלה: RSS + נושאי + Yahoo — בלי מאיה ובלי דפדפן (Playwright).
// רצה במקביל לריצת מאיה הכבדה (run.mjs) בדקות אחרות — מכפילה את קצב הרענון
// של הפיד בלי עלות: אין דפדפן להתקין, הריצה מסתיימת תוך ~דקה.
// דה-דופ ההעשרה (getEnrichedMap) מונע שריפת מכסת Groq על פריטים שכבר הועשרו.
import { scoreReport } from './materiality.mjs'
import { enrich, signalEnabled } from './signal.mjs'
import { upsertItems, getEnrichedMap, linkHeadlineTags } from './db.mjs'
import { fetchAllRss, isClickbait, bodyReveals } from './rss.mjs'
import { collectThematic } from './thematic.mjs'
import { collectYahoo } from './yahoo.mjs'
import { classifyHeadline } from './headlines.mjs'

const ENRICH_TOP = 16
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log('📰 NewFin News Collector — איסוף חדשות קל (ללא מאיה)...')
console.log(
  signalEnabled
    ? '🧠 מנוע SIGNAL (AI) פעיל'
    : '⚠️  מנוע SIGNAL כבוי (אין GROQ_API_KEY) — ציון מבוסס-כללים בלבד',
)
const t0 = Date.now()

// ── חדשות RSS (גלובס, TheMarker) + זיהוי חברה מהכותרת ──
try {
  const rssRaw = await fetchAllRss()
  const rssBase = rssRaw
    .map((it) => ({ it, score: scoreReport(it), bottom_line: null, headlineTag: null }))
    .filter((r) => {
      // קליקבייט: כותרת-חידה שהתקציר לא חושף את העובדות מאחוריה — נזרקת,
      // גם אם זוהתה חברה. מדיניות: מציגים עובדות, לא פיתיונות.
      if (isClickbait(r.it.title) && !bodyReveals(r.it.body)) return false
      if (r.it.company_id) return true
      const h = classifyHeadline(r.it.title)
      if (h) {
        r.headlineTag = h
        return true
      }
      // מקור ענפי (קובץ ת"א-35): אין חברה ואין סיווג-כותרת → תגית הענף של הפיד
      if (r.it.feed_sector) {
        r.headlineTag = { tag: r.it.feed_sector, type: 'sector' }
        return true
      }
      return false
    })
  console.log(`📰 ${rssRaw.length} ידיעות RSS → ${rssBase.length} נשמרות (חברה/סקטור/מאקרו)`)
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
      if (rssBase[i].bottom_line) continue
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
    body: it.body ?? '', // תקציר מהמקור — מוצג כשאין עדיין bottom_line

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

// ── מקורות נושאיים: שער-AI מחמיר → השלכה ישראלית בלבד ──
try {
  const themItems = await collectThematic({ signalEnabled })
  if (themItems.length) {
    const themRes = await upsertItems(themItems)
    console.log(`✅ נשמרו/עודכנו: ${themRes.count} פריטים נושאיים`)
  }
} catch (e) {
  console.warn('⚠️  איסוף נושאי נכשל:', e.message)
}

// ── Yahoo Finance: חברות ישראליות דואליות ──
try {
  const yItems = await collectYahoo({ signalEnabled })
  if (yItems.length) {
    const yRes = await upsertItems(yItems)
    console.log(`✅ נשמרו/עודכנו: ${yRes.count} פריטים מ-Yahoo Finance`)
  }
} catch (e) {
  console.warn('⚠️  איסוף Yahoo נכשל:', e.message)
}

console.log(`\n⏱️  ${((Date.now() - t0) / 1000).toFixed(1)} שניות`)
