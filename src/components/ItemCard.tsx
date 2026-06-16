import type { ReactNode } from 'react'
import type { FeedItem } from '../types/db'
import { reliabilityLabel, directionLabel, reliabilityDot, formatTime } from '../lib/format'
import { sectorTagClass, sourceTagClass } from '../lib/tags'

// תווית צבועה אחידה (מקור / סקטור) — color-coding לזיהוי מהיר
function Tag({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${color}`}
    >
      {children}
    </span>
  )
}

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
        watched ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'
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
  // הסקטור לתצוגה: סקטור החברה, ואם אין — תגית הכותרת (סקטור/מאקרו)
  const sectorName =
    item.company_sector && item.company_sector !== 'אחר' ? item.company_sector : item.headline_tag

  if (compact) {
    return (
      <article
        style={delayStyle(index)}
        className="animate-fade-up flex h-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <DirectionChip item={item} />
        {canWatch && <StarButton watched={watched} onClick={onToggleWatch!} size={13} />}
        {item.company_name ? (
          <span className="shrink-0 text-base font-extrabold text-brand">{item.company_name}</span>
        ) : item.headline_tag ? (
          <Tag color={sectorTagClass(item.headline_tag)}>{item.headline_tag}</Tag>
        ) : null}
        <span className="truncate text-[15px] text-slate-600">{item.title}</span>
        <div className="mr-auto flex shrink-0 items-center gap-2">
          <Tag color={sourceTagClass(item.source_name)}>{item.source_name}</Tag>
          <span className="text-xs font-semibold tabular-nums text-slate-700">
            {formatTime(item.published_at)}
          </span>
        </div>
      </article>
    )
  }

  return (
    <article
      style={delayStyle(index)}
      className="animate-fade-up h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-light/50 hover:shadow-[0_12px_32px_-12px_rgba(15,76,129,0.18)]"
    >
      {/* שורה ראשונה: ימין — שם המניה + כיוון. שמאל-עליון — תגיות סקטור ואז מקור. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {canWatch && <StarButton watched={watched} onClick={onToggleWatch!} />}
          {item.company_name && (
            <span className="truncate text-lg font-extrabold tracking-tight text-brand">
              {item.company_name}
            </span>
          )}
          <DirectionChip item={item} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {sectorName && <Tag color={sectorTagClass(sectorName)}>{sectorName}</Tag>}
          <Tag color={sourceTagClass(item.source_name)}>{item.source_name}</Tag>
        </div>
      </div>

      <h2 className="mt-2 text-xl font-bold leading-snug text-slate-900">{item.title}</h2>

      {item.body && <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{item.body}</p>}

      {item.bottom_line && (
        <p className="mt-3 rounded-lg border-r-2 border-brand-light/60 bg-slate-50 px-3 py-2 text-[15px] leading-relaxed text-slate-600">
          {item.bottom_line}
        </p>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1" title={`מהימנות: ${rel.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${reliabilityDot[item.reliability]}`} />
          {rel.text}
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-[13px] font-bold tabular-nums text-slate-700">
          {formatTime(item.published_at)}
        </span>
        {item.tags?.map((t) => (
          <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
            #{t}
          </span>
        ))}
        {item.original_url && (
          <a
            href={item.original_url}
            target="_blank"
            rel="noreferrer"
            className="mr-auto font-semibold text-brand hover:underline"
          >
            למקור ↗
          </a>
        )}
      </div>
    </article>
  )
}
