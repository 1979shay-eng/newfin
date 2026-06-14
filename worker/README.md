# newfin-collector-cron

Cloudflare Worker שמפעיל את הקולקטור כל 15 דקות בצורה אמינה, במקום המתזמן
הלא-אמין של GitHub Actions (שמפיל את רוב הריצות).

הוא שולח `workflow_dispatch` ל-`collect.yml` בריפו `1979shay-eng/newfin`.

## פריסה דרך ה-Dashboard (בלי CLI)

1. **GitHub PAT** — צור fine-grained token:
   - https://github.com/settings/personal-access-tokens/new
   - Repository access → Only select repositories → `newfin`
   - Permissions → Actions → **Read and write**
   - Expiration → 1 year (או No expiration)
   - העתק את הטוקן (מתחיל ב-`github_pat_...`)

2. **Cloudflare** — https://dash.cloudflare.com → Workers & Pages → Create → Worker:
   - שם: `newfin-collector-cron` → Deploy (קוד ברירת מחדל)
   - Edit code → הדבק את תוכן `collector-cron.js` → Deploy
   - Settings → Variables and Secrets → Add:
     - `GH_TOKEN` (Secret) = הטוקן מ-GitHub
     - `CRON_KEY` (Secret, אופציונלי) = מחרוזת אקראית להגנת ההפעלה הידנית
   - Settings → Triggers → Cron Triggers → Add → `*/15 * * * *`

## פריסה דרך CLI

```bash
cd worker
npx wrangler deploy
npx wrangler secret put GH_TOKEN
```

## בדיקה ידנית

פתח את כתובת ה-Worker בדפדפן (`https://newfin-collector-cron.<subdomain>.workers.dev`).
אם הוגדר `CRON_KEY` הוסף `?key=<CRON_KEY>`. תשובת `{"ok":true,"status":204}`
פירושה שההפעלה הצליחה — תוך דקה תופיע ריצת `dispatch` ב-GitHub Actions.
