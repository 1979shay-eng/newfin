// מודול RSS — קריאת חדשות פיננסיות, זיהוי חברה מהכותרת, ונירמול ל-Item.
// מבנה הפלט זהה ל-normalizeReport של מאיה, כך שה-flow (ציון + SIGNAL + שמירה) משותף.
import { db, getOrCreateSource } from './db.mjs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// רשימת הפידים. ה-key הוא ברמת ה*מקור* (לא המקטע) ולכן חוזר על עצמו בין מקטעים:
// כך אותה כתבה שמופיעה בשני מקטעים של אותו מקור מזוהה ככפילות (maya_report_id = key:guid)
// ומסוננת. section = הערה אנושית בלבד. לוקחים רק PER_FEED הפריטים החדשים מכל פיד.
const PER_FEED = 30
export const FEEDS = [
  // ── גלובס (עיתון כלכלי) — כל המקטעים ממופים למקור "גלובס" ─────────────
  { key: 'globes', source_name: 'גלובס', section: 'שוק ההון',
    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585' },
  { key: 'globes', source_name: 'גלובס', section: 'גלובלי ושוקי עולם',
    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=1225' },
  { key: 'globes', source_name: 'גלובס', section: 'טכנולוגיה',
    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=594' },
  { key: 'globes', source_name: 'גלובס', section: 'נדל"ן ותשתיות',
    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=607' },
  { key: 'globes', source_name: 'גלובס', section: 'שווקים',
    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2' },
  // ── TheMarker ──────────────────────────────────────────────────────
  { key: 'themarker', source_name: 'TheMarker', section: 'כללי',
    url: 'https://www.themarker.com/cmlink/1.144' },
  { key: 'themarker', source_name: 'TheMarker', section: 'שווקים',
    url: 'https://www.themarker.com/cmlink/1.243' },
  { key: 'themarker', source_name: 'TheMarker', section: 'שוק ההון',
    url: 'https://www.themarker.com/cmlink/1.145' },
  // ── ynet כלכלה ──────────────────────────────────────────────────────
  { key: 'ynet', source_name: 'ynet כלכלה', section: 'כלכלה',
    url: 'https://www.ynet.co.il/Integration/StoryRss6.xml' },
  // ── וואלה — עד ספטמבר 2026 הצהיר GMT אבל שידר שעון ישראל; מאז שולח GMT
  //    אמיתי (אומת 16.10.2026 מול article:published_time). tz='detect' מזהה
  //    לבד בכל ריצה איזה מהשניים הפיד שולח — ראה detectIsraelTz. ──
  // 16.10.2026: וואלה החליף מבנה פידים בספטמבר — 2686/2689 קפאו ב-22.09 ו-22 הפך
  //   לחדשות כלליות. הכתובות החדשות מתוך www.walla.co.il/rss (מדור "וואלה כסף").
  { key: 'walla', source_name: 'וואלה', section: 'כסף', tz: 'detect',
    url: 'https://rss.walla.co.il/feed/2?type=main' },
  { key: 'walla', source_name: 'וואלה', section: 'חדשות כסף', tz: 'detect',
    url: 'https://rss.walla.co.il/feed/557' },
  // ── מעריב כלכלה ─────────────────────────────────────────────────────
  { key: 'maariv', source_name: 'מעריב', section: 'כלכלה',
    url: 'https://www.maariv.co.il/rss/business' },
  // ── ספונסר (שוק הון; RSS ב-Content_rss_articles, CatId=7) ───────────
  { key: 'sponser', source_name: 'ספונסר', section: 'שוק הון',
    url: 'https://www.sponser.co.il/Content_rss_articles.aspx?CatId=7' },
  // ── DeepTASE (חדשות וניתוח שוק ההון) ────────────────────────────────
  { key: 'deeptase', source_name: 'DeepTASE', section: 'כללי',
    url: 'https://www.deeptase.co.il/he/rss.xml' },
  // ── ערוץ 10 (ערוץ הכלכלה; WordPress feed — כל האתר פיננסי) ───────────
  { key: 'tv10', source_name: 'ערוץ 10', section: 'כללי',
    url: 'https://tv10.co.il/feed/' },

  // ── מקורות ענפיים (קובץ ת"א-35, 04.07.2026) ─────────────────────────
  // sector = תגית-ענף שתוצמד לידיעה אם לא זוהתה חברה ולא נמצא סיווג-כותרת.
  // כך ידיעה ענפית מהמקור הייעודי תמיד רלוונטית למניה או לענף בפיד.
  { key: 'geektime', source_name: 'Geektime', section: 'הייטק ישראלי', sector: 'טכנולוגיה',
    url: 'https://www.geektime.co.il/tag/%D7%94%D7%99%D7%99%D7%98%D7%A7-%D7%99%D7%A9%D7%A8%D7%90%D7%9C%D7%99/feed/' },
  { key: 'geektime', source_name: 'Geektime', section: 'שבבים', sector: 'טכנולוגיה',
    url: 'https://www.geektime.co.il/tag/semiconductors/feed/' },
  { key: 'nadlancenter', source_name: 'מרכז הנדל"ן', section: 'ראשי', sector: 'נדל"ן ובינוי',
    url: 'https://www.nadlancenter.co.il/rss/main' },
  { key: 'energyinst', source_name: 'המכון לאנרגיה', section: 'עדכונים', sector: 'אנרגיה',
    url: 'https://energy.org.il/feed/' },
  { key: 'ynet', source_name: 'ynet כלכלה', section: 'צרכנות', sector: 'מסחר ושירותים',
    url: 'https://www.ynet.co.il/Integration/StoryRss6780.xml' },
  { key: 'globes', source_name: 'גלובס', section: 'צרכנות', sector: 'מסחר ושירותים',
    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=821' },
  // אייס (מדיה/תקשורת) — בלי sector: רק ידיעות עם חברה מזוהה או סיווג-כותרת נשמרות.
  // pubDate בלי אזור-זמן והוא שעון ישראל (אומת מול דף הכתבה) — tz מתקן.
  { key: 'ice', source_name: 'אייס', section: 'מדיה וצריכה', tz: 'israel',
    url: 'https://www.ice.co.il/rss' },
]

// פענוח ישויות HTML/XML נפוצות. שני מעברים: ישויות שהיו מקודדות-כפול
// (&amp;#8226; → &#8226; → •) נפתחות רק אחרי שה-&amp; הפך ל-&.
function decodePass(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
function decode(s) {
  return decodePass(decodePass(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')))
    .replace(/<[^>]+>/g, '') // הסרת תגיות HTML שנותרו בתיאור
    .replace(/\s+/g, ' ')
    .trim()
}

// חילוץ ערך תג בודד מתוך בלוק <item>
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? m[1].trim() : ''
}

// offset של שעון ישראל (בדקות) ברגע נתון — 120 בחורף, 180 בקיץ (DST אוטומטי)
function israelOffsetMin(d) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]))
  const asIl = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second)
  return Math.round((asIl - d.getTime()) / 60000)
}

// המרת pubDate גולמי ל-ISO תקין. מטפל בשלוש תקלות אמיתיות שנצפו בפידים:
//   1. CDATA — ynet עוטף את התאריך ב-<![CDATA[...]]> ואז new Date נכשל ונופל ל"עכשיו"
//      (כל הידיעות מקבלות אותה שעה + ידיעה ישנה מקבלת תאריך היום).
//   2. tz='israel' — מקורות שמשדרים שעון ישראל עם סימון שגוי (וואלה מסמן GMT,
//      אייס בלי סימון בכלל). מתעלמים מהסימון ומפרשים את השעה כ-Asia/Jerusalem.
//      בלי זה הידיעות מוצגות 2-3 שעות קדימה. אומת מול article:published_time.
//   3. תאריך עתידי — עדכון-תאריך מאוחר של כתבה. זמן פרסום לא יכול להיות אחרי
//      זמן האיסוף, אז חוסמים ונופלים לזמן הנוכחי.
// בכל מקרה של תאריך חסר/לא-תקין/עתידי → זמן האיסוף (קירוב סביר, האיסוף תכוף).
export function publishedAtFrom(rawPubDate, tz) {
  const now = Date.now()
  const cleaned = (rawPubDate || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
  if (!cleaned) return new Date().toISOString()
  let d
  if (tz === 'israel') {
    // הסרת סימון אזור-הזמן (השקרי) ופירוש השעה הערומה כשעון ישראל
    const naive = cleaned.replace(/\s*(GMT|UTC|Z|[+-]\d{2}:?\d{2})\s*$/i, '')
    const asUtc = new Date(naive + ' GMT')
    d = isNaN(asUtc.getTime()) ? null : new Date(asUtc.getTime() - israelOffsetMin(asUtc) * 60000)
  } else {
    d = new Date(cleaned)
  }
  if (!d || isNaN(d.getTime()) || d.getTime() > now + 60000) return new Date().toISOString()
  return d.toISOString()
}

// פירוק פיד RSS לרשימת פריטים גולמיים. מיוצא לשימוש חוזר ע"י thematic.mjs.
export function parseFeed(xml) {
  const out = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m
  while ((m = re.exec(xml))) {
    const b = m[1]
    const link = decode(tag(b, 'link')).split('#')[0]
    out.push({
      title: decode(tag(b, 'title')),
      link,
      guid: decode(tag(b, 'guid')) || link,
      description: decode(tag(b, 'description')),
      pubDate: tag(b, 'pubDate'),
    })
  }
  return out
}

// טעינת רשימת החברות פעם אחת, ממוינת לפי אורך השם (ארוך קודם — התאמה מדויקת קודמת).
// סינון לשמות באורך 4+ : שמות בני 3 אותיות (ארד, חמת, עשות) נבלעים בתוך מילים נפוצות.
let companiesCache = null
export async function loadCompanies() {
  if (companiesCache) return companiesCache
  const { data } = await db.from('companies').select('id, name_he')
  companiesCache = (data || [])
    .filter((c) => c.name_he && c.name_he.trim().length >= 4)
    .map((c) => ({ id: c.id, name: c.name_he.trim() }))
    .sort((a, b) => b.name.length - a.name.length)
  return companiesCache
}

// תווי גבול-מילה: רווח, פיסוק, מקף, מרכאות, נקודותיים. שם החברה חייב להיות מוקף בהם
// כדי להיחשב התאמה — כך "מלחמת" לא ייתפס כחברת "חמת".
const BOUNDARY = /[\s.,;:!?"'()[\]־–—•·\-/|]/

// שמות-חברה שהם גם מילה עברית נפוצה (תואר/שם-עצם) — מדלגים כדי למנוע התאמות-שווא.
const STOP = new Set(['בינלאומי', 'מבנה'])

// שמות-חברה דו-משמעיים — מילה עברית יומיומית שהיא גם שם חברה בבורסה
// ("חשמל", "מקורות", "לאומי"...). התאמה מתקבלת רק אם הכותרת מכילה גם הקשר
// פיננסי (FIN_CONTEXT) — אחרת "חשמל באוויר" בכתבת רכילות נתפס כחברת החשמל.
// כולל שמות מקום ושמות פרטיים שהם גם שמות חברה בבורסה — "ירושלים" (בנק
// ירושלים) תפס "חוף ירושלים בבת ים" ו"ירושלים מחפשת צל", ו"רפאל" תפס
// "ליובל רפאל היו 200 דירות אירוח". 33 זיהויי-שווא ב-21 יום.
const AMBIGUOUS = new Set([
  'אדמה', 'אזורים', 'איילון', 'אלומה', 'אלמוג', 'אלעד', 'אמות', 'אמנת',
  'אנליסט', 'אקסל', 'ארזים', 'בליץ', 'ברנד', 'גולד', 'גולף', 'חשמל',
  'יוזמות', 'יצוא', 'ירושלים', 'כנפיים', 'לאומי', 'לכיש', 'מגידו', 'מהדרין',
  'מקורות', 'ניסן', 'נובה', 'סקופ', 'פוקס', 'פועלים', 'צרפתי', 'קליל',
  'רפאל', 'רימון', 'תעוזה', 'תשתיות אנרגיה',
])

// סימני הקשר כלכלי/שוק-הון בכותרת — תנאי להתאמת שם דו-משמעי.
const FIN_CONTEXT =
  /מניה|מניית|מניות|בורס[הת]|דו"ח|דוח|הנפק[הת]|אג"ח|רווח|הפסד|שווי|עסק[הת]|רכיש[הת]|רכשה|רכוש|מיזוג|דיבידנד|משקיע|השקע|גיוס|גייס|תשקיף|מסחר|נסחר|שוק ההון|וול סטריט|נאסד"ק|בנק|המלצת|תשואה|אשראי|ריבית|מכרז|חוזה|הסכם|מנכ"ל|דירקטוריון|שותפות|קרן|חנויות|סניפים|חברת|קבוצת|מיליון|מיליארד|שקל|דולר|נדל"ן/

// צירופים כוזבים ידועים — ביטוי שמכיל שם-חברה דו-משמעי אבל לעולם אינו החברה.
// מסולקים מהכותרת לפני חיפוש שמות דו-משמעיים ("ביטוח לאומי" ≠ בנק לאומי).
const FALSE_COLLOC = [
  /ביטוח לאומי/g,
  /רעיד(ת|ות) (ה)?אדמה/g,
  /נתיבי איילון|כביש איילון/g,
  /פסטיבל נובה|הטבח בנובה/g,
  /הפסק(ת|ות) (ה)?חשמל/g,
  /רימון (יד|רסס|הלם)/g,
  /(רב|בין)[- ]לאומי/g,
  /כוחות? (ה)?ביטחון פועלים|צוותי (ה)?כיבוי פועלים/g,
  /מקורות (ביטחוניים|זרים|בכירים|פלסטיניים|לבנוניים|מעורים|יודעי דבר)/g,
  // ירושלים כעיר — גם כשיש בכותרת מילה כלכלית ("תקציב", "מיליון שקל")
  /עיריית ירושלים|ראש עיריית ירושלים|חוף ירושלים|הרי ירושלים|(מזרח|מערב|צפון|דרום) ירושלים|ירושלים והסביבה|יער ירושלים/g,
]

// מיקומי השם בטקסט כמילה שלמה (מוקף בגבול-מילה משני הצדדים). withPrefix — מקבל
// גם אותיות שימוש צמודות ("לרימון", "באיילון", "ולסקייליין"), עד שתיים.
const PREFIX = 'ובכלמשה'
function wordHits(text, name, withPrefix = false) {
  const out = []
  let from = 0
  let idx
  while ((idx = text.indexOf(name, from)) !== -1) {
    let b = idx
    if (withPrefix) while (b > 0 && idx - b < 2 && PREFIX.includes(text[b - 1])) b--
    const before = b === 0 ? ' ' : text[b - 1]
    const after = idx + name.length >= text.length ? ' ' : text[idx + name.length]
    if (BOUNDARY.test(before) && BOUNDARY.test(after)) out.push(idx)
    from = idx + 1 // אותו שם עשוי להופיע שוב במקום עם גבול תקין
  }
  return out
}
const hasWord = (text, name) => wordHits(text, name).length > 0

const stripFalseColloc = (s) => FALSE_COLLOC.reduce((acc, re) => acc.replace(re, ' '), s)
// גרש/מרכאות טיפוגרפיים → ASCII ("ג’י סיטי" = "ג'י סיטי")
const normQuotes = (s) => s.replace(/[’‘׳`]/g, "'").replace(/[”“״]/g, '"')

// שם דו-משמעי בתקציר נחשב "שם חברה" רק בהקשר של חברה: אחרי "החברה/חברת/מניית/
// בנק/קבוצת", בתוך מרכאות, או לפני פועל של תנועת מניה/פעולה עסקית. בלי זה
// "מקורות המימון", "אספקת חשמל" ו"חזון לאומי" נתפסו כחברות.
const CUE_BEFORE = /(?:החברה|חברת|מניית|מניות|בנק|קבוצת)\s*['"]?$/
const CUE_AFTER = /^['"]?\s*(?:זינק|מזנק|קפצ|קופצ|עלת|עול|ירד|יורד|צלל|נפל|איבד|הודיע|דיווח|חתמ|רכש|מכר|השלימ)/
function companyCue(text, idx, name) {
  const pre = text.slice(Math.max(0, idx - 12), idx)
  const post = text.slice(idx + name.length, idx + name.length + 12)
  return CUE_BEFORE.test(pre) || CUE_AFTER.test(post) || (/['"]$/.test(pre) && /^['"]/.test(post))
}

// מזהה חברה מהכותרת: מחזיר { company_id, company_name } או ריק.
// דורש שם מוקף בגבול-מילה משני הצדדים. ארוך-קודם מצמצם התאמות-שווא.
// שם דו-משמעי (AMBIGUOUS) מותאם רק אם יש הקשר פיננסי, ואחרי סילוק צירופים כוזבים.
export function matchCompany(title, companies) {
  const hasFinContext = FIN_CONTEXT.test(title)
  let strippedCache = null // מחושב פעם אחת, רק אם נתקלים בשם דו-משמעי
  for (const c of companies) {
    if (STOP.has(c.name)) continue
    let haystack = title
    if (AMBIGUOUS.has(c.name)) {
      if (!hasFinContext) continue
      if (strippedCache === null) strippedCache = stripFalseColloc(title)
      haystack = strippedCache
    }
    if (hasWord(haystack, c.name)) return { company_id: c.id, company_name: c.name }
  }
  return { company_id: null, company_name: null }
}

// שם חברה סחירה שה-AI הכניס לתקציר אבל לא מופיע במקור — סימן להזיה, ופרסום
// כזה על חברה נסחרת הוא חשיפה ללשון הרע. המקרה שהוליד את הבדיקה: כתבה על רעידות
// אדמה סוכמה כ"החברה 'אדמה' עומדת בפני אתגר" (גלובס, 28.06.2026). צירופים כוזבים
// ("רעידת אדמה") מסולקים משני הצדדים, כך שגם מילה שמופיעה במקור רק כחלק מצירוף
// כזה לא נחשבת "מופיעה". במקור מתקבלות גם אותיות שימוש ("לרימון"). מחזיר את
// השם הראשון שהומצא, או null.
export function inventedCompany(text, source, companies) {
  const ai = stripFalseColloc(normQuotes(text))
  const src = stripFalseColloc(normQuotes(source))
  for (const c of companies) {
    if (STOP.has(c.name)) continue
    let hits = wordHits(ai, c.name)
    if (AMBIGUOUS.has(c.name)) hits = hits.filter((i) => companyCue(ai, i, c.name))
    if (hits.length && !wordHits(src, c.name, true).length) return c.name
  }
  return null
}

// מילת זמן יחסית ("היום", "מחר") שה-AI הכניס בלי שהמקור אומר זאת — המודל לא יודע
// מה התאריך, ו"מפרסמת דוחות ב-2 בנובמבר" הפך ל"צפויה לפרסם היום" (טאואר, 27.10.2026,
// שבוע לפני הדוח). המילה מושמטת ("פרסמה היום מצגת" → "פרסמה מצגת") ולא נפסל הכל:
// פסילה הייתה מחזירה את הפריט להשלמה שוב ושוב ושורפת מכסה. ביטויים שאינם ציון זמן
// ("סדר היום", "עד היום", "באותו היום", "היום הקובע", "מתחילת השבוע", "סיימו את
// השבוע") לא נוגעים — שם המילה היא חלק מהמשפט. "הערב" לא נבדק — בהקשר פיננסי הוא
// גם "הערב" לחוב. מחזיר { text, dropped }.
const REL_BEFORE = 'עד|סדר|באותו|לאותו|מאותו|מתחילת|בתחילת|בסוף|מסוף|לסוף|את'
const REL_HE = new RegExp(
  `(?<![א-ת])(?<!(?:${REL_BEFORE})\\s+)[וש]?(היום|מחר|אתמול|הבוקר|הלילה|השבוע)(?![א-ת])(?!\\s+הקובע)`,
  'g',
)
const REL_IDIOM = new RegExp(`(?:${REL_BEFORE})\\s+(?:היום|השבוע)|היום\\s+הקובע`, 'g')
const REL_SRC =
  /\b(?:today|tonight|tomorrow|yesterday|this (?:morning|evening|week))\b|(?<![א-ת])[וש]?(?:היום|מחר|אתמול|הערב|הבוקר|הלילה|השבוע)(?![א-ת])/i
export function dropRelativeTime(text, source) {
  if (!text || REL_SRC.test(source.replace(REL_IDIOM, ' '))) return { text, dropped: [] }
  const dropped = []
  const out = text
    .replace(REL_HE, (m, w) => (dropped.push(w), ''))
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()
  return { text: dropped.length ? out : text, dropped }
}

// ── סינון קליקבייט ──────────────────────────────────────────────────
// כותרת שמסתירה את העיקר (חידה, שאלה מתגרה, "לא תאמינו") פסולה — אלא אם
// התקציר מהמקור חושף את העובדות עצמן. מדיניות המוצר: עובדות, לא פיתיונות.
const TEASE =
  /לא תאמינו|לא יאומן|מה שקרה|זה מה ש|זו הסיבה|זאת הסיבה|נחשו|ניחשתם|לא ידעתם|שלא ידעתם|תופתעו|החידה|כך תגלו|גלו (איך|מי|מה|למה)|מה עומד מאחורי|הבשורה ש|בשורה משמחת|מוצר החובה|כל הפרטים|לחצו כאן|צפו:|התשובה בפנים|לא תנחשו|ולא ידעתם|זו ההצעה|ההטבה החדשה|מה זה אומר עליכם|המ(?:וצר|כשיר)[^,.:]{0,25}המבוקש/

// כותרת קליקבייט: מסתיימת בסימן שאלה או מכילה ניסוח-פיתיון.
export function isClickbait(title) {
  const t = (title || '').trim()
  return /\?\s*$/.test(t) || TEASE.test(t)
}

// התקציר "חושף" רק אם הוא ארוך מספיק לשאת עובדות וגם לא ממשיך את ההסתרה.
export function bodyReveals(body) {
  const b = (body || '').trim()
  return b.length >= 80 && !TEASE.test(b)
}

// מיפוי שם מקור → uuid ב-sources. יוצר את המקור אם אינו קיים (osint/media/מדווח),
// כך שמקור RSS חדש נכנס לבד בלי INSERT ידני.
async function getSourceId(name) {
  return getOrCreateSource(name, { type: 'osint', reliability: 'reported' })
}

// שואב פיד יחיד ומחזיר פריטים מנורמלים (כולל זיהוי חברה)
// פיד שמסמן אזור זמן לא אמין: אם הידיעה החדשה ביותר, כשקוראים את השעה כפשוטה,
// יוצאת "בעתיד" — הפיד בעצם משדר שעון ישראל עם סימון שגוי, ומתקנים. אחרת השעה
// אמינה כמות שהיא. מחושב מחדש בכל ריצה, כך שמקור שמשנה התנהגות מתוקן מעצמו
// (וואלה עבר משעון ישראל ל-GMT אמיתי בספטמבר 2026 והידיעות הוצגו 3 שעות אחורה).
function detectIsraelTz(items) {
  const newest = items.map((it) => new Date((it.pubDate || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()).getTime()).filter(Number.isFinite)
  if (!newest.length) return undefined
  return Math.max(...newest) > Date.now() + 2 * 60000 ? 'israel' : undefined
}

async function fetchFeed(feed, companies) {
  const r = await fetch(feed.url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml,application/xml,text/xml' },
  })
  if (!r.ok) {
    console.warn(`RSS ${feed.key}: HTTP ${r.status}`)
    return []
  }
  const xml = await r.text()
  const sourceId = await getSourceId(feed.source_name)
  const raw = parseFeed(xml).slice(0, PER_FEED) // RSS מגיע מהחדש לישן — לוקחים את הראש
  const tz = feed.tz === 'detect' ? detectIsraelTz(raw) : feed.tz
  return raw
    .filter((it) => it.title && it.link)
    .map((it) => {
      const { company_id, company_name } = matchCompany(it.title, companies)
      return {
        source_id: sourceId,
        company_id,
        company_name,
        maya_report_id: `${feed.key}:${it.guid}`, // מזהה ייחודי לכל מקור (משמש ל-upsert)
        title: it.title.slice(0, 500),
        // תקציר הפיד: fallback תצוגתי כשאין העשרת AI + קלט נוסף ל-AI (חושף את
        // החברה כשהכותרת קליקבייט). עובדות מהמקור עם קישור — שימוש RSS סטנדרטי.
        // פידים של WordPress (ערוץ 10) מדביקים זנב "The post … appeared first on …" — מסולק.
        body: (it.description || '')
          .replace(/The post[\s\S]*appeared first on[\s\S]*$/i, '')
          .trim()
          .slice(0, 1000),
        original_url: it.link,
        published_at: publishedAtFrom(it.pubDate, tz),
        source_type: 'osint',
        reliability: 'reported',
        lang: 'he',
        feed_sector: feed.sector ?? null, // תגית-ענף ברירת מחדל מהפיד (למקורות ענפיים)
      }
    })
}

// שואב את כל הפידים, מדלל כפילויות לפי maya_report_id
export async function fetchAllRss() {
  const companies = await loadCompanies()
  const byId = new Map()
  for (const feed of FEEDS) {
    try {
      for (const item of await fetchFeed(feed, companies)) byId.set(item.maya_report_id, item)
    } catch (e) {
      console.warn(`RSS ${feed.key} נכשל:`, e.message)
    }
  }
  return [...byId.values()]
}
