import { useEffect, useMemo, useState } from 'react'
import { fetchCompanies, type CompanyRow } from '../lib/queries'
import { loadWatch, saveWatch } from '../lib/watchlist'

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
  const [watch, setWatch] = useState<string[]>(() => loadWatch())
  const watchSet = useMemo(() => new Set(watch), [watch])

  useEffect(() => {
    fetchCompanies().then((data) => {
      setCompanies(data)
      setLoading(false)
    })
  }, [])

  function toggleWatch(id: string) {
    setWatch((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      saveWatch(next)
      return next
    })
  }

  const filtered = useMemo(() => {
    let r = companies
    if (query) r = r.filter((c) => c.name_he.includes(query))
    if (onlyWatched) r = r.filter((c) => watchSet.has(c.id))
    return r
  }, [companies, query, onlyWatched, watchSet])

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">חברות</h1>
        <p className="mt-1 text-sm text-slate-500">
          {companies.length} חברות נסחרות — סמן בכוכב ⭐ כדי לעקוב, והדיווחים שלהן יופיעו ב"במעקב".
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש חברה..."
          className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-slate-400"
        />
        <button
          onClick={() => setOnlyWatched((o) => !o)}
          className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            onlyWatched
              ? 'border-amber-300 bg-amber-50 text-amber-600'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          ⭐ במעקב ({watch.length})
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-slate-400">
          {onlyWatched ? 'עדיין לא סימנת חברות למעקב.' : 'לא נמצאו חברות.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((c) => {
            const on = watchSet.has(c.id)
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-800">{c.name_he}</div>
                  {c.sector && <div className="truncate text-[11px] text-slate-400">{c.sector}</div>}
                </div>
                <button
                  onClick={() => toggleWatch(c.id)}
                  title={on ? 'הסר ממעקב' : 'הוסף למעקב'}
                  className={`shrink-0 transition ${on ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                >
                  <Star on={on} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
