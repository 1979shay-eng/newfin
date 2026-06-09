import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'

const navItems: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'פיד', end: true },
  { to: '/companies', label: 'חברות' },
  { to: '/about', label: 'אודות' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const initial = (user?.email ?? '?').trim().charAt(0).toUpperCase()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-brand">NewFin</span>
            <span className="hidden text-xs text-slate-400 sm:inline">מודיעין פיננסי</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            {user && (
              <div className="mr-2 flex items-center gap-1.5 border-r border-slate-200 pr-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand"
                  title={user.email ?? ''}
                >
                  {initial}
                </span>
                <button
                  onClick={signOut}
                  title="יציאה"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5M21 12H9" />
                  </svg>
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mt-12 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        NewFin · מודיעין פיננסי לשוק ההון · גרסת פיתוח
      </footer>
    </div>
  )
}
