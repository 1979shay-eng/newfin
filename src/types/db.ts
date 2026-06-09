// טיפוסי מסד הנתונים — תואמים ל-supabase/schema.sql

export type SourceType = 'osint' | 'humint' | 'finint'
export type Reliability = 'verified' | 'reported' | 'estimate'
export type Direction = 'bull' | 'bear' | 'neutral'
export type ItemStatus = 'draft' | 'published'

export interface Source {
  id: string
  name: string
  type: SourceType
  subtype: string | null
  reliability_default: Reliability
  base_url: string | null
  is_active: boolean
}

export interface Company {
  id: string
  maya_company_id: string | null
  name_he: string
  name_en: string | null
  sector: string | null
  is_active: boolean
}

export interface Item {
  id: string
  source_id: string
  company_id: string | null
  security_id: string | null
  title: string
  body: string
  bottom_line: string | null
  original_url: string | null
  published_at: string
  source_type: SourceType
  reliability: Reliability
  materiality_score: number // 1-10
  direction: Direction
  status: ItemStatus
  is_public: boolean
  lang: string
  cluster_id: string | null
  created_at: string
}

// פריט מועשר לתצוגה (עם שמות מצורפים ותגיות)
export interface FeedItem extends Item {
  source_name: string
  company_name?: string | null
  company_sector?: string | null
  tags?: string[]
}
