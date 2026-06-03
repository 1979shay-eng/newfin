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
