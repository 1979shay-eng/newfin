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
// סוגים: annual · quarterly · presentation · rating (דוח מעקב/אשרור דירוג, לא דירוג הנפקה) ·
//        debt (מצבת התחייבויות לפי מועדי פירעון — דיווח HTML) · other
const NOT_REPORT = /מועד פרסום|צפוי(ה)? לפרסם|זימון|שיחת ועידה|אישור סקירת|Form 52-109|הודעה בדבר|דחיית|תזכורת/
const RATING_AGENCY = /מידרוג|מעלות|S&P|Fitch|Moody/i
// דירוג של הנפקה/סדרה חדשה — לא זה שמבקשים לניתוח
const RATING_ISSUANCE = /להנפק|שתנפיק|שינפיק|הנפקת|קובעת דירוג|מתן דירוג|נתנה דירוג|דירוג מקדמי|דרוג מקדמי|מותנה|\(P\)|סדרה חדשה|מסירה את ההתניה|ני["״]?ע מסחריים/
const RATING_FOLLOWUP = /מותירה על כנ|מאשרר|אשרר|אישרור|מעקב|מעלה (את )?(ה)?דירוג|מורידה (את )?(ה)?דירוג|מעדכנת|משנה (את )?(ה)?אופק|אופק הדירוג|תחזית הדירוג|דוח הדירוג המלא|הערכת האיתנות/
export function classifyReport(title) {
  const t = String(title ?? '')
  if (/מצבת התחייבו(ת|יות)|מועדי פר[יע]?עון/.test(t) && !/דחיית/.test(t)) return 'debt'
  if (RATING_AGENCY.test(t) || /דו["״]?ח דירוג/.test(t)) {
    if (RATING_FOLLOWUP.test(t) && !RATING_ISSUANCE.test(t)) return 'rating'
    return 'other'
  }
  if (NOT_REPORT.test(t)) return 'other'
  if (/מצגת/.test(t)) return /דוח|רבעון|תוצאות|שוק ההון|משקיעים|כספי|שנת/.test(t) ? 'presentation' : 'other'
  if (/דו["״]?ח(ות)? (תקופתי|שנתי)|תקופתי ושנתי|annual report|10-?K\b/i.test(t)) return 'annual'
  if (/דו["״]?ח(ות)? (רבעוני|רבעון|כספי|ביניים|לרבעון)|רבעון \d|חצי שנתי|quarterly report|10-?Q\b|6-?K\b/i.test(t)) return 'quarterly'
  return 'other'
}

// "משבצות" הסט המלא לניתוח חברה. מצגת שנתית = מצגת שתקופתה מסתיימת ב-31.12.
export const DOSSIER_SLOTS = [
  { key: 'annual', label: 'דוח שנתי אחרון', match: (r) => r.report_kind === 'annual' },
  { key: 'quarterly', label: 'דוח רבעוני אחרון', match: (r) => r.report_kind === 'quarterly' },
  { key: 'presentation', label: 'מצגת אחרונה', match: (r) => r.report_kind === 'presentation' },
  { key: 'presentation_annual', label: 'מצגת שנתית', match: (r) => r.report_kind === 'presentation' && /-12-31$/.test(r.period_end || '') },
  { key: 'rating', label: 'דוח דירוג אחרון (מעקב)', match: (r) => r.report_kind === 'rating' },
  { key: 'debt', label: 'מצבת התחייבויות אחרונה (HTML)', match: (r) => r.report_kind === 'debt' },
]

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
  // אנגלית: "As of June 30, 2026" / "as at 30 June 2026" / "Q3 2026"
  const MONTHS = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' }
  m = t.match(/\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/) || t.match(/\b(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})\b/)
  if (m) {
    const [a, b] = /^\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]]
    const mm = MONTHS[a.toLowerCase()]
    if (mm) return `${m[3]}-${mm}-${String(b).padStart(2, '0')}`
  }
  m = t.match(/\bQ([1-4])[\s-]*(\d{4})\b/i)
  if (m) return `${m[2]}-${['03-31', '06-30', '09-30', '12-31'][Number(m[1]) - 1]}`
  m = t.match(/\b(?:annual report|10-?K)\D{0,12}(\d{4})\b/i)
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

// ── דיווחי HTML של מאיה (טפסים מובנים כמו מצבת התחייבויות, ת126) ───────
// הקבצים ב-windows-1255. טבלאות → שורה לכל <tr>, תאים מופרדים ב-" | ".
export function htmlToText(buf) {
  let html
  try {
    html = new TextDecoder('windows-1255').decode(buf)
    if (/charset=["']?utf-?8/i.test(html.slice(0, 2000)) || /[�]/.test(html.slice(0, 5000))) html = buf.toString('utf8')
  } catch {
    html = buf.toString('utf8')
  }
  const strip = (s) =>
    s
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/\s+/g, ' ')
      .trim()
  html = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '')
  const lines = []
  // טבלאות: כל שורה בנפרד
  const rows = html.split(/<\/tr\s*>/i)
  for (const row of rows) {
    const cells = row
      .split(/<\/t[dh]\s*>/i)
      .map((c) => strip(c.replace(/^[\s\S]*<t[dh][^>]*>/i, (m) => m.replace(/^[\s\S]*?(<t[dh][^>]*>)$/i, '$1')).replace(/^[\s\S]*?<t[dh][^>]*>/i, '')))
      .filter((c) => c)
    if (cells.length) lines.push(cells.join(' | '))
    else {
      const t = strip(row)
      if (t) lines.push(t)
    }
  }
  return lines
    .map((l) => l.replace(/^(\|\s*)+|(\s*\|)+$/g, '').trim())
    .filter((l) => l && !/^_+$/.test(l) && l !== 'false' && !/^\|( \|)*$/.test(l))
    .join('\n')
}

export const BUCKET = 'kepler-files'
export async function uploadToKepler(path, buf, contentType) {
  const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType, upsert: true })
  if (error) throw new Error(`אחסון נכשל (${path}): ${error.message}`)
  return path
}

// תוצאת הבאה לפי דרישה — קפלר (kepler_fetch_status) קורא את הקובץ הזה כדי לדעת שהסתיים.
export async function writeJobStatus(job, obj) {
  if (!job) return
  const body = Buffer.from(JSON.stringify({ job, ...obj, finished_at: new Date().toISOString() }))
  await uploadToKepler(`jobs/${job}.json`, body, 'application/json').catch((e) => console.error('כתיבת סטטוס נכשלה:', e.message))
}

// ── הורדת דוח ממאיה ושמירתו ─────────────────────────────────────────
// משותף להבאה לפי דרישה (financial-reports.mjs) ולשמירה כשהדוח עובר בפיד (run.mjs).
const MAYA = 'https://maya.tase.co.il'
const MAYA_FILES = 'https://mayafiles.tase.co.il'

export async function mayaGet(ctx, path) {
  const r = await ctx.request.get(MAYA + path, { headers: { Accept: 'application/json' }, timeout: 20000 })
  if (r.status() !== 200) throw new Error(`GET ${path} -> ${r.status()}`)
  return r.json()
}

// אילו דיווחים כבר שמורים (עם טקסט) מתוך רשימת מזהים / לחברה
export async function savedReportIds({ ids, mayaCompanyId } = {}) {
  let q = db.from('kepler_reports').select('maya_report_id,text')
  if (ids) q = q.in('maya_report_id', ids.map(String))
  if (mayaCompanyId) q = q.eq('maya_company_id', String(mayaCompanyId))
  const { data, error } = await q
  if (error) throw error
  return new Set((data || []).filter((r) => r.text).map((r) => r.maya_report_id))
}

// rep: { id, title, kind, publishDate } · company: { maya_company_id, name_he } · entity: { id } | null
export async function fetchAndStoreReport(ctx, rep, company, entity) {
  const full = await mayaGet(ctx, `/api/v1/reports/${rep.id}`)
  const pdf = (full.attachments || []).find((a) => String(a.fileType).startsWith('pdf'))
  const htm = (full.attachments || []).find((a) => String(a.fileType) === 'htm')
  const xbrl = (full.attachments || []).find((a) => String(a.fileType) === 'xbrl')
  // טפסים מובנים (מצבת התחייבויות) מגיעים כ-HTML בלבד; עבורם ה-HTML הוא המקור
  const useHtml = htm && (!pdf || rep.kind === 'debt')
  const row = {
    maya_report_id: String(rep.id),
    maya_company_id: String(company.maya_company_id),
    company_name: company.name_he,
    entity_id: entity?.id ?? null,
    title: rep.title,
    report_kind: rep.kind,
    period_end: periodEndFromTitle(rep.title),
    published_at: new Date(String(full.publishDate || rep.publishDate).replace(/([+-]\d{2}:?\d{2}|Z)?$/, '+02:00')).toISOString(),
    pdf_url: pdf ? `${MAYA_FILES}/${pdf.url}` : htm ? `${MAYA_FILES}/${htm.url}` : `${MAYA}/he/reports/companies/${company.maya_company_id}`,
    xbrl_url: xbrl ? `${MAYA_FILES}/${xbrl.url}` : null,
    form_id: full.formId || null,
    fetched_at: new Date().toISOString(),
    error: null,
  }
  if (useHtml) {
    const r = await ctx.request.get(`${MAYA_FILES}/${htm.url}`, { timeout: 60000 })
    if (r.status() !== 200) throw new Error(`הורדת HTML נכשלה (${r.status()})`)
    const buf = await r.body()
    row.bytes = buf.length
    row.file_path = await uploadToKepler(`reports/${company.maya_company_id}/${rep.id}.htm`, buf, 'text/html; charset=windows-1255')
    const text = htmlToText(buf).slice(0, MAX_TEXT)
    row.text = text
    row.pages = 1
    row.chars = text.length
    if (text.length < 100) row.error = 'HTML ריק'
  } else if (!pdf) {
    row.error = 'אין קובץ PDF מצורף'
  } else {
    const r = await ctx.request.get(row.pdf_url, { timeout: 120000 })
    if (r.status() !== 200) throw new Error(`הורדת PDF נכשלה (${r.status()})`)
    const buf = await r.body()
    row.bytes = buf.length
    row.file_path = await uploadToKepler(`reports/${company.maya_company_id}/${rep.id}.pdf`, buf, 'application/pdf')
    const { text, pages } = await pdfToText(buf)
    row.text = text
    row.pages = pages
    row.chars = text.length
    if (text.replace(/\[עמוד \d+\]/g, '').trim().length < 200) row.error = 'PDF סרוק — אין שכבת טקסט'
  }
  const { error } = await db.from('kepler_reports').upsert(row, { onConflict: 'maya_report_id' })
  if (error) throw new Error(`כתיבה ל-kepler_reports נכשלה: ${error.message}`)
  return row
}
