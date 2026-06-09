import { useState, type ReactNode } from 'react'
import AuthModal from '../components/AuthModal'

// ── דף נחיתה (Brand) — עשיר, פרימיום, מציג את המוצר האמיתי. ──
export default function Landing({ onGuest }: { onGuest?: () => void }) {
  const [authOpen, setAuthOpen] = useState(false)
  const open = () => setAuthOpen(true)

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Backdrop />

      {/* כותרת */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
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
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1fr_1.15fr] lg:gap-10 lg:pt-14">
        <div className="text-center lg:text-right">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            מודיעין שוק ההון הישראלי
          </div>

          <h1
            className="animate-fade-up mt-6 text-5xl font-black leading-[1.04] tracking-tight sm:text-6xl"
            style={{ animationDelay: '60ms' }}
          >
            אלפי מקורות.
            <br />
            <span className="bg-gradient-to-l from-brand-light to-sky-300 bg-clip-text text-transparent">
              תובנה אחת.
            </span>
          </h1>

          <p
            className="animate-fade-up mt-5 max-w-md text-lg leading-relaxed text-slate-300 lg:mx-0"
            style={{ animationDelay: '120ms' }}
          >
            כל דיווח משוק ההון — מדורג לפי מהותיות ומזוקק לשורה תחתונה. הרעש שוקע, החשוב צף.
          </p>

          <div
            className="animate-fade-up mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
            style={{ animationDelay: '180ms' }}
          >
            <button
              onClick={open}
              className="group inline-flex h-12 items-center gap-2 rounded-xl bg-brand-light px-7 text-sm font-bold text-white shadow-lg shadow-brand-light/25 transition-all duration-200 hover:bg-sky-400 hover:shadow-brand-light/40 active:scale-[0.98]"
            >
              כניסה / הרשמה חינם
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
            className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 lg:justify-start"
            style={{ animationDelay: '240ms' }}
          >
            <Trust>ציון מהותיות</Trust>
            <Trust>הצלבת מקורות</Trust>
            <Trust>עדכון חי 24/7</Trust>
          </div>
        </div>

        {/* מוקאפ הדשבורד — הכוכב */}
        <div className="animate-fade-up" style={{ animationDelay: '220ms' }}>
          <FeedDashboard />
        </div>
      </section>

      {/* רצועת מספרים */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 sm:grid-cols-4">
          <Stat value="10,000+" label="דיווחים נאספו" />
          <Stat value="638" label="חברות במעקב" />
          <Stat value="5" label="מנועי ניתוח" />
          <Stat value="24/7" label="איסוף חי" />
        </div>
      </section>

      {/* יתרונות */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-black tracking-tight sm:text-4xl">
          לא עוד פיד. <span className="text-brand-light">מודיעין.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-slate-400">
          חמישה מנועי ניתוח שהופכים רעש של אלפי מקורות לתובנה אחת ממוקדת.
        </p>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Feature icon={<IconTarget />} title="ציון מהותיות" body="כל ידיעה מקבלת ציון 1–10. הרעש שוקע, מה שמזיז מניות צף לראש." />
          <Feature icon={<IconLink />} title="הצלבת מקורות" body="כמה מקורות מאשרים את אותה ידיעה — כך יודעים מה אמין ומה רעש." />
          <Feature icon={<IconPen />} title="שורה תחתונה" body="לא עוד דיווח יבש. בכל ידיעה — מה המשמעות שלה למשקיע, בעברית." />
          <Feature icon={<IconCalendar />} title="לוח אירועים" body="מבט קדימה: דוחות כספיים, פקיעות אופציות ונתוני מאקרו." />
          <Feature icon={<IconEye />} title="מעקב בעלי עניין" body="מי קונה ומוכר מבפנים — מוסדיים, בעלי שליטה ועסקאות בלוק." />
          <Feature icon={<IconMail />} title="בריף יומי" body="סיכום אישי לבוקר, ישר למייל או לטלגרם. רק מה שרלוונטי לך." />
        </div>
      </section>

      {/* CTA סופי */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-l from-brand/40 via-slate-900 to-slate-900 p-10 text-center sm:p-14">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">מוכן לראות את השוק בבירור?</h2>
          <p className="mx-auto mt-3 max-w-md text-slate-300">
            הצטרף חינם וקבל את הפיד המדורג שלך תוך שניות.
          </p>
          <button
            onClick={open}
            className="group mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-brand-light px-8 text-sm font-bold text-white shadow-lg shadow-brand-light/25 transition-all duration-200 hover:bg-sky-400 hover:shadow-brand-light/40 active:scale-[0.98]"
          >
            כניסה / הרשמה חינם
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
          </button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-6 text-center text-xs text-slate-500">
        NewFin · מודיעין פיננסי לשוק ההון
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

// ── רקע מוכל: גרדיאנט-מש + רשת עדינה (בלי אלמנט דורס) ────────────────
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-48 right-[-10%] h-[34rem] w-[34rem] rounded-full bg-brand/25 blur-[150px]" />
      <div className="absolute top-[20%] left-[-12%] h-[28rem] w-[28rem] rounded-full bg-brand-light/15 blur-[150px]" />
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '54px 54px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)',
        }}
      />
    </div>
  )
}

