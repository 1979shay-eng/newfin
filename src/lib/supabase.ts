import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // לא חוסם את הריצה — מאפשר לעבוד על ה-UI לפני חיבור DB
  console.warn(
    '[NewFin] חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ב-.env.local — חיבור Supabase עדיין לא פעיל.',
  )
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
)
