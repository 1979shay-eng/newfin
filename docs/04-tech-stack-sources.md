# 04 — Stack טכני ומקורות נתונים

> ה"איך" הטכני. עיקרון על: **חינמי ככל האפשר, אוטומציה מלאה, בר-סקייל.**

---

## 🧱 ה-Stack

| שכבה | טכנולוגיה | למה | עלות |
|---|---|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind RTL | כמו danino-app, מוכר | חינם |
| State | Zustand | קל, מוכר | חינם |
| Backend / DB | Supabase (Postgres) | DB + Auth + Functions בחבילה | חינם (Free tier) |
| Auth | Supabase Auth | Google/Microsoft/Apple/Email מובנה | חינם |
| Vectors | pgvector (ב-Supabase) | clustering / similarity | חינם |
| Collectors | Supabase Edge Functions / GitHub Actions | קרולרים מתוזמנים | חינם |
| Cron | Supabase cron / GitHub Actions | ריצה אוטומטית | חינם |
| Deploy | Netlify (אוטומטי מ-GitHub) | כמו danino-app | חינם |
| AI זול | **Groq** (Llama) | סיווג/תיוג/סינון בכמות | חינם |
| AI עמוק | **Claude** | סיכומים/זיקוק/שורה תחתונה | זול (~$0.25/1M) |
| Scraping | Playwright (לאתרים בלי API) | שכבה 4-5 | חינם |

**עקרון עלות AI:** סינון זול קודם (כללים → embeddings → Groq) → רק מה שעבר סף מגיע ל-Claude. אגרגציה לפי משתמש, לא לפי ידיעה (בריף = קריאה אחת/משתמש/יום).

---

## 📡 מקורות נתונים (לפי שכבות)

### שכבה 1 — מאיה 👑 (הלב)
- **API:** `mayaapi.tase.co.il` (ה-SPA של `maya.tase.co.il` פונה אליו)
- דיווחים מיידיים, דוחות, מצגות, הודעות מהותיות
- מבנה: `company` ID + `paper` (נייר) ID + קוד סוג אירוע + תאריך
- חינם, ציבורי, חוקי

### שכבה 2 — RSS חדשות
גלובס, כלכליסט, TheMarker, Ynet כלכלה, Reuters Business, Yahoo Finance, Investing — כולם RSS חינמי.

### שכבה 3 — נתוני שוק + גרפים (FININT)
| מקור | נתון | מגבלת חינם |
|---|---|---|
| **TASE API** | מחירים/נפחים ישראלי | חינם |
| **Finnhub** | חדשות + מניות גלובלי | 60/דקה |
| **FRED** (פד) | מאקרו, ריביות, CAPE | חינם מלא |
| **Alpha Vantage** | מכפילים, מניות | 25/יום |
| **Yahoo Finance** | מחירים, news (לא רשמי) | חינם |

### שכבה 4 — מחקר חופשי (OSINT)
דמודרן (בלוג + datasets), שילר (CAPE, ייל), בנק ישראל, IMF, SSRN, **SEC EDGAR** (דוחות + Form 4 לבעלי עניין).

### שכבה 5 — מקורות אנושיים (HUMINT)
אנליסטים, ערוצי טלגרם, X, LinkedIn — **עובדות בלבד**, זיקוק לזווית מקורית. הולכים למקור המקורי (לא למתווך).

---

## 🔐 Auth (כמו FocusFin, חינם דרך Supabase)

ספקי OAuth: **Google, Microsoft, Apple** + אימייל/סיסמה.
- Microsoft → אנשי מקצוע/ארגונים.
- Apple → תאימות עתידית לאפליקציה.

---

## 🤖 הצינור האוטומטי (Pipeline)

```
1. Collectors (מתוזמן)     → שואבים מ-sources → raw items
2. Dedup + Entity Tagging  → NER: חברה/נייר/תגיות
3. סינון רלוונטיות זול      → כללים/embeddings/Groq → זורקים רעש מתחת לסף
4. מנוע ציון מהותיות (LLM)  → 1-10 + כיוון + ניסוח עיתונאי + שורה תחתונה
5. הצלבת מקורות            → embeddings → clusters → רמת ביטחון
6. פרסום                   → status=published → פיד
7. מנועים מתוזמנים          → לוח אירועים / בעלי עניין / בריף יומי
8. Frontend                → פיד, דפי חברה (SEO ציבורי), מעקב (auth), בריף
```

---

## 💸 הכנה למונטיזציה (תשתית רדומה)

מהיום הראשון, כבוי:
- `users.tier` (free/premium)
- feature flags למה שנעול
- נקודות paywall בקוד (מתג, לא בנייה מחדש)
- עמוד `/subscribe` מוכן

**בונים את הצנרת, הברז סגור.**
