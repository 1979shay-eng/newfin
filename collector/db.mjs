// חיבור למסד הנתונים — משתמש במפתח service_role (כתיבה מלאה, עוקף RLS)
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// קריאת .env ידנית (בלי dotenv — כדי לא להוסיף תלות)
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '.env')
let envVars = {}
try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const [k, ...v] = line.split('=')
    if (k && v.length) envVars[k.trim()] = v.join('=').trim()
  }
} catch {
  console.warn('לא נמצא collector/.env — בודק משתני סביבה')
}

const url = envVars.SUPABASE_URL || process.env.SUPABASE_URL
const key = envVars.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!url || !key) throw new Error('חסרים SUPABASE_URL / SUPABASE_SERVICE_KEY בקובץ collector/.env')

export const db = createClient(url, key, {
  auth: { persistSession: false },
})

// מוצא או יוצר חברה לפי מזהה מאיה, מחזיר את ה-uuid שלה
export async function upsertCompany(maya_company_id, name_he) {
  if (!maya_company_id) return null
  const slug = name_he
    .replace(/[^֐-׿a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  const { data, error } = await db
    .from('companies')
    .upsert({ maya_company_id, name_he, slug }, { onConflict: 'maya_company_id' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// מחזיר את ה-uuid של מקור מאיה (נוצר פעם אחת מ-seed)
let mayaSourceId = null
export async function getMayaSourceId() {
  if (mayaSourceId) return mayaSourceId
  const { data } = await db.from('sources').select('id').eq('name', 'מאיה').single()
  mayaSourceId = data?.id || null
  return mayaSourceId
}

// מוצא מקור לפי שם, ואם אינו קיים — יוצר אותו. כך כל מקור חדש (RSS/נושאי) נכנס
// לבד בלי צעד ידני ב-DB. ממוטמן בזיכרון לכל ריצה.
const sourceCache = new Map()
export async function getOrCreateSource(name, { type = 'osint', reliability = 'reported', base_url = null } = {}) {
  if (!name) return null
  if (sourceCache.has(name)) return sourceCache.get(name)
  const { data: found } = await db.from('sources').select('id').eq('name', name).maybeSingle()
  if (found?.id) {
    sourceCache.set(name, found.id)
    return found.id
  }
  const { data, error } = await db
    .from('sources')
    .insert({ name, type, reliability_default: reliability, base_url })
    .select('id')
    .single()
  if (error) {
    // ייתכן מרוץ — מקור נוצר במקביל. ננסה לשלוף שוב.
    const { data: again } = await db.from('sources').select('id').eq('name', name).maybeSingle()
    if (again?.id) {
      sourceCache.set(name, again.id)
      return again.id
    }
    throw error
  }
  sourceCache.set(name, data.id)
  return data.id
}

// מחזיר Map: maya_report_id → { bottom_line, materiality_score, direction } עבור
// פריטים שכבר הועשרו (bottom_line לא-null). שני שימושים:
//   1. לדלג על העשרה חוזרת — כדי לא לשרוף את מכסת הטוקנים היומית של Groq על אותם פריטים.
//   2. לטעון בחזרה את ההעשרה הקיימת — כדי שה-upsert לא ידרוס bottom_line קיים ל-null
//      כשהפריט נופל מ-top-ENRICH_TOP בריצה מאוחרת.
export async function getEnrichedMap(reportIds) {
  const map = new Map()
  const ids = [...new Set(reportIds.filter(Boolean))]
  if (!ids.length) return map
  const CHUNK = 200 // שמירה על אורך URL סביר ב-filter .in()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const { data, error } = await db
      .from('items')
      .select('maya_report_id, bottom_line, materiality_score, direction')
      .in('maya_report_id', slice)
      .not('bottom_line', 'is', null)
    if (error) throw error
    for (const row of data || []) map.set(row.maya_report_id, row)
  }
  return map
}

// מכניס/מעדכן פריטים במסד לפי maya_report_id (מאפשר העשרה חוזרת)
export async function upsertItems(items) {
  if (!items.length) return { count: 0 }
  const { data, error } = await db
    .from('items')
    .upsert(items, { onConflict: 'maya_report_id' })
    .select('id')
  if (error) throw error
  return { count: data?.length ?? 0 }
}

// מוצא/יוצר תגית לפי slug (ענף/מאקרו) ומחזיר id. ממוטמן בזיכרון לכל ריצה.
const tagCache = new Map()
export async function getOrCreateTag(name_he, type) {
  if (tagCache.has(name_he)) return tagCache.get(name_he)
  const slug =
    name_he.replace(/[^֐-׿a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || type
  const { data: found } = await db.from('tags').select('id').eq('slug', slug).maybeSingle()
  let id = found?.id
  if (!id) {
    const { data, error } = await db.from('tags').insert({ name_he, type, slug }).select('id').single()
    if (error) {
      const { data: again } = await db.from('tags').select('id').eq('slug', slug).maybeSingle()
      if (!again?.id) throw error
      id = again.id
    } else {
      id = data.id
    }
  }
  tagCache.set(name_he, id)
  return id
}

// מקשר תגית כותרת (סקטור/מאקרו) לפריטים בלי חברה.
// entries: [{ maya_report_id, tag, type }]. משתמש ב-item_tags (בלי migration).
export async function linkHeadlineTags(entries) {
  if (!entries?.length) return
  // 1) tag ids
  for (const e of entries) await getOrCreateTag(e.tag, e.type)
  // 2) item ids לפי maya_report_id
  const ids = [...new Set(entries.map((e) => e.maya_report_id).filter(Boolean))]
  const idMap = new Map()
  const CHUNK = 200
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await db
      .from('items')
      .select('id, maya_report_id')
      .in('maya_report_id', ids.slice(i, i + CHUNK))
    for (const row of data || []) idMap.set(row.maya_report_id, row.id)
  }
  // 3) upsert קישורים
  const rows = []
  for (const e of entries) {
    const item_id = idMap.get(e.maya_report_id)
    const tag_id = tagCache.get(e.tag)
    if (item_id && tag_id) rows.push({ item_id, tag_id })
  }
  if (rows.length) {
    await db.from('item_tags').upsert(rows, { onConflict: 'item_id,tag_id', ignoreDuplicates: true })
  }
}
