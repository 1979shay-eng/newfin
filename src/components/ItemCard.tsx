import { useState } from 'react'
import type { FeedItem } from '../types/db'
import { track } from '../lib/track'
import {
  impLevel,
  impLabel,
  impColor,
  impDots,
  sentiment,
  SENTIMENT_NOTE,
  sectorColor,
  avatarColor,
  clockParts,
} from '../lib/feedVisual'

type Props = {
  item: FeedItem
  compact?: boolean
  watched?: boolean
  onToggleWatch?: () => void
  index?: number
  isNew?: boolean
}

function delayStyle(index = 0) {
  return { animationDelay: `${Math.min(index * 40, 360)}ms` }
}

// סימן חשיבות: 5 נקודות + תווית. יושב בתחילת שורת המטא (ימין, נקודת הכניסה של
// העין ב-RTL) — לא בפינה השמאלית, שם נקרא אחרון.
export function ImportanceMark({ score }: { score: number }) {
  const lvl = impLevel(score)
  const dots = impDots(score)
  return (
    <span className="flex shrink-0 items-center gap-1.5" aria-label={`${impLabel[lvl]} (${score} מתוך 10)`}>
      <span className="flex gap-[3px]" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: i < dots ? impColor[lvl] : 'var(--dot-empty)' }}
          />
        ))}
      </span>
      <span className="text-[12px] font-bold leading-none" style={{ color: impColor[lvl] }}>
        {impLabel[lvl]}
      </span>
    </span>
  )
}

// כרטיס דיווח (handoff). החשיבות קובעת את הצורה: ידיעה בחשיבות גבוהה — כותרת
// גדולה, פירוט ושורה תחתונה מלאה; בינונית — כותרת קטנה ושורה תחתונה מקוצרת
// לשתי שורות שנפתחת בלחיצה. כך ידיעה ב-9 לא נראית כמו ידיעה ב-4.
export default function ItemCard({
  item,
  compact = false,
  watched = false,
  onToggleWatch,
  index = 0,
  isNew = false,
}: Props) {
  const canWatch = Boolean(item.company_id && onToggleWatch)
  const major = impLevel(item.materiality_score) === 'high'
  const [expanded, setExpanded] = useState(false)
  const sent = sentiment(item.direction)
  const company = item.company_name
  const sectorName =
    item.company_sector && item.company_sector !== 'אחר' ? item.company_sector : item.headline_tag
  const sColor = sectorColor(sectorName)
  // מבנה תוכן: body = פירוט עובדתי מהמקור; bottom_line = ניתוח + השלכות (SIGNAL).
  // כשיש שניהם — מציגים את שניהם; ה"שורה התחתונה" מקבלת בלוק מובלט משלה.
  const detail = item.body?.trim() || null
  const bottomLine = item.bottom_line?.trim() || null
  const { time, date } = clockParts(item.published_at)
  const [reporting, setReporting] = useState(false)

  // בינונית: השורה התחתונה מקוצרת עד שפותחים; הפירוט מהמקור מוצג רק בפתיחה
  const open = major || expanded

  return (
    <article
      id={`item-${item.id}`}
      style={{
        ...delayStyle(index),
        background: 'var(--surface)',
        borderColor: 'var(--line2)',
        boxShadow: 'var(--shadow)',
      }}
      className={`animate-fade-up scroll-mt-24 rounded-[18px] border transition-colors duration-150 hover:bg-[var(--hover)] ${
        major ? 'px-6 py-5' : 'px-5 py-4'
      }`}
    >
      {/* שורת מטא עליונה */}
      <div className="flex items-start justify-between gap-4">
        {/* ימין: חשיבות → אווטר → חברה → סקטור → סנטימנט */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <ImportanceMark score={item.materiality_score} />
          {major && company && (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
              style={{ background: avatarColor(company) }}
            >
              {company.trim().charAt(0)}
            </span>
          )}
          {company && (
            <span className="truncate text-[15px] font-bold" style={{ color: 'var(--ink2)' }}>
              {company}
            </span>
          )}
          {sectorName && (
            <span
              className="nf-sc shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-bold"
              style={{ ['--sc' as string]: sColor }}
            >
              {sectorName}
            </span>
          )}
          {/* אופי הידיעה מוצג רק כשיש בו מידע. "ניטרלית" הופיעה על רוב הכרטיסים
              ולכן שחקה את המשמעות — היעדר התג הוא עצמו הניטרלי. */}
          {item.direction !== 'neutral' && (
            <span
              title={SENTIMENT_NOTE}
              className="shrink-0 cursor-help whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold"
              style={{ color: sent.color, background: sent.bg }}
            >
              <span aria-hidden>{sent.symbol}</span> {sent.label}
            </span>
          )}
          {isNew && (
            <span
              className="nf-sc shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold"
              style={{ ['--sc' as string]: 'var(--accent)' }}
            >
              חדש
            </span>
          )}
        </div>

        {/* שמאל: כוכב מעקב */}
        <div className="flex shrink-0 items-center gap-3">
          {canWatch && (
            <button
              onClick={onToggleWatch}
              title={watched ? 'הסר ממעקב' : 'הוסף למעקב'}
              className="shrink-0 text-[19px] leading-none transition-colors"
              style={{ color: watched ? '#e0a93f' : 'var(--muted2)' }}
            >
              {watched ? '★' : '☆'}
            </button>
          )}
        </div>
      </div>

      {/* כותרת — פונט מעוגל (Rubik), קריא ונוח. גודל לפי חשיבות. */}
      <h2
        className={`font-display font-bold tracking-[-0.01em] ${
          major ? 'mt-2.5 text-[21px] leading-[1.4]' : 'mt-2 text-[17px] leading-[1.45]'
        }`}
        style={{ color: 'var(--ink)' }}
      >
        {item.title}
      </h2>

      {/* פירוט מהמקור — עד 3 שורות, נמתח לכל רוחב הכרטיס; מוסתר בתצוגה תמציתית */}
      {!compact && open && detail && (
        <p
          className="mt-2 text-[15px] leading-[1.65] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden"
          style={{ color: 'var(--muted)' }}
        >
          {detail}
        </p>
      )}

      {/* שורה תחתונה — הניתוח וההשלכות של SIGNAL, בבלוק ציטוט מובלט */}
      {!compact && bottomLine && (
        <div
          className="mt-2.5 rounded-[10px] py-2.5 pl-4 pr-3.5 text-[14.5px] leading-[1.65]"
          style={{
            background: 'var(--chip)',
            color: 'var(--ink2)',
            borderRight: '3px solid var(--accent)',
          }}
        >
          <p className={open ? undefined : '[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden'}>
            <span className="font-bold" style={{ color: 'var(--accent)' }}>
              שורה תחתונה ·{' '}
            </span>
            {bottomLine}
          </p>
          <span className="mt-1 flex flex-wrap items-center justify-between gap-x-3 text-[11.5px]" style={{ color: 'var(--muted2)' }}>
            <span>סיכום אוטומטי (AI) · עלול לכלול טעויות — הכתבה המקורית היא הקובעת</span>
            {!major && (
              <button
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                className="font-bold hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {expanded ? 'פחות' : 'הצג הכל'}
              </button>
            )}
          </span>
        </div>
      )}

      {/* פוטר מטא */}
      <div
        className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]"
        style={{ color: 'var(--muted2)' }}
      >
        <span
          className="rounded px-2 py-0.5 font-semibold"
          style={{ background: 'var(--chip)', color: 'var(--chip-ink)' }}
        >
          {item.source_name}
        </span>
        <span className="tabular-nums">
          {time} · {date}
        </span>
        <button
          onClick={() => setReporting((r) => !r)}
          aria-expanded={reporting}
          className={`${item.original_url ? '' : 'mr-auto '}font-semibold hover:underline`}
          style={{ color: 'var(--muted2)' }}
        >
          דווח על טעות
        </button>
        {item.original_url && (
          <a
            href={item.original_url}
            target="_blank"
            rel="noreferrer"
            className="mr-auto font-bold hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            למקור ↗
          </a>
        )}
      </div>

      {reporting && <ReportForm item={item} onDone={() => setReporting(false)} />}
    </article>
  )
}

