// מנוע SIGNAL — שכבת ה-AI: הופך כותרת דיווח ל"שורה תחתונה" + כיוון + ציון.
// משתמש ב-Groq (חינמי, תואם OpenAI). אם אין מפתח — מנוטרל בעדינות.
import { getEnv } from './env.mjs'
import { loadCompanies, inventedCompany, dropRelativeTime } from './rss.mjs'

const GROQ_KEY = getEnv('GROQ_API_KEY')
const MODEL = getEnv('GROQ_MODEL') || 'qwen/qwen3.8-27b'
// השער הנושאי = סיווג זול. מנותב למודל קטן עם מכסה יומית נפרדת וגדולה,
// כדי לא לשרוף את תקציב המודל הגדול (100K טוקנים/יום) שמשמש להעשרה.
const GATE_MODEL = getEnv('GROQ_GATE_MODEL') || 'qwen/qwen3.8-27b'

export const signalEnabled = Boolean(GROQ_KEY)

// הפרומפט נשמר קצר בכוונה. עברית מתפרקת לטוקנים בצפיפות של כמעט תו-לטוקן,
// והגרסה המפורטת עלתה 2,520 טוקני קלט לכל פריט — מול מכסה יומית של 100K.
// כלומר ~37 פריטים ליום מיצו את כל התקציב. כל כלל תוכן נשמר, רק הניסוח דחוס
// ונותרה דוגמה אחת במקום שלוש.
const SYSTEM = `אתה עורך פיננסי בכיר בשוק ההון הישראלי. בהינתן כותרת דיווח (ולעיתים שם חברה ותקציר), החזר JSON תקין בלבד:
{"direction":"bull|bear|neutral","score":<1-10>,"bottom_line":"<עברית>"}

direction = אופי הידיעה לעסקי החברה — לא תחזית למחיר המניה.
score = מהותיות: 8-10 דוח כספי/מיזוג/רכישה/אזהרת רווח/זכייה גדולה/שינוי שליטה; 7 מצגת תוצאות/מנכ"ל/דיבידנד/תביעה; 4-6 שגרה עסקית; 1-3 טכני, פרוצדורלי, הנפקות שגרתיות, החזקות ומצבות, אופציות (גם בסכומים גדולים).

bottom_line = 3-4 משפטים בטון עיתונאי יבש:
1. העובדה המרכזית — פועל חזק + הנתון (סכום, אחוז, שם).
2. הקשר — איזו תקופה/פעילות, מה קדם.
3. המשמעות העסקית לחברה או לענף ("עשוי"/"צפוי", בלי לנחש מספרים).
4. רשות — מה לעקוב בהמשך.

אסור: גוף ראשון, שיפוט חשיבות ("שגרתי","משמעותי"), ניסוח שולל ("אינו מכיל","ללא השפעה"), המלצה (קנייה/מכירה/החזקה), תחזית למחיר המניה, והמצאת עובדות שאינן במקור.
אל תזכיר חברה, מניה או אדם שאינם בקלט. מילה כמו "אדמה" או "חשמל" אינה בהכרח שם חברה. תאריך — כפי שבמקור; "היום"/"מחר"/"השבוע" רק אם המקור אומר זאת. מידע דל → 2-3 משפטים, ובדיווח טכני דלג על משפט ההשפעה.
אם הכותרת מסתירה את שם החברה — פתח בשמה המפורש מתוך התקציר.

דוגמה: "הדירקטוריון אישר דיבידנד של 0.45 שקל למניה לרבעון הראשון. זו חלוקה שנייה ברציפות לאחר שנת שיא. המהלך משקף ביטחון בתזרים השוטף של החברה."

JSON בלבד.`

