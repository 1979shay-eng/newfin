// מעקב שימוש מאוזן — שורה אחת לאירוע ב-usage_events.
// כותב רק עבור משתמש מחובר (RLS חוסם אנונימי ממילא). שקט: שגיאות לא מפריעות ל-UI.
import { supabase, isSupabaseConfigured } from './supabase'

type EventType = 'login' | 'page_view' | 'search' | 'watch_add' | 'watch_remove'

// קאש מזהה המשתמש הנוכחי — מתעדכן דרך onAuthStateChange (בלי לקרוא לרשת בכל track).
let currentUserId: string | null = null
if (isSupabaseConfigured) {
  supabase.auth.getSession().then(({ data }) => {
    currentUserId = data.session?.user?.id ?? null
  })
  supabase.auth.onAuthStateChange((_e, s) => {
    currentUserId = s?.user?.id ?? null
  })
}

export async function track(type: EventType, meta?: Record<string, unknown>): Promise<void> {
  if (!currentUserId) return
  try {
    await supabase.from('usage_events').insert({ user_id: currentUserId, type, meta: meta ?? null })
  } catch {
    /* מעקב הוא best-effort — לא מפילים את החוויה בגלל לוג */
  }
}

// page_view ממוזער: לא רושמים את אותו נתיב פעמיים ברצף (מונע כפילויות מרענדר).
let lastPath = ''
export function trackPageView(path: string): void {
  if (path === lastPath) return
  lastPath = path
  void track('page_view', { path })
}
