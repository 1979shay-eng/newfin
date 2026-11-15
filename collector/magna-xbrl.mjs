// מגנא (רשות ני"ע) — נתונים כספיים מתויגים (iXBRL) → kepler_financials
//
// מערכת התחקור של מגנא חושפת API רשמי, חינמי, בלי מפתח ובלי הגנת בוטים
// (תיעוד: https://xbrl.magna.isa.gov.il/he/assets/magna-xbrl-api.pdf):
//   GET  /api/init                       → ישויות (ח.פ. + שם) ותגיות
//   POST /api/search {entities,...}      → {guid, status:'pending'}
//   POST /api/search {guid}              → ...עד status:'report-generated' + file
//   GET  /public/search/{file}.json      → שורות שטוחות (תג, ערך, תקופה, אסמכתא)
// מגבלה: רק חברות שמדווחות iXBRL בשלב הוולונטרי (~43 חברות, נכון ל-11.2026).
//
// הרצה:
//   node collector/magna-xbrl.mjs --list                  → מי מכוסה במגנא
//   node collector/magna-xbrl.mjs --company "מטריקס"       → חברה אחת (כל ההיסטוריה)
//   node collector/magna-xbrl.mjs --all                   → כל החברות, מצטבר (מדלג על אסמכתאות שכבר נשמרו)
//   --with-members  גם פילוחים (מגזרים/מטבעות). ברירת מחדל: רק סה"כ — חוסך ~50% שורות.
//   --since 2021    שנת התחלה (ברירת מחדל 2021 — תחילת הנתונים במגנא)
import { db } from './db.mjs'
import { matchKeplerEntity, normName } from './kepler-link.mjs'

const BASE = 'https://xbrl.magna.isa.gov.il'
const args = process.argv.slice(2)
const flag = (f) => args.includes(f)
const opt = (f, d) => {
  const i = args.indexOf(f)
  return i > -1 ? args[i + 1] : d
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const year = new Date().getFullYear()
const SINCE = Number(opt('--since', 2021))
const WITH_MEMBERS = flag('--with-members')
const QUIET = flag('--quiet')
const log = (...a) => !QUIET && console.log(...a)

async function getJson(url, init) {
  const r = await fetch(url, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  if (!r.ok) throw new Error(`${init?.method || 'GET'} ${url.replace(BASE, '')} -> ${r.status}`)
  return r.json()
}

export async function magnaInit() {
  return getJson(`${BASE}/api/init`)
}

// שאילתה אסינכרונית: פותחים, ואז שולחים את ה-guid שוב ושוב עד שהקובץ מוכן.
async function magnaSearch(entity, { timeoutMs = 120000 } = {}) {
  const body = {
    branches: [],
    entities: [{ _id: entity._id, name: entity.name, branch_id: entity.branch_id }],
    xbrlFields: [], // ריק = כל התגיות
    fromYear: SINCE,
    toYear: year,
    quarters: ['q1', 'q2', 'q3', 'q4'],
  }
  let s = await getJson(`${BASE}/api/search`, { method: 'POST', body: JSON.stringify(body) })
  const t0 = Date.now()
  while (s.status !== 'report-generated' && s.status !== 'download') {
    if (Date.now() - t0 > timeoutMs) throw new Error(`מגנא: השאילתה ל-${entity.name} לא הסתיימה תוך ${timeoutMs / 1000} שניות (status=${s.status})`)
    if (s.status && !/pending|processing|running|generating/i.test(s.status)) throw new Error(`מגנא: סטטוס לא צפוי "${s.status}" ל-${entity.name}`)
    await sleep(1500)
    s = await getJson(`${BASE}/api/search`, { method: 'POST', body: JSON.stringify({ guid: s.guid }) })
  }
  if (!s.count) return []
  return getJson(`${BASE}/public/search/${s.file}.json`)
}

// "31/12/2024" → נקודת זמן; "01/01/2024 - 31/12/2024" → תקופה
function parsePeriod(p) {
  const d = (s) => {
    const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null
  }
  const parts = String(p ?? '').split(' - ')
  if (parts.length === 2) return { period_start: d(parts[0]), period_end: d(parts[1]), duration: true }
  return { period_start: null, period_end: d(parts[0]), duration: false }
}

function toRows(raw, entity, keplerId) {
  const out = new Map()
  for (const r of raw) {
    const member = [r.Axis, r.ExplicitMember, r.TypedMember].filter(Boolean).join(' | ')
    if (member && !WITH_MEMBERS) continue
    const fact = Number(r.Fact)
    if (r.Fact === '' || r.Fact === null || Number.isNaN(fact)) continue // תגיות טקסטואליות — לא לכאן
    const per = parsePeriod(r.Period)
    if (!per.period_end) continue
    const row = {
      tax_id: String(r['Company ID'] || entity._id),
      company_name: r['Company Name (Heb)'] || entity.name,
      company_name_en: r['Company Name (Eng)'] || entity.name_en || null,
      entity_id: keplerId,
      reference_number: String(r['Reference Number'] || ''),
      tag: r.Tag,
      label_he: r['Verbose Label (HE)'] || r['Total Label (HE)'] || r['Period End Label (HE)'] || null,
      label_en: r['Label (EN)'] || r['Verbose Label (EN)'] || null,
      statement: r['Data source in XBRL'] || null,
      period: String(r.Period),
      ...per,
      member,
      fact: (r.Sign === '-' ? -1 : 1) * fact,
      measure: r.Measure || null,
      scale: r.Scale === '' || r.Scale == null ? null : Number(r.Scale),
      updated_at: new Date().toISOString(),
    }
    if (!row.reference_number || !row.tag) continue
    out.set(`${row.tax_id}|${row.reference_number}|${row.tag}|${row.period}|${row.member}`, row) // דה-דופ בתוך הקובץ
  }
  return [...out.values()]
}

// אילו אסמכתאות (דוחות) כבר נשמרו לחברה. השרת מחזיר לכל היותר 1,000 שורות לבקשה,
// ולחברה ותיקה יש 5-8 אלף שורות — לכן מדפדפים עד הסוף (אחרת "לא מוכר" = כתיבה חוזרת של הכול).
async function knownRefs(taxId) {
  const refs = new Set()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('kepler_financials').select('reference_number').eq('tax_id', taxId).order('id').range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data || []) refs.add(r.reference_number)
    if (!data || data.length < PAGE) break
  }
  return refs
}

