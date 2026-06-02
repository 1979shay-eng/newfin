import ItemCard from '../components/ItemCard'
import { mockFeed } from '../lib/mockData'

export default function Feed() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-slate-900">הפיד</h1>
        <p className="mt-1 text-sm text-slate-500">
          דיווחים ממוקדים, מדורגים לפי מהותיות. הנתונים כרגע לדוגמה — חיבור למאיה ב-Phase 1.
        </p>
      </div>

      <div className="space-y-4">
        {mockFeed.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}
