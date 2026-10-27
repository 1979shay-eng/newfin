import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useTheme } from '../lib/theme'
import AuthModal from './AuthModal'
import { DISCLAIMER, LEGAL_PAGES } from '../lib/legal'

// desktopOnly — קישור בתדירות נמוכה שנושר מהבר במסך צר כדי לפנות מקום
// ליעדים האמיתיים (פיד, חברות). "אודות" מופיע בפוטר בכל הרזולוציות.
const navItems: { to: string; label: string; end?: boolean; adminOnly?: boolean; desktopOnly?: boolean }[] = [
  { to: '/', label: 'פיד', end: true },
  { to: '/markets', label: 'שווקים' },
  { to: '/indicators', label: 'אינדיקטורים' },
  { to: '/companies', label: 'חברות' },
  { to: '/about', label: 'אודות', desktopOnly: true },
  { to: '/admin', label: 'ניהול', adminOnly: true },
]

const WIDE_ROUTES = ['/markets', '/indicators']

function Logo() {
  return (
    <span
      className="flex h-[27px] w-[27px] items-center justify-center rounded-lg text-white"
      style={{ background: 'var(--accent-fill)' }}
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
  // דפי לוח (כרטיסים בגריד) מנצלים מסך רחב; דפי קריאה נשארים צרים
  const { pathname } = useLocation()
  const width = WIDE_ROUTES.includes(pathname) ? 'max-w-[1600px]' : 'max-w-[1200px]'

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
        <div className="nf-noise absolute inset-0" />
      </div>

      {/* ── ניווט ── */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-xl"
        style={{ background: 'var(--nav)', borderColor: 'var(--line2)' }}
      >
        {/* במסך צר: שורה עליונה — לוגו + פעולות; שורה שנייה — הקישורים, נגללת לרוחב
            בלי פס גלילה. בשורה אחת הם חרגו מרוחב הטלפון (421px מול 375) והקטינו את
            כל האתר. מ-sm ומעלה — שורה אחת כמו קודם. */}
        <div className={`mx-auto flex ${width} flex-wrap items-center justify-between gap-x-2 px-4 pb-1 pt-2.5 sm:flex-nowrap sm:px-6 sm:py-3`}>
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-[19px] font-extrabold tracking-tight" style={{ color: 'var(--ink)' }}>
              NewFin
            </span>
          </Link>
          <nav
            aria-label="ניווט ראשי"
            className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {items.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                // שטח נגיעה של 44px בטלפון; במחשב — נמוך יותר
                className={`inline-flex shrink-0 items-center rounded-[9px] px-3.5 py-[12px] text-sm font-bold transition-colors sm:py-[7px]${
                  n.desktopOnly ? ' hidden sm:inline-flex' : ''
                }`}
                style={({ isActive }) =>
                  isActive
                    ? { color: 'var(--accent)', background: 'var(--chip)' }
                    : { color: 'var(--muted)' }
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <span className="mx-1.5 hidden h-5 w-px sm:block" style={{ background: 'var(--line2)' }} />

            {/* מתג כהה/בהיר */}
            <button
              onClick={toggle}
              title="החלף ערכת נושא"
              aria-label="החלף ערכת נושא"
              className="inline-flex min-w-[44px] items-center justify-center rounded-[9px] px-3 py-[13px] text-sm font-bold transition-colors sm:min-w-0 sm:py-[7px]"
              style={{ color: 'var(--muted)' }}
            >
              {theme === 'dark' ? '☀' : '🌙'}
              {/* התווית מיותרת לצד האייקון במסך צר — aria-label נושא את המשמעות */}
              <span className="hidden sm:inline"> {theme === 'dark' ? 'בהיר' : 'כהה'}</span>
            </button>

            {user ? (
              <div className="mr-1.5 flex items-center gap-1.5 border-r pr-2" style={{ borderColor: 'var(--line2)' }}>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: 'var(--accent-fill)' }}
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
                className="mr-1.5 inline-flex items-center rounded-full px-4 py-[12px] text-sm font-semibold text-white sm:py-1.5"
                style={{ background: 'var(--accent-fill)' }}
              >
                כניסה
              </button>
            )}
          </div>
        </div>
      </header>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      <main className={`relative z-10 mx-auto ${width} px-4 py-7 sm:px-6`}>
        <Outlet />
      </main>

      <footer
        className="relative z-10 mt-12 border-t px-4 py-6 text-center text-xs"
        style={{ borderColor: 'var(--line2)', color: 'var(--muted2)' }}
      >
        {/* הבהרה משפטית — בתחתית כל עמוד (סעיף 3(ב) לחוק הייעוץ: מידע כללי, עניין אישי) */}
        <p role="note" className="mx-auto max-w-[900px] leading-relaxed">
          <b style={{ color: 'var(--muted)' }}>לתשומת לבך: </b>
          {DISCLAIMER}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>NewFinIL · המקום שלך בשוק ההון</span>
          {[{ path: '/about', label: 'אודות' }, ...LEGAL_PAGES].map((p) => (
            <span key={p.path} className="contents">
              <span aria-hidden>·</span>
              <Link to={p.path} className="font-semibold hover:underline" style={{ color: 'var(--muted)' }}>
                {p.label}
              </Link>
            </span>
          ))}
        </div>
      </footer>
    </div>
  )
}
