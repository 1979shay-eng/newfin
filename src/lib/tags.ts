// מערכת צבעי-תוויות: לכל מקור ולכל סקטור צבע קבוע ומזוהה, כדי שהעין תלמד לזהות
// מהר (color-coding). מחרוזות מחלקה מלאות (לא דינמיות) כדי ש-Tailwind ישמר אותן.
// סגנון אחיד: רקע רך + טקסט כהה תואם + טבעת פנימית עדינה (תמה בהירה).

const SECTOR_TAG: Record<string, string> = {
  'נדל"ן ובינוי': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  בנקים: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  ביטוח: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  פיננסים: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  טכנולוגיה: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  'נפט וגז': 'bg-stone-100 text-stone-700 ring-stone-600/20',
  'אנרגיה מתחדשת': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ביומד: 'bg-teal-50 text-teal-700 ring-teal-600/20',
  'מסחר ושירותים': 'bg-rose-50 text-rose-700 ring-rose-600/20',
  תעשייה: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  מאקרו: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}
const SECTOR_DEFAULT = 'bg-slate-100 text-slate-600 ring-slate-500/20'

const SOURCE_TAG: Record<string, string> = {
  מאיה: 'bg-blue-600/10 text-blue-700 ring-blue-600/25',
  גלובס: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  TheMarker: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  'ynet כלכלה': 'bg-red-50 text-red-700 ring-red-600/20',
  וואלה: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20',
  מעריב: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  ספונסר: 'bg-lime-50 text-lime-700 ring-lime-600/20',
  DeepTASE: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  'ערוץ 10': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Yahoo Finance': 'bg-violet-50 text-violet-700 ring-violet-600/20',
  'Jerusalem Post': 'bg-sky-50 text-sky-700 ring-sky-600/20',
}
const SOURCE_DEFAULT = 'bg-slate-100 text-slate-600 ring-slate-500/20'

export function sectorTagClass(name?: string | null): string {
  if (!name) return SECTOR_DEFAULT
  return SECTOR_TAG[name] ?? SECTOR_DEFAULT
}

export function sourceTagClass(name?: string | null): string {
  if (!name) return SOURCE_DEFAULT
  return SOURCE_TAG[name] ?? SOURCE_DEFAULT
}
