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
      companies ( name_he )
    `)
    .eq('status', 'published')
    .order('materiality_score', { ascending: false })
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
    tags: [],
  })) as FeedItem[]
}
