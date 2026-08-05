// עדכון חד-פעמי: החלת כללי המהותיות המעודכנים על המאגר הקיים.
// נחוץ כי האספן מדרג רק דיווחים שנשלפים מחדש (חלון של ~יום), ולכן ידיעות
// ישנות היו נשארות עם הציון הישן וממשיכות להציף את הפיד.
//
// מדיניות (מונעת דריסה של שיפוט ה-AI):
//   • טופס שגרתי (מצבת, אסיפה, דח"צ, החזקות...) → נכפה לציון הכלל, גם אם ה-AI
//     נתן ציון גבוה. אלה בדיוק הפריטים שהמשתמש ביקש להעלים מהפיד.
//   • פריט מועשר (יש bottom_line) שאינו טופס שגרתי → לא נוגעים. ה-AI ראה אותו.
//   • פריט לא מועשר → מקבל את ציון הכלל החדש.
//
// הרצה: node collector/rescore-noise.mjs [--apply]
// בלי --apply רץ במצב יבש ומדפיס מה היה משתנה.
import { db } from './db.mjs'
import { scoreReport } from './materiality.mjs'

const APPLY = process.argv.includes('--apply')
const MONTHS_BACK = 9

const { data: sources } = await db.from('sources').select('id, name')
const mayaId = sources.find((s) => s.name === 'מאיה')?.id ?? null

const since = new Date()
since.setMonth(since.getMonth() - MONTHS_BACK)

// שליפה בעימוד — המאגר גדול מ-1000 שורות
let rows = []
for (let page = 0; ; page++) {
  const { data, error } = await db
    .from('items')
    .select('id, title, materiality_score, direction, bottom_line, source_id')
    .gte('published_at', since.toISOString())
    .order('published_at', { ascending: false })
    .range(page * 1000, page * 1000 + 999)
  if (error) throw error
  rows = rows.concat(data)
  if (data.length < 1000) break
}
console.log(`נשלפו ${rows.length} פריטים מ-${MONTHS_BACK} החודשים האחרונים`)

const changes = []
for (const r of rows) {
  const source = r.source_id === mayaId ? 'maya' : 'news'
  const next = scoreReport({ title: r.title }, { source })
  const isRoutine = next.materiality_score <= 2 // רק טפסים שגרתיים מגיעים ל-2
  if (r.bottom_line && !isRoutine) continue // שיפוט ה-AI גובר
  if (next.materiality_score === r.materiality_score) continue
  changes.push({ id: r.id, title: r.title, from: r.materiality_score, to: next.materiality_score, direction: next.direction })
}

const down = changes.filter((c) => c.from >= 4 && c.to < 4)
const up = changes.filter((c) => c.to > c.from)
console.log(`\nשינויים: ${changes.length}`)
console.log(`  ⬇️  יורדים מהפיד (4+ → פחות מ-4): ${down.length}`)
console.log(`  ⬆️  עולים: ${up.length}`)
console.log('\nדוגמאות ליורדים:')
for (const c of down.slice(0, 15)) console.log(`   [${c.from}→${c.to}] ${c.title.slice(0, 75)}`)
console.log('\nדוגמאות לעולים:')
for (const c of up.slice(0, 15)) console.log(`   [${c.from}→${c.to}] ${c.title.slice(0, 75)}`)

if (!APPLY) {
  console.log('\n(מצב יבש — להחלה בפועל הרץ עם --apply)')
  process.exit(0)
}

let done = 0
for (const c of changes) {
  const { error } = await db
    .from('items')
    .update({ materiality_score: c.to, direction: c.direction })
    .eq('id', c.id)
  if (error) {
    console.warn('  עדכון נכשל:', c.title.slice(0, 40), error.message)
    continue
  }
  done++
  if (done % 200 === 0) console.log(`  ...${done}/${changes.length}`)
}
console.log(`\n✅ עודכנו ${done} פריטים`)
process.exit(0)