// ── שער נושאי מחמיר ─────────────────────────────────────────────────
// מקבל ידיעה ממקור נושאי/זר (לרוב אנגלית) ומחליט בקפדנות אם יש לה השלכה ישראלית
// ברורה. רק מה שעובר נשמר — וכבר מנוסח עובדתית בעברית במילים שלנו (לא תרגום מילולי,
// כדי להישאר חוקי). מחזיר {relevant:false} לפסילה, או פריט מועשר מלא.
const THEMATIC_SYSTEM = `אתה עורך מודיעין שוק ההון. מקבל כותרת ותקציר של ידיעה ממקור נושאי/זר (לרוב באנגלית) בתחום מסוים.
המשימה: להחליט בקפדנות אם לידיעה יש השלכה ברורה וישירה על חברה ישראלית סחירה ספציפית, או על תת-ענף ישראלי סחיר מוגדר היטב (ביטחון, רחפנים, סייבר, אנרגיה, שבבים וכו').
החזר אך ורק JSON תקין:
{"relevant":true|false,"company":"<שם חברה ישראלית סחירה בעברית אם מעורבת ישירות, אחרת null>","direction":"bull|bear|neutral","score":<1-10>,"headline_he":"<כותרת עובדתית קצרה בעברית במילים שלך>","bottom_line":"<2-3 משפטים בעברית: העובדה, ההקשר, וההשלכה האפשרית על החברה/הסקטור הישראלי>"}

כללים מחמירים (ברירת המחדל היא לפסול — relevant=true רק כשהקשר הישראלי חד-משמעי):
- relevant=true רק אם מתקיים אחד מ: (א) חברה ישראלית סחירה ספציפית מעורבת ישירות ומהותית באירוע; (ב) אירוע קונקרטי משפיע ישירות על תת-ענף ישראלי סחיר מוגדר (לא "ענף הרחפנים העולמי").
- פסול מפורשות (relevant=false): "השלכה כללית על חברות הרחפנים/הביטחון בישראל" ללא חברה/אירוע ישראלי קונקרטי = הכללה מעורפלת, פוסל. וכן: רגולציה מקומית זרה, תוכן חובבני/צרכני, מחקר אקדמי, תאונה/אירוע נקודתי של חברה זרה, השקת מוצר זרה, חדשות כלליות.
- company = השם ה**עברי** המקובל של החברה הישראלית (למשל "אלביט מערכות", לא "Elbit Systems"). אם אין חברה ישראלית ספציפית — null.
- headline_he = ניסוח עובדתי מדויק משלך בעברית (לא תרגום מילולי). שמור על נכונות העובדה (אספקה≠רכישה, זכייה≠הפסד). טון עיתונאי יבש.
- bottom_line = 2-3 משפטים: העובדה המרכזית, הקשר קצר, וההשלכה העסקית הקונקרטית על החברה/הסקטור הישראלי ("עשוי", "צפוי" — בלי לנחש מספרים). בלי גוף ראשון, בלי קלישאות כלליות, בלי המלצה ובלי תחזית למחיר מניה.
- direction = אופי הידיעה לעסקי החברה/הסקטור — לא תחזית למחיר המניה.
- אל תמציא עובדות שאינן בכותרת/תקציר. בכל ספק — relevant=false.
- תאריכים: העתק את התאריך שבמקור ("ב-2 בנובמבר"). אל תכתוב "היום", "מחר" או "השבוע" אם המקור לא אומר זאת במפורש — אינך יודע מה התאריך היום.
- JSON בלבד, ללא טקסט נוסף.`

export async function gateThematic(item) {
  if (!GROQ_KEY) return null
  const pub = item.published ? new Date(item.published) : null
  const pubLine =
    pub && !isNaN(pub) ? `\nפורסם במקור: ${pub.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}` : ''
  const user = `תחום: ${item.sector || '—'}${pubLine}\nכותרת: ${item.title}\nתקציר: ${(item.description || '').slice(0, 400)}`
  try {
    let res
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: GATE_MODEL,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: THEMATIC_SYSTEM },
            { role: 'user', content: user },
          ],
        }),
      })
      if (res.status !== 429) break
      // rate limit — המתנה קצרה וניסיון נוסף אחד. לא ממתינים ארוך (חוסם את הריצה
      // כולה מול מגבלת הזמן); ידיעה שנדחית תנוסה שוב בריצה הבאה בזכות הדה-דופ.
      const wait = Number(res.headers.get('retry-after')) * 1000 || 3000
      await new Promise((r) => setTimeout(r, Math.min(wait, 4000)))
    }
    if (!res.ok) {
      if (res.status === 429) {
        // מכסה אזלה — מצב זמני. מאותתים לקורא לעצור (לא לשרוף ניסיונות), והפריט
        // יישאר "טרי" וינוסה שוב בריצה הבאה. לא שומרים שום החלטה כאן.
        console.warn('Groq rate limit — מדלג (גם אחרי retry)')
        return { rateLimited: true }
      }
      flagDeadModel(res.status)
      console.warn('Groq error', res.status, (await res.text()).slice(0, 200))
      return null
    }
    const data = await res.json()
    const out = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    if (!out.relevant) return { relevant: false }
    // "היום"/"מחר" שלא במקור — מושמט (ראה dropRelativeTime)
    const src = `${item.title} ${item.description ?? ''}`
    const head = dropRelativeTime(typeof out.headline_he === 'string' ? out.headline_he.trim() : '', src)
    if (head.dropped.length) console.warn(`✂️ הושמט "${head.dropped.join('", "')}" מהכותרת: ${item.title.slice(0, 60)}`)
    const headline_he = head.text || null
    if (!headline_he) return { relevant: false } // בלי כותרת עברית תקינה — פוסל
    const direction = ['bull', 'bear', 'neutral'].includes(out.direction) ? out.direction : 'neutral'
    let score = Math.round(Number(out.score))
    if (!Number.isFinite(score)) score = 5
    score = Math.max(1, Math.min(10, score))
    const bottom_line =
      typeof out.bottom_line === 'string' && out.bottom_line.trim()
        ? dropRelativeTime(out.bottom_line.trim(), src).text.slice(0, 500)
        : null
    const company = typeof out.company === 'string' && out.company.trim() ? out.company.trim() : null
    return { relevant: true, company, direction, score, headline_he, bottom_line }
  } catch (e) {
    console.warn('gateThematic err:', e.message)
    return null
  }
}

