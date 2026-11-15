// דוחות כספיים ממאיה → kepler_reports (PDF/HTML באחסון kepler-files + טקסט מחולץ)
//
// **לפי דרישה בלבד.** מורידים את הדוחות של חברה אחת כשמבקשים אותם:
//   - מ-claude.ai: קפלר (kepler_fetch_reports) מעיר את התהליך fetch-reports.yml ב-GitHub,
//     שמריץ את הסקריפט הזה עם --job; בסיום נכתב jobs/{job}.json לאחסון וקפלר קורא אותו.
//   - מהמחשב: node collector/financial-reports.mjs --company "מטריקס"
// דוחות חדשים של חברות שכבר בקפלר נשמרים בלי הסקריפט הזה: run.mjs רואה אותם
// כשהם עוברים בפיד (ראה saveKeplerReports שם). אין סריקה של חברות.
//
// שני מצבים:
//   --bundle (ברירת מחדל)  הסט המלא לניתוח: דוח שנתי אחרון, רבעוני אחרון, מצגת אחרונה,
//                           מצגת שנתית, דוח דירוג (מעקב) אחרון, מצבת התחייבויות אחרונה (HTML).
//                           מדווח אילו משבצות לא נמצאו (missing) — קפלר מתריע למשתמש.
//   --latest N              N הדוחות/מצגות האחרונים בלי משבצות (היסטוריה).
//
// איך מוצאים: אין במאיה נקודת קצה "דיווחים לפי חברה" פתוחה, אבל
// GET /api/v1/reports/{id}/siblings מחזיר את דיווחי אותה חברה (30 לעמוד, אחורה בזמן).
// הזרע: הדיווח האחרון של החברה בטבלת items של האתר.
//
// דגלים: --company <שם> | --maya-company-id <id>   [--bundle | --latest 8]   [--pages 60]
//        [--job <id>] [--dry]
import { openMaya } from './maya.mjs'
import { db } from './db.mjs'
import { classifyReport, periodEndFromTitle, DOSSIER_SLOTS, DOSSIER_MAX_MONTHS, monthsAgo, matchKeplerEntity, normName, mayaGet, mayaPost, savedReportIds, fetchAndStoreReport, writeJobStatus } from './kepler-link.mjs'

const args = process.argv.slice(2)
const flag = (f) => args.includes(f)
const opt = (f, d) => {
  const i = args.indexOf(f)
  return i > -1 ? args[i + 1] : d
}
const MODE = opt('--latest') ? 'latest' : 'bundle'
const LATEST_N = Math.min(Number(opt('--latest', 8)) || 8, 20)
const MAX_PAGES = Number(opt('--pages', 60)) // 60 × 30 = 1,800 דיווחים אחורה (~שנה-שלוש, תלוי בחברה)
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

// אין דיווח של החברה בפיד (חברה שקטה / לא נאספה) → הזרם המלא של מאיה מסונן לחברה (companyId)
async function seedFromMaya(ctx, mayaCompanyId) {
  const d = await mayaPost(ctx, '/api/v1/reports/companies', { pageNumber: 1, limit: 20, offset: 0, companyId: Number(mayaCompanyId) })
  const arr = Array.isArray(d) ? d : d?.reports || d?.result || d?.items || d?.data || []
  const id = arr.find((r) => r?.id != null)?.id
  return id != null ? String(id) : null
}

// מדפדף אחורה בדיווחי החברה. done(cands) מחזיר true כשאפשר להפסיק.
async function* walkReports(ctx, seedId) {
  const seen = new Set()
  for (let p = 0; p < MAX_PAGES; p++) {
    let arr
    try {
      arr = await mayaGet(ctx, `/api/v1/reports/${seedId}/siblings?offset=${p * 30}&limit=30`)
    } catch (e) {
      if (p === 0) throw e
      return
    }
    if (!Array.isArray(arr) || !arr.length) return
    for (const s of arr) {
      const id = String(s.id)
      if (seen.has(id)) continue
      seen.add(id)
      const kind = classifyReport(s.title)
      if (kind === 'other') continue
      yield { id, title: s.title, kind, publishDate: s.publishDate, period_end: periodEndFromTitle(s.title), report_kind: kind }
    }
    if (arr.length < 30) return
  }
}

