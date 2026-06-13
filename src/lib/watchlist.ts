// מעקב אישי. אורח: נשמר ב-localStorage בלבד. מחובר: מסונכרן גם לטבלת watchlist
// ב-Supabase — נשמר בענן ועובר בין מכשירים. ה-localStorage נשאר המקור המהיר ל-UI.
import { supabase, isSupabaseConfigured } from './supabase'

const KEY = 'newfin_watch'
const CHANGED = 'newfin-watch-changed' // אירוע פנימי לרענון רכיבים אחרי מיזוג ענן

// קאש מזהה המשתמש — מתעדכן דרך onAuthStateChange (בלי קריאת רשת בכל שמירה).
let currentUserId: string | null = null
if (isSupabaseConfigured) {
  supabase.auth.getSession().then(({ data }) => {
    currentUserId = data.session?.user?.id ?? null
  })
  supabase.auth.onAuthStateChange((_e, s) => {
    currentUserId = s?.user?.id ?? null
  })
}

export function loadWatch(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function saveWatch(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
  if (currentUserId) void replaceCloudWatch(currentUserId, ids)
}

// מאזין לרענון אחרי מיזוג ענן (Feed/Companies קוראים שוב את הרשימה)
export function onWatchChanged(cb: () => void): () => void {
  window.addEventListener(CHANGED, cb)
  return () => window.removeEventListener(CHANGED, cb)
}

// כותב מחדש את רשימת המעקב של המשתמש בענן (מחיקה + הכנסה — פשוט ועמיד לרשימות קטנות).
async function replaceCloudWatch(userId: string, companyIds: string[]): Promise<void> {
  try {
    await supabase.from('watchlist').delete().eq('user_id', userId)
    if (companyIds.length) {
      await supabase
        .from('watchlist')
        .insert(companyIds.map((company_id) => ({ user_id: userId, company_id })))
    }
  } catch {
    /* best-effort */
  }
}

// בכניסה: מאחד את הרשימה המקומית עם זו שבענן (איחוד), שומר מקומית ובענן,
// ומשדר אירוע כדי שהרכיבים יתעדכנו. כך מעקב מהדפדפן הקודם "נדבק" לחשבון.
export async function mergeWatchOnLogin(userId: string): Promise<void> {
  try {
    const { data } = await supabase.from('watchlist').select('company_id').eq('user_id', userId)
    const cloud = (data ?? []).map((r: { company_id: string }) => r.company_id).filter(Boolean)
    const local = loadWatch()
    const merged = [...new Set([...local, ...cloud])]
    localStorage.setItem(KEY, JSON.stringify(merged))
    await replaceCloudWatch(userId, merged)
    window.dispatchEvent(new Event(CHANGED))
  } catch {
    /* best-effort */
  }
}
