import { Link, NavLink, Outlet } from 'react-router-dom'

const navItems: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'פיד', end: true },
  { to: '/companies', label: 'חברות' },
  { to: '/about', label: 'אודות' },
]

export default function Layout() {
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
