// דוחות כספיים ממאיה → kepler_reports (PDF באחסון kepler-files + טקסט מחולץ)
//
// **לפי דרישה בלבד.** מורידים את הדוחות של חברה אחת כשמבקשים אותם:
//   - מ-claude.ai: קפלר (kepler_fetch_reports) מעיר את התהליך fetch-reports.yml ב-GitHub,
//     שמריץ את הסקריפט הזה עם --job; בסיום נכתב jobs/{job}.json לאחסון וקפלר קורא אותו.
//   - מהמחשב: node collector/financial-reports.mjs --company "מטריקס" [--limit 8]
// דוחות חדשים של חברות שכבר בקפלר נשמרים בלי הסקריפט הזה: run.mjs רואה אותם
// כשהם עוברים בפיד (ראה saveKeplerReports שם). אין סריקה של חברות.
//
// איך מוצאים את הדוחות: אין במאיה נקודת קצה "דיווחים לפי חברה" פתוחה, אבל
// GET /api/v1/reports/{id}/siblings מחזיר את דיווחי אותה חברה (30 לעמוד, אחורה בזמן).
// הזרע: הדיווח האחרון של החברה בטבלת items של האתר.
//
// דגלים: --company <שם> | --maya-company-id <id>   --limit 8   --kinds quarterly,annual,presentation
//        --pages 40 (עומק הדפדוף)   --job <id> (כתיבת סטטוס לאחסון)   --dry (רשימה בלבד)
import { openMaya } from './maya.mjs'
import { db } from './db.mjs'
import { classifyReport, matchKeplerEntity, normName, mayaGet, savedReportIds, fetchAndStoreReport, writeJobStatus } from './kepler-link.mjs'

const args = process.argv.slice(2)
const flag = (f) => args.includes(f)
const opt = (f, d) => {
  const i = args.indexOf(f)
  return i > -1 ? args[i + 1] : d
}
const LIMIT = Math.min(Number(opt('--limit', 8)) || 8, 20)
const KINDS = new Set(opt('--kinds', 'quarterly,annual,presentation').split(','))
const MAX_PAGES = Number(opt('--pages', 40)) // 40 × 30 = 1,200 דיווחים אחורה (~2-3 שנים לחברה פעילה)
const JOB = opt('--job', null)
const DRY = flag('--dry')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// חברה באתר (companies) לפי שם או מזהה מאיה — מחזירה { id, maya_company_id, name_he }
async function findSiteCompany({ name, mayaId }) {
  if (mayaId) {
    const { data } = await db.from('companies').select('id,maya_company_id,name_he').eq('maya_company_id', String(mayaId)).maybeSingle()
    if (!data) throw new Error(`אין חברה עם מזהה מאיה ${mayaId} בטבלת החברות`)
    return data
  }
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
  const err = new Error(`"${name}" לא חד-משמעית. אפשרויות: ${rows.map((c) => c.name_he).slice(0, 8).join(' | ')}`)
  err.candidates = rows.map((c) => ({ name: c.name_he, maya_company_id: c.maya_company_id }))
  throw err
}

async function seedReportId(companyId) {
  const { data } = await db.from('items').select('maya_report_id').eq('company_id', companyId).not('maya_report_id', 'is', null).order('published_at', { ascending: false }).limit(1)
  const id = data?.[0]?.maya_report_id
  return id && /^\d+$/.test(id) ? id : null
}

// מדפדף אחורה בדיווחי החברה ואוסף את הדוחות הכספיים הראשונים שעדיין לא נשמרו
async function findReports(ctx, seedId, have, { limit }) {
  const found = []
  const seen = new Set()
  for (let p = 0; p < MAX_PAGES && found.length < limit; p++) {
    let arr
    try {
      arr = await mayaGet(ctx, `/api/v1/reports/${seedId}/siblings?offset=${p * 30}&limit=30`)
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
      found.push({ id, title: s.title, kind, publishDate: s.publishDate })
      if (found.length >= limit) break
    }
    if (arr.length < 30) break
  }
  return found
}

// ── הפעלה ─────────────────────────────────────────────────────────
if (!opt('--company') && !opt('--maya-company-id')) {
  console.log('שימוש: --company <שם> | --maya-company-id <id>   [--limit 8] [--kinds quarterly,annual,presentation] [--pages 40] [--job <id>] [--dry]')
  process.exit(2)
}

const t0 = Date.now()
const result = { ok: false, company: opt('--company') || null, saved: [], errors: [] }
let browser
let ctx
try {
  const company = await findSiteCompany({ name: opt('--company'), mayaId: opt('--maya-company-id') })
  result.company = company.name_he
  result.maya_company_id = company.maya_company_id
  const entity = await matchKeplerEntity(company.name_he)
  result.kepler_entity = entity?.name ?? null
  const seed = await seedReportId(company.id)
  if (!seed) throw new Error('אין אף דיווח של החברה בטבלת items (נדרש כזרע לדפדוף במאיה)')
  const have = await savedReportIds({ mayaCompanyId: company.maya_company_id })
  result.already_saved = have.size

  console.log(`▸ ${company.name_he} (מאיה ${company.maya_company_id})${entity ? ' → קפלר: ' + entity.name : ''}; ${have.size} דוחות כבר שמורים`)
  ;({ browser, ctx } = await openMaya())
  const reps = await findReports(ctx, seed, have, { limit: LIMIT })
  result.found = reps.length
  for (const rep of reps) {
    if (DRY) {
      console.log(`   · ${rep.publishDate.slice(0, 10)}  [${rep.kind}]  ${rep.title}`)
      continue
    }
    try {
      const row = await fetchAndStoreReport(ctx, rep, company, entity)
      result.saved.push({ title: rep.title, kind: rep.kind, period_end: row.period_end, pages: row.pages, error: row.error })
      console.log(`   ✓ ${row.published_at.slice(0, 10)}  [${rep.kind}]  ${rep.title}  (${row.pages ?? '?'} עמ', ${Math.round((row.chars ?? 0) / 1000)}K תווים${row.error ? ', ' + row.error : ''})`)
    } catch (e) {
      result.errors.push(`${rep.title}: ${e.message}`)
      console.error(`   ✗ ${rep.title}: ${e.message}`)
    }
    await sleep(1500)
  }
  result.ok = true
} catch (e) {
  result.errors.push(e.message)
  if (e.candidates) result.candidates = e.candidates
  console.error(`✗ ${e.message}`)
} finally {
  if (browser) await browser.close()
}
result.seconds = Math.round((Date.now() - t0) / 1000)
console.log(`דוחות: ${result.saved.length} נשמרו, ${result.errors.length} כשלים, ${result.seconds} שניות`)
await writeJobStatus(JOB, result)
process.exit(result.ok ? 0 : 1)