// ── מוקאפ הדשבורד (המוצר האמיתי) ────────────────────────────────────
const SPARK = 'M2,30 L18,24 L34,28 L50,16 L66,21 L82,9 L98,13 L116,3'

function FeedDashboard() {
  const items = [
    { score: 9, tier: 'high', dir: '▲', dirC: 'text-emerald-400', company: 'טאואר', sector: 'טכנולוגיה', title: 'רבעון שיא; הרווח הנקי זינק 13.7%', bl: 'השיפור בשוליים תומך בתחזית 2026.' },
    { score: 8, tier: 'high', dir: '▲', dirC: 'text-emerald-400', company: 'אלביט מערכות', sector: 'תעשייה', title: 'זכייה בחוזה ביטחוני מהותי באירופה' },
    { score: 5, tier: 'mid', dir: '◆', dirC: 'text-slate-400', company: 'עזריאלי', sector: 'נדל"ן ובינוי', title: 'עדכון שווי נכסים מניב ברבעון' },
    { score: 3, tier: 'low', dir: '◆', dirC: 'text-slate-400', sector: 'בנקים', title: 'הפיקוח על הבנקים פרסם הנחיה חדשה' },
  ]
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-brand/15 backdrop-blur-xl ring-1 ring-white/[0.03]">
      {/* chrome */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="mr-auto text-[11px] text-slate-500">newfin · הפיד שלי</span>
      </div>

      {/* רצועת שוק + sparkline פיננסי */}
      <div className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-white">ת"א 35</span>
            <span className="text-xs font-semibold text-emerald-400">+1.24%</span>
          </div>
          <span className="text-[11px] text-slate-500">2,184.50</span>
        </div>
        <svg width="118" height="34" viewBox="0 0 118 34" fill="none" className="shrink-0">
          <path
            className="animate-draw-line"
            d={SPARK}
            stroke="#34d399"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
          />
        </svg>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          חי
        </span>
      </div>

      {/* פילטרים */}
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {['הכל', 'מהותיות 7+', 'מאיה', 'גלובס', 'במעקב'].map((c, i) => (
          <span
            key={c}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
              i === 0 ? 'bg-brand-light/20 text-brand-light ring-1 ring-brand-light/30' : 'bg-white/5 text-slate-400'
            }`}
          >
            {c}
          </span>
        ))}
      </div>

      {/* כרטיסים */}
      <div className="space-y-2 px-3 pb-4">
        {items.map((it, i) => (
          <div
            key={i}
            className="animate-fade-up flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3"
            style={{ animationDelay: `${400 + i * 80}ms` }}
          >
            <div className="flex shrink-0 flex-col items-center gap-1">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${SCORE_STYLE[it.tier]}`}>
                {it.score}
              </span>
              <span className={`text-xs leading-none ${it.dirC}`}>{it.dir}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {it.company ? (
                  <span className="text-xs font-bold text-brand-light">{it.company}</span>
                ) : null}
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                  {it.sector}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] font-medium leading-snug text-slate-100">{it.title}</p>
              {it.bl && (
                <p className="mt-1.5 border-r-2 border-brand-light/40 pr-2 text-[11px] leading-relaxed text-slate-400">
                  {it.bl}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── עזרים ───────────────────────────────────────────────────────────
const SCORE_STYLE: Record<string, string> = {
  high: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/25',
  mid: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25',
  low: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25',
}

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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-7 text-center">
      <div className="text-3xl font-black tracking-tight text-white sm:text-4xl">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  )
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors duration-200 hover:border-brand-light/30 hover:bg-white/[0.05]">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light/10 text-brand-light ring-1 ring-brand-light/20">
        {icon}
      </span>
      <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  )
}

// ── אייקונים (stroke אחיד) ──────────────────────────────────────────
const ic = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const IconTarget = () => (<svg {...ic}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>)
const IconLink = () => (<svg {...ic}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>)
const IconPen = () => (<svg {...ic}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>)
const IconCalendar = () => (<svg {...ic}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>)
const IconEye = () => (<svg {...ic}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>)
const IconMail = () => (<svg {...ic}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>)