// הסט המלא: המופע האחרון לכל משבצת (הדפדוף הולך אחורה בזמן, לכן הראשון שנמצא = האחרון שפורסם).
// כל משבצת עם חלון זמן; מעבר לחלון הארוך ביותר מפסיקים לדפדף — מה שלא נמצא מדווח כחסר.
async function findBundle(ctx, seedId) {
  const slots = Object.fromEntries(DOSSIER_SLOTS.map((s) => [s.key, null]))
  for await (const rep of walkReports(ctx, seedId)) {
    const age = monthsAgo(rep.publishDate)
    if (age > DOSSIER_MAX_MONTHS) break
    for (const s of DOSSIER_SLOTS) if (!slots[s.key] && age <= s.maxMonths && s.match(rep)) slots[s.key] = rep
    if (DOSSIER_SLOTS.every((s) => slots[s.key])) break
  }
  return slots
}

async function findLatest(ctx, seedId, n) {
  const out = []
  for await (const rep of walkReports(ctx, seedId)) {
    if (['quarterly', 'annual', 'presentation'].includes(rep.kind)) out.push(rep)
    if (out.length >= n) break
  }
  return out
}

// ── הפעלה ─────────────────────────────────────────────────────────
if (!opt('--company') && !opt('--maya-company-id')) {
  console.log('שימוש: --company <שם> | --maya-company-id <id>   [--bundle | --latest 8] [--pages 60] [--job <id>] [--dry]')
  process.exit(2)
}

const t0 = Date.now()
const result = { ok: false, mode: MODE, company: opt('--company') || null, saved: [], already: [], missing: [], errors: [] }
let browser
let ctx
try {
  const company = await findSiteCompany({ name: opt('--company'), mayaId: opt('--maya-company-id') })
  result.company = company.name_he
  result.maya_company_id = company.maya_company_id
  const entity = await matchKeplerEntity(company.name_he)
  result.kepler_entity = entity?.name ?? null
  const have = await savedReportIds({ mayaCompanyId: company.maya_company_id })

  console.log(`▸ ${company.name_he} (מאיה ${company.maya_company_id})${entity ? ' → קפלר: ' + entity.name : ''}; ${have.size} דוחות כבר שמורים; מצב: ${MODE}`)
  ;({ browser, ctx } = await openMaya())
  const seed = (await seedReportId(company.id)) || (await seedFromMaya(ctx, company.maya_company_id))
  if (!seed) throw new Error(`לא נמצא אף דיווח של ${company.name_he} במאיה`)

  let toFetch = []
  if (MODE === 'bundle') {
    const slots = await findBundle(ctx, seed)
    result.slots = {}
    for (const s of DOSSIER_SLOTS) {
      const rep = slots[s.key]
      if (!rep) {
        result.missing.push(s.label)
        console.log(`   ✗ ${s.label}: לא נמצא ב-${s.maxMonths} החודשים האחרונים`)
        continue
      }
      result.slots[s.key] = { label: s.label, title: rep.title, published: rep.publishDate.slice(0, 10), period_end: rep.period_end, maya_report_id: rep.id }
      if (have.has(rep.id)) {
        result.already.push(s.label)
        console.log(`   = ${s.label}: כבר שמור — ${rep.title}`)
      } else if (!toFetch.some((r) => r.id === rep.id)) toFetch.push(rep)
    }
  } else {
    const reps = await findLatest(ctx, seed, LATEST_N)
    toFetch = reps.filter((r) => !have.has(r.id))
    result.already = reps.filter((r) => have.has(r.id)).map((r) => r.title)
  }
  result.found = toFetch.length

  for (const rep of toFetch) {
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
    await sleep(3000) // קצב נינוח — Incapsula רגישה לרצף מהיר, במיוחד מ-GitHub
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
console.log(`דוחות: ${result.saved.length} נשמרו, ${result.already.length} כבר היו, ${result.missing.length} חסרים, ${result.errors.length} כשלים, ${result.seconds} שניות`)
await writeJobStatus(JOB, result)
process.exit(result.ok ? 0 : 1)