// דיווח משתמש על טעות בידיעה — נשמר כאירוע error_report ומוצג בדף הניהול.
// ערוץ התיקון הזה הוא חלק מההגנה מפני תביעת לשון הרע: טעות שדווחה מתוקנת מהר.
function ReportForm({ item, onDone }: { item: FeedItem; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)

  const send = async () => {
    await track('error_report', { item_id: item.id, title: item.title, note: note.trim() })
    setSent(true)
    setTimeout(onDone, 2200)
  }

  if (sent)
    return (
      <p role="status" className="mt-3 text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
        תודה! הדיווח התקבל ויטופל בהקדם.
      </p>
    )

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
      <label className="sr-only" htmlFor={`report-${item.id}`}>
        מה שגוי בידיעה?
      </label>
      <textarea
        id={`report-${item.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="מה שגוי בידיעה? (למשל: החברה הלא נכונה, נתון שגוי)"
        className="min-w-0 flex-1 resize-none rounded-[10px] px-3 py-2 text-[13.5px] outline-none"
        style={{ background: 'var(--field)', border: '1px solid var(--line2)', color: 'var(--ink)' }}
      />
      <div className="flex gap-2">
        <button
          onClick={send}
          disabled={!note.trim()}
          className="rounded-[10px] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
          style={{ background: 'var(--accent-fill)' }}
        >
          שליחה
        </button>
        <button
          onClick={onDone}
          className="rounded-[10px] px-3 py-2 text-[13px] font-semibold"
          style={{ background: 'var(--chip)', color: 'var(--chip-ink)' }}
        >
          ביטול
        </button>
      </div>
    </div>
  )
}
