# 📡 ה-API של מאיה — מה שגילינו (רֶקוֹן 02.06.2026)

> ידע מעשי על ה-API הציבורי של מאיה, לשימוש מנוע האיסוף.

## הגנה
מאיה מוגנת ב-**Imperva Incapsula** (עוגיות `visid_incap` / `incap_ses`).
בקשות HTTP פשוטות → **403**. הפתרון: **Playwright** (דפדפן אמיתי) טוען עמוד פעם אחת
ועובר את האתגר; אחר כך `context.request` עובד מול ה-API באותו context.

## בסיסים
- API: `https://maya.tase.co.il/api/v1`
- קבצים (PDF): `https://mayafiles.tase.co.il`

## Endpoints

| Endpoint | מה מחזיר |
|---|---|
| **`POST /api/v1/reports/breaking-announcement`** body `{pageNumber,limit,offset}` | ★ **הפיד הגלובלי** — דיווחים מכל החברות, מדפדף |
| `GET /api/v1/reports/breaking-announcement?limit=5` | ווידג'ט (מקס' 5) |
| `GET /api/v1/reports/{id}` | דיווח מלא |
| `GET /api/v1/reports/{id}/reduce` | `{title, companyName}` |
| `GET /api/v1/reports/{id}/siblings?offset=&limit=` (limit מקס' 30) | דיווחי **אותה חברה** |
| `GET /api/v1/tradingdata?securityId={id}` | מחיר, שינוי %, סימול, ISIN, סקטור (FININT) |
| `GET /api/v1/corporate-actions/upcoming?limit=` | קטליזטורים קרובים (לוח אירועים) |
| `GET /api/v1/reports/metadata/breaking-announcement` | מטא-דאטה (ספירה/דפדוף) |

## סכמת דיווח
```
id, title, publishDate, isPriority, formId, reportType,
companies: [{ companyId, name, mainSecurityId, ... }],
attachments: [{ fileType:"pdf1", fileName, url:"rpdf/.../P{id}-00.pdf" }]
```
- **deep-link ל-PDF:** `https://mayafiles.tase.co.il/{attachment.url}`
- `isPriority` = דגל עדיפות של מאיה (קלט לציון מהותיות)
- `formId` = קוד סוג טופס (למשל `ת022` = הצעת מדף)

## עמודים (SPA)
- `/he` — דף בית (קורא breaking-announcement?limit=5 + corporate-actions)
- `/he/reports` — דף ניווט קטגוריות
- `/he/reports/breaking-announcements` — **הפיד החי** (קורא ל-POST למעלה)
- `/he/reports/companies/{companyId}` — דף חברה
