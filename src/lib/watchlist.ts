// מעקב אישי — נשמר מקומית בדפדפן (localStorage).
// בעתיד, כשתתווסף הזדהות, יסונכרן לטבלת watchlist ב-Supabase.

const KEY = 'newfin_watch'

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
}
