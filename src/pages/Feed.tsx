import { useEffect, useMemo, useState } from 'react'
import ItemCard from '../components/ItemCard'
import { fetchFeed } from '../lib/queries'
import { isSupabaseConfigured } from '../lib/supabase'
import type { FeedItem } from '../types/db'

// רמות סינון מהותיות — המשתמש בוחר כמה רעש לסנן
const LEVELS = [
  { key: 'all', label: 'הכל', min: 0 },
  { key: 'mid', label: 'בינוני ומעלה', min: 5 },
  { key: 'high', label: 'חשוב', min: 7 },
  { key: 'critical', label: 'קריטי בלבד', min: 9 },
]

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [min, setMin] = useState(0)

  useEffect(() => {
    fetchFeed(60).then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => items.filter((it) => it.materiality_score >= min), [items, min])

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">הפיד</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isSupabaseConfigured ? 'דיווחים ממאיה, מדורגים לפי מהותיות.' : 'נתוני דמו.'}
        </p>
      </div>

      {/* פס סינון */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="ml-1 text-xs text-slate-400">סינון רעש:</span>
        {LEVELS.map((l) => (
          <button
            key={l.key}
            onClick={() => setMin(l.min)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              min === l.min
                ? 'bg-brand text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {l.label}
          </button>
        ))}
        {!loading && (
          <span className="mr-auto text-xs text-slate-400">{filtered.length} דיווחים</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-slate-400">אין דיווחים ברמת הסינון הזו.</p>
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
