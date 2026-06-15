// מנוע SIGNAL — שכבת ה-AI: הופך כותרת דיווח ל"שורה תחתונה" + כיוון + ציון.
// משתמש ב-Groq (חינמי, תואם OpenAI). אם אין מפתח — מנוטרל בעדינות.
import { getEnv } from './env.mjs'

const GROQ_KEY = getEnv('GROQ_API_KEY')
const MODEL = getEnv('GROQ_MODEL') || 'llama-3.3-70b-versatile'
// השער הנושאי = סיווג זול. מנותב למודל קטן עם מכסה יומית נפרדת וגדולה,
// כדי לא לשרוף את תקציב המודל הגדול (100K טוקנים/יום) שמשמש להעשרה.
const GATE_MODEL = getEnv('GROQ_GATE_MODEL') || 'llama-3.1-8b-instant'

export const signalEnabled = Boolean(GROQ_KEY)

const SYSTEM = `אתה עורך פיננסי בכיר במערכת מודיעין שוק ההון הישראלי.
בהינתן כותרת דיווח רשמי מהבורסה (ולעיתים שם החברה), החזר אך ורק JSON תקין:
{"direction":"bull|bear|neutral","score":<1-10>,"bottom_line":"<עברית>"}

כללים:
- direction = ההשפעה הצפויה על מנית החברה (bull=חיובי, bear=שלילי, neutral=ניטרלי).
- score = מהותיות למשקיע (1=זניח, 10=דרמטי).
- bottom_line = 1-2 משפטים בעברית, **בטון עיתונאי ממוקד**. כתוב כמו כתב כלכלי ב-TheMarker:
  • פתח בפועל חזק: "החברה זכתה ב...", "הדירקטוריון אישר...", "מאזן הרבעון מצביע על...", "החברה הנפיקה..."
  • כלול את הנתון המרכזי אם קיים בכותרת (סכום, אחוז, שם חברה שנרכשה וכו')
  • אם הדיווח הוא מצגת תוצאות — ציין מה היא מסכמת ולאיזו תקופה
  • אסור: גוף ראשון, "אני", שיפוט חשיבות ("שגרתי", "משמעותי"), שלילה ("אינה מכילה", "ללא השפעה")
  • אל תמציא עובדות שאינן בכותרת

- מהותיות (score):
  • 8-10: דוחות כספיים, מיזוג/רכישה, אזהרת רווח, זכייה בחוזה גדול, שינוי שליטה
  • 7: מצגת תוצאות/רבעון/"מצגת לשוק ההון", שינוי מנכ"ל, דיבידנד גדול, תביעה מהותית
  • 4-6: מצגת שיווקית גנרית, שינוי החזקות קטן, דיווחי ציות שגרתיים
  • 1-3: הנפקות שגרתיות, תשקיפי מדף, ריבית/פדיון, דיווחים טכניים/פרוצדורליים

דוגמאות bottom_line איכותיות:
- "ברן זינקה 12% לאחר שחתמה על מזכר הבנת לפרויקט הבנות מים של 150 מיליון דולר באפריקה"
- "בזק הגישה לנאמן דוחות כספיים שנתיים לסדרות אג\"ח 11-14 לשנת 2025"
- "הדירקטוריון אישר חלוקת דיבידנד של 0.45 שקל למניה לרבעון הראשון"
- "מצגת התוצאות לרבעון הראשון 2026 מציגה את הביצועים הכספיים של החברה"

החזר JSON בלבד, ללא טקסט נוסף.`

