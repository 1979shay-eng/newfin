import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import AuthModal from './AuthModal'

const navItems: { to: string; label: string; end?: boolean; adminOnly?: boolean }[] = [
  { to: '/', label: 'פיד', end: true },
  { to: '/companies', label: 'חברות' },
  { to: '/about', label: 'אודות' },
  { to: '/admin', label: 'ניהול', adminOnly: true },
]

function Logo() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-light/15 text-brand-light ring-1 ring-brand-light/25">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M16 8h4v4" />
      </svg>
    </span>
  )
}

export default function Layout() {
  const { user, signOut, isAdmin } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const initial = (user?.email ?? '?').trim().charAt(0).toUpperCase()
  const items = navItems.filter((n) => !n.adminOnly || isAdmin)

  return (
    <div className="relative min-h-screen">
      {/* זוהר רקע עדין — שפת הנחיתה, באיפוק של מוצר */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[-12%] h-[28rem] w-[28rem] rounded-full bg-brand/15 blur-[150px]" />
        <div className="absolute top-[40%] left-[-14%] h-[24rem] w-[24rem] rounded-full bg-brand-light/[0.07] blur-[150px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-lg font-extrabold tracking-tight text-white">NewFin</span>
          </Link>
          <nav className="flex items-center gap-1">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-brand-light/15 text-brand-light ring-1 ring-brand-light/25'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            {user ? (
              <div className="mr-2 flex items-center gap-1.5 border-r border-white/10 pr-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light/15 text-xs font-bold text-brand-light"
                  title={user.email ?? ''}
                >
                  {initial}
                </span>
                <button
                  onClick={signOut}
                  title="יציאה"
                  className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5M21 12H9" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="mr-2 rounded-full border border-brand-light/30 bg-brand-light/10 px-4 py-1.5 text-sm font-semibold text-brand-light transition-colors hover:bg-brand-light/20"
              >
                כניסה
              </button>
            )}
          </nav>
        </div>
      </header>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <footer className="relative z-10 mt-12 border-t border-white/5 py-6 text-center text-xs text-slate-500">
        NewFinIL · המקום שלך בשוק ההון
      </footer>
    </div>
  )
}
