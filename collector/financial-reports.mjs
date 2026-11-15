// דוחות כספיים ממאיה → kepler_reports (PDF באחסון kepler-files + טקסט מחולץ)
//
// מודל "לפי דרישה", לא "הכל מראש": ה-robots.txt של מאיה מתיר שליפה לפי שאילתה ואוסר
// שאיבה המונית. לכן מורידים רק דוחות של חברה שמנתחים (--company) או של החברות שכבר
// נמצאות בקפלר (--watch), ורק מה שעדיין לא נשמר.
//
// איך מוצאים את הדוחות של חברה: אין במאיה נקודת קצה "דיווחים לפי חברה" פתוחה, אבל
// GET /api/v1/reports/{id}/siblings מחזיר את דיווחי אותה חברה (30 לעמוד, אחורה בזמן).
// הזרע: הדיווח האחרון של החברה בטבלת items של האתר (האספן כבר אוסף את כולם).
//
// הרצה:
//   node collector/financial-reports.mjs --company "מטריקס"            → עד 8 דוחות אחרונים
//   node collector/financial-reports.mjs --company "מטריקס" --limit 4 --kinds quarterly,annual
//   node collector/financial-reports.mjs --watch --limit 2             → כל חברות קפלר, רק חדשים
//   --dry   רשימה בלבד, בלי הורדה
import { openMaya } from './maya.mjs'
import { db } from './db.mjs'
import { classifyReport, periodEndFromTitle, matchKeplerEntity, loadKeplerCompanies, normName, pdfToText, uploadToKepler } from './kepler-link.mjs'

const BASE = 'https://maya.tase.co.il'
const FILES = 'https://mayafiles.tase.co.il'
const args = process.argv.slice(2)
const flag = (f) => args.includes(f)
const opt = (f, d) => {
  const i = args.indexOf(f)
  return i > -1 ? args[i + 1] : d
}
const LIMIT = Number(opt('--limit', 8))
const KINDS = new Set(opt('--kinds', 'quarterly,annual,presentation').split(','))
const MAX_PAGES = Number(opt('--pages', 40)) // 40 × 30 = 1,200 דיווחים אחורה (~2-3 שנים לחברה פעילה)
const MAX_TOTAL = Number(opt('--max-total', Infinity)) // תקרת הורדות לריצה (ב-CI: הסבב מוגבל לחצי שעה)
const DRY = flag('--dry')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function apiGet(ctx, path) {
  const r = await ctx.request.get(BASE + path, { headers: { Accept: 'application/json' }, timeout: 20000 })
  if (r.status() !== 200) throw new Error(`GET ${path} -> ${r.status()}`)
  return r.json()
}

// חברה באתר (companies) לפי שם — מחזירה { id, maya_company_id, name_he }
async function findSiteCompany(name) {
  const q = normName(name)
  const { data, error } = await db.from('companies').select('id,maya_company_id,name_he').ilike('name_he', `%${q.split(' ')[0]}%`).limit(30)
  if (error) throw error
  const rows = (data || []).filter((c) => c.maya_company_id)
  const exact = rows.filter((c) => normName(c.name_he) === q)
  if (exact.length === 1) return exact[0]
  const starts = rows.filter((c) => normName(c.name_he).startsWith(q) || q.startsWith(normName(c.name_he)))
  if (starts.length === 1) return starts[0]
  if (rows.length === 1) return rows[0]
  if (!rows.length) throw new Error(`"${name}" לא נמצאה בטבלת החברות של האתר`)
  throw new Error(`"${name}" לא חד-משמעית. אפשרויות: ${rows.map((c) => c.name_he).slice(0, 8).join(' | ')}`)
}

async function seedReportId(companyId) {
  const { data } = await db.from('items').select('maya_report_id').eq('company_id', companyId).not('maya_report_id', 'is', null).order('published_at', { ascending: false }).limit(1)
  const id = data?.[0]?.maya_report_id
  return id && /^\d+$/.test(id) ? id : null
}

async function alreadyHave(mayaCompanyId) {
  const { data } = await db.from('kepler_reports').select('maya_report_id,text').eq('maya_company_id', String(mayaCompanyId))
  return new Set((data || []).filter((r) => r.text).map((r) => r.maya_report_id))
}

// מדפדף אחורה בדיווחי החברה ואוסף את הדוחות הכספיים הראשונים שעדיין לא נשמרו
async function findReports(ctx, seedId, have, { limit }) {
  const found = []
  const seen = new Set()
  for (let p = 0; p < MAX_PAGES && found.length < limit; p++) {
    let arr
    try {
      arr = await apiGet(ctx, `/api/v1/reports/${seedId}/siblings?offset=${p * 30}&limit=30`)
    } catch (e) {
      if (p === 0) throw e
      break
    }
    if (!Array.isArray(arr) || !arr.length) break
    for (const s of arr) {
      const id = String(s.id)
      if (seen.has(id)) continue
      seen.add(id)
      const kind = classifyReport(s.title)
      if (!KINDS.has(kind) || have.has(id)) continue
      found.push({ id, title: s.title, kind, publishDate: s.publishDate, company: s.company })
      if (found.length >= limit) break
    }
    if (arr.length < 30) break
  }
  return found
}

