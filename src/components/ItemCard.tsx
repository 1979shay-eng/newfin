import type { FeedItem } from '../types/db'
import { reliabilityLabel, directionLabel, reliabilityDot, formatTime } from '../lib/format'

type Props = {
  item: FeedItem
  compact?: boolean
  watched?: boolean
  onToggleWatch?: () => void
  index?: number
}

// השהיית כניסה מדורגת (capped) — תחושת "פיד חי" בלי לעכב פריטים מאוחרים
function delayStyle(index = 0) {
  return { animationDelay: `${Math.min(index * 40, 360)}ms` }
}

function StarButton({
  watched,
  onClick,
  size = 15,
}: {
  watched: boolean
  onClick: () => void
  size?: number
}) {
  return (
    <button
      onClick={onClick}
      title={watched ? 'הסר ממעקב' : 'הוסף למעקב'}
      className={`shrink-0 transition-colors ${
        watched ? 'text-amber-300' : 'text-slate-600 hover:text-amber-300'
      }`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={watched ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  )
}

// חץ כיוון בלבד (bull/bear/neutral) — אינדיקטור עזר. הציון המספרי הוסר מהתצוגה
// (הסינון לפי מהותיות נשאר פעיל בבר החיפוש).
function DirectionChip({ item }: { item: FeedItem }) {
  const dir = directionLabel[item.direction]
  return (
    <span
      className={`shrink-0 text-sm leading-none ${dir.className}`}
      title={`כיוון: ${dir.text}`}
    >
      {dir.icon}
    </span>
  )
}

export default function ItemCard({
  item,
  compact = false,
  watched = false,
  onToggleWatch,
  index = 0,
}: Props) {
  const rel = reliabilityLabel[item.reliability]
  const canWatch = Boolean(item.company_id && onToggleWatch)

  if (compact) {
    return (
      <article
        style={delayStyle(index)}
        className="animate-fade-up flex h-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
      >
        <DirectionChip item={item} />
        {canWatch && <StarButton watched={watched} onClick={onToggleWatch!} size={13} />}
        {item.company_name ? (
          <span className="shrink-0 text-base font-extrabold text-brand-light">{item.company_name}</span>
        ) : item.headline_tag ? (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
              item.headline_type === 'macro'
                ? 'bg-brand-light/15 text-brand-light'
                : 'bg-white/[0.07] text-slate-300'
            }`}
          >
            {item.headline_tag}
          </span>
        ) : null}
        <span className="truncate text-[15px] text-slate-300">{item.title}</span>
        <span className="mr-auto shrink-0 text-xs font-semibold tabular-nums text-slate-300">
          {formatTime(item.published_at)}
        </span>
      </article>
    )
  }

  return (
    <article
      style={delayStyle(index)}
      className="animate-fade-up h-full rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition-all duration-200 hover:border-brand-light/25 hover:bg-white/[0.05] hover:shadow-[0_8px_30px_-12px_rgba(99,179,237,0.25)]"
    >
      {/* שורה ראשונה: שם המניה — הכוכב. הציון תג קטן בצד. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {canWatch && <StarButton watched={watched} onClick={onToggleWatch!} />}
          {item.company_name ? (
            <>
              <span className="truncate text-lg font-extrabold tracking-tight text-brand-light">
                {item.company_name}
              </span>
              {item.company_sector && item.company_sector !== 'אחר' && (
                <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-slate-400">
                  {item.company_sector}
                </span>
              )}
            </>
          ) : item.headline_tag ? (
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
                item.headline_type === 'macro'
                  ? 'bg-brand-light/15 text-brand-light'
                  : 'bg-white/[0.07] text-slate-300'
              }`}
            >
              {item.headline_tag}
            </span>
          ) : null}
        </div>
        <DirectionChip item={item} />
      </div>

      <h2 className="mt-2 text-xl font-semibold leading-snug text-slate-100">{item.title}</h2>

      {item.body && <p className="mt-2 text-[15px] leading-relaxed text-slate-300">{item.body}</p>}

      {item.bottom_line && (
        <p className="mt-3 rounded-lg border-r-2 border-brand-light/40 bg-white/[0.03] px-3 py-2 text-[15px] leading-relaxed text-slate-300">
          {item.bottom_line}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span>{item.source_name}</span>
        <span className="text-slate-700">·</span>
        <span className="flex items-center gap-1" title={`מהימנות: ${rel.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${reliabilityDot[item.reliability]}`} />
          {rel.text}
        </span>
        <span className="text-slate-700">·</span>
        <span className="text-[13px] font-bold tabular-nums text-slate-300">
          {formatTime(item.published_at)}
        </span>
        {item.tags?.map((t) => (
          <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-slate-400">
            #{t}
          </span>
        ))}
        {item.original_url && (
          <a
            href={item.original_url}
            target="_blank"
            rel="noreferrer"
            className="mr-auto font-medium text-brand-light hover:underline"
          >
            למקור ↗
          </a>
        )}
      </div>
    </article>
  )
}
