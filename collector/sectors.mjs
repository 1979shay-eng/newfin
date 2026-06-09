// סיווג חברות לסקטור בורסאי — ממלא את companies.sector (UPDATE, בלי migration).
// משתמש ב-Groq 8b (זול, מכסה נפרדת) ובאצ'ים של ~20 חברות לקריאה. רץ מעט בכל
// ריצת אספן וממלא בהדרגה; כשאין חברות בלי סקטור — no-op.
import { db } from './db.mjs'
import { getEnv } from './env.mjs'

const GROQ_KEY = getEnv('GROQ_API_KEY')
const MODEL = getEnv('GROQ_GATE_MODEL') || 'llama-3.1-8b-instant'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// טקסונומיית סקטורים סגורה (עברית) — מותאמת לבורסת ת"א
export const SECTORS = [
  'בנקים',
  'ביטוח ופיננסים',
  'נדל"ן ותשתיות',
  'טכנולוגיה',
  'ביטחון',
  'אנרגיה ונפט',
  'תעשייה',
  'מסחר וצריכה',
  'פארמה וביוטק',
  'תקשורת ומדיה',
  'אחזקות והשקעות',
  'חקלאות ומזון',
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
  פורמולה: 'טכנולוגיה', מלאנוקס: 'טכנולוגיה',
  טבע: 'פארמה וביוטק', אופקו: 'פארמה וביוטק', קמהדע: 'פארמה וביוטק', פריגו: 'פארמה וביוטק',
  מליסרון: 'נדל"ן ותשתיות', עזריאלי: 'נדל"ן ותשתיות', 'אלוני חץ': 'נדל"ן ותשתיות',
  גזית: 'נדל"ן ותשתיות', אמות: 'נדל"ן ותשתיות', אשטרום: 'נדל"ן ותשתיות',
  'שיכון ובינוי': 'נדל"ן ותשתיות', אלקטרה: 'נדל"ן ותשתיות', דמרי: 'נדל"ן ותשתיות', אאורה: 'נדל"ן ותשתיות',
  אלביט: 'ביטחון', נקסטויז: 'ביטחון', אורבית: 'ביטחון',
  אנלייט: 'אנרגיה ונפט', דוראל: 'אנרגיה ונפט', נופר: 'אנרגיה ונפט', אנרגיאן: 'אנרגיה ונפט',
  'דלק קבוצה': 'אנרגיה ונפט', 'דלק רכב': 'מסחר וצריכה',
  'חברה לישראל': 'אחזקות והשקעות',
  שטראוס: 'חקלאות ומזון', תנובה: 'חקלאות ומזון',
  שופרסל: 'מסחר וצריכה', 'רמי לוי': 'מסחר וצריכה', פוקס: 'מסחר וצריכה', דלתא: 'מסחר וצריכה', סנו: 'מסחר וצריכה',
}

function seedSector(name) {
  for (const k in SEED) if (name.includes(k)) return SEED[k]
  return null
}

// כללי-מילים מדויקים (precision-first) — תופסים שמות עם רמז סקטור ברור בלי AI.
// סדר חשוב: הספציפי קודם. נורה רק כשבטוח; השאר עובר ל-AI.
const RULES = [
  [/בנק\b|לאומי|הפועלים|מזרחי טפחות|דיסקונט|הבינלאומי/, 'בנקים'],
  [/ביטוח|הראל|מגדל|הפניקס|מנורה|איילון|אשראי|כרטיסי אשראי|ישראכרט/, 'ביטוח ופיננסים'],
  [/נדל"?ן|נכסים|מקרקעין|מבני|מגורים|ריט |חניונ|קניונ/, 'נדל"ן ותשתיות'],
  // הערה: "דלק" הוסר — דו-משמעי (דלק רכב = יבואנית רכב, לא אנרגיה). דלק קבוצה ב-seed.
  [/אנרגיה|נפט|גז טבעי|זיקוק|פטרוכימ|חשמל|סולאר|פוטו-?וולט|תחנת כוח|רנסולה/, 'אנרגיה ונפט'],
  [/ביומד|ביוטכ|פארמ|תרפ|מדיקל|דיאגנוס|רפוא|תרופ|cell|therap/i, 'פארמה וביוטק'],
  [/סייבר|שבב|סמיקונד|אופטיק|תוכנה|סופטוור|מחשב|דיגיטל|טכנולוג/, 'טכנולוגיה'],
  [/ביטחון|בטחון|אלביט|רפאל|רחפ|מל"ט|אווירי|חלל|נשק/, 'ביטחון'],
  [/תקשורת|סלולר|בזק|פרטנר|סלקום|כבלים/, 'תקשורת ומדיה'],
  [/אחזקות|החזקות|הולדינג|holdings|גרופ\b/i, 'אחזקות והשקעות'],
  [/מזון|חקלא|תנובה|שטראוס|חלב|בשר|דגן/, 'חקלאות ומזון'],
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
