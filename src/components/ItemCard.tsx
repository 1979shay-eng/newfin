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
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        {/* ציון מהותיות */}
        <div
          className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg ${materialityStyle[tier]}`}
          title={`ציון מהותיות: ${item.materiality_score}/10`}
        >
          <span className="text-base font-bold leading-none">{item.materiality_score}</span>
          <span className="text-[10px] font-medium leading-none opacity-70">מהותיות</span>
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-bold leading-snug text-slate-900">{item.title}</h2>

          {/* שורת מטא */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-brand/10 px-2 py-0.5 font-medium text-brand">
              {sourceTypeLabel[item.source_type]}
            </span>
            <span className="text-slate-500">{item.source_name}</span>
            <span className="text-slate-300">•</span>
            <span title="מהימנות" className="text-slate-600">
              {rel.icon} {rel.text}
            </span>
            <span className="text-slate-300">•</span>
            <span className={`font-medium ${dir.className}`}>
              {dir.icon} {dir.text}
            </span>
            {item.company_name && (
              <>
                <span className="text-slate-300">•</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                  {item.company_name}
                </span>
              </>
            )}
            <span className="mr-auto text-slate-400">{formatTime(item.published_at)}</span>
          </div>
        </div>
      </div>

      {/* גוף הדיווח */}
      <p className="mt-4 leading-relaxed text-slate-700">{item.body}</p>

      {/* השורה התחתונה — חתימת המוצר */}
      {item.bottom_line && (
        <div className="mt-3 rounded-lg border-r-4 border-brand bg-brand/5 px-4 py-2">
          <span className="font-semibold text-brand">השורה התחתונה: </span>
          <span className="text-slate-700">{item.bottom_line}</span>
        </div>
      )}

      {/* תגיות + קישור למקור */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.tags?.map((t) => (
          <span
            key={t}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
          >
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
    </article>
  )
}
