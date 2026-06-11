// תיקון חד-פעמי: מוצא bottom_line בעלי ניסוח מזלזל ("שגרתי", "אינו משפיע" וכו')
// ומחדש אותם עם ההנחיה המעודכנת ב-signal.mjs (תיאור עובדתי של תוכן הדיווח).
// הרצה: node collector/fix-bottomlines.mjs
import { db } from './db.mjs'
import { enrich, signalEnabled } from './signal.mjs'

// זיהוי ניסוח מזלזל/שלילי: כל אזכור של מה שהדיווח חסר / לא עושה / לא משפיע.
// תופס גם את דפוס ה"אך" ("מספק מידע, אך ללא פרטים משמעותיים").
const BAD_RE =
  /שגרתי|טכני בלבד|אינו? משפיע|אינו? מהווה|אינה? מכיל|אין בו מידע|אין בה מידע|ללא מידע|ללא פרטים|ללא השפעה|לא משמעות|לא מהות|חסר משמעות|אך ללא|אך המידע|אינה ברור|לא ברור|לא ספציפי|מידע ספציפי|אינו? מספק|לא מספק|פרטים משמעותיים|מידע משמעותי|מידע מהותי/
const isBad = (s) => typeof s === 'string' && BAD_RE.test(s)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!signalEnabled) {
  console.error('⚠️  אין GROQ_API_KEY — אי אפשר לחדש. הסקריפט יאפס בלבד את השורות הגרועות.')
}

// שליפת כל הפריטים המועשרים וסינון בצד הלקוח לפי regex (עמיד יותר מ-ilike)
const { data: all, error } = await db
  .from('items')
  .select('id, title, bottom_line, company_id, companies(name_he)')
  .not('bottom_line', 'is', null)

if (error) throw error
const rows = all.filter((r) => isBad(r.bottom_line))
console.log(`נמצאו ${rows.length} פריטים עם ניסוח מזלזל לתיקון (מתוך ${all.length} מועשרים)`)

let fixed = 0
let cleared = 0
for (const r of rows) {
  const company_name = r.companies?.name_he ?? null
  let newBL = null
  // עד 3 ניסיונות לקבל ניסוח עובדתי שאינו מזלזל; אחרת מרוקנים (עדיף ריק על גרוע)
  if (signalEnabled) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const e = await enrich({ title: r.title, company_name })
      await sleep(2500) // כיבוד מגבלת הקצב של Groq
      const cand = e?.bottom_line ?? null
      if (cand && !isBad(cand)) { newBL = cand; break }
    }
  }

  const { error: upErr } = await db.from('items').update({ bottom_line: newBL }).eq('id', r.id)
  if (upErr) {
    console.warn('  עדכון נכשל:', r.title.slice(0, 40), upErr.message)
    continue
  }
  if (newBL) {
    fixed++
    console.log(`  ✏️  ${r.title.slice(0, 45)} → ${newBL.slice(0, 60)}`)
  } else {
    cleared++
    console.log(`  🧹 רוקן (אין ניסוח טוב): ${r.title.slice(0, 45)}`)
  }
}

console.log(`\n✅ הסתיים — חודשו ${fixed}, רוקנו ${cleared} מתוך ${rows.length}`)