// ── שער נושאי מחמיר ─────────────────────────────────────────────────
// מקבל ידיעה ממקור נושאי/זר (לרוב אנגלית) ומחליט בקפדנות אם יש לה השלכה ישראלית
// ברורה. רק מה שעובר נשמר — וכבר מנוסח עובדתית בעברית במילים שלנו (לא תרגום מילולי,
// כדי להישאר חוקי). מחזיר {relevant:false} לפסילה, או פריט מועשר מלא.
const THEMATIC_SYSTEM = `אתה עורך מודיעין שוק ההון. מקבל כותרת ותקציר של ידיעה ממקור נושאי/זר (לרוב באנגלית) בתחום מסוים.
המשימה: להחליט בקפדנות אם לידיעה יש השלכה ברורה וישירה על חברה ישראלית סחירה ספציפית, או על תת-ענף ישראלי סחיר מוגדר היטב (ביטחון, רחפנים, סייבר, אנרגיה, שבבים וכו').
החזר אך ורק JSON תקין:
{"relevant":true|false,"company":"<שם חברה ישראלית סחירה בעברית אם מעורבת ישירות, אחרת null>","direction":"bull|bear|neutral","score":<1-10>,"headline_he":"<כותרת עובדתית קצרה בעברית במילים שלך>","bottom_line":"<משפט אחד בעברית: ההשלכה על החברה/הענף הישראלי>"}

כללים מחמירים (ברירת המחדל היא לפסול — relevant=true רק כשהקשר הישראלי חד-משמעי):
- relevant=true רק אם מתקיים אחד מ: (א) חברה ישראלית סחירה ספציפית מעורבת ישירות ומהותית באירוע; (ב) אירוע קונקרטי משפיע ישירות על תת-ענף ישראלי סחיר מוגדר (לא "ענף הרחפנים העולמי").
- פסול מפורשות (relevant=false): "השלכה כללית על חברות הרחפנים/הביטחון בישראל" ללא חברה/אירוע ישראלי קונקרטי = הכללה מעורפלת, פוסל. וכן: רגולציה מקומית זרה, תוכן חובבני/צרכני, מחקר אקדמי, תאונה/אירוע נקודתי של חברה זרה, השקת מוצר זרה, חדשות כלליות.
- company = השם ה**עברי** המקובל של החברה הישראלית (למשל "אלביט מערכות", לא "Elbit Systems"). אם אין חברה ישראלית ספציפית — null.
- headline_he = ניסוח עובדתי מדויק משלך בעברית (לא תרגום מילולי). שמור על נכונות העובדה (אספקה≠רכישה, זכייה≠הפסד). טון עיתונאי יבש.
- bottom_line = ההשלכה הקונקרטית והספציפית למשקיע הישראלי, בלי גוף ראשון ובלי קלישאות כלליות.
- אל תמציא עובדות שאינן בכותרת/תקציר. בכל ספק — relevant=false.
- JSON בלבד, ללא טקסט נוסף.`

export async function gateThematic(item) {
  if (!GROQ_KEY) return null
  const user = `תחום: ${item.sector || '—'}\nכותרת: ${item.title}\nתקציר: ${(item.description || '').slice(0, 400)}`
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
      if (res.status === 429) console.warn('Groq rate limit — מדלג (גם אחרי retry)')
      else console.warn('Groq error', res.status, (await res.text()).slice(0, 200))
      return null
    }
    const data = await res.json()
    const out = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    if (!out.relevant) return { relevant: false }
    const headline_he =
      typeof out.headline_he === 'string' && out.headline_he.trim() ? out.headline_he.trim() : null
    if (!headline_he) return { relevant: false } // בלי כותרת עברית תקינה — פוסל
    const direction = ['bull', 'bear', 'neutral'].includes(out.direction) ? out.direction : 'neutral'
    let score = Math.round(Number(out.score))
    if (!Number.isFinite(score)) score = 5
    score = Math.max(1, Math.min(10, score))
    const bottom_line =
      typeof out.bottom_line === 'string' && out.bottom_line.trim()
        ? out.bottom_line.trim().slice(0, 300)
        : null
    const company = typeof out.company === 'string' && out.company.trim() ? out.company.trim() : null
    return { relevant: true, company, direction, score, headline_he, bottom_line }
  } catch (e) {
    console.warn('gateThematic err:', e.message)
    return null
  }
}

export async function enrich(item) {
  if (!GROQ_KEY) return null
  const user = `כותרת: ${item.title}\nחברה: ${item.company_name ?? '—'}`
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
      else console.warn('Groq error', res.status)
      return null
    }
    const data = await res.json()
    const out = JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
    const direction = ['bull', 'bear', 'neutral'].includes(out.direction) ? out.direction : 'neutral'
    let score = Math.round(Number(out.score))
    if (!Number.isFinite(score)) score = item.materiality_score ?? 5
    score = Math.max(1, Math.min(10, score))
    const bottom_line =
      typeof out.bottom_line === 'string' && out.bottom_line.trim()
        ? out.bottom_line.trim().slice(0, 300)
        : null
    return { direction, materiality_score: score, bottom_line }
  } catch (e) {
    console.warn('enrich err:', e.message)
    return null
  }
}
