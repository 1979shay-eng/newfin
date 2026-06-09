import { supabase, isSupabaseConfigured } from './supabase'
import { mockFeed } from './mockData'
import type { FeedItem } from '../types/db'

export async function fetchFeed(limit = 40): Promise<FeedItem[]> {
  if (!isSupabaseConfigured) return mockFeed

  const { data, error } = await supabase
    .from('items')
    .select(`
      *,
      sources ( name ),
      companies ( name_he, sector )
    `)
    .eq('status', 'published')
    // עיקרון: כל ידיעה בפיד חייבת להכווין למניה. ידיעות בלי חברה (חדשות
    // מאקרו/כלליות שלא זוהתה להן חברה) מוסתרות — עד שתיווסף שכבת תיוג ענפי.
    .not('company_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('fetchFeed error:', error.message)
    return mockFeed
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    source_name: row.sources?.name ?? row.source_type,
    company_name: row.companies?.name_he ?? null,
    company_sector: row.companies?.sector ?? null,
    tags: [],
  })) as FeedItem[]
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
