// סיווג חברות לסקטור בורסאי — ממלא את companies.sector (UPDATE, בלי migration).
// משתמש ב-Groq 8b (זול, מכסה נפרדת) ובאצ'ים של ~20 חברות לקריאה. רץ מעט בכל
// ריצת אספן וממלא בהדרגה; כשאין חברות בלי סקטור — no-op.
import { db } from './db.mjs'
import { getEnv } from './env.mjs'

const GROQ_KEY = getEnv('GROQ_API_KEY')
const MODEL = getEnv('GROQ_GATE_MODEL') || 'llama-3.1-8b-instant'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// טקסונומיית סקטורים — מיושרת לרשימת הענפים של הבורסה בת"א (אושר ע"י המשתמש)
export const SECTORS = [
  'בנקים',
  'ביטוח',
  'פיננסים',
  'נדל"ן ובינוי',
  'תעשייה',
  'מסחר ושירותים',
  'טכנולוגיה',
  'ביומד',
  'נפט וגז',
  'אנרגיה מתחדשת',
  'כימיה גומי ופלסטיק',
  'השקעה ואחזקות',
  'אחר',
]

const SYSTEM = `אתה ממיין חברות הנסחרות בבורסה בתל אביב לסקטור.
בהינתן רשימת שמות חברות, החזר JSON שממפה כל שם בדיוק לסקטור אחד מהרשימה הסגורה:
${SECTORS.join(', ')}.
פורמט: {"<שם חברה>":"<סקטור>"}. אם לא ידוע בוודאות — "אחר". JSON בלבד, בלי טקסט נוסף.`

// מפת seed למייג'ורים מוכרים שאין בשמם רמז-סקטור (8b מפספס אותם). מפתחות 4+ תווים
// כדי למנוע התאמות-שווא ב-substring. אלה החברות שהכי סביר שיופיעו בפיד.
const SEED = {
  טאואר: 'טכנולוגיה', אורבוטק: 'טכנולוגיה', קמטק: 'טכנולוגיה', נייס: 'טכנולוגיה',
  פורמולה: 'טכנולוגיה', מלאנוקס: 'טכנולוגיה', נקסטויז: 'טכנולוגיה', אורבית: 'טכנולוגיה',
  טבע: 'ביומד', אופקו: 'ביומד', קמהדע: 'ביומד', פריגו: 'ביומד',
  מליסרון: 'נדל"ן ובינוי', עזריאלי: 'נדל"ן ובינוי', 'אלוני חץ': 'נדל"ן ובינוי',
  גזית: 'נדל"ן ובינוי', אמות: 'נדל"ן ובינוי', אשטרום: 'נדל"ן ובינוי',
  'שיכון ובינוי': 'נדל"ן ובינוי', אלקטרה: 'נדל"ן ובינוי', דמרי: 'נדל"ן ובינוי', אאורה: 'נדל"ן ובינוי',
  אלביט: 'תעשייה',
  אנלייט: 'אנרגיה מתחדשת', דוראל: 'אנרגיה מתחדשת', נופר: 'אנרגיה מתחדשת', אנרגיאן: 'נפט וגז',
  'דלק קבוצה': 'נפט וגז', 'דלק רכב': 'מסחר ושירותים',
  'חברה לישראל': 'השקעה ואחזקות',
  שטראוס: 'מסחר ושירותים', תנובה: 'מסחר ושירותים',
  שופרסל: 'מסחר ושירותים', 'רמי לוי': 'מסחר ושירותים', פוקס: 'מסחר ושירותים', דלתא: 'מסחר ושירותים', סנו: 'מסחר ושירותים',
}

function seedSector(name) {
  for (const k in SEED) if (name.includes(k)) return SEED[k]
  return null
}

