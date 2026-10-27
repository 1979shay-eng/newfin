// עדכון חד-פעמי: מעלה לרצפת "חשיבות גבוהה" ידיעות קיימות במאגר שעונות לכללי
// העדיפות (בנק מזרחי / יוני פנינג). ידיעות חדשות מטופלות אוטומטית ב-upsertItems.
// הרצה: node collector/backfill-priority.mjs           ← ריצה יבשה (רק מציג)
//       node collector/backfill-priority.mjs --apply   ← מעדכן בפועל
import { db } from './db.mjs'
import { isPriority, mizrahiBankIds, PRIORITY_FLOOR } from './priority.mjs'

const apply = process.argv.includes('--apply')
const bankIds = await mizrahiBankIds(db)
const cols = 'id,title,bottom_line,body,company_id,reliability,maya_report_id,materiality_score'

// מועמדים: אזכור בטקסט, או שיוך לחברת הבנק
const byId = new Map()
for (const [col, pat] of [
  ['title', '%מזרחי%'],
  ['bottom_line', '%מזרחי%'],
  ['title', '%פנינג%'],
  ['bottom_line', '%פנינג%'],
]) {
  const { data, error } = await db.from('items').select(cols).eq('status', 'published').ilike(col, pat)
  if (error) throw error
  for (const r of data) byId.set(r.id, r)
}
if (bankIds.size) {
  const { data, error } = await db.from('items').select(cols).eq('status', 'published').in('company_id', [...bankIds])
  if (error) throw error
  for (const r of data) byId.set(r.id, r)
}

const hits = [...byId.values()].filter((r) => isPriority(r, bankIds) && r.materiality_score < PRIORITY_FLOOR)
console.log(`${byId.size} מועמדים → ${hits.length} יועלו ל-${PRIORITY_FLOOR}${apply ? '' : ' (ריצה יבשה)'}\n`)
for (const r of hits) console.log(`  [${r.materiality_score}→${PRIORITY_FLOOR}] ${r.title.slice(0, 80)}`)

if (apply && hits.length) {
  const { error } = await db
    .from('items')
    .update({ materiality_score: PRIORITY_FLOOR })
    .in('id', hits.map((r) => r.id))
  if (error) throw error
  console.log(`\n✅ עודכנו ${hits.length} ידיעות`)
}
