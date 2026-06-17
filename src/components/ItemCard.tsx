import type { FeedItem } from '../types/db'
import {
  impLevel,
  impLabel,
  impColor,
  impDots,
  sentiment,
  sectorColor,
  tint,
  avatarColor,
  clockParts,
} from '../lib/feedVisual'

type Props = {
  item: FeedItem
  compact?: boolean
  watched?: boolean
  onToggleWatch?: () => void
  index?: number
}

function delayStyle(index = 0) {
  return { animationDelay: `${Math.min(index * 40, 360)}ms` }
}

// שורת דיווח עריכותית (handoff). מנוהלת ע"י טוקני CSS — עובדת זהה בכהה ובהיר.
export default function ItemCard({
  item,
  compact = false,
  watched = false,
  onToggleWatch,
  index = 0,
}: Props) {
  const canWatch = Boolean(item.company_id && onToggleWatch)
  const lvl = impLevel(item.materiality_score)
  const dots = impDots(item.materiality_score)
  const sent = sentiment(item.direction)
  const company = item.company_name
  const sectorName =
    item.company_sector && item.company_sector !== 'אחר' ? item.company_sector : item.headline_tag
  const sColor = sectorColor(sectorName)
  const summary = item.bottom_line || item.body
  const { time, date } = clockParts(item.published_at)

  return (
    <article
      style={delayStyle(index)}
      className="animate-fade-up px-6 py-[22px] transition-colors duration-150 hover:bg-[var(--hover)]"
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
              className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-bold"
              style={{ color: sColor, background: tint(sColor) }}
            >
              {sectorName}
            </span>
          )}
          <span
            className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold"
            style={{ color: sent.color, background: sent.bg }}
          >
            {sent.symbol} {sent.label}
          </span>
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

      {/* כותרת — סריף */}
      <h2 className="mt-2.5 font-serif text-[22px] font-bold leading-[1.38]" style={{ color: 'var(--ink)' }}>
        {item.title}
      </h2>

      {/* סיכום — מוסתר בתצוגה תמציתית */}
      {!compact && summary && (
        <p className="mt-1.5 text-[15px] leading-[1.6]" style={{ color: 'var(--muted)' }}>
          {summary}
        </p>
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
