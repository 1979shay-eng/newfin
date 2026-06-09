// מודול איסוף ממאיה — עובר את הגנת Incapsula דרך דפדפן אמיתי (Playwright)
// וקורא ל-API הציבורי /api/v1. ראה docs ובלוטפרינט.
import { chromium } from 'playwright'

const BASE = 'https://maya.tase.co.il'
const FILES_BASE = 'https://mayafiles.tase.co.il'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// פותח דפדפן ועובר את ההגנה (טעינת העמוד פעם אחת מקבעת את עוגיות Incapsula)
export async function openMaya() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ locale: 'he-IL', userAgent: UA })
  const page = await ctx.newPage()
  await page.goto(BASE + '/he', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)
  await page.close()
  return { browser, ctx }
}

async function apiGet(ctx, path) {
  const r = await ctx.request.get(BASE + path, {
    headers: { Accept: 'application/json' },
    timeout: 20000,
  })
  if (r.status() !== 200) throw new Error(`GET ${path} -> ${r.status()}`)
  return r.json()
}

async function apiPost(ctx, path, body) {
  const r = await ctx.request.post(BASE + path, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    data: body,
    timeout: 20000,
  })
  if (r.status() !== 200) throw new Error(`POST ${path} -> ${r.status()}`)
  return r.json()
}

function asArray(d) {
  if (Array.isArray(d)) return d
  return d.reports || d.result || d.items || d.data || []
}

// הפיד הגלובלי של ההודעות המתפרצות — POST עם דפדוף (pageNumber/offset/limit).
// מחזיר דיווחים מכל החברות, ממוין מהחדש לישן.
export async function fetchRecentReports(ctx, { pages = 3, limit = 20 } = {}) {
  const byId = new Map()
  for (let p = 1; p <= pages; p++) {
    let arr
    try {
      const d = await apiPost(ctx, '/api/v1/reports/breaking-announcement', {
        pageNumber: p,
        limit,
        offset: (p - 1) * limit,
      })
      arr = asArray(d)
    } catch {
      break
    }
    if (arr.length === 0) break
    for (const rep of arr) byId.set(rep.id, rep)
    if (arr.length < limit) break
  }
  return [...byId.values()].sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate))
}

// קטליזטורים קרובים (למנוע לוח האירועים)
export async function fetchUpcomingCorporateActions(ctx, limit = 8) {
  try {
    return await apiGet(ctx, `/api/v1/corporate-actions/upcoming?limit=${limit}`)
  } catch {
    return []
  }
}

// Maya לפעמים מחזירה offset +02:00 (IST חורף) גם בקיץ (IDT = UTC+3).
// פותרים: מסירים את ה-offset שמאיה מצהירה עליו ומפרשים מחדש כ-Asia/Jerusalem.
function getIsraelOffsetMin(d) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]))
  const ilLocal = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)
  return Math.round((ilLocal - d) / 60000)
}

function parseMayaDate(s) {
  if (!s) return null
  const naive = s.replace(/([+-]\d{2}:?\d{2}|Z)$/i, '').trim()
  const asUtc = new Date(naive + 'Z')
  if (isNaN(asUtc)) return null
  const offsetMin = getIsraelOffsetMin(asUtc)
  return new Date(asUtc.getTime() - offsetMin * 60000).toISOString()
}

// נירמול דיווח גולמי ממאיה למבנה Item שלנו
export function normalizeReport(raw) {
  const company = raw.companies?.[0] || raw.company || null
  const pdf = (raw.attachments || []).find((a) => String(a.fileType).startsWith('pdf'))
  const original_url = pdf
    ? `${FILES_BASE}/${pdf.url}`
    : `${BASE}/he/reports/companies/${company?.companyId ?? ''}`
  return {
    maya_report_id: String(raw.id),
    title: (raw.title || '').replace(/בק["״]ע/g, 'בנושא').trim() || '(ללא כותרת)',
    company_name: company?.name || null,
    maya_company_id: company?.companyId != null ? String(company.companyId) : null,
    security_id: company?.mainSecurityId != null ? String(company.mainSecurityId) : null,
    form_id: raw.formId || null,
    is_priority: Boolean(raw.isPriority),
    published_at: parseMayaDate(raw.publishDate) ?? new Date().toISOString(),
    original_url,
    source_type: 'osint',
    reliability: 'verified',
    lang: 'he',
  }
}
