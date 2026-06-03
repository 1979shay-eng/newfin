import type { FeedItem } from '../types/db'
import {
  reliabilityLabel,
  directionLabel,
  materialityTier,
  materialityStyle,
  formatTime,
} from '../lib/format'

export default function ItemCard({ item }: { item: FeedItem }) {
  const tier = materialityTier(item.materiality_score)
  const rel = reliabilityLabel[item.reliability]
  const dir = directionLabel[item.direction]

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {item.company_name && (
            <div className="text-sm font-extrabold text-brand">{item.company_name}</div>
          )}
          <h2 className="mt-0.5 text-[15px] font-bold leading-snug text-slate-900">{item.title}</h2>
        </div>
        <span
          className={`mt-0.5 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded px-1 text-[11px] font-bold ${materialityStyle[tier]}`}
          title={`מהותיות ${item.materiality_score}/10`}
        >
          {item.materiality_score}
        </span>
      </div>

      {/* מטא מינימלי */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
        <span>{item.source_name}</span>
        <span className={`font-medium ${dir.className}`} title={`כיוון: ${dir.text}`}>
          {dir.icon}
        </span>
        <span title={`מהימנות: ${rel.text}`}>{rel.icon}</span>
        <span className="mr-auto">{formatTime(item.published_at)}</span>
      </div>

      {item.body && <p className="mt-3 text-sm leading-relaxed text-slate-700">{item.body}</p>}

      {/* הקשר/משמעות — הערה עיתונאית טבעית, בלי תווית */}
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
