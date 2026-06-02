# 🏗️ BLUEPRINT — תוכנית בנייה טכנית: The Crawler

> מסמך הבנייה המלווה את כל הפיתוח. נגזר מ-CLAUDE.md + docs/. עדכן תוך כדי בנייה.
> **סטטוס:** טיוטה לאישור. טרם נכתב קוד.

---

## 1. ארכיטקטורה כללית

```
                    ┌─────────────────────────────────────────┐
   מקורות           │            הצינור (Pipeline)              │      תצוגה
 ┌─────────┐        │  ┌────────┐  ┌────────┐  ┌─────────────┐ │   ┌──────────┐
 │ מאיה    │───────▶│  │ איסוף  │─▶│ תיוג + │─▶│ ציון מהותיות│ │──▶│ פיד      │
 │ RSS     │───────▶│  │collect │  │ סינון  │  │ + ניסוח LLM │ │   │ דפי חברה │
 │ נתוני   │───────▶│  └────────┘  └────────┘  └─────────────┘ │   │ (SEO)    │
 │ שוק     │        │       │           │             │        │   │ מעקב     │
 │ מחקר    │───────▶│       ▼           ▼             ▼        │   │ בריף     │
 │ אנושי   │───────▶│   ┌──────────────────────────────────┐  │   └──────────┘
 └─────────┘        │   │     Supabase (Postgres+pgvector)  │  │        ▲
                    │   └──────────────────────────────────┘  │        │
                    └──────────────────┬──────────────────────┘        │
                                       └───────────── React + Netlify ──┘
```

**עיקרון:** כל שכבה עומדת בפני עצמה. עולים לאוויר מוקדם עם הליבה, מוסיפים שכבה-שכבה בלי לשבור.

---

## 2. מודל נתונים (סכמת Postgres)

### ישויות ליבה
```sql
sources          -- מקורות
  id, name, type('osint'|'humint'|'finint'), subtype,
  reliability_default, base_url, is_active

companies        -- חברות
  id, maya_company_id, name_he, name_en, sector, is_active

securities       -- ניירות ערך (paper)
  id, maya_paper_id, company_id→companies, symbol, name

items            -- ★ יחידת הליבה של הפיד
  id, source_id→sources, company_id→companies (nullable),
  security_id→securities (nullable),
  title, body, original_url,           -- deep-link מדויק
  published_at, source_type, reliability('verified'|'reported'|'estimate'),
  materiality_score (1-10), direction('bull'|'bear'|'neutral'),
  bottom_line,                          -- "השורה התחתונה"
  status('draft'|'published'), is_public (bool, ל-SEO), lang,
  cluster_id (nullable), embedding vector(1536), created_at

tags             -- תגיות
  id, name_he, name_en, type('sector'|'topic'|'company')
item_tags        -- N:N
  item_id→items, tag_id→tags
```

### מנועי ניתוח (טבלאות נלוות)
```sql
clusters         -- הצלבת מקורות / רצפי דיווחים
  id, headline, company_id, confidence, first_seen, last_seen

events           -- לוח אירועים (HORIZON)
  id, company_id, type('earnings'|'dividend'|'meeting'|'lockup'|'macro'),
  title, event_date, source_id

insider_moves    -- מעקב בעלי עניין (TRACE)
  id, company_id, actor, role, action('buy'|'sell'),
  quantity, value, reported_at, source

prices           -- FININT (לגרפים אוטומטיים)
  security_id, date, open, high, low, close, volume
anomalies        -- אנומליות נפח/מחיר
  id, security_id, date, type, magnitude, note
```

### משתמשים ומונטיזציה
```sql
users            -- מקושר ל-Supabase Auth
  id, email, tier('free'|'premium'), created_at
watchlist
  user_id→users, company_id (nullable), tag_id (nullable)
briefs           -- בריף יומי (DISPATCH)
  id, user_id, date, content, channel('web'|'telegram'|'email'), sent_at
feature_flags    -- שליטה במונטיזציה רדומה
  key, enabled, premium_only
```

---

## 3. הצינור (Pipeline) — צעד-אחר-צעד

