import { useParams } from 'react-router-dom'

export default function CompanyProfile() {
  const { slug } = useParams()

  return (
    <div>
      <h1 className="font-serif text-[32px] font-black tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
        דף חברה: {slug}
      </h1>
      <p className="mt-2" style={{ color: 'var(--muted)' }}>
        עמוד חברה ציבורי (כותרת, מחיר, פיד מסונן, גרפים) — ייבנה ב-Phase 3 ו-Phase 5.
      </p>
    </div>
  )
}
