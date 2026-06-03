// מנוע SIGNAL — שכבת ה-AI: הופך כותרת דיווח ל"שורה תחתונה" + כיוון + ציון.
// משתמש ב-Groq (חינמי, תואם OpenAI). אם אין מפתח — מנוטרל בעדינות.
import { getEnv } from './env.mjs'

const GROQ_KEY = getEnv('GROQ_API_KEY')
const MODEL = getEnv('GROQ_MODEL') || 'llama-3.3-70b-versatile'

export const signalEnabled = Boolean(GROQ_KEY)

const SYSTEM = `אתה עורך פיננסי בכיר במערכת מודיעין שוק ההון.
בהינתן כותרת של דיווח רשמי מהבורסה (ולעיתים שם החברה), החזר אך ורק JSON תקין במבנה:
{"direction":"bull|bear|neutral","score":<מספר 1-10>,"bottom_line":"<משפט אחד בעברית>"}

כללים:
- direction = ההשפעה הצפויה של הדיווח על מניית החברה.
- score = מידת המהותיות למשקיע (1 = זניח, 10 = דרמטי).
- bottom_line = משפט אחד קצר בעברית, בטון עיתונאי יבש וענייני, בלי גוף ראשון ובלי המילה "אני", שמסביר את המשמעות או ההקשר של הדיווח למשקיע.
- אל תמציא עובדות שאינן בכותרת. אם המידע דל — תן הקשר זהיר וכללי.
- מהותיות: הנפקות שגרתיות, תשקיפי מדף, תוצאות מכרזים, ריבית/פדיון ודיווחים טכניים = ציון נמוך (1-4). שמור ציון גבוה (8-10) רק לאירועים שמשנים החלטת השקעה: דוחות כספיים, מיזוג/רכישה, אזהרת רווח, זכייה בחוזה משמעותי, שינוי הנהלה בכירה.
- החזר JSON בלבד, ללא טקסט נוסף.`

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
