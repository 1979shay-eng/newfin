import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

type UserStat = {
  id: string
  email: string | null
  tier: 'free' | 'premium'
  is_admin: boolean
  created_at: string
  last_seen: string | null
  event_count: number
  login_count: number
  watch_count: number
}

type EventRow = {
  id: number
  type: string
  meta: Record<string, unknown> | null
  created_at: string
  users: { email: string | null } | null
}

const EVENT_LABEL: Record<string, string> = {
  login: 'כניסה',
  page_view: 'צפייה בעמוד',
  search: 'חיפוש',
  watch_add: 'הוספת מעקב',
  watch_remove: 'הסרת מעקב',
}

export default function Admin() {
  const { isAdmin, loading: authLoading } = useAuth()
  const [users, setUsers] = useState<UserStat[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    Promise.all([
      supabase.from('admin_user_stats').select('*').order('last_seen', { ascending: false, nullsFirst: false }),
      supabase
        .from('usage_events')
        .select('id, type, meta, created_at, users ( email )')
        .order('created_at', { ascending: false })
        .limit(80),
    ]).then(([u, e]) => {
      if (!alive) return
      setUsers((u.data as UserStat[]) ?? [])
      setEvents((e.data as unknown as EventRow[]) ?? [])
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [isAdmin])

  const totals = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      users: users.length,
      activeToday: users.filter((u) => u.last_seen?.slice(0, 10) === today).length,
      events: users.reduce((s, u) => s + Number(u.event_count), 0),
      logins: users.reduce((s, u) => s + Number(u.login_count), 0),
    }
  }, [users])

  if (authLoading) return null
  if (!isAdmin)
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <p className="text-lg font-bold text-white">אין הרשאה</p>
        <p className="mt-1 text-sm text-slate-400">העמוד הזה זמין למנהלי המערכת בלבד.</p>
      </div>
    )

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">ניהול</h1>
        <p className="mt-1 text-sm text-slate-400">משתמשים, פעילות ושימוש במערכת.</p>
      </div>

      {/* כרטיסי סיכום */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="משתמשים" value={totals.users} />
        <StatCard label="פעילים היום" value={totals.activeToday} accent />
        <StatCard label="סה״כ כניסות" value={totals.logins} />
        <StatCard label="סה״כ אירועים" value={totals.events} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* טבלת משתמשים */}
          <div className="lg:col-span-3">
            <h2 className="mb-2 text-sm font-semibold text-slate-300">משתמשים ({users.length})</h2>
            <div className="overflow-hidden rounded-xl border border-white/[0.08]">
              <table className="w-full text-right text-sm">
                <thead className="bg-white/[0.03] text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">משתמש</th>
                    <th className="px-3 py-2 font-medium">כניסה אחרונה</th>
                    <th className="px-3 py-2 text-center font-medium">כניסות</th>
                    <th className="px-3 py-2 text-center font-medium">מעקב</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-slate-200" dir="ltr">
                            {u.email ?? '—'}
                          </span>
                          {u.is_admin && (
                            <span className="shrink-0 rounded bg-brand-light/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-light">
                              מנהל
                            </span>
                          )}
                          {u.tier === 'premium' && (
                            <span className="shrink-0 rounded bg-amber-300/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              פרימיום
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{relTime(u.last_seen)}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-slate-300">{u.login_count}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-slate-300">{u.watch_count}</td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                        עדיין אין משתמשים רשומים.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* פעילות אחרונה */}
          <div className="lg:col-span-2">
            <h2 className="mb-2 text-sm font-semibold text-slate-300">פעילות אחרונה</h2>
            <div className="max-h-[28rem] space-y-1.5 overflow-y-auto rounded-xl border border-white/[0.08] p-2">
              {events.map((e) => (
                <div key={e.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.03]">
                  <span className="mt-0.5 shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                    {EVENT_LABEL[e.type] ?? e.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-slate-300" dir="ltr">
                      {e.users?.email ?? '—'}
                    </div>
                    {metaText(e) && <div className="truncate text-[11px] text-slate-500">{metaText(e)}</div>}
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-600">{relTime(e.created_at)}</span>
                </div>
              ))}
              {events.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">אין פעילות עדיין.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className={`text-2xl font-black tabular-nums ${accent ? 'text-brand-light' : 'text-white'}`}>
        {value.toLocaleString('he-IL')}
      </div>
      <div className="mt-0.5 text-xs text-slate-400">{label}</div>
    </div>
  )
}

function metaText(e: EventRow): string {
  if (!e.meta) return ''
  if (e.type === 'search' && e.meta.q) return `"${e.meta.q}"`
  if (e.type === 'page_view' && e.meta.path) return String(e.meta.path)
  if ((e.type === 'watch_add' || e.type === 'watch_remove') && e.meta.company) return String(e.meta.company)
  return ''
}

function relTime(iso: string | null): string {
  if (!iso) return 'מעולם'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'עכשיו'
  if (m < 60) return `לפני ${m} ד׳`
  const h = Math.floor(m / 60)
  if (h < 24) return `לפני ${h} ש׳`
  const d = Math.floor(h / 24)
  return `לפני ${d} י׳`
}
