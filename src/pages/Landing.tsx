import { useState, type ReactNode } from 'react'
import AuthModal from '../components/AuthModal'

// ── דף נחיתה (Brand) — פוגש משתמשים לא-מזוהים. כהה, דינמי, מציג את הבידול. ──
export default function Landing() {
  const [authOpen, setAuthOpen] = useState(false)
  const open = () => setAuthOpen(true)

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* זוהר אטמוספרי */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="animate-float-glow absolute -top-40 right-[-12%] h-[30rem] w-[30rem] rounded-full bg-brand/30 blur-[130px]" />
        <div
          className="animate-float-glow absolute bottom-[-12%] left-[-8%] h-[26rem] w-[26rem] rounded-full bg-brand-light/20 blur-[130px]"
          style={{ animationDelay: '2.5s' }}
        />
      </div>

      {/* כותרת עליונה */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight">NewFin</span>
          <span className="hidden text-xs text-slate-400 sm:inline">· מודיעין שוק ההון</span>
        </div>
        <button
          onClick={open}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/10"
        >
          כניסה / הרשמה
        </button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-8 lg:grid-cols-2 lg:gap-10 lg:pt-16">
        <div className="text-center lg:text-right">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            מודיעין חכם לשוק ההון הישראלי
          </div>

          <h1
            className="animate-fade-up mt-5 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '60ms' }}
          >
            אלפי מקורות.
            <br />
            <span className="bg-gradient-to-l from-brand-light to-sky-300 bg-clip-text text-transparent">
              תובנה אחת.
            </span>
          </h1>

          <p
            className="animate-fade-up mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-300 lg:mx-0 lg:text-lg"
            style={{ animationDelay: '120ms' }}
          >
            NewFin אוסף דיווחים ממאיה, מהעיתונות הכלכלית ומהשווקים, מדרג כל ידיעה לפי{' '}
            <strong className="font-bold text-white">מהותיות</strong>, וכותב לך את השורה התחתונה.
            הרעש שוקע, החשוב צף.
          </p>

          <div
            className="animate-fade-up mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
            style={{ animationDelay: '180ms' }}
          >
            <button
              onClick={open}
              className="group inline-flex h-12 items-center gap-2 rounded-xl bg-brand-light px-6 text-sm font-bold text-white shadow-lg shadow-brand-light/25 transition-all hover:bg-sky-400 hover:shadow-brand-light/40 active:scale-[0.98]"
            >
              כניסה / הרשמה חינם
              <span className="transition-transform group-hover:-translate-x-1">←</span>
            </button>
            <span className="text-xs text-slate-400">חינם · בלי כרטיס אשראי</span>
          </div>

          <div
            className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-400 lg:justify-start"
            style={{ animationDelay: '240ms' }}
          >
            <Trust>ציון מהותיות לכל ידיעה</Trust>
            <Trust>עדכון חי</Trust>
            <Trust>אלפי מקורות</Trust>
          </div>
        </div>

        {/* כרטיס פיד לדוגמה — חי ומדורג, בעקביות עם המוצר */}
        <div className="animate-fade-up" style={{ animationDelay: '160ms' }}>
          <MockFeed />
        </div>
      </section>

      {/* בידול */}
      <section className="relative z-10 border-t border-white/5 bg-slate-950/40 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
            למה NewFin
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Feature
              icon="🎯"
              title="ציון מהותיות"
              body="כל ידיעה מקבלת ציון 1–10. הרעש שוקע, מה שמזיז מניות צף לראש הפיד."
            />
            <Feature
              icon="🔗"
              title="הצלבת מקורות"
              body="כמה מקורות מאשרים את אותה ידיעה — כך יודעים מה אמין ומה רעש."
            />
            <Feature
              icon="✍️"
              title="שורה תחתונה"
              body="לא עוד דיווח יבש. בכל ידיעה — מה המשמעות שלה למשקיע, בעברית."
            />
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs text-slate-500">
        NewFin · מודיעין פיננסי לשוק ההון · גרסת פיתוח
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

// ── עזרים ───────────────────────────────────────────────────────────
function Logo() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light/20 text-brand-light ring-1 ring-brand-light/30">
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
      {children}
    </span>
  )
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.05]">
      <div className="text-2xl">{icon}</div>
      <h3 className="mt-3 text-base font-bold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
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
    { score: 8, tier: 'high', company: 'אלביט מערכות', title: 'זכייה בחוזה ביטחוני בהיקף מהותי' },
    { score: 5, tier: 'mid', company: 'עזריאלי', title: 'עדכון שווי נכסים מניב ברבעון' },
    { score: 3, tier: 'low', sector: 'בנקים', title: 'הפיקוח על הבנקים פרסם הנחיה חדשה' },
  ]
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-brand/10 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <span className="text-sm font-bold text-white">הפיד שלי</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          LIVE
        </span>
      </div>
      <div className="mt-3 space-y-2.5">
        {items.map((it, i) => (
          <div
            key={i}
            className="animate-fade-up flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3"
            style={{ animationDelay: `${320 + i * 90}ms` }}
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
