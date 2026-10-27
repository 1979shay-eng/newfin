import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="font-serif text-[32px] font-black tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
        אודות NewFin
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>
        NewFin אוסף מידע ממגוון רחב של מקורות פומביים — דיווחי חברות וכתבות מהעיתונות הכלכלית — מסנן
        לפי חשיבות ומציג אותו במקום אחד. כל פריט מוצג בטון עיתונאי — עובדה, הקשר ושורה תחתונה — ומלווה
        בציון חשיבות ובקישור למקור.
      </p>
      <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>
        השורות התחתונות נכתבות אוטומטית על ידי בינה מלאכותית ועלולות לכלול טעויות. המידע באתר הוא מידע
        כללי בלבד ואינו ייעוץ השקעות או המלצה — ראו את{' '}
        <Link to="/terms" className="font-semibold underline" style={{ color: 'var(--accent)' }}>
          תנאי השימוש
        </Link>
        .
      </p>
    </div>
  )
}
