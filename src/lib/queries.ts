import { supabase, isSupabaseConfigured } from './supabase'
import { mockFeed } from './mockData'
import type { FeedItem } from '../types/db'

export async function fetchFeed(limit = 40): Promise<FeedItem[]> {
  if (!isSupabaseConfigured) return mockFeed

  const SEL = `
      *,
      sources ( name ),
      companies ( name_he, sector ),
      item_tags ( tags ( name_he, type ) )
    `
  // שתי שאילתות במקביל:
  //   1. הטריות ביותר לפי זמן — הפיד הרגיל.
  //   2. החשובות (7+) מ-3 הימים האחרונים — בזרם המלא של מאיה (מאות דיווחים ביום)
  //      ידיעה חשובה מהבוקר נדחקת מחלון הזמן, וסינון "חשיבות גבוהה" נשאר ריק בלעדיה.
  // חשיבות נמוכה (≤3: מרשם בעלי מניות, החזקות בעלי עניין, שגרה טכנית) לא מוצגת
  // בפיד בכלל — רעש. נשארת במאגר לארכיון, לחיפוש ולדפי חברה.
  // שולפים יותר מהדרוש ומסננים בצד-לקוח, כי כלל התצוגה הוא "חברה או תגית סקטור/מאקרו"
  // (קשה לבטא OR על משאב מקושר ב-PostgREST).
  const since72h = new Date(Date.now() - 72 * 3600e3).toISOString()
  const [fresh, important] = await Promise.all([
    supabase
      .from('items')
      .select(SEL)
      .eq('status', 'published')
      .gte('materiality_score', 4)
      .order('published_at', { ascending: false })
      .limit(limit * 2),
    supabase
      .from('items')
      .select(SEL)
      .eq('status', 'published')
      .gte('materiality_score', 7)
      .gte('published_at', since72h)
      .order('published_at', { ascending: false })
      .limit(60),
  ])

  if (fresh.error) {
    console.error('fetchFeed error:', fresh.error.message)
    return mockFeed
  }

  // מיזוג ודה-דופ לפי id, מהחדש לישן
  const byId = new Map<string, any>()
  for (const row of [...(fresh.data ?? []), ...(important.data ?? [])]) byId.set(row.id, row)
  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  )

  // עיקרון: כל ידיעה חייבת הכוונה — חברה, או תגית סקטור/מאקרו. השאר מוסתר.
  return mapRows(merged)
    .filter((it: any) => it.company_id || it.headline_tag)
    .slice(0, limit + 60) as FeedItem[]
}

// מיפוי שורת DB (עם joins) לצורת FeedItem — משותף לפיד ולחיפוש הארכיון
function mapRows(rows: any[]): any[] {
  return rows.map((row: any) => {
    const tag = row.item_tags?.[0]?.tags ?? null
    return {
      ...row,
      source_name: row.sources?.name ?? row.source_type,
      company_name: row.companies?.name_he ?? null,
      company_sector: row.companies?.sector ?? null,
      headline_tag: tag?.name_he ?? null, // סקטור/מאקרו לכתבות בלי חברה
      headline_type: tag?.type ?? null, // 'sector' | 'macro'
      tags: [],
    }
  })
}

const ITEM_SELECT = `
  *,
  sources ( name ),
  companies ( name_he, sector ),
  item_tags ( tags ( name_he, type ) )
`

// ── חיפוש ארכיון: עד 9 חודשים אחורה, מול המאגר (לא רק מה שנטען למסך) ──
// מחפש בכותרת + בהסבר, ובנפרד לפי שם חברה (join של PostgREST לא תומך
// ב-OR על טבלה מקושרת). התוצאות ממוזגות, מדו-דופלקות וממוינות לפי זמן.
export async function searchFeed(q: string, limit = 120): Promise<FeedItem[]> {
  if (!isSupabaseConfigured) return []
  const term = q.trim().replace(/[,%()]/g, ' ').trim()
  if (term.length < 2) return []

  const since = new Date()
  since.setMonth(since.getMonth() - 9)
  const sinceIso = since.toISOString()

  // חיפוש 1: בטקסט הידיעה (כותרת/שורה תחתונה)
  const textQ = supabase
    .from('items')
    .select(ITEM_SELECT)
    .eq('status', 'published')
    .gte('published_at', sinceIso)
    .or(`title.ilike.%${term}%,bottom_line.ilike.%${term}%`)
    .order('published_at', { ascending: false })
    .limit(limit)

  // חיפוש 2: לפי שם חברה — קודם מאתרים חברות תואמות, ואז את הידיעות שלהן
  const compQ = supabase.from('companies').select('id').ilike('name_he', `%${term}%`).limit(30)

  const [textRes, compRes] = await Promise.all([textQ, compQ])
  if (textRes.error) console.error('searchFeed text error:', textRes.error.message)

  let compItems: any[] = []
  const compIds = (compRes.data ?? []).map((c: any) => c.id)
  if (compIds.length) {
    const { data, error } = await supabase
      .from('items')
      .select(ITEM_SELECT)
      .eq('status', 'published')
      .gte('published_at', sinceIso)
      .in('company_id', compIds)
      .order('published_at', { ascending: false })
      .limit(limit)
    if (error) console.error('searchFeed company error:', error.message)
    compItems = data ?? []
  }

  // מיזוג + דה-דופ לפי מזהה, מיון מהחדש לישן
  const seen = new Set<string>()
  const merged = [...(textRes.data ?? []), ...compItems].filter((r: any) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
  merged.sort((a: any, b: any) => +new Date(b.published_at) - +new Date(a.published_at))

  return mapRows(merged)
    .filter((it: any) => it.company_id || it.headline_tag)
    .slice(0, limit) as FeedItem[]
}

export type CompanyRow = {
  id: string
  maya_company_id: string | null
  name_he: string
  sector: string | null
}

export async function fetchCompanies(): Promise<CompanyRow[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('companies')
    .select('id, maya_company_id, name_he, sector')
    .order('name_he')

  if (error) {
    console.error('fetchCompanies error:', error.message)
    return []
  }

  return (data ?? []) as CompanyRow[]
}
