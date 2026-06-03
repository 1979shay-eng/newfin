import { useEffect, useState } from 'react'
import ItemCard from '../components/ItemCard'
import { fetchFeed } from '../lib/queries'
import { isSupabaseConfigured } from '../lib/supabase'
import type { FeedItem } from '../types/db'

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFeed(40).then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-slate-900">הפיד</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isSupabaseConfigured
            ? 'דיווחים ממאיה, מדורגים לפי מהותיות.'
            : 'נתוני דמו — חבר Supabase להפעלה מלאה.'}
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-slate-500">אין פריטים להצגה.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