async function fetchAndStore(ctx, rep, company, entity) {
  const full = await apiGet(ctx, `/api/v1/reports/${rep.id}`)
  const pdf = (full.attachments || []).find((a) => String(a.fileType).startsWith('pdf'))
  const xbrl = (full.attachments || []).find((a) => String(a.fileType) === 'xbrl')
  const row = {
    maya_report_id: rep.id,
    maya_company_id: String(company.maya_company_id),
    company_name: company.name_he,
    entity_id: entity?.id ?? null,
    title: rep.title,
    report_kind: rep.kind,
    period_end: periodEndFromTitle(rep.title),
    published_at: new Date(String(full.publishDate || rep.publishDate).replace(/([+-]\d{2}:?\d{2}|Z)?$/, '+02:00')).toISOString(),
    pdf_url: pdf ? `${FILES}/${pdf.url}` : `${BASE}/he/reports/companies/${company.maya_company_id}`,
    xbrl_url: xbrl ? `${FILES}/${xbrl.url}` : null,
    form_id: full.formId || null,
    fetched_at: new Date().toISOString(),
    error: null,
  }
  if (!pdf) {
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

async function processCompany(ctx, company, { limit }) {
  const entity = await matchKeplerEntity(company.name_he)
  const seed = await seedReportId(company.id)
  if (!seed) return { company: company.name_he, skipped: 'אין דיווח של החברה בטבלת items (זרע לדפדוף)' }
  const have = await alreadyHave(company.maya_company_id)
  const reps = await findReports(ctx, seed, have, { limit })
  const out = { company: company.name_he, kepler: entity?.name ?? null, already: have.size, found: reps.length, saved: 0, errors: [] }
  for (const rep of reps) {
    if (DRY) {
      console.log(`   · ${rep.publishDate.slice(0, 10)}  [${rep.kind}]  ${rep.title}`)
      continue
    }
    try {
      const row = await fetchAndStore(ctx, rep, company, entity)
      out.saved++
      console.log(`   ✓ ${row.published_at.slice(0, 10)}  [${rep.kind}]  ${rep.title}  (${row.pages ?? '?'} עמ', ${Math.round((row.chars ?? 0) / 1000)}K תווים${row.error ? ', ' + row.error : ''})`)
    } catch (e) {
      out.errors.push(`${rep.title}: ${e.message}`)
      console.error(`   ✗ ${rep.title}: ${e.message}`)
    }
    await sleep(1500)
  }
  return out
}

// ── הפעלה ─────────────────────────────────────────────────────────
let companies = []
if (opt('--company')) {
  companies = [await findSiteCompany(opt('--company'))]
} else if (flag('--watch')) {
  // כל חברות קפלר שיש להן מקבילה בטבלת החברות של האתר
  const ents = await loadKeplerCompanies()
  const { data: all } = await db.from('companies').select('id,maya_company_id,name_he').not('maya_company_id', 'is', null)
  for (const c of all || []) {
    const n = normName(c.name_he)
    if (ents.some((e) => e.keys.has(n) || [...e.keys].some((k) => k.length >= 3 && (n === k || n.startsWith(k + ' ') || k.startsWith(n + ' '))))) companies.push(c)
  }
  console.log(`מעקב: ${companies.length} חברות קפלר נמצאו בטבלת החברות (${ents.length} בקפלר)`)
} else {
  console.log('שימוש: --company <שם> | --watch   [--limit 8] [--kinds quarterly,annual,presentation] [--pages 40] [--dry]')
  process.exit(2)
}

const t0 = Date.now()
const { browser, ctx } = await openMaya()
let saved = 0
let failed = 0
try {
  for (const c of companies) {
    if (saved >= MAX_TOTAL) {
      console.log(`⏹ הגענו לתקרת ${MAX_TOTAL} הורדות לריצה — השאר בריצה הבאה`)
      break
    }
    console.log(`▸ ${c.name_he} (מאיה ${c.maya_company_id})`)
    try {
      const r = await processCompany(ctx, c, { limit: Math.min(LIMIT, MAX_TOTAL - saved) })
      if (r.skipped) console.log(`   – דולג: ${r.skipped}`)
      else console.log(`   ${r.saved}/${r.found} נשמרו (${r.already} כבר היו${r.kepler ? ', קפלר: ' + r.kepler : ', לא מקושר לישות בקפלר'})`)
      saved += r.saved ?? 0
      failed += r.errors?.length ?? 0
    } catch (e) {
      failed++
      console.error(`   ✗ ${e.message}`)
    }
    await sleep(1000)
  }
} finally {
  await browser.close()
}
console.log(`דוחות: ${saved} נשמרו, ${failed} כשלים, ${Math.round((Date.now() - t0) / 1000)} שניות`)
process.exit(failed && !saved ? 1 : 0)
