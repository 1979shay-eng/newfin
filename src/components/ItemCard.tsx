import type { FeedItem } from '../types/db'
import {
  impLevel,
  impLabel,
  impColor,
  impDots,
  sentiment,
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

// כרטיס דיווח עצמאי (handoff). מנוהל ע"י טוקני CSS — עובד זהה בכהה ובהיר.
export default function ItemCard({
  item,
  compact = false,
  watched = false,
  onToggleWatch,
  index = 0,
  isNew = false,
}: Props) {
  const canWatch = Boolean(item.company_id && onToggleWatch)
  const lvl = impLevel(item.materiality_score)
  const dots = impDots(item.materiality_score)
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

  return (
    <article
      style={{
        ...delayStyle(index),
        background: 'var(--surface)',
        borderColor: 'var(--line2)',
        boxShadow: 'var(--shadow)',
      }}
      className="animate-fade-up rounded-[18px] border px-6 py-5 transition-colors duration-150 hover:bg-[var(--hover)]"
    >
      {/* שורת מטא עליונה */}
      <div className="flex items-start justify-between gap-4">
        {/* ימין: אווטר → חברה → סקטור → סנטימנט */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {company && (
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
          {/* כיוון מוצג רק כשיש בו מידע. "ניטרלי" הופיע על רוב הכרטיסים
              ולכן שחק את המשמעות של ▲/▼ — היעדר התג הוא עצמו הניטרלי. */}
          {item.direction !== 'neutral' && (
            <span
              className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold"
              style={{ color: sent.color, background: sent.bg }}
            >
              {sent.symbol} {sent.label}
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

        {/* שמאל: חשיבות (5 נקודות + תווית) + כוכב מעקב */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: i < dots ? impColor[lvl] : 'var(--dot-empty)' }}
                />
              ))}
            </div>
            <span className="text-[11.5px] font-bold leading-none" style={{ color: impColor[lvl] }}>
              {impLabel[lvl]}
            </span>
          </div>
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

      {/* כותרת — פונט מעוגל (Rubik), קריא ונוח */}
      <h2
        className="mt-2.5 font-display text-[21px] font-bold leading-[1.4] tracking-[-0.01em]"
        style={{ color: 'var(--ink)' }}
      >
        {item.title}
      </h2>

      {/* פירוט מהמקור — עד 3 שורות, נמתח לכל רוחב הכרטיס; מוסתר בתצוגה תמציתית */}
      {!compact && detail && (
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
          <span className="font-bold" style={{ color: 'var(--accent)' }}>
            שורה תחתונה ·{' '}
          </span>
          {bottomLine}
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
    </article>
  )
}
