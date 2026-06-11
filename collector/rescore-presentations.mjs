// עדכון חד-פעמי: מצגות המסכמות דוחות/רבעון/תוצאות (כולל "מצגת לשוק ההון") הן
// סיכום ביצועים מהותי → ציון 7 לפחות. מעלה בלבד, לא מוריד פריטים שכבר גבוהים.
// הרצה: node collector/rescore-presentations.mjs
import { db } from './db.mjs'

const FINANCIAL_PRES = /מצגת.*(דוח|כספי|רבעון|תקופתי|שנתי|תוצאות|סיכום|שוק ההון)/
const TARGET = 7

const { data, error } = await db
  .from('items')
  .select('id, title, materiality_score')
  .ilike('title', '%מצגת%')
if (error) throw error

const toRaise = data.filter((r) => FINANCIAL_PRES.test(r.title) && r.materiality_score < TARGET)
console.log(`מצגות תוצאות שיועלו ל-${TARGET}: ${toRaise.length}`)

let done = 0
for (const r of toRaise) {
  const { error: upErr } = await db
    .from('items')
    .update({ materiality_score: TARGET })
    .eq('id', r.id)
  if (upErr) {
    console.warn('  עדכון נכשל:', r.title.slice(0, 45), upErr.message)
    continue
  }
  done++
  console.log(`  ⬆️  [${r.materiality_score}→${TARGET}] ${r.title.slice(0, 50)}`)
}
console.log(`\n✅ הועלו ${done} מצגות תוצאות`)
process.exit(0)
