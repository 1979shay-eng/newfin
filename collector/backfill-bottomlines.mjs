// השלמת שורות תחתונות לפריטים שכבר בפיד אבל נשארו "קירחים".
// למה זה נחוץ: האספן מעשיר רק פריטים שהוא שולף מחדש (חלון של ~יום), ולכן פריט
// שהציון שלו עלה בדיעבד (rescore-noise.mjs) או שפוספס בגלל מכסה — נשאר בלי
// שורה תחתונה לנצח. כאן שולפים ישירות מהמאגר, מהחשוב לפחות חשוב.
//
// הרצה: node collector/backfill-bottomlines.mjs [--limit 40] [--min 7] [--apply]
//   --limit  כמה פריטים להעשיר בריצה (ברירת מחדל 40 — שמירה על מכסת Groq היומית)
//   --min    ציון מינימלי (ברירת מחדל 7 — הכרטיסים הבולטים ביותר)
//   --apply  בלעדיו רץ יבש ורק מדפיס מה היה קורה
import { db } from './db.mjs'
import { enrich, signalEnabled } from './signal.mjs'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback
}
const LIMIT = arg('limit', 40)
const MIN_SCORE = arg('min', 7)
const APPLY = process.argv.includes('--apply')
const QUICK = process.argv.includes('--quick')
const MONTHS_BACK = 3
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!signalEnabled) {
  console.error('⚠️  אין GROQ_API_KEY — אי אפשר להעשיר.')
  process.exit(1)
}

const since = new Date()
since.setMonth(since.getMonth() - MONTHS_BACK)

// מהציון הגבוה לנמוך, ובתוך אותו ציון — מהחדש לישן. כך המכסה מושקעת קודם
// על הכרטיסים שהקורא באמת רואה בראש הפיד.
const { data: rows, error } = await db
  .from('items')
  .select('id, title, body, materiality_score, company_id, companies(name_he)')
  .eq('status', 'published')
  .gte('materiality_score', MIN_SCORE)
  .is('bottom_line', null)
  .gte('published_at', since.toISOString())
  .order('materiality_score', { ascending: false })
  .order('published_at', { ascending: false })
  .limit(LIMIT)
if (error) throw error

console.log(`נמצאו ${rows.length} פריטים בציון ${MIN_SCORE}+ בלי שורה תחתונה (תקרה: ${LIMIT})`)
if (!APPLY) {
  for (const r of rows) console.log(`  [${r.materiality_score}] ${r.title.slice(0, 80)}`)
  console.log('\n(מצב יבש — להחלה בפועל הרץ עם --apply)')
  process.exit(0)
}

// מגבלת Groq היא לדקה (TPM), לא ליום — היא מתמלאת מחדש כל דקה. לכן כישלון
// אינו סיבה לעצור אלא להמתין: האספן החי רץ במקביל ומרוקן את החלון בפרצים,
// והסקריפט פשוט צריך להיכנס בין הפרצים. השהיה עולה 20 → 40 → 60 שניות.
async function enrichWithBackoff(item) {
  // --quick: בלי המתנות. משמש בלולאת האספן, שם עיכוב של דקות היה דוחה את
  // סבב האיסוף הבא; ממילא תהיה הזדמנות נוספת בעוד 10 דקות.
  const waits = QUICK ? [0] : [0, 20000, 40000, 60000]
  for (let attempt = 0; attempt < waits.length; attempt++) {
    if (waits[attempt]) {
      console.log(`     ⏳ ממתין ${waits[attempt] / 1000}ש' (חלון המכסה מתמלא כל דקה)...`)
      await sleep(waits[attempt])
    }
    const e = await enrich(item)
    if (e?.bottom_line) return e
  }
  return null
}

let done = 0
let misses = 0
for (const r of rows) {
  const e = await enrichWithBackoff({
    title: r.title,
    body: r.body,
    company_name: r.companies?.name_he ?? null,
  })
  if (!e?.bottom_line) {
    // גם אחרי 2 דקות של המתנה אין מענה — כנראה תקלה אמיתית ולא עומס.
    if (++misses >= 3) {
      console.warn('\n⚠️  3 פריטים נכשלו גם אחרי המתנות — עוצר.')
      break
    }
    continue
  }
  misses = 0
  // הציון נשאר כפי שקבעו הכללים — הם כווננו מול הנתונים, ואילו ה-AI נוטה
  // לנפח טפסים טכניים (נתן 8 ל"פתיחת מסחר — עושה שוק"). לוקחים ממנו רק
  // את הניסוח ואת הכיוון.
  const { error: upErr } = await db
    .from('items')
    .update({ bottom_line: e.bottom_line, direction: e.direction })
    .eq('id', r.id)
  if (upErr) {
    console.warn('  עדכון נכשל:', r.title.slice(0, 40), upErr.message)
    continue
  }
  done++
  console.log(`  ✏️  [${r.materiality_score}] ${r.title.slice(0, 45)} → ${e.bottom_line.slice(0, 55)}...`)
  await sleep(2500) // כיבוד מגבלת הקצב של Groq
}

console.log(`\n✅ הושלמו ${done} שורות תחתונות`)
process.exit(0)
