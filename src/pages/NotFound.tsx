import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-extrabold text-white">404</h1>
      <p className="mt-2 text-slate-400">העמוד לא נמצא.</p>
      <Link to="/" className="mt-4 inline-block font-medium text-brand-light hover:underline">
        חזרה לפיד
      </Link>
    </div>
  )
}
