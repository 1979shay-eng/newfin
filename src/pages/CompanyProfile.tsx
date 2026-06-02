import { useParams } from 'react-router-dom'

export default function CompanyProfile() {
  const { slug } = useParams()

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900">דף חברה: {slug}</h1>
      <p className="mt-2 text-slate-500">
        עמוד חברה ציבורי (כותרת, מחיר, פיד מסונן, גרפים) — ייבנה ב-Phase 3 ו-Phase 5.
      </p>
    </div>
  )
}