| # | שלב | טכנולוגיה | עלות |
|---|---|---|---|
| 1 | **איסוף** — collectors מתוזמנים פר-מקור | Edge Functions / GitHub Actions | חינם |
| 2 | **Dedup + תיוג ישויות** (NER → חברה/נייר/תגיות) | Groq / regex+מילון | זול |
| 3 | **סינון רלוונטיות** — זורק רעש מתחת לסף | כללים → embeddings → Groq | זול |
| 4 | **ציון מהותיות + ניסוח** — 1-10, כיוון, כותרת+גוף+שורה תחתונה | Claude (batched) | אגורות |
| 5 | **הצלבת מקורות** — embeddings → clusters → confidence | pgvector | כמעט חינם |
| 6 | **פרסום** — status=published, is_public לפי מהותיות | DB | — |
| 7 | **מנועים מתוזמנים** — לוח אירועים / בעלי עניין / בריף | Cron | זול |

**מפתח עלות:** סינון מדורג (זול→יקר). רק ~10-20% מהפריטים מגיעים ל-Claude.

---

## 4. עץ העמודים (Routing)

**ציבורי (SEO, בלי הרשמה):**
- `/` — דשבורד/פיד ראשי (טעימה)
- `/company/:slug` — דף חברה (★ עמוד נחיתה SEO)
- `/companies` — ספריית חברות
- `/tags` + `/tag/:slug` — ספריית תגיות
- `/item/:id` — דיווח בודד (+ "דומים" בהקשר)
- `/about` `/how-it-works` `/editorial-policy` `/faq`

**מאחורי הרשמה:**
- פיד מלא + פילטרים מתקדמים
- `/watchlist` — מעקב אישי
- `/brief` — בריף יומי
- מנועי פרימיום (מעקב בעלי עניין, לוח אירועים מלא)

**רדום:** `/subscribe`

---

## 5. סדר המימוש (Phases)

| Phase | מה | תוצר |
|---|---|---|
| **0** | Scaffold: React+Vite+Tailwind RTL, Supabase, Netlify, git, Auth, schema | שלד חי + התחברות |
| **1** 👑 | **מאיה collector** → items → פיד בסיסי | תוכן אמיתי זורם |
| **2** 🎯 | **מנוע ציון מהותיות** — ניסוח עיתונאי + 1-10 + שורה תחתונה | הבידול המרכזי |
| **3** | דפי חברה (ציבורי/SEO) + מעקב אישי (auth) | SEO + התאמה |
| **4** | מקורות RSS + תגיות + פילטרים + פאנל מקורות | רוחב תוכן |
| **5** | FININT: מחירים → גרפים אוטומטיים + סטטיסטיקה פר-חברה | גרפים |
| **6** | הצלבת מקורות (clustering) + לוח אירועים + בעלי עניין | מנועים מתקדמים |
| **7** | בריף יומי (Telegram/מייל) | פיצ'ר דביק |
| **8** | הפעלת מונטיזציה (subscribe + paywall flip) | הכנסה |

**עולים לאוויר אחרי Phase 2-3** (פיד איכותי + דפי חברה) → פידבק → ממשיכים על בסיס חי.

---

## 6. עקרונות בנייה

- **חוקי תמיד:** עובדות + ניסוח מקורי + קישור. אפס העתקה. (ראה `docs/01`.)
- **חינם קודם:** כל שירות בחבילת free; משלמים רק כשהסקייל מצדיק.
- **מונטיזציה רדומה:** הצנרת מההתחלה, הברז בסוף.
- **SEO מובנה:** דפי חברה/תגית ציבוריים, SSR/meta tags, sitemap.
- **RTL + i18n-ready:** מבנה מוכן לאנגלית.
- **תיעוד חי:** מעדכנים CLAUDE.md + BLUEPRINT בכל אבן דרך.

---

## 7. החלטות שנסגרו (מוכן ל-Phase 0)

- **שם עבודה:** NewFin · **דומיין מתוכנן:** newfin.il · **אירוח:** נטליפיי (אפשר לחבר ‎.il בהמשך)
- **מודל הנתונים:** אושר
- **נקודת התחלה ב-Phase 1:** שואבים את **כל** דיווחי מאיה, ומנוע ציון המהותיות מסדר מה חשוב ומה רעש — אין צורך לבחור סוגים מראש

הכל פתור → מוכן להקמת השלד באישור המשתמש.

---

*נגזר מריאיון החזון + רֶקוֹן FocusFin (02.06.2026).*
