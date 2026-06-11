import { useEffect, useMemo, useState } from 'react'
import { fetchCompanies, type CompanyRow } from '../lib/queries'
import { loadWatch, saveWatch } from '../lib/watchlist'

// נרמול לחיפוש גמיש: מסיר גרשיים/נקודות/מקפים/רווחים + lowercase.
// כך "אורט" מוצא את "או.אר.טי." ו-"אב גד" מוצא את "אב-גד".
const norm = (s: string) => s.toLowerCase().replace(/['"’.\-\s]/g, '')

const PAGE = 60 // כמה כרטיסים להציג בכל פעם (מונע עומס של 638 בבת אחת)

function Star({ on }: { on: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export default function Companies() {
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [onlyWatched, setOnlyWatched] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [watch, setWatch] = useState<string[]>(() => loadWatch())
  const watchSet = useMemo(() => new Set(watch), [watch])

  useEffect(() => {
    fetchCompanies().then((data) => {
      setCompanies(data)
      setLoading(false)
    })
  }, [])

  // איפוס מספר המוצגים כשמשנים חיפוש/סינון
  useEffect(() => setShown(PAGE), [query, onlyWatched])

  function toggleWatch(id: string) {
    setWatch((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      saveWatch(next)
      return next
    })
  }

  const filtered = useMemo(() => {
    let r = companies
    const q = norm(query)
    if (q) r = r.filter((c) => norm(c.name_he).includes(q))
    if (onlyWatched) r = r.filter((c) => watchSet.has(c.id))
    return r
  }, [companies, query, onlyWatched, watchSet])

  const visible = filtered.slice(0, shown)

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">חברות</h1>
        <p className="mt-1 text-sm text-slate-400">
          {companies.length} חברות נסחרות — סמן בכוכב ⭐ כדי לעקוב, והדיווחים שלהן יופיעו ב"במעקב".
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 backdrop-blur">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש חברה..."
          className="min-w-0 flex-1 rounded-lg bg-transparent px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
        />
        <button
          onClick={() => setOnlyWatched((o) => !o)}
          className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            onlyWatched
              ? 'border-amber-300/30 bg-amber-300/10 text-amber-300'
              : 'border-white/[0.08] text-slate-300 hover:bg-white/[0.06]'
          }`}
        >
          ⭐ במעקב ({watch.length})
        </button>
      </div>

      {/* מונה תוצאות — נותן ביטחון שהחיפוש סורק את כל החברות */}
      {!loading && (
        <p className="mb-2 text-xs text-slate-500">
          {query || onlyWatched
            ? `נמצאו ${filtered.length} חברות`
            : `מציג ${visible.length} מתוך ${filtered.length}`}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          {onlyWatched ? 'עדיין לא סימנת חברות למעקב.' : 'לא נמצאו חברות.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visible.map((c) => {
              const on = watchSet.has(c.id)
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-white/[0.14]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-200">{c.name_he}</div>
                    {c.sector && (
                      <div className="truncate text-[11px] text-slate-500">{c.sector}</div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleWatch(c.id)}
                    title={on ? 'הסר ממעקב' : 'הוסף למעקב'}
                    className={`shrink-0 transition-colors ${on ? 'text-amber-300' : 'text-slate-600 hover:text-amber-300'}`}
                  >
                    <Star on={on} />
                  </button>
                </div>
              )
            })}
          </div>

          {visible.length < filtered.length && (
            <button
              onClick={() => setShown((s) => s + PAGE)}
              className="mt-4 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.06]"
            >
              טען עוד ({filtered.length - visible.length})
            </button>
          )}
        </>
      )}
    </div>
  )
}
