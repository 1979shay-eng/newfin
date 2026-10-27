// כללי עדיפות קשיחים: נושאים שהמשתמש קבע שהם תמיד בחשיבות גבוהה, בלי קשר לציון
// שנתן מנוע הכללים או ה-AI. מיושם בנקודה אחת (upsertItems) כך שכל מסלולי האיסוף
// — מאיה, RSS, נושאי, Yahoo — עוברים דרכו.
//
// כרגע: בנק מזרחי טפחות, והאסטרטג הראשי שלו יוני פנינג.

// רצפה לציון: 8+ = "חשיבות גבוהה". 9 כדי שגם בדירוג "מומלץ" יעלו לראש.
export const PRIORITY_FLOOR = 9

// "מזרחי" לבד הוא גם שם משפחה ומילה רגילה ("חזי גור מזרחי", "הדרום מזרחי") —
// לכן דורשים את שם הבנק המלא. "במזרחי טפחות" נתפס כי אין דרישת גבול-מילה.
const MIZRAHI = /מזרחי[\s\-־]*טפחות|בנק מזרחי|Mizrahi[\s-]*Tefahot/i
const PENNING = /פנינג|Penning/i

// דיווחי מאיה טכניים-שגרתיים של הבנק — נשארים עם הציון הרגיל (לא מוצפים לגבוהה)
// (אסיפות מהותיות — מיזוג/רכישה — כבר מקבלות ציון גבוה ממנוע הכללים עצמו.)
const ROUTINE = /פתיחת מסחר|מרשם בעלי מניות|מצבת הון|החזקות בעלי עניין|שינוי(?: ב)?החזקות|שטר(?:י)? נאמנות|פרטים מזהים לניירות|אישור מנכ"?ל הבורסה|רישום ניירות ערך|טיוטת (?:תנאי|שטר)|כתבי אופציה לעובדים|ביטול עסקות|זימון אסיפה|תוצאות אסיפה|כתב הצבעה/
// ציון מתחת לזה = מנוע הכללים זיהה דיווח טכני מובהק (טופס כללי וכד') — לא מועלה
const MAYA_MIN_SCORE = 3

// מזהה חברת הבנק (לא "מזרחי טפחות הנפ" — חברת ההנפקות, שכולה דיווחי אג"ח טכניים)
const MIZRAHI_BANK_NAME = 'מזרחי טפחות'
let bankIdsPromise = null
async function mizrahiBankIds(db) {
  if (!bankIdsPromise) {
    bankIdsPromise = db
      .from('companies')
      .select('id')
      .eq('name_he', MIZRAHI_BANK_NAME)
      .then(({ data }) => new Set((data || []).map((c) => c.id)))
  }
  return bankIdsPromise
}

const isMaya = (it) => it.reliability === 'verified' || /^\d+$/.test(String(it.maya_report_id ?? ''))
const textOf = (it) => `${it.title ?? ''} ${it.bottom_line ?? ''} ${it.body ?? ''}`

// האם הפריט בעדיפות? bankIds — Set של מזהי חברת הבנק (או ריק)
export function isPriority(it, bankIds = new Set()) {
  const text = textOf(it)
  if (PENNING.test(text)) return true
  if (MIZRAHI.test(text) || (it.company_id && bankIds.has(it.company_id))) {
    // דיווח מאיה שגרתי (פתיחת מסחר, החזקות, אסיפות שיפוי וכו') — לא מועלה
    if (isMaya(it) && (ROUTINE.test(it.title ?? '') || (it.materiality_score ?? 0) < MAYA_MIN_SCORE)) return false
    return true
  }
  return false
}

// תגית כותרת לפריט עדיפות בלי חברה מזוהה — כדי שלא ייזרק במסנן ה-RSS ויוצג בפיד
// (הפיד מציג רק פריט עם חברה או תגית). מסנכרוני, על הכותרת והתקציר בלבד.
export function priorityTag(it) {
  const text = textOf(it)
  if (MIZRAHI.test(text)) return { tag: 'בנקים', type: 'sector' }
  if (PENNING.test(text)) return { tag: 'שוק ההון', type: 'macro' }
  return null
}

// מעלה לרצפה את ציון פריטי העדיפות. מחזיר מערך חדש (לא משנה את המקורי).
export async function applyPriority(db, items) {
  const bankIds = await mizrahiBankIds(db)
  return items.map((it) =>
    isPriority(it, bankIds) && (it.materiality_score ?? 0) < PRIORITY_FLOOR
      ? { ...it, materiality_score: PRIORITY_FLOOR }
      : it,
  )
}

export { mizrahiBankIds }
