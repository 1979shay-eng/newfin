import type { FeedItem } from '../types/db'
import {
  reliabilityLabel,
  directionLabel,
  materialityTier,
  materialityStyle,
  formatTime,
} from '../lib/format'

type Props = {
  item: FeedItem
  compact?: boolean
  watched?: boolean
  onToggleWatch?: () => void
}

function StarButton({ watched, onClick }: { watched: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={watched ? 'הסר ממעקב' : 'הוסף למעקב'}
      className={`shrink-0 transition ${watched ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
    >
      <svg
        width="15"
        height="15"
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

export default function ItemCard({ item, compact = false, watched = false, onToggleWatch }: Props) {
  const tier = materialityTier(item.materiality_score)
  const rel = reliabilityLabel[item.reliability]
  const dir = directionLabel[item.direction]
  const canWatch = Boolean(item.company_id && onToggleWatch)

  const scoreBadge = (
    <span
      className={`inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded px-1 text-[11px] font-bold ${materialityStyle[tier]}`}
      title={`מהותיות ${item.materiality_score}/10`}
    >
      {item.materiality_score}
    </span>
  )

  if (compact) {
    return (
      <article className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:shadow-sm">
        {scoreBadge}
        {canWatch && <StarButton watched={watched} onClick={onToggleWatch!} />}
        {item.company_name && (
          <span className="shrink-0 text-xs font-bold text-brand">{item.company_name}</span>
        )}
        <span className={`shrink-0 text-xs ${dir.className}`} title={dir.text}>
          {dir.icon}
        </span>
        <span className="truncate text-sm text-slate-800">{item.title}</span>
        <span className="mr-auto shrink-0 text-xs text-slate-400">{formatTime(item.published_at)}</span>
      </article>
    )
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {item.company_name && (
            <div className="flex items-center gap-1.5">
              {canWatch && <StarButton watched={watched} onClick={onToggleWatch!} />}
              <span className="text-sm font-extrabold text-brand">{item.company_name}</span>
            </div>
          )}
          <h2 className="mt-0.5 text-[15px] font-bold leading-snug text-slate-900">{item.title}</h2>
        </div>
        <span className="mt-0.5">{scoreBadge}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
        <span>{item.source_name}</span>
        <span className={`font-medium ${dir.className}`} title={`כיוון: ${dir.text}`}>
          {dir.icon}
        </span>
        <span title={`מהימנות: ${rel.text}`}>{rel.icon}</span>
        <span className="mr-auto">{formatTime(item.published_at)}</span>
      </div>

      {item.body && <p className="mt-3 text-sm leading-relaxed text-slate-700">{item.body}</p>}

      {item.bottom_line && (
        <p className="mt-2.5 border-r-[3px] border-brand/40 pr-3 text-sm leading-relaxed text-slate-600">
          {item.bottom_line}
        </p>
      )}

      {(item.tags?.length || item.original_url) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.tags?.map((t) => (
            <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              #{t}
            </span>
          ))}
          {item.original_url && (
            <a
              href={item.original_url}
              target="_blank"
              rel="noreferrer"
              className="mr-auto text-xs font-medium text-brand hover:underline"
            >
              למקור ↗
            </a>
          )}
        </div>
      )}
    </article>
  )
}
