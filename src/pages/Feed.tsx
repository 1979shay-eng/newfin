import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ItemCard from '../components/ItemCard'
import { fetchFeed } from '../lib/queries'
import { loadWatch, saveWatch, onWatchChanged } from '../lib/watchlist'
import { track } from '../lib/track'
import type { FeedItem } from '../types/db'

const MAT_PRESETS = [
  { label: 'הכל', min: 1 },
  { label: 'בינוני ומעלה', min: 5 },
  { label: 'חשוב', min: 7 },
  { label: 'קריטי בלבד', min: 9 },
]

type Menu = '' | 'mat' | 'src' | 'sort'
type Sort = 'materiality' | 'time'
type Tab = 'general' | 'watch'

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [tab, setTab] = useState<Tab>('general')
  const [min, setMin] = useState(1)
  const [query, setQuery] = useState('')
  const [excluded, setExcluded] = useState<string[]>([])
  const [sort, setSort] = useState<Sort>('time')
  const [compact, setCompact] = useState(false)
  const [menu, setMenu] = useState<Menu>('')
  const [watch, setWatch] = useState<string[]>(() => loadWatch())
  const barRef = useRef<HTMLDivElement>(null)
  const watchSet = useMemo(() => new Set(watch), [watch])

  // טעינה ראשונית + רענון אוטומטי כל 2 דקות (הפיד "חי" בלי F5).
  // הרענון שקט — לא מציג שלד טעינה מחדש, רק מחליף את הנתונים.
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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setMenu('')
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // רענון רשימת המעקב אחרי מיזוג-ענן בכניסה (מכשיר אחר)
  useEffect(() => onWatchChanged(() => setWatch(loadWatch())), [])

  // מעקב חיפוש — ממוזער (רושם רק אחרי הקלדה שנעצרה 800ms, ומילה באורך 2+)
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

  const allSources = useMemo(() => [...new Set(items.map((i) => i.source_name))], [items])

  const filtered = useMemo(() => {
    let r = items.filter(
      (it) =>
        it.materiality_score >= min &&
        !excluded.includes(it.source_name) &&
        (!query || it.title.includes(query) || (it.company_name ?? '').includes(query)),
    )
    if (tab === 'watch') r = r.filter((it) => it.company_id && watchSet.has(it.company_id))
    return r.sort((a, b) =>
      sort === 'time'
        ? +new Date(b.published_at) - +new Date(a.published_at)
        : b.materiality_score - a.materiality_score,
    )
  }, [items, min, query, excluded, sort, tab, watchSet])

  const toggleSource = (s: string) =>
    setExcluded((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">הפיד</h1>
        <p className="mt-2 text-sm text-slate-400">
          דיווחים משוק ההון, מדורגים לפי מהותיות.
          {lastUpdated && (
            <span className="text-slate-500">
              {' · '}
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />{' '}
              מתעדכן אוטומטית · עודכן{' '}
              {lastUpdated.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </p>
      </div>

      {/* לשוניות כללי / במעקב */}
      <div className="mb-3 flex w-fit gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-1">
        <TabBtn active={tab === 'general'} onClick={() => setTab('general')}>
          כללי
        </TabBtn>
        <TabBtn active={tab === 'watch'} onClick={() => setTab('watch')}>
          ⭐ במעקב{watch.length > 0 ? ` (${watch.length})` : ''}
        </TabBtn>
      </div>

      {/* בר חיפוש וסינון */}
      <div
        ref={barRef}
        className="relative z-[60] mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 p-2 shadow-lg shadow-black/20 backdrop-blur-xl"
      >
        <div className="relative">
          <button onClick={() => setMenu(menu === 'mat' ? '' : 'mat')} className={btn(menu === 'mat' || min > 1)}>
            <FunnelIcon />
            <span>מהותיות</span>
            <Badge>{min}+</Badge>
          </button>
          {menu === 'mat' && (
            <Panel>
              <PanelTitle>סינון לפי מהותיות</PanelTitle>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {MAT_PRESETS.map((p) => (
                  <Chip key={p.min} active={min === p.min} onClick={() => setMin(p.min)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">סולם</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={min}
                  onChange={(e) => setMin(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer accent-sky-400"
                />
                <Badge>{min}</Badge>
              </div>
            </Panel>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setMenu(menu === 'src' ? '' : 'src')} className={btn(menu === 'src' || excluded.length > 0)}>
            <FunnelIcon />
            <span>מקורות</span>
            {excluded.length > 0 && <Badge>{allSources.length - excluded.length}</Badge>}
          </button>
          {menu === 'src' && (
            <Panel>
              <PanelTitle>מקורות מידע</PanelTitle>
              <div className="space-y-0.5">
                {allSources.length === 0 && <div className="text-xs text-slate-500">—</div>}
                {allSources.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-white/5">
                    <input type="checkbox" checked={!excluded.includes(s)} onChange={() => toggleSource(s)} className="accent-sky-400" />
                    <span className="text-slate-300">{s}</span>
                  </label>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setMenu(menu === 'sort' ? '' : 'sort')} className={btn(menu === 'sort')}>
            <SortIcon />
            <span>מיון</span>
          </button>
          {menu === 'sort' && (
            <Panel narrow>
              <Chip block active={sort === 'materiality'} onClick={() => { setSort('materiality'); setMenu('') }}>
                לפי מהותיות
              </Chip>
              <Chip block active={sort === 'time'} onClick={() => { setSort('time'); setMenu('') }}>
                החדש ביותר
              </Chip>
            </Panel>
          )}
        </div>

        <button onClick={() => setCompact((c) => !c)} className={btn(compact)}>
          תצוגה תמציתית
        </button>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setMenu('')}
          placeholder="חיפוש חברה או מילת מפתח..."
          className="min-w-[140px] flex-1 rounded-lg bg-transparent px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
        />

        {!loading && <span className="shrink-0 px-2 text-xs text-slate-500">{filtered.length}</span>}
      </div>

      {loading ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : tab === 'watch' && watch.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 py-10 text-center">
          <p className="text-slate-400">עדיין לא סימנת חברות למעקב.</p>
          <p className="mt-1 text-sm text-slate-500">לחץ על הכוכב ⭐ ליד שם חברה בפיד הכללי כדי לעקוב אחריה.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-slate-500">אין דיווחים שתואמים את הסינון.</p>
      ) : (
        <div className={`grid items-start ${compact ? 'gap-2.5' : 'gap-4'} lg:grid-cols-2`}>
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
  )
}

// ── עזרי תצוגה ──────────────────────────────────────────────────
function btn(active: boolean) {
  return `flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 ${
    active
      ? 'border-brand-light/40 bg-brand-light/15 text-brand-light shadow-[0_0_0_1px_rgba(99,179,237,0.15)]'
      : 'border-white/[0.09] text-slate-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white active:scale-[0.97]'
  }`
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? 'bg-brand-light/20 text-brand-light shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-brand-light/30'
          : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded bg-brand-light/20 px-1 text-[11px] font-bold text-brand-light">
      {children}
    </span>
  )
}

function Panel({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div
      className={`absolute right-0 z-20 mt-2 rounded-xl border border-white/[0.12] bg-[#0b1220] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.04] ${narrow ? 'w-44' : 'w-64'}`}
    >
      {children}
    </div>
  )
}

function PanelTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-xs font-semibold text-slate-400">{children}</div>
}

function Chip({
  active,
  onClick,
  children,
  block = false,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  block?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium transition-colors ${
        block ? 'mb-1 block w-full rounded-lg px-3 py-2 text-right' : 'rounded-full px-2.5 py-1'
      } ${
        active
          ? 'bg-brand-light/20 text-brand-light ring-1 ring-brand-light/40'
          : 'bg-white/[0.06] text-slate-400 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function FunnelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function SortIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M6 12h12M9 18h6" />
    </svg>
  )
}
