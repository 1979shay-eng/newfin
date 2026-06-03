// שאיבת רשימת החברות מ-apicontent.tase.co.il (חיפוש שוק, לא חסום).
// מזהה החברה תואם ל-companyId בדיווחים — כך שהמעקב מתחבר אוטומטית.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// שאילתות רחבות לכיסוי טוב: כל אות עברית + מונחים נפוצים בשמות חברות
const LETTERS = [...'אבגדהוזחטיכךלמםנןסעפףצץקרשת']
const TERMS = [
  'בנק', 'נדלן', 'אנרגיה', 'טכנולוגי', 'ביו', 'השקעות', 'תעשיות', 'פיננס',
  'נפט', 'גז', 'תקשורת', 'מזון', 'ביטוח', 'אחזקות', 'גלובל', 'מדיקל', 'פארמ',
  'סייבר', 'קלין', 'גרין', 'בית', 'קבוצת', 'מניב', 'הון', 'אגד', 'תעופה',
  'רכב', 'בניין', 'פיתוח', 'מסחר', 'שירותים', 'תרופות', 'סולאר', 'מים',
]
const QUERIES = [...new Set([...LETTERS, ...TERMS])]

async function searchMarket(q) {
  const r = await fetch(
    'https://apicontent.tase.co.il/api/search/market?culture=he-IL&q=' + encodeURIComponent(q),
    { headers: { Accept: 'application/json' } },
  )
  if (!r.ok) return []
  const data = (await r.json()).data || []
  return data
    .filter((d) => d.category === 'חברה' && d.id && d.name)
    .map((d) => ({ id: String(d.id), name: String(d.name).trim() }))
}

export async function syncCompanies() {
  const byId = new Map()
  for (const q of QUERIES) {
    try {
      for (const c of await searchMarket(q)) byId.set(c.id, c.name)
    } catch {
      /* ignore */
    }
    await sleep(120)
  }
  return [...byId.entries()].map(([id, name]) => ({ id, name }))
}
