import { useState, type ReactNode } from 'react'
import AuthModal from '../components/AuthModal'

// ── דף נחיתה עריכותי-יוקרתי (Brand) — טיפוגרפיה עם ניגוד + אמנות-דאטה דרמטית. ──
export default function Landing({ onGuest }: { onGuest?: () => void }) {
  const [authOpen, setAuthOpen] = useState(false)
  const open = () => setAuthOpen(true)

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div aria-hidden className="pointer-events-none absolute -top-48 right-[-10%] h-[34rem] w-[34rem] rounded-full bg-brand/20 blur-[150px]" />
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
        {/* אמנות-דאטה — נשפכת מעבר לקצה השמאלי (דסקטופ) */}
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[54%] lg:block">
          <CandleArt />
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

        {/* אמנות-דאטה — גרסת מובייל (מוכלת, לא נשפכת) */}
        <div className="relative h-44 w-full lg:hidden">
          <CandleArt />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950" />
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
              הרעש שוקע.
              <br />
              <span className="font-serif font-medium text-slate-300">החשוב צף.</span>
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-slate-400 lg:mr-0">
              פיד אחד שמחבר כל ידיעה למניה או לסקטור, מדרג אותה לפי מהותיות, ומסביר בשורה
              אחת מה המשמעות למשקיע — בטון עיתונאי, בלי גוף ראשון ובלי רעש.
            </p>
          </div>
          <FeedDashboard />
        </div>
      </section>

      {/* יתרונות */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          <Feature icon={<IconTarget />} title="ציון מהותיות" body="כל ידיעה מקבלת ציון 1–10. מה שמזיז מניות צף לראש." />
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
          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
            מוכן לראות את השוק <span className="font-serif font-medium text-brand-light">בבירור?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-slate-300">
            הרשמה חינם, בלי כרטיס אשראי. הפיד המדורג שלך מוכן תוך שניות.
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
        NewFin · מודיעין פיננסי לשוק ההון
      </footer>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

// ── אמנות-דאטה: נרות זוהרים שצומחים בטעינה ──────────────────────────
const CANDLES = [
  { h: 34, up: 0 }, { h: 50, up: 1 }, { h: 43, up: 0 }, { h: 58, up: 1 }, { h: 52, up: 0 },
  { h: 67, up: 1 }, { h: 61, up: 0 }, { h: 75, up: 1 }, { h: 69, up: 0 }, { h: 83, up: 1 },
  { h: 78, up: 0 }, { h: 90, up: 1 }, { h: 85, up: 0 }, { h: 97, up: 1 },
]

function CandleArt() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute left-[8%] top-1/2 h-[24rem] w-[24rem] -translate-y-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />
      <div className="absolute left-[40%] top-[38%] h-[20rem] w-[20rem] rounded-full bg-brand-light/20 blur-[120px]" />
      <div className="absolute inset-0 flex items-end gap-[2.2%] px-6 pb-[16%] pt-[14%]">
        {CANDLES.map((c, i) => (
          <div
            key={i}
            className={`animate-grow-up flex h-full flex-1 flex-col items-center justify-end ${
              c.up ? 'text-emerald-400' : 'text-rose-400'
            }`}
            style={{ animationDelay: `${180 + i * 55}ms` }}
          >
            <div className="w-px bg-current opacity-40" style={{ height: '12%' }} />
            <div
              className="w-full max-w-[14px] rounded-[3px] bg-current shadow-[0_0_16px_var(--tw-shadow-color)] shadow-current/25"
              style={{ height: `${c.h}%` }}
            />
          </div>
        ))}
      </div>

      {/* קו מגמה זוהר מעל הנרות (עולה שמאלה ב-RTL) */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        <path
          className="animate-draw-line"
          d="M97,72 L83,66 L69,69 L55,57 L41,51 L27,38 L13,31 L2,25"
          stroke="#e2e8f0"
          strokeOpacity="0.65"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          vectorEffect="non-scaling-stroke"
          style={{ filter: 'drop-shadow(0 0 4px rgba(226,232,240,0.55))' }}
        />
      </svg>
      <div
        className="animate-area absolute h-2 w-2 rounded-full bg-white shadow-[0_0_14px_4px_rgba(255,255,255,0.6)]"
        style={{ left: '2%', top: '25%', marginRight: '-4px', marginTop: '-4px' }}
      />
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
      <div className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-white">ת"א 35</span>
            <span className="text-xs font-semibold text-emerald-400">+1.24%</span>
          </div>
          <span className="text-[11px] text-slate-500">2,184.50</span>
        </div>
        <svg width="118" height="34" viewBox="0 0 118 34" fill="none" className="shrink-0">
          <path className="animate-draw-line" d={SPARK} stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
        </svg>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          חי
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {['הכל', 'מהותיות 7+', 'מאיה', 'גלובס', 'במעקב'].map((c, i) => (
          <span key={c} className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${i === 0 ? 'bg-brand-light/20 text-brand-light ring-1 ring-brand-light/30' : 'bg-white/5 text-slate-400'}`}>
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