// כללי-מילים מדויקים (precision-first) — תופסים שמות עם רמז סקטור ברור בלי AI.
// סדר חשוב: הספציפי קודם. נורה רק כשבטוח; השאר עובר ל-AI.
const RULES = [
  [/בנק\b|לאומי|הפועלים|מזרחי טפחות|דיסקונט|הבינלאומי/, 'בנקים'],
  [/ביטוח|הראל|מגדל ביטוח|הפניקס|מנורה|איילון/, 'ביטוח'],
  [/אשראי|כרטיסי אשראי|ישראכרט|שירותים פיננסיים|בית השקעות|בתי השקעות/, 'פיננסים'],
  [/נדל"?ן|נכסים|מקרקעין|מבני|מגורים|ריט |חניונ|קניונ|בינוי|בנייה/, 'נדל"ן ובינוי'],
  // הערה: "דלק" הוסר — דו-משמעי (דלק רכב = יבואנית רכב). דלק קבוצה ב-seed.
  [/אנרגיה מתחדש|סולאר|פוטו-?וולט|רוח|אנרגיה נקייה|מתחדשות/, 'אנרגיה מתחדשת'],
  [/נפט|גז טבעי|זיקוק|פטרוכימ|חיפושי|קידוח/, 'נפט וגז'],
  [/כימיקל|כימי|גומי|פלסטיק/, 'כימיה גומי ופלסטיק'],
  [/ביומד|ביוטכ|פארמ|תרפ|מדיקל|דיאגנוס|רפוא|תרופ|cell|therap/i, 'ביומד'],
  [/סייבר|שבב|סמיקונד|אופטיק|תוכנה|סופטוור|מחשב|דיגיטל|טכנולוג/, 'טכנולוגיה'],
  [/אחזקות|החזקות|הולדינג|holdings|השקעות|השקעה/i, 'השקעה ואחזקות'],
  [/תעשי|פלדה|מתכת|חומרים|מפעל|ייצור|חשמל|תחנת כוח/, 'תעשייה'],
]

function ruleSector(name) {
  for (const [re, sec] of RULES) if (re.test(name)) return sec
  return null
}

async function classifyBatch(names) {
  // retry על כשל זמני (Groq מחזיר 400/429 לסירוגין)
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: 'חברות:\n' + names.join('\n') },
        ],
      }),
    })
    if (res.ok) {
      const data = await res.json()
      try {
        return JSON.parse(data.choices?.[0]?.message?.content ?? '{}')
      } catch {
        return null
      }
    }
    console.warn('sectors: Groq', res.status, '(ניסיון', attempt + 1, ')')
    await sleep(2000)
  }
  return null
}

// מסווג חברות חסרות-סקטור. שלב 1 (seed+כללים) אמין ומכסה את הכל; שלב 2 (AI)
// best-effort לשארית — כישלונו לא חוסם. מחזיר { updated, ruled, aied }.
export async function classifyCompanySectors({ aiBatches = 3, batchSize = 20 } = {}) {
  // ── שלב 1: seed + כללי-מילים על כל חסרות-הסקטור (דטרמיניסטי, בלי AI) ──
  let ruled = 0
  const { data: all } = await db.from('companies').select('id, name_he').is('sector', null).limit(2000)
  for (const r of all || []) {
    const hit = seedSector(r.name_he) || ruleSector(r.name_he)
    if (hit) {
      await db.from('companies').update({ sector: hit }).eq('id', r.id)
      ruled++
    }
  }

  // ── שלב 2: AI לשארית (best-effort; כישלון לא חוסם את שלב 1) ──
  let aied = 0
  if (GROQ_KEY) {
    for (let b = 0; b < aiBatches; b++) {
      const { data: rows } = await db
        .from('companies')
        .select('id, name_he')
        .is('sector', null)
        .limit(batchSize)
      if (!rows?.length) break
      const map = await classifyBatch(rows.map((r) => r.name_he))
      if (!map) break // כשל זמני — נמשיך בריצה הבאה
      for (const r of rows) {
        const sec = map[r.name_he] && SECTORS.includes(map[r.name_he]) ? map[r.name_he] : 'אחר'
        await db.from('companies').update({ sector: sec }).eq('id', r.id)
        aied++
      }
      await sleep(1500)
    }
  }
  return { updated: ruled + aied, ruled, aied }
}
