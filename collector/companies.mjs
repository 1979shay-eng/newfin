// שאיבת רשימת החברות מ-apicontent.tase.co.il דרך חיפוש prefix מעמיק (BFS).
// עובר את הגנת Incapsula דרך context של Playwright (ראה maya.mjs → openMaya).
// מזהה החברה תואם ל-companyId בדיווחים — כך שהמעקב מתחבר אוטומטית.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// אלפבית עברי (בלי אותיות סופיות — שמות מתחילים באות רגילה)
const LETTERS = [...'אבגדהוזחטיכלמנסעפצקרשת']

// חיפוש בודד מול ה-API. מחזיר מערך חברות, או null אם נחסם/נכשל.
async function searchMarket(ctx, q) {
  try {
    const r = await ctx.request.get(
      'https://apicontent.tase.co.il/api/search/market?culture=he-IL&q=' + encodeURIComponent(q),
      { headers: { Accept: 'application/json', Referer: 'https://maya.tase.co.il/' }, timeout: 20000 },
    )
    if (r.status() !== 200) return null
    const data = (await r.json()).data || []
    return data
      .filter((d) => d.category === 'חברה' && d.id && d.name)
      .map((d) => ({ id: String(d.id), name: String(d.name).trim() }))
  } catch {
    return null
  }
}

// BFS על prefixes: מתחיל מכל אות בודדת. כשחיפוש מחזיר 10 תוצאות (מלא — סימן שיש עוד
// שלא נכנסו), מעמיק אותו לצירוף של 2 אותיות. כך עוקפים את מגבלת ה-10-לכל-שאילתה
// ומגיעים לכיסוי כמעט-מלא של הבורסה (~620 חברות מול ~270 בחיפוש שטוח).
// ctx = Playwright BrowserContext שכבר עבר Incapsula (מ-openMaya).
export async function syncCompanies(ctx) {
  const byId = new Map()
  let queue = [...LETTERS]
  let depth = 0
  while (queue.length && depth < 2) {
    const next = []
    for (const q of queue) {
      const res = await searchMarket(ctx, q)
      if (res === null) {
        await sleep(400) // נחסם — נושמים רגע וממשיכים
        continue
      }
      for (const c of res) byId.set(c.id, c.name)
      // החיפוש מלא והגענו רק לרמה הראשונה → שווה להעמיק לצירופי 2 אותיות
      if (res.length >= 10 && depth < 1) for (const L of LETTERS) next.push(q + L)
      await sleep(130)
    }
    queue = next
    depth++
  }
  return [...byId.entries()].map(([id, name]) => ({ id, name }))
}
