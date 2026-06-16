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
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
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
    <div className="relative min-h-screen bg-slate-50 text-slate-900">
      {/* זוהר רקע עדין ואוורירי — גוונים בהירים על רקע בהיר */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[-12%] h-[28rem] w-[28rem] rounded-full bg-brand-light/[0.10] blur-[150px]" />
        <div className="absolute top-[40%] left-[-14%] h-[24rem] w-[24rem] rounded-full bg-sky-300/[0.10] blur-[150px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-lg font-extrabold tracking-tight text-slate-900">NewFin</span>
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
                      ? 'bg-brand-light/15 text-brand ring-1 ring-brand-light/30'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            {user ? (
              <div className="mr-2 flex items-center gap-1.5 border-r border-slate-200 pr-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light/15 text-xs font-bold text-brand"
                  title={user.email ?? ''}
                >
                  {initial}
                </span>
                <button
                  onClick={signOut}
                  title="יציאה"
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
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
                className="mr-2 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark"
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

      <footer className="relative z-10 mt-12 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        NewFinIL · המקום שלך בשוק ההון
      </footer>
    </div>
  )
}