async function upsertRows(rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('kepler_financials').upsert(rows.slice(i, i + 500), { onConflict: 'tax_id,reference_number,tag,period,member' })
    if (error) throw new Error(`כתיבה ל-kepler_financials נכשלה: ${error.message}`)
  }
}

export async function syncEntity(entity, { incremental = true } = {}) {
  const kepler = await matchKeplerEntity(entity.name, entity.name_en)
  const raw = await magnaSearch(entity)
  let rows = toRows(raw, entity, kepler?.id ?? null)
  const totalRefs = new Set(rows.map((r) => r.reference_number)).size
  if (incremental) {
    const known = await knownRefs(entity._id)
    rows = rows.filter((r) => !known.has(r.reference_number))
  }
  await upsertRows(rows)
  return { company: entity.name, kepler: kepler?.name ?? null, reports: totalRefs, rows_written: rows.length, raw: raw.length }
}

// ── הפעלה ─────────────────────────────────────────────────────────
{
  const init = await magnaInit()
  const entities = init.entities || []
  if (flag('--list')) {
    console.log(`מגנא: ${init.totalEntities} חברות, ${init.totalReports} דוחות`)
    for (const e of entities) console.log(`  ${e._id}  ${e.name}${e.name_en ? '  (' + e.name_en + ')' : ''}`)
    process.exit(0)
  }
  let targets
  if (opt('--company')) {
    const q = normName(opt('--company'))
    targets = entities.filter((e) => normName(e.name).includes(q) || normName(e.name_en).includes(q))
    if (!targets.length) {
      console.error(`"${opt('--company')}" לא נמצאה במגנא. חברות מכוסות: node collector/magna-xbrl.mjs --list`)
      process.exit(2)
    }
    if (targets.length > 1) {
      console.error(`כמה התאמות ל-"${opt('--company')}":\n` + targets.map((e) => `  ${e.name}`).join('\n'))
      process.exit(2)
    }
  } else if (flag('--all')) {
    targets = entities
  } else {
    console.log('שימוש: --list | --company <שם> | --all   [--with-members] [--since 2021] [--quiet]')
    process.exit(2)
  }
  const t0 = Date.now()
  let ok = 0
  let failed = 0
  let written = 0
  for (const e of targets) {
    try {
      const r = await syncEntity(e, { incremental: !opt('--company') })
      written += r.rows_written
      ok++
      log(`✓ ${r.company}${r.kepler ? ' → קפלר: ' + r.kepler : ''}: ${r.reports} דוחות, ${r.rows_written} שורות חדשות`)
    } catch (err) {
      failed++
      console.error(`✗ ${e.name}: ${err.message}`)
    }
    await sleep(800)
  }
  console.log(`מגנא: ${ok} חברות סונכרנו, ${failed} נכשלו, ${written} שורות נכתבו, ${Math.round((Date.now() - t0) / 1000)} שניות`)
  process.exit(failed && !ok ? 1 : 0)
}
