// שכבת הדוחות של קפלר — עזרים משותפים לשני האספנים:
//   financial-reports.mjs  (PDF ממאיה)      ·  magna-xbrl.mjs (נתונים מתויגים ממגנא)
// קפלר יושב באותו פרויקט Supabase של האתר, ולכן האספן כותב ישירות לטבלאות kepler_*.
import { createRequire } from 'node:module'
import { db } from './db.mjs'

// ── קישור לישות בקפלר ─────────────────────────────────────────────
// שמות החברות שונים בכל מקור: מאיה "מטריקס", מגנא "מטריקס אי.טי. בע\"מ", קפלר "מטריקס אי.טי".
// משווים אחרי נירמול (בלי בע"מ/סיומות תאגיד/פיסוק), ואז לפי כינויים.
// הסיומות מוסרות אחרי שהפיסוק כבר הפך לרווח: בע"מ → "בע מ", אי.טי → "אי טי".
const CORP_SUFFIX = /(^|\s)(בע מ|בעמ|ltd|limited|inc|plc|corp|corporation)(?=\s|$)/g
export function normName(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\(\d{4}\)/g, ' ') // "(1988)"
    .replace(/["'״׳`.,()\-–—/\\_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(CORP_SUFFIX, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

let entityCache = null
export async function loadKeplerCompanies() {
  if (entityCache) return entityCache
  const { data, error } = await db.from('kepler_entities').select('id,name,slug,aliases').eq('kind', 'company')
  if (error) throw error
  entityCache = (data || []).map((e) => ({
    id: e.id,
    name: e.name,
    keys: new Set([normName(e.name), e.slug, ...(e.aliases || []).map((a) => normName(a.replace(/-/g, ' ')))].filter(Boolean)),
  }))
  return entityCache
}

// מחזיר { id, name } של ישות קפלר התואמת לשם חברה, או null.
// התאמה מדויקת קודם; אחר כך הכלה (שם קצר בתוך ארוך) רק כשיש מועמד יחיד.
export async function matchKeplerEntity(...names) {
  const ents = await loadKeplerCompanies()
  const keys = names.map(normName).filter(Boolean)
  if (!keys.length) return null
  for (const e of ents) for (const k of keys) if (e.keys.has(k)) return { id: e.id, name: e.name }
  const cands = ents.filter((e) => [...e.keys].some((ek) => ek.length >= 3 && keys.some((k) => k.includes(ek) || ek.includes(k))))
  return cands.length === 1 ? { id: cands[0].id, name: cands[0].name } : null
}

// ── סיווג דיווחים ממאיה ────────────────────────────────────────────
// מסווג לפי הכותרת בלבד (ה-formId במאיה לא אחיד בין חברות רגילות לדואליות).
const NOT_REPORT = /מועד פרסום|צפוי(ה)? לפרסם|זימון|שיחת ועידה|אישור סקירת|Form 52-109|הודעה בדבר|דחיית|תזכורת/
export function classifyReport(title) {
  const t = String(title ?? '')
  if (NOT_REPORT.test(t)) return 'other'
  if (/מצגת/.test(t)) return /דוח|רבעון|תוצאות|שוק ההון|משקיעים|כספי/.test(t) ? 'presentation' : 'other'
  if (/דו["״]?ח(ות)? (תקופתי|שנתי)|תקופתי ושנתי|annual report|10-?K\b/i.test(t)) return 'annual'
  if (/דו["״]?ח(ות)? (רבעוני|רבעון|כספי|ביניים|לרבעון)|רבעון \d|חצי שנתי|quarterly report|10-?Q\b|6-?K\b/i.test(t)) return 'quarterly'
  return 'other'
}

// תאריך סוף התקופה מתוך הכותרת. מחזיר 'YYYY-MM-DD' או null.
export function periodEndFromTitle(title) {
  const t = String(title ?? '')
  let m = t.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  m = t.match(/רבעון\s*(\d)(?:\/חצי שנתי)?\s*(?:לשנת|של שנת|שנת)?\s*(\d{4})/) || t.match(/(?:ה)?רבעון\s*ה?(ראשון|שני|שלישי|רביעי)\s*(?:לשנת|של שנת|שנת)?\s*(\d{4})/)
  if (m) {
    const q = { 1: 1, 2: 2, 3: 3, 4: 4, ראשון: 1, שני: 2, שלישי: 3, רביעי: 4 }[m[1]]
    return `${m[2]}-${['03-31', '06-30', '09-30', '12-31'][q - 1]}`
  }
  m = t.match(/חצי שנתי\s*(?:לשנת)?\s*(\d{4})/)
  if (m) return `${m[1]}-06-30`
  m = t.match(/(?:תקופתי|שנתי|לשנת)\D{0,12}(\d{4})/)
  if (m) return `${m[1]}-12-31`
  return null
}

// ── חילוץ טקסט מ-PDF (pdfjs) ───────────────────────────────────────
// שורות נבנות לפי קואורדינטת Y, כך שטבלאות נשארות שורה-שורה. העברית יוצאת בסדר לוגי.
let pdfjsMod = null
async function pdfjs() {
  if (pdfjsMod) return pdfjsMod
  const require = createRequire(import.meta.url)
  const p = require.resolve('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsMod = await import('file:///' + p.replace(/\\/g, '/'))
  return pdfjsMod
}
export const MAX_TEXT = 1_500_000
export async function pdfToText(buf, { maxPages = 400 } = {}) {
  const lib = await pdfjs()
  const warn = console.warn
  console.warn = () => {} // pdfjs מדפיס אזהרות גופנים לכל עמוד
  try {
    const doc = await lib.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true, verbosity: 0 }).promise
    const pages = []
    const n = Math.min(doc.numPages, maxPages)
    let total = 0
    for (let p = 1; p <= n && total < MAX_TEXT; p++) {
      const page = await doc.getPage(p)
      const tc = await page.getTextContent()
      const lines = []
      let line = ''
      let lastY = null
      for (const it of tc.items) {
        if (!('str' in it)) continue
        const y = Math.round(it.transform[5])
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          lines.push(line)
          line = ''
        }
        line += it.str + (it.hasEOL ? '' : ' ')
        lastY = y
      }
      lines.push(line)
      const txt = `[עמוד ${p}]\n` + lines.map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim()).join('\n')
      pages.push(txt)
      total += txt.length
      page.cleanup()
    }
    return { text: pages.join('\n\n').slice(0, MAX_TEXT), pages: doc.numPages }
  } finally {
    console.warn = warn
  }
}

export const BUCKET = 'kepler-files'
export async function uploadToKepler(path, buf, contentType) {
  const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType, upsert: true })
  if (error) throw new Error(`אחסון נכשל (${path}): ${error.message}`)
  return path
}
