import { useEffect, useMemo, useState, type ReactNode } from 'react'
import ItemCard from '../components/ItemCard'
import { fetchFeed } from '../lib/queries'
import { loadWatch, saveWatch, onWatchChanged } from '../lib/watchlist'
import { track } from '../lib/track'
import { impLevel, sectorColor, tint } from '../lib/feedVisual'
import type { FeedItem } from '../types/db'

type Sort = 'importance' | 'time'
type Tab = 'all' | 'watched'
type Imp = 'all' | 'high' | 'mid' | 'low'

const IMP_OPTS: { key: Imp; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'high', label: 'גבוהה' },
  { key: 'mid', label: 'בינונית' },
  { key: 'low', label: 'נמוכה' },
]
const SORT_OPTS: { key: Sort; label: string }[] = [
  { key: 'importance', label: 'חשיבות' },
  { key: 'time', label: 'זמן' },
]

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [importance, setImportance] = useState<Imp>('all')
  const [sector, setSector] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('time')
  const [compact, setCompact] = useState(false)
  const [watch, setWatch] = useState<string[]>(() => loadWatch())
  const watchSet = useMemo(() => new Set(watch), [watch])

  // טעינה + רענון שקט כל 2 דקות (פיד חי)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetchFeed(80).then((data) => {
        if (!alive) return
        setItems(data)
        setLastUpdated(new Date())
        setLoading(false)
      })
    load()
    const id = setInterval(load, 120000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  useEffect(() => onWatchChanged(() => setWatch(loadWatch())), [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const id = setTimeout(() => track('search', { q }), 800)
    return () => clearTimeout(id)
  }, [query])

  function toggleWatch(id: string) {
    setWatch((prev) => {
      const adding = !prev.includes(id)
      const next = adding ? [...prev, id] : prev.filter((x) => x !== id)
      saveWatch(next)
      const company = items.find((it) => it.company_id === id)?.company_name ?? null
      void track(adding ? 'watch_add' : 'watch_remove', { company_id: id, company })
      return next
    })
  }

  // הסקטור של פריט (חברה או תגית כותרת)
  const itemSector = (it: FeedItem) =>
    it.company_sector && it.company_sector !== 'אחר' ? it.company_sector : it.headline_tag

  // רשימת הסקטורים הקיימים בפיד (לצ'יפים), לפי שכיחות
  const sectors = useMemo(() => {
    const count = new Map<string, number>()
    for (const it of items) {
      const s = itemSector(it)
      if (s) count.set(s, (count.get(s) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim()
    let r = items.filter((it) => {
      if (importance !== 'all' && impLevel(it.materiality_score) !== importance) return false
      if (sector !== 'all' && itemSector(it) !== sector) return false
      if (q) {
        const hay = `${it.company_name ?? ''} ${it.title} ${it.bottom_line ?? ''} ${itemSector(it) ?? ''}`
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (tab === 'watched') r = r.filter((it) => it.company_id && watchSet.has(it.company_id))
    return r.sort((a, b) =>
      sort === 'time'
        ? +new Date(b.published_at) - +new Date(a.published_at)
        : b.materiality_score - a.materiality_score,
    )
  }, [items, importance, sector, query, sort, tab, watchSet])

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* כותרת */}
      <h1 className="font-serif text-[38px] font-black leading-[1.05] tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
        הפיד
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]" style={{ color: 'var(--muted)' }}>
        <span>דיווחים משוק ההון, מדורגים לפי חשיבות</span>
        {lastUpdated && (
          <>
            <Dot />
            <span className="flex items-center gap-1.5">
              <span className="nf-pulse inline-block h-[7px] w-[7px] rounded-full bg-[#16a34a]" />
              מתעדכן אוטומטית
            </span>
            <Dot />
            <span>
              עודכן {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </p>

      {/* לשוניות */}
      <div className="mt-5 flex gap-2">
        <Tab active={tab === 'all'} onClick={() => setTab('all')}>
          כללי
        </Tab>
        <Tab active={tab === 'watched'} onClick={() => setTab('watched')}>
          במעקב{watch.length > 0 ? ` (${watch.length})` : ''}
        </Tab>
      </div>

      {/* Toolbar */}
      <div
        className="mt-3 rounded-2xl border p-3.5"
        style={{ background: 'var(--surface)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow)' }}
      >
        {/* שורה 1: חיפוש + תצוגה תמציתית */}
        <div className="flex items-center gap-2">
          <div
            className="flex flex-1 items-center gap-2 rounded-[11px] px-3 py-2.5"
            style={{ background: 'var(--field)', border: '1px solid var(--line2)' }}
          >
            <span className="h-[13px] w-[13px] shrink-0 rounded-full border-2" style={{ borderColor: 'var(--muted2)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש חברה או מילת מפתח..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-70"
              style={{ color: 'var(--ink)' }}
            />
          </div>
          <button
            onClick={() => setCompact((c) => !c)}
            className="shrink-0 rounded-[11px] px-4 py-2.5 text-sm font-bold transition-colors"
            style={compact ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--field)', color: 'var(--muted)' }}
          >
            תצוגה תמציתית
          </button>
        </div>

        {/* שורה 2: חשיבות + מיון */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Seg label="חשיבות" opts={IMP_OPTS} value={importance} onChange={setImportance} />
          <Seg label="מיון" opts={SORT_OPTS} value={sort} onChange={setSort} />
        </div>

        {/* שורה 3: צ'יפי סקטור */}
        {sectors.length > 0 && (
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
            <SectorChip active={sector === 'all'} accent onClick={() => setSector('all')}>
              כל הסקטורים
            </SectorChip>
            {sectors.map((s) => (
              <SectorChip key={s} active={sector === s} color={sectorColor(s)} onClick={() => setSector(s)}>
                {s}
              </SectorChip>
            ))}
          </div>
        )}
      </div>

      {/* רשימה */}
      <div
        className="mt-4 overflow-hidden rounded-[18px] border"
        style={{ background: 'var(--surface)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-3.5 text-[12.5px] font-semibold"
          style={{ color: 'var(--muted2)', borderBottom: '1px solid var(--line)' }}
        >
          <span>{loading ? '—' : `${filtered.length} דיווחים`}</span>
          <span>מדורג לפי {sort === 'time' ? 'זמן עדכון' : 'חשיבות'}</span>
        </div>

        {loading ? (
          <div className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="px-6 py-[22px]">
                <div className="h-5 w-40 animate-pulse rounded" style={{ background: 'var(--hover)' }} />
                <div className="mt-3 h-6 w-full animate-pulse rounded" style={{ background: 'var(--hover)' }} />
              </div>
            ))}
          </div>
        ) : tab === 'watched' && watch.length === 0 ? (
          <Empty
            title="עדיין לא סימנת חברות למעקב"
            sub="לחץ על הכוכב ☆ ליד שם חברה בפיד הכללי כדי לעקוב אחריה."
          />
        ) : filtered.length === 0 ? (
          <Empty title="אין דיווחים תואמים" sub="נסה לשנות את הסינון או לנקות את החיפוש." />
        ) : (
          <div className="divide-y divide-[color:var(--line)]">
            {filtered.map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                index={i}
                compact={compact}
                watched={!!item.company_id && watchSet.has(item.company_id)}
                onToggleWatch={item.company_id ? () => toggleWatch(item.company_id as string) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── עזרי תצוגה ──────────────────────────────────────────────────
function Dot() {
  return <span style={{ color: 'var(--muted2)' }}>·</span>
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-[11px] px-[18px] py-[9px] text-sm font-bold transition-colors"
      style={
        active
          ? { background: 'var(--accent)', color: '#fff' }
          : { background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--line2)' }
      }
    >
      {children}
    </button>
  )
}

function Seg<T extends string>({
  label,
  opts,
  value,
  onChange,
}: {
  label: string
  opts: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12.5px] font-bold" style={{ color: 'var(--muted2)' }}>
        {label}
      </span>
      <div className="inline-flex gap-0.5 rounded-[11px] p-[3px]" style={{ background: 'var(--seg)' }}>
        {opts.map((o) => {
          const on = value === o.key
          return (
            <button
              key={o.key}
              onClick={() => onChange(o.key)}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors"
              style={
                on
                  ? { background: 'var(--seg-active)', color: 'var(--ink)', boxShadow: 'var(--seg-active-shadow)' }
                  : { color: 'var(--muted)' }
              }
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SectorChip({
  active,
  accent = false,
  color,
  onClick,
  children,
}: {
  active: boolean
  accent?: boolean
  color?: string
  onClick: () => void
  children: ReactNode
}) {
  let style: React.CSSProperties
  if (active && accent) style = { background: 'var(--accent)', color: '#fff' }
  else if (active && color) style = { background: tint(color), color }
  else style = { background: 'var(--chip)', color: 'var(--chip-ink)', border: '1px solid var(--line2)' }
  return (
    <button
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-[20px] px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
      style={style}
    >
      {children}
    </button>
  )
}

function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-base font-bold" style={{ color: 'var(--ink2)' }}>
        {title}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
        {sub}
      </p>
    </div>
  )
}
