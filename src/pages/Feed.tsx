import { useEffect, useMemo, useState } from 'react'
import ItemCard from '../components/ItemCard'
import { fetchFeed } from '../lib/queries'
import type { FeedItem } from '../types/db'

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [min, setMin] = useState(5)

  useEffect(() => {
    fetchFeed(80).then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => items.filter((it) => it.materiality_score >= min), [items, min])

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">הפיד</h1>
        <p className="mt-1 text-sm text-slate-500">דיווחים ממאיה, מדורגים לפי מהותיות.</p>
      </div>

      {/* סינון לפי סולם מספרי */}
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="shrink-0 text-sm font-medium text-slate-600">מהותיות מינימלית</span>
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand text-xs font-bold text-white">
          {min}
        </span>
        <input
          type="range"
          min={1}
          max={10}
          value={min}
          onChange={(e) => setMin(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-brand"
        />
        {!loading && <span className="shrink-0 text-xs text-slate-400">{filtered.length} דיווחים</span>}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-slate-400">אין דיווחים ברמת המהותיות הזו.</p>
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
