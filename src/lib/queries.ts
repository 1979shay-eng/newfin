import { supabase, isSupabaseConfigured } from './supabase'
import { mockFeed } from './mockData'
import type { FeedItem } from '../types/db'

export async function fetchFeed(limit = 40): Promise<FeedItem[]> {
  if (!isSupabaseConfigured) return mockFeed

  // שולפים יותר מהדרוש ומסננים בצד-לקוח, כי כלל התצוגה הוא "חברה או תגית סקטור/מאקרו"
  // (קשה לבטא OR על משאב מקושר ב-PostgREST).
  const { data, error } = await supabase
    .from('items')
    .select(`
      *,
      sources ( name ),
      companies ( name_he, sector ),
      item_tags ( tags ( name_he, type ) )
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit * 2)

  if (error) {
    console.error('fetchFeed error:', error.message)
    return mockFeed
  }

  const mapped = (data ?? []).map((row: any) => {
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

  // עיקרון: כל ידיעה חייבת הכוונה — חברה, או תגית סקטור/מאקרו. השאר מוסתר.
  return mapped.filter((it: any) => it.company_id || it.headline_tag).slice(0, limit) as FeedItem[]
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
