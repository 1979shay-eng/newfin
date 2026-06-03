import type { FeedItem } from '../types/db'
import {
  sourceTypeLabel,
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
      <h2 className="text-[15px] font-bold leading-snug text-slate-900">{item.title}</h2>

      {/* שורת מטא קומפקטית */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span
          className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 text-[11px] font-bold ${materialityStyle[tier]}`}
          title={`ציון מהותיות: ${item.materiality_score}/10`}
        >
          {item.materiality_score}
        </span>
        <span className="rounded bg-brand/10 px-1.5 py-0.5 font-medium text-brand">
          {sourceTypeLabel[item.source_type]}
        </span>
        <span className="text-slate-400">{item.source_name}</span>
        <span className={`font-medium ${dir.className}`} title={`כיוון: ${dir.text}`}>
          {dir.icon}
        </span>
        <span title={`מהימנות: ${rel.text}`}>{rel.icon}</span>
        {item.company_name && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{item.company_name}</span>
        )}
        <span className="mr-auto text-slate-400">{formatTime(item.published_at)}</span>
      </div>

      {item.body && <p className="mt-3 text-sm leading-relaxed text-slate-700">{item.body}</p>}

      {/* השורה התחתונה — חתימת המוצר */}
      {item.bottom_line && (
        <div className="mt-3 rounded-lg border-r-[3px] border-brand bg-brand/5 px-3 py-2 text-sm">
          <span className="font-semibold text-brand">השורה התחתונה: </span>
          <span className="text-slate-700">{item.bottom_line}</span>
        </div>
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
