import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-extrabold" style={{ color: 'var(--ink)' }}>
        404
      </h1>
      <p className="mt-2" style={{ color: 'var(--muted)' }}>
        העמוד לא נמצא.
      </p>
      <Link to="/" className="mt-4 inline-block font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
        חזרה לפיד
      </Link>
    </div>
  )
}
