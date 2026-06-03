import { useEffect, useMemo, useRef, useState } from 'react'
import ItemCard from '../components/ItemCard'
import { fetchFeed } from '../lib/queries'
import type { FeedItem } from '../types/db'

const PRESETS = [
  { label: 'הכל', min: 1 },
  { label: 'בינוני ומעלה', min: 5 },
  { label: 'חשוב', min: 7 },
  { label: 'קריטי בלבד', min: 9 },
]

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [min, setMin] = useState(5)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchFeed(80).then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  // סגירת התפריט בלחיצה בחוץ
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const filtered = useMemo(
    () =>
      items.filter(
        (it) =>
          it.materiality_score >= min &&
          (!query ||
            it.title.includes(query) ||
            (it.company_name ?? '').includes(query)),
      ),
    [items, min, query],
  )

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">הפיד</h1>
        <p className="mt-1 text-sm text-slate-500">דיווחים ממאיה, מדורגים לפי מהותיות.</p>
      </div>

      {/* בר חיפוש וסינון */}
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {/* כפתור סינון + תפריט נפתח */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              open || min > 1
                ? 'border-brand/30 bg-brand/5 text-brand'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>מהותיות</span>
            <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded bg-brand px-1 text-[11px] font-bold text-white">
              {min}+
            </span>
          </button>

          {open && (
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <div className="mb-2 text-xs font-semibold text-slate-500">סינון לפי מהותיות</div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.min}
                    onClick={() => setMin(p.min)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      min === p.min
                        ? 'bg-brand text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">סולם</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={min}
                  onChange={(e) => setMin(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer accent-brand"
                />
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-brand text-xs font-bold text-white">
                  {min}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* חיפוש */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש חברה או מילת מפתח..."
          className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-slate-400"
        />

        {!loading && <span className="shrink-0 px-2 text-xs text-slate-400">{filtered.length}</span>}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-slate-400">אין דיווחים שתואמים את הסינון.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
