import { useState, type ReactNode } from 'react'
import AuthModal from '../components/AuthModal'

// ── דף נחיתה (Brand) — נקי, תמציתי, עם מוטיב פיננסי חי ברקע. ──
export default function Landing({ onGuest }: { onGuest?: () => void }) {
  const [authOpen, setAuthOpen] = useState(false)
  const open = () => setAuthOpen(true)

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* רקע: גרף שוק + רשת מסחר + זוהר רך (סטטי) */}
      <MarketBackdrop />

      {/* כותרת עליונה */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight">NewFin</span>
        </div>
        <button
          onClick={open}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/10"
        >
          כניסה
        </button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-220px)] max-w-6xl items-center gap-14 px-6 py-10 lg:grid-cols-2 lg:gap-10">
        <div className="text-center lg:text-right">
          <div
            className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            מודיעין שוק ההון הישראלי
          </div>

          <h1
            className="animate-fade-up mt-6 text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '60ms' }}
          >
            אלפי מקורות.
            <br />
            <span className="bg-gradient-to-l from-brand-light to-sky-300 bg-clip-text text-transparent">
              תובנה אחת.
            </span>
          </h1>

          <p
            className="animate-fade-up mt-5 text-lg text-slate-300 sm:text-xl"
            style={{ animationDelay: '120ms' }}
          >
            מדורג לפי מהותיות. מזוקק לשורה תחתונה.
          </p>

          <div
            className="animate-fade-up mt-9 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
            style={{ animationDelay: '180ms' }}
          >
            <button
              onClick={open}
              className="group inline-flex h-12 items-center gap-2 rounded-xl bg-brand-light px-7 text-sm font-bold text-white shadow-lg shadow-brand-light/20 transition-all duration-200 hover:bg-sky-400 hover:shadow-brand-light/35 active:scale-[0.98]"
            >
              כניסה / הרשמה
              <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
            </button>
            {onGuest && (
              <button
                onClick={onGuest}
                className="text-sm text-slate-400 underline-offset-4 transition-colors hover:text-slate-200 hover:underline"
              >
                המשך לצפייה ←
              </button>
            )}
          </div>

          <div
            className="animate-fade-up mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 lg:justify-start"
            style={{ animationDelay: '240ms' }}
          >
            <Trust>ציון מהותיות</Trust>
            <Trust>הצלבת מקורות</Trust>
            <Trust>עדכון חי</Trust>
          </div>
        </div>

        {/* כרטיס פיד — הוכחת מוצר, בעקביות עם האפליקציה */}
        <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
          <MockFeed />
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-6 text-center text-xs text-slate-500">
        NewFin · מודיעין פיננסי לשוק ההון
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

// ── רקע פיננסי ──────────────────────────────────────────────────────
const LINE =
  'M0,384 L114,360 L228,392 L342,318 L456,344 L570,280 L684,300 L798,232 L912,256 L1026,176 L1200,118'

function MarketBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* זוהר רך סטטי (עומק, בלי פעימה) */}
      <div className="absolute -top-40 right-[-12%] h-[32rem] w-[32rem] rounded-full bg-brand/25 blur-[140px]" />
      <div className="absolute bottom-[-16%] left-[-10%] h-[26rem] w-[26rem] rounded-full bg-brand-light/15 blur-[140px]" />

      {/* גרף שוק על תחתית המסך */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[55%] w-full"
        viewBox="0 0 1200 500"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="nf-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b7dd8" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#3b7dd8" stopOpacity="0" />
          </linearGradient>
          {/* רשת מסחר עדינה */}
          <pattern id="nf-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M60 0H0V60" fill="none" stroke="#fff" strokeOpacity="0.03" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1200" height="500" fill="url(#nf-grid)" />
        <path className="animate-area" d={`${LINE} L1200,500 L0,500 Z`} fill="url(#nf-area)" />
        <path
          className="animate-draw-line"
          d={LINE}
          fill="none"
          stroke="#3b7dd8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          opacity="0.7"
        />
      </svg>
    </div>
  )
}

// ── עזרים ───────────────────────────────────────────────────────────
function Logo() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light/15 text-brand-light ring-1 ring-brand-light/25">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M16 8h4v4" />
      </svg>
    </span>
  )
}

function Trust({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {children}
    </span>
  )
}

const SCORE_STYLE: Record<string, string> = {
  high: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/25',
  mid: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25',
  low: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25',
}

function MockFeed() {
  const items = [
    { score: 9, tier: 'high', company: 'טאואר', title: 'רבעון שיא; הרווח הנקי זינק 13.7%' },
    { score: 8, tier: 'high', company: 'אלביט מערכות', title: 'זכייה בחוזה ביטחוני מהותי' },
    { score: 5, tier: 'mid', company: 'עזריאלי', title: 'עדכון שווי נכסים מניב' },
    { score: 3, tier: 'low', sector: 'בנקים', title: 'הפיקוח על הבנקים פרסם הנחיה' },
  ]
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-2xl shadow-brand/10 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <span className="text-sm font-bold text-white">הפיד שלי</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          חי
        </span>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map((it, i) => (
          <div
            key={i}
            className="animate-fade-up flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3"
            style={{ animationDelay: `${360 + i * 80}ms` }}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${SCORE_STYLE[it.tier]}`}
            >
              {it.score}
            </span>
            <div className="min-w-0">
              {it.company ? (
                <span className="text-xs font-bold text-brand-light">{it.company}</span>
              ) : (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                  {it.sector}
                </span>
              )}
              <p className="mt-0.5 text-[13px] leading-snug text-slate-200">{it.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
