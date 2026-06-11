import { useState, type ReactNode } from 'react'
import AuthModal from '../components/AuthModal'

// ── דף נחיתה עריכותי-יוקרתי (Brand) — טיפוגרפיה עם ניגוד + אמנות-דאטה דרמטית. ──
export default function Landing({ onGuest }: { onGuest?: () => void }) {
  const [authOpen, setAuthOpen] = useState(false)
  const open = () => setAuthOpen(true)

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* רקע חי — גוני זוהר משתנים לאורך הדף (כחול → ירקרק → כחול-בהיר) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 right-[-10%] h-[34rem] w-[34rem] rounded-full bg-brand/20 blur-[150px]" />
        <div className="absolute top-[6%] left-[-10%] h-[28rem] w-[28rem] rounded-full bg-emerald-500/[0.08] blur-[150px]" />
        <div className="absolute top-[48%] right-[-14%] h-[26rem] w-[26rem] rounded-full bg-brand-light/10 blur-[160px]" />
        <div className="absolute bottom-[-8%] left-[15%] h-[24rem] w-[24rem] rounded-full bg-brand/15 blur-[150px]" />
      </div>
      {/* גרעין-פילם עדין — שובר את ה"שטיחות" של CSS */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* כותרת — דביקה עם זכוכית */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight">NewFin</span>
        </div>
        <button
          onClick={open}
          className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/10"
        >
          כניסה
        </button>
        </div>
      </header>

      {/* Hero עריכותי */}
      <section className="relative overflow-hidden">
        {/* אמנות-שוק — נשפכת מעבר לקצה השמאלי (דסקטופ) */}
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[54%] lg:block">
          <MarketArt />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-slate-950" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <div className="max-w-xl text-center lg:text-right">
            <p
              className="animate-fade-up text-xs font-bold uppercase tracking-[0.22em] text-brand-light"
            >
              — מודיעין שוק ההון הישראלי
            </p>

            <h1 className="mt-6">
              <span
                className="animate-fade-up block text-6xl font-black leading-[0.98] tracking-tight sm:text-7xl"
                style={{ animationDelay: '60ms' }}
              >
                אלפי מקורות.
              </span>
              <span
                className="animate-fade-up mt-1 block bg-gradient-to-l from-brand-light to-sky-300 bg-clip-text font-serif text-6xl font-medium leading-[1.05] text-transparent sm:text-7xl"
                style={{ animationDelay: '140ms' }}
              >
                תובנה אחת.
              </span>
            </h1>

            <p
              className="animate-fade-up mt-7 max-w-md text-lg leading-relaxed text-slate-300 lg:mr-0"
              style={{ animationDelay: '220ms' }}
            >
              מאיה, העיתונות הכלכלית והשווקים — במקום אחד. כל ידיעה מדורגת לפי מהותיות
              ומזוקקת לשורה תחתונה אחת.
            </p>

            <div
              className="animate-fade-up mt-9 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
              style={{ animationDelay: '300ms' }}
            >
              <button
                onClick={open}
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-b from-white to-slate-200 px-7 text-sm font-bold text-slate-900 shadow-[0_10px_30px_-8px_rgba(255,255,255,0.3)] ring-1 ring-white/50 transition-all duration-200 hover:to-white hover:shadow-[0_12px_36px_-8px_rgba(255,255,255,0.45)] active:scale-[0.98]"
              >
                כניסה / הרשמה חינם
                <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
              </button>
              <button
                onClick={onGuest ?? open}
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
              >
                {onGuest ? 'המשך לצפייה' : 'גלה עוד'}
              </button>
            </div>
          </div>
        </div>

        {/* אמנות-שוק — גרסת מובייל מוכלת */}
        <div className="relative mx-auto w-full max-w-md px-2 pb-10 lg:hidden">
          <MarketArt compact />
        </div>
      </section>

      {/* רצועת מספרים */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 px-6 sm:grid-cols-4">
          <Stat value="+10,000" label="דיווחים מנותחים" />
          <Stat value="638" label="חברות סחירות" />
          <Stat value="5" label="מנועי ניתוח" />
          <Stat value="24/7" label="עדכון חי" />
        </div>
      </section>

      {/* הצגת המוצר */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-right">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-light">הפיד שלך</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              פחות רעש.
              <br />
              <span className="font-serif font-medium text-slate-300">יותר סיגנל.</span>
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-slate-400 lg:mr-0">
              פיד אחד שמחבר כל ידיעה למניה או לסקטור, מדרג לפי מהותיות, ונותן לך בשורה
              אחת את מה שחשוב — חד, ענייני, בלי חפירות.
            </p>
          </div>
          <FeedDashboard />
        </div>
      </section>

      {/* יתרונות */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          <Feature icon={<IconTarget />} title="ציון מהותיות" body="כל ידיעה מקבלת ציון 1–10. מה שמזיז מניות — בראש הפיד." />
          <Feature icon={<IconLink />} title="הצלבת מקורות" body="כמה מקורות מאשרים — כך יודעים מה אמין ומה רעש." />
          <Feature icon={<IconPen />} title="שורה תחתונה" body="בכל ידיעה — מה המשמעות שלה למשקיע, בעברית." />
          <Feature icon={<IconCalendar />} title="לוח אירועים" body="מבט קדימה: דוחות, פקיעות ונתוני מאקרו." />
          <Feature icon={<IconEye />} title="מעקב בעלי עניין" body="מי קונה ומוכר מבפנים — מוסדיים ובלוקים." />
          <Feature icon={<IconMail />} title="בריף יומי" body="סיכום אישי לבוקר — למייל או לטלגרם." />
        </div>
      </section>

      {/* CTA סופי */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-l from-brand/40 via-slate-900 to-slate-900 p-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-light">
            NEWFINIL · המקום שלך בשוק ההון
          </p>
          <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            רוצה לדעת <span className="font-serif font-medium text-brand-light">לפני כולם?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-slate-300">
            הרשמה חינם — הפיד האישי שלך מחכה בפנים.
          </p>
          <button
            onClick={open}
            className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-b from-white to-slate-200 px-8 text-sm font-bold text-slate-900 shadow-[0_10px_30px_-8px_rgba(255,255,255,0.3)] ring-1 ring-white/50 transition-all duration-200 hover:to-white hover:shadow-[0_12px_36px_-8px_rgba(255,255,255,0.45)] active:scale-[0.98]"
          >
            כניסה / הרשמה חינם
            <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
          </button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-6 text-center text-xs text-slate-500">
        NewFinIL · המקום שלך בשוק ההון
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

// ── אמנות-דאטה: נרות זוהרים שצומחים בטעינה ──────────────────────────
// ווליום שמטפס יחד עם הגרף — נמוך בהיסטוריה השטוחה (שמאל), גבוה ליד השיא (ימין)
const CANDLES = [
  { h: 14, up: 1 }, { h: 18, up: 0 }, { h: 16, up: 1 }, { h: 22, up: 1 }, { h: 20, up: 0 },
  { h: 26, up: 1 }, { h: 24, up: 0 }, { h: 32, up: 1 }, { h: 30, up: 1 }, { h: 38, up: 0 },
  { h: 44, up: 1 }, { h: 42, up: 0 }, { h: 54, up: 1 }, { h: 62, up: 1 }, { h: 58, up: 0 },
  { h: 72, up: 1 }, { h: 84, up: 1 }, { h: 97, up: 1 },
]

// גרף-שטח "מדד לאורך זמן" — דימוי בלבד (שטוח ואז טיפוס מעריכי), בלי שמות ומספרים.
// הזמן זורם משמאל לימין (מוסכמת גרפים גם בעברית) — ההיסטוריה השטוחה נשפכת מעבר
// לקצה השמאלי, והשיא הזוהר מטפס לכיוון הטקסט.
const AREA =
  'M0,262 L30,255 L60,258 L90,251 L120,254 L150,246 L180,249 L210,241 L240,244 L270,234 L300,237 L330,225 L360,228 L390,209 L420,200 L450,176 L480,154 L510,116 L540,90 L570,50 L592,26'

function MarketArt({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative flex h-full w-full flex-col justify-center overflow-hidden ${
        compact ? 'px-3 py-2' : 'px-6 py-6'
      }`}
    >
      {/* זוהר מקומי — מתעצם לכיוון השיא (ימין) */}
      <div className="absolute left-[4%] top-[24%] h-[50%] w-[45%] rounded-full bg-emerald-500/[0.07] blur-[110px]" />
      <div className="absolute right-[2%] top-[4%] h-[45%] w-[40%] rounded-full bg-emerald-400/15 blur-[100px]" />

      {/* גרף שטח — מצייר את עצמו בכניסה, מתחזק לקראת השיא */}
      <div className="relative">
        <svg
          viewBox="0 0 600 300"
          fill="none"
          preserveAspectRatio="none"
          className={`w-full ${compact ? 'h-36' : 'h-72'}`}
        >
          <defs>
            <linearGradient id="nf-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
            {/* הקו מתחיל עמום ומתעצם עד זוהר מלא בקצה */}
            <linearGradient id="nf-line-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
              <stop offset="55%" stopColor="#34d399" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#6ee7b7" stopOpacity="1" />
            </linearGradient>
          </defs>
          {[75, 150, 225].map((y) => (
            <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#fff" strokeOpacity="0.05" strokeWidth="1" />
          ))}
          <path className="animate-area" d={`${AREA} L592,300 L0,300 Z`} fill="url(#nf-area-fill)" />
          <path
            className="animate-draw-line"
            d={AREA}
            stroke="url(#nf-line-grad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            style={{ filter: 'drop-shadow(0 0 9px rgba(52,211,153,0.55))' }}
          />
        </svg>
        {/* שיא: נקודה זוהרת + נצנוץ */}
        <div
          className="animate-area absolute h-2.5 w-2.5 rounded-full bg-emerald-200 shadow-[0_0_22px_7px_rgba(52,211,153,0.6)]"
          style={{ left: 'calc(98.7% - 5px)', top: 'calc(8.7% - 5px)' }}
        />
        <svg
          className="animate-twinkle absolute"
          style={{ left: 'calc(98.7% - 10px)', top: 'calc(8.7% - 10px)' }}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="#d1fae5"
          aria-hidden
        >
          <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8Z" />
        </svg>
      </div>

      {/* נרות ווליום — עולים יחד עם הגרף (LTR כמו ציר הזמן) */}
      <div
        className={`flex items-end gap-[1.6%] ${compact ? 'mt-3 h-14' : 'mt-6 h-28'}`}
        style={{ direction: 'ltr' }}
      >
        {CANDLES.map((c, i) => (
          <div
            key={i}
            className={`animate-grow-up flex h-full flex-1 flex-col items-center justify-end ${
              c.up ? 'text-emerald-400' : 'text-rose-400'
            }`}
            style={{ animationDelay: `${550 + i * 40}ms` }}
          >
            <div className="w-px bg-current opacity-40" style={{ height: '14%' }} />
            <div
              className="w-full max-w-[12px] rounded-[2px] bg-current shadow-[0_0_10px_var(--tw-shadow-color)] shadow-current/25"
              style={{ height: `${c.h}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── מוקאפ הדשבורד ───────────────────────────────────────────────────
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
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="mr-auto text-[11px] text-slate-500">newfin · הפיד שלי</span>
      </div>
      {/* רצועת מגמה — דימוי ויזואלי בלבד, בלי שמות מדדים ומספרים (אין להציג נתון בלי מקור) */}
      <div className="flex items-center gap-4 border-b border-white/5 px-4 py-3">
        <svg viewBox="0 0 118 34" fill="none" preserveAspectRatio="none" className="h-9 min-w-0 flex-1">
          <path className="animate-draw-line" d={SPARK} stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
        </svg>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          חי
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {['הכל', 'מהותיות 7+', 'מאיה', 'גלובס', 'במעקב'].map((c, i) => (
          <span
            key={c}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${
              i === 0
                ? 'bg-gradient-to-b from-brand-light/30 to-brand-light/10 text-brand-light ring-brand-light/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                : 'bg-white/[0.04] text-slate-400 ring-white/[0.06]'
            }`}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="space-y-2 px-3 pb-4">
        {items.map((it, i) => (
          <div key={i} className="animate-fade-up flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3" style={{ animationDelay: `${400 + i * 80}ms` }}>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${SCORE_STYLE[it.tier]}`}>{it.score}</span>
              <span className={`text-xs leading-none ${it.dirC}`}>{it.dir}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {it.company ? <span className="text-xs font-bold text-brand-light">{it.company}</span> : null}
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">{it.sector}</span>
              </div>
              <p className="mt-0.5 text-[13px] font-medium leading-snug text-slate-100">{it.title}</p>
              {it.bl && <p className="mt-1.5 border-r-2 border-brand-light/40 pr-2 text-[11px] leading-relaxed text-slate-400">{it.bl}</p>}
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
    <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors duration-200 hover:border-brand-light/30 hover:bg-white/[0.05]">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-light/10 text-brand-light ring-1 ring-brand-light/20">
        {icon}
      </span>
      <h3 className="mt-4 text-base font-bold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  )
}

const ic = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const IconTarget = () => (<svg {...ic}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>)
const IconLink = () => (<svg {...ic}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>)
const IconPen = () => (<svg {...ic}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>)
const IconCalendar = () => (<svg {...ic}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>)
const IconEye = () => (<svg {...ic}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>)
const IconMail = () => (<svg {...ic}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>)
