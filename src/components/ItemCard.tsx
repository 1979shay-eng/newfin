import type { FeedItem } from '../types/db'
import {
  reliabilityLabel,
  directionLabel,
  materialityTier,
  materialityStyle,
  materialityAnchor,
  reliabilityDot,
  formatTime,
} from '../lib/format'

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
        watched ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'
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

export default function ItemCard({
  item,
  compact = false,
  watched = false,
  onToggleWatch,
  index = 0,
}: Props) {
  const tier = materialityTier(item.materiality_score)
  const rel = reliabilityLabel[item.reliability]
  const dir = directionLabel[item.direction]
  const canWatch = Boolean(item.company_id && onToggleWatch)

  if (compact) {
    return (
      <article
        style={delayStyle(index)}
        className="animate-fade-up flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 transition-shadow hover:shadow-sm"
      >
        <span
          className={`flex h-6 min-w-[24px] items-center justify-center rounded text-xs font-bold tabular-nums ${materialityStyle[tier]}`}
          title={`מהותיות ${item.materiality_score}/10`}
        >
          {item.materiality_score}
        </span>
        <span className={`shrink-0 text-xs ${dir.className}`} title={dir.text}>
          {dir.icon}
        </span>
        {canWatch && <StarButton watched={watched} onClick={onToggleWatch!} size={13} />}
        {item.company_name ? (
          <span className="shrink-0 text-xs font-bold text-brand">{item.company_name}</span>
        ) : item.headline_tag ? (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
              item.headline_type === 'macro' ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {item.headline_tag}
          </span>
        ) : null}
        <span className="truncate text-sm text-slate-700">{item.title}</span>
        <span className="mr-auto shrink-0 text-[11px] tabular-nums text-slate-500">
          {formatTime(item.published_at)}
        </span>
      </article>
    )
  }

  return (
    <article
      style={delayStyle(index)}
      className="animate-fade-up flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:border-slate-300 hover:shadow-md"
    >
      {/* עוגן: ציון מהותיות + כיוון — היחידה הנסרקת ראשונה */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-lg text-lg font-bold tabular-nums ${materialityAnchor[tier]}`}
          title={`מהותיות ${item.materiality_score}/10`}
        >
          {item.materiality_score}
        </span>
        <span
          className={`text-sm leading-none ${dir.className}`}
          title={`כיוון: ${dir.text}`}
        >
          {dir.icon}
        </span>
      </div>

      {/* גוף */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {canWatch && <StarButton watched={watched} onClick={onToggleWatch!} />}
            {item.company_name ? (
              <>
                <span className="truncate text-xs font-bold text-brand">{item.company_name}</span>
                {item.company_sector && item.company_sector !== 'אחר' && (
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {item.company_sector}
                  </span>
                )}
              </>
            ) : item.headline_tag ? (
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${
                  item.headline_type === 'macro' ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {item.headline_tag}
              </span>
            ) : null}
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
            {formatTime(item.published_at)}
          </span>
        </div>

        <h2 className="mt-1 text-[15px] font-semibold leading-snug text-slate-900">{item.title}</h2>

        {item.body && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
        )}

        {item.bottom_line && (
          <p className="mt-2 rounded-lg border-r-2 border-brand/30 bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-600">
            {item.bottom_line}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
          <span>{item.source_name}</span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1" title={`מהימנות: ${rel.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${reliabilityDot[item.reliability]}`} />
            {rel.text}
          </span>
          {item.tags?.map((t) => (
            <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
              #{t}
            </span>
          ))}
          {item.original_url && (
            <a
              href={item.original_url}
              target="_blank"
              rel="noreferrer"
              className="mr-auto font-medium text-brand hover:underline"
            >
              למקור ↗
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
