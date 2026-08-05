import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import ItemCard from '../components/ItemCard'
import { fetchFeed, searchFeed, fetchHighImportance } from '../lib/queries'
import { loadWatch, saveWatch, onWatchChanged } from '../lib/watchlist'
import { track } from '../lib/track'
import {
  impLevel,
  sectorColor,
  rankScore,
  dayKey,
  dayLabel,
  readLastSeen,
  markSeenNow,
} from '../lib/feedVisual'
import type { FeedItem } from '../types/db'

type Sort = 'smart' | 'importance' | 'time'
type Tab = 'all' | 'watched'
// 'low' הוסר — חשיבות נמוכה (רעש טכני) לא מוצגת בפיד כלל, אין מה לסנן אליה
type Imp = 'all' | 'high' | 'mid'

const IMP_OPTS: { key: Imp; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'high', label: 'גבוהה' },
  { key: 'mid', label: 'בינונית' },
]
const SORT_OPTS: { key: Sort; label: string }[] = [
  { key: 'smart', label: 'מומלץ' },
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
  // תוצאות חיפוש ארכיון (עד 9 חודשים אחורה) — null כשאין חיפוש פעיל
  const [archive, setArchive] = useState<FeedItem[] | null>(null)
  const [searching, setSearching] = useState(false)
  // ארכיון "חשיבות גבוהה" (8+ עד 9 חודשים אחורה) — נטען רק כשהסינון פעיל
  const [highArchive, setHighArchive] = useState<FeedItem[] | null>(null)
  const [loadingHigh, setLoadingHigh] = useState(false)
  const [sort, setSort] = useState<Sort>('time')
  const [compact, setCompact] = useState(false)
  const [watch, setWatch] = useState<string[]>(() => loadWatch())
  const watchSet = useMemo(() => new Set(watch), [watch])
  // חותמת הביקור הקודם — נקראת פעם אחת ונשמרת ב-state, כך שהסימון "חדש"
  // יציב לאורך הסשן ולא נמחק ברענון האוטומטי כל 2 דקות.
  const [lastSeen] = useState<number | null>(() => readLastSeen())

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

  // חותמים "נצפה" רק אחרי שהחותמת הקודמת כבר נקראה ל-state
  useEffect(() => markSeenNow(), [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const id = setTimeout(() => track('search', { q }), 800)
    return () => clearTimeout(id)
  }, [query])

  // חיפוש ארכיון מול המאגר — מופעל בהשהיה קלה אחרי ההקלדה (debounce)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setArchive(null)
      setSearching(false)
      return
    }
    setSearching(true)
    let alive = true
    const id = setTimeout(() => {
      searchFeed(q).then((results) => {
        if (!alive) return
        setArchive(results)
        setSearching(false)
      })
    }, 350)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [query])

  // סינון "גבוהה" → שליפת כל הידיעות החשובות מהמאגר (לא רק מה שנטען למסך)
  useEffect(() => {
    if (importance !== 'high') {
      setHighArchive(null)
      setLoadingHigh(false)
      return
    }
    let alive = true
    setLoadingHigh(true)
    fetchHighImportance().then((results) => {
      if (!alive) return
      setHighArchive(results)
      setLoadingHigh(false)
    })
    return () => {
      alive = false
    }
  }, [importance])

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

  // הבסיס לתצוגה: חיפוש פעיל → תוצאות הארכיון מהמאגר (עד 9 חודשים אחורה).
  // סינון "גבוהה" → ארכיון הידיעות החשובות (8+ עד 9 חודשים).
  // אחרת → 80 הידיעות הטריות כרגיל.
  const base = archive ?? (importance === 'high' && highArchive ? highArchive : items)

  // הסקטורים בתצוגה הנוכחית + כמה דיווחים בכל אחד, לפי שכיחות.
  // המונה עונה על "איפה קורה משהו עכשיו" עוד לפני שלוחצים.
  const sectors = useMemo(() => {
    const count = new Map<string, number>()
    for (const it of base) {
      const s = itemSector(it)
      if (s) count.set(s, (count.get(s) ?? 0) + 1)
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1])
  }, [base])

  const filtered = useMemo(() => {
    const q = query.trim()
    let r = base.filter((it) => {
      if (importance !== 'all' && impLevel(it.materiality_score) !== importance) return false
      if (sector !== 'all' && itemSector(it) !== sector) return false
      // סינון טקסט בצד-לקוח רק כשאין תוצאות שרת (המאגר כבר סינן טוב יותר)
      if (q && !archive) {
        const hay = `${it.company_name ?? ''} ${it.title} ${it.bottom_line ?? ''} ${itemSector(it) ?? ''}`
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (tab === 'watched') r = r.filter((it) => it.company_id && watchSet.has(it.company_id))
    const byTime = (a: FeedItem, b: FeedItem) => +new Date(b.published_at) - +new Date(a.published_at)
    return r.sort((a, b) => {
      // "מומלץ": עדיפות מקור + מהותיות (מצף את מאיה לראש), שובר שוויון לפי זמן.
      // "חשיבות": מהותיות בלבד. "זמן": כרונולוגי בלבד.
      if (sort === 'time') return byTime(a, b)
      const diff = sort === 'smart' ? rankScore(b) - rankScore(a) : b.materiality_score - a.materiality_score
      return diff !== 0 ? diff : byTime(a, b)
    })
  }, [base, importance, sector, query, sort, tab, watchSet, archive])

  const isNew = (it: FeedItem) => lastSeen !== null && +new Date(it.published_at) > lastSeen
  const newCount = useMemo(() => filtered.filter(isNew).length, [filtered, lastSeen])

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
            className="nf-search flex flex-1 items-center gap-2.5 rounded-[11px] px-3 py-2.5"
            style={{ background: 'var(--field)', border: '1px solid var(--line2)' }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--muted2)"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="shrink-0"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש חברה או מילת מפתח..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-70"
              style={{ color: 'var(--ink)' }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                title="נקה חיפוש"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[13px] leading-none transition-colors"
                style={{ background: 'var(--chip)', color: 'var(--chip-ink)' }}
              >
                ×
              </button>
            )}
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
            <SectorChip active={sector === 'all'} color="var(--accent)" onClick={() => setSector('all')}>
              כל הסקטורים
            </SectorChip>
            {sectors.map(([s, n]) => (
              <SectorChip
                key={s}
                active={sector === s}
                color={sectorColor(s)}
                count={n}
                onClick={() => setSector(s)}
              >
                {s}
              </SectorChip>
            ))}
          </div>
        )}
      </div>

      {/* רשימה — כל דיווח בכרטיס נפרד */}
      <div className="mt-4">
        <div
          className="flex items-center justify-between px-2 pb-2.5 text-[12.5px] font-semibold"
          style={{ color: 'var(--muted2)' }}
        >
          <span className="flex items-center gap-2">
            {loading
              ? '—'
              : searching || loadingHigh
                ? 'מחפש בארכיון...'
                : archive
                  ? `${filtered.length} תוצאות מ-9 החודשים האחרונים`
                  : importance === 'high' && highArchive
                    ? `${filtered.length} דיווחים בחשיבות גבוהה מ-9 החודשים האחרונים`
                    : `${filtered.length} דיווחים`}
            {!loading && !archive && newCount > 0 && (
              <span
                className="nf-sc rounded-full px-2 py-0.5 text-[11.5px] font-bold"
                style={{ ['--sc' as string]: 'var(--accent)' }}
              >
                {newCount} חדשים מאז הביקור האחרון
              </span>
            )}
          </span>
          <span>מדורג לפי {sort === 'time' ? 'זמן עדכון' : sort === 'smart' ? 'עדיפות מקור וחשיבות' : 'חשיבות'}</span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-[18px] border px-6 py-5"
                style={{ background: 'var(--surface)', borderColor: 'var(--line2)' }}
              >
                <div className="h-5 w-40 animate-pulse rounded" style={{ background: 'var(--hover)' }} />
                <div className="mt-3 h-6 w-full animate-pulse rounded" style={{ background: 'var(--hover)' }} />
              </div>
            ))}
          </div>
        ) : tab === 'watched' && watch.length === 0 ? (
          <ListCard>
            <Empty
              title="עדיין לא סימנת חברות למעקב"
              sub="לחץ על הכוכב ☆ ליד שם חברה בפיד הכללי כדי לעקוב אחריה."
            />
          </ListCard>
        ) : filtered.length === 0 ? (
          <ListCard>
            <Empty title="אין דיווחים תואמים" sub="נסה לשנות את הסינון או לנקות את החיפוש." />
          </ListCard>
        ) : (
          <div className="space-y-4">
            {filtered.map((item, i) => {
              // מפריד יום — רק במיון כרונולוגי, אחרת התאריכים מעורבבים
              // והכותרת "היום" הייתה משקרת.
              const newDay =
                sort === 'time' &&
                (i === 0 || dayKey(item.published_at) !== dayKey(filtered[i - 1].published_at))
              return (
                <Fragment key={item.id}>
                  {newDay && <DayDivider label={dayLabel(item.published_at)} />}
                  <ItemCard
                    item={item}
                    index={i}
                    compact={compact}
                    isNew={isNew(item)}
                    watched={!!item.company_id && watchSet.has(item.company_id)}
                    onToggleWatch={item.company_id ? () => toggleWatch(item.company_id as string) : undefined}
                  />
                </Fragment>
              )
            })}
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

// מפריד יום — עוגן התמצאות בגלילה ארוכה. קו שיער דק ותווית שקטה:
// מספיק כדי לעצור את העין, לא מספיק כדי להתחרות בכותרות הדיווחים.
function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-1 pt-2 first:pt-0">
      <span className="text-[12.5px] font-bold" style={{ color: 'var(--muted2)' }}>
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: 'var(--line2)' }} />
    </div>
  )
}

// מעטפת כרטיס למצבי ריק/הודעה — אותה שפה ויזואלית כמו כרטיסי הדיווחים
function ListCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-[18px] border"
      style={{ background: 'var(--surface)', borderColor: 'var(--line2)', boxShadow: 'var(--shadow)' }}
    >
      {children}
    </div>
  )
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

// צ'יפ סקטור — נושא את צבע הסקטור שלו תמיד, לא רק כשהוא פעיל. הצבע הוא
// זהות (אותו גוון כמו התגית בכרטיס), ולכן הבר עצמו הופך למקרא של הפיד.
// הגזירה לרקע/טקסט/טבעת יושבת ב-CSS (`.nf-sc`) כדי לתקן ניגודיות בשתי התמות.
function SectorChip({
  active,
  color,
  count,
  onClick,
  children,
}: {
  active: boolean
  color: string
  count?: number
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="nf-sc nf-chip flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[20px] px-3.5 py-1.5 text-[12.5px]"
      style={{ ['--sc' as string]: color, fontWeight: active ? 800 : 600 }}
    >
      {children}
      {count !== undefined && (
        <span className="tabular-nums text-[11px] opacity-65">{count}</span>
      )}
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