// מודל שהוסר מהשירות מחזיר 404 — ואז *כל* ההעשרה נכשלת בשקט (קרה ב-17.08.2026:
// חודשיים בלי שורה תחתונה אחת). קוד יציאה 3 מסמן ללולאה ב-collect.yml להכשיל את
// הריצה בסופה, כך ש-GitHub שולח מייל התראה במקום שהתקלה תעבור בשקט.
// ציון סופי = ציון הכללים, וה-AI רשאי להזיז אותו ב-2 לכל היותר לכל כיוון.
// הכללים כווננו מול נתוני אמת; ה-AI לבדו גם ניפח טפסים טכניים (8 ל"עושה שוק")
// וגם קבר אירועים מהותיים (1 להצעת רכש, 3 למזכר מיזוג — qwen, 14.10.2026).
export function blendScore(ruleScore, aiScore) {
  if (!Number.isFinite(aiScore)) return ruleScore
  return Math.max(ruleScore - 2, Math.min(ruleScore + 2, aiScore))
}

export function flagDeadModel(status) {
  if (status !== 404) return
  console.error(`⛔ המודל ${MODEL} לא קיים יותר בשירות Groq — ההעשרה מושבתת. יש להחליף מודל ב-signal.mjs`)
  process.exitCode = 3
}

export async function enrich(item) {
  if (!GROQ_KEY) return null
  const desc = (item.body || item.description || '').slice(0, 500)
  const user = `כותרת: ${item.title}\nחברה: ${item.company_name ?? '—'}${desc ? `\nתקציר מהמקור: ${desc}` : ''}`
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) {
      if (res.status === 429) console.warn('Groq rate limit — מדלג')
      else {
        flagDeadModel(res.status)
        console.warn('Groq error', res.status)
      }
      return null
    }
    const data = await res.json()
    const out = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    const direction = ['bull', 'bear', 'neutral'].includes(out.direction) ? out.direction : 'neutral'
    let score = Math.round(Number(out.score))
    if (!Number.isFinite(score)) score = item.materiality_score ?? 5
    score = Math.max(1, Math.min(10, score))
    let bottom_line =
      typeof out.bottom_line === 'string' && out.bottom_line.trim()
        ? out.bottom_line.trim().slice(0, 700)
        : null
    // תקציר שמזכיר חברה סחירה שלא מופיעה במקור — נפסל כולו (גם הכיוון), כמו
    // כישלון. קרה בפועל: "נייס קופצת 6%" בכתבת סיכום מסחר שלא הזכירה את נייס.
    if (bottom_line) {
      const source = `${item.title} ${item.company_name ?? ''} ${item.body || item.description || ''}`
      const invented = inventedCompany(bottom_line, source, await loadCompanies())
      if (invented) {
        console.warn(`🚫 תקציר נפסל — הזכיר את "${invented}" שלא מופיע במקור: ${item.title.slice(0, 60)}`)
        return null
      }
      // "היום"/"מחר" שלא במקור — מושמט, לא נפסל (ראה dropRelativeTime)
      bottom_line = dropRelativeTime(bottom_line, source).text
    }
    return { direction, materiality_score: score, bottom_line }
  } catch (e) {
    console.warn('enrich err:', e.message)
    return null
  }
}
