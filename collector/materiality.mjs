// ציון מהותיות מבוסס-כללים (1-10) — שלב ביניים לפני מנוע ה-LLM ב-Phase 2.
// מבוסס על כותרת הדיווח + דגל ה-priority של מאיה.

const RULES = [
  // גבוה (8-10)
  { re: /דוח(?:ות)? כספי|דוח רבעוני|דוח שנתי|דוח תקופתי|דוח רווח/, w: 9, dir: 'neutral' },
  { re: /מיזוג|רכישה|השתלטות|הצעת רכש|מכירת פעילות/, w: 9, dir: 'bull' },
  { re: /אזהרת רווח|הרעה|חדלות פירעון|הקפאת הליכים/, w: 9, dir: 'bear' },
  { re: /גיוס|הנפק|הקצאת מניות|הצעת מדף|אגרות חוב|אג"ח/, w: 7, dir: 'neutral' },
  { re: /מנכ"ל|יו"ר|דירקטור|נושא משרה|מינוי|התפטרות|סיום כהונה/, w: 6, dir: 'neutral' },
  { re: /דיבידנד|חלוקה/, w: 6, dir: 'bull' },
  // בינוני (4-7)
  { re: /שינוי החזקות|בעל עניין|עסקה עם בעל שליטה/, w: 5, dir: 'neutral' },
  { re: /מצגת|שיחת ועידה|עדכון/, w: 4, dir: 'neutral' },
  // נמוך (1-3)
  { re: /כתובת|תקנון|נוסח|תיקון טעות|פרטים טכניים|זימון אסיפה/, w: 2, dir: 'neutral' },
]

export function scoreReport(item) {
  const text = item.title || ''
  let score = 4 // ברירת מחדל אם שום כלל לא נתפס
  let direction = 'neutral'
  for (const rule of RULES) {
    if (rule.re.test(text)) {
      score = rule.w
      direction = rule.dir
      break
    }
  }
  if (item.is_priority) score = Math.min(10, score + 1)
  return { materiality_score: score, direction }
}
