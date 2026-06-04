// סנכרון רשימת החברות ל-Supabase. הרצה: node collector/sync-companies.mjs
import { syncCompanies } from './companies.mjs'
import { openMaya } from './maya.mjs'
import { db } from './db.mjs'

console.log('🏢 פותח דפדפן ועובר את הגנת Incapsula...')
const { browser, ctx } = await openMaya()

console.log('🔎 שואב רשימת חברות מהבורסה (חיפוש מעמיק)...')
const list = await syncCompanies(ctx)
await browser.close()
console.log(`נמצאו ${list.length} חברות ייחודיות`)

const rows = list.map((c) => ({ maya_company_id: c.id, name_he: c.name, slug: c.id }))
let saved = 0
for (let i = 0; i < rows.length; i += 100) {
  const chunk = rows.slice(i, i + 100)
  const { data, error } = await db
    .from('companies')
    .upsert(chunk, { onConflict: 'maya_company_id' })
    .select('id')
  if (error) console.log('שגיאה:', error.message)
  else saved += data.length
}
console.log(`✅ נשמרו/עודכנו ${saved} חברות`)
