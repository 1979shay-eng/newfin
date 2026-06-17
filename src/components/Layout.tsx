import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useTheme } from '../lib/theme'
import AuthModal from './AuthModal'

const navItems: { to: string; label: string; end?: boolean; adminOnly?: boolean }[] = [
  { to: '/', label: 'פיד', end: true },
  { to: '/companies', label: 'חברות' },
  { to: '/about', label: 'אודות' },
  { to: '/admin', label: 'ניהול', adminOnly: true },
]

function Logo() {
  return (
    <span
      className="flex h-[27px] w-[27px] items-center justify-center rounded-lg text-white"
      style={{ background: 'var(--accent)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M16 8h4v4" />
      </svg>
    </span>
  )
}

export default function Layout() {
  const { user, signOut, isAdmin } = useAuth()
  const { theme, toggle } = useTheme()
  const [authOpen, setAuthOpen] = useState(false)
  const initial = (user?.email ?? '?').trim().charAt(0).toUpperCase()
  const items = navItems.filter((n) => !n.adminOnly || isAdmin)

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--ink)' }}>
      {/* ── רקע מונפש: גריד ממוסך + 3 כתמי זוהר נודדים ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
            maskImage: 'radial-gradient(ellipse 100% 55% at 50% 0%, #000 30%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(ellipse 100% 55% at 50% 0%, #000 30%, transparent 78%)',
          }}
        />
        <div className="nf-drift1 absolute -top-40 right-[-8%] h-[600px] w-[600px] rounded-full" style={{ background: 'radial-gradient(circle, var(--glow1), transparent 65%)' }} />
        <div className="nf-drift2 absolute top-[30%] left-[-10%] h-[560px] w-[560px] rounded-full" style={{ background: 'radial-gradient(circle, var(--glow2), transparent 65%)' }} />
        <div className="nf-drift3 absolute bottom-[-12%] right-[20%] h-[520px] w-[520px] rounded-full" style={{ background: 'radial-gradient(circle, var(--glow1), transparent 65%)' }} />
      </div>

      {/* ── ניווט ── */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-xl"
        style={{ background: 'var(--nav)', borderColor: 'var(--line2)' }}
      >
        <div className="mx-auto flex max-w-[920px] items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-[19px] font-extrabold tracking-tight" style={{ color: 'var(--ink)' }}>
              NewFin
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className="rounded-[9px] px-3.5 py-[7px] text-sm font-bold transition-colors"
                style={({ isActive }) =>
                  isActive
                    ? { color: 'var(--accent)', background: 'var(--chip)' }
                    : { color: 'var(--muted)' }
                }
              >
                {n.label}
              </NavLink>
            ))}

            <span className="mx-1.5 h-5 w-px" style={{ background: 'var(--line2)' }} />

            {/* מתג כהה/בהיר */}
            <button
              onClick={toggle}
              title="החלף ערכת נושא"
              className="rounded-[9px] px-3 py-[7px] text-sm font-bold transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              {theme === 'dark' ? '☀ בהיר' : '🌙 כהה'}
            </button>

            {user ? (
              <div className="mr-1.5 flex items-center gap-1.5 border-r pr-2" style={{ borderColor: 'var(--line2)' }}>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: 'var(--accent)' }}
                  title={user.email ?? ''}
                >
                  {initial}
                </span>
                <button
                  onClick={signOut}
                  title="יציאה"
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: 'var(--muted2)' }}
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
                className="mr-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}
              >
                כניסה
              </button>
            )}
          </nav>
        </div>
      </header>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      <main className="relative z-10 mx-auto max-w-[920px] px-4 py-7 sm:px-6">
        <Outlet />
      </main>

      <footer className="relative z-10 mt-12 border-t py-6 text-center text-xs" style={{ borderColor: 'var(--line2)', color: 'var(--muted2)' }}>
        NewFinIL · המקום שלך בשוק ההון
      </footer>
    </div>
  )
}
