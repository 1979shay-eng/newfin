// ── Cloudflare Worker: מפעיל אמין לקולקטור ──────────────────────────
// מחליף את המתזמן הלא-אמין של GitHub Actions (שמפיל רוב הריצות).
// כל 15 דקות שולח workflow_dispatch ל-collect.yml — Cron Triggers של
// Cloudflare אמינים בהרבה ולא נדחים בשעות עומס כמו GitHub.
//
// סודות (Settings → Variables and Secrets):
//   GH_TOKEN  — GitHub fine-grained PAT, הרשאת Actions: Read and write על newfin
//   CRON_KEY  — (אופציונלי) מפתח להגנה על ההפעלה הידנית דרך הדפדפן
//
// Cron Trigger (Settings → Triggers):  */15 * * * *

const OWNER = '1979shay-eng'
const REPO = 'newfin'
const WORKFLOW = 'collect.yml'

async function dispatch(env) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'newfin-collector-cron',
      },
      body: JSON.stringify({ ref: 'main' }),
    },
  )
  // GitHub מחזיר 204 No Content בהצלחה
  if (!res.ok) {
    const body = await res.text()
    console.error(`dispatch failed: ${res.status} ${body}`)
    return { ok: false, status: res.status, body }
  }
  return { ok: true, status: res.status }
}

export default {
  // ── הפעלה אוטומטית כל 15 דקות ──
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatch(env))
  },

  // ── הפעלה ידנית לבדיקה: פתח את כתובת ה-Worker בדפדפן ──
  // אם הוגדר CRON_KEY — חובה ?key=<CRON_KEY>. אחרת פתוח (הקולקטור מוגן
  // ב-concurrency, אז הפעלה כפולה לא מזיקה).
  async fetch(request, env) {
    const url = new URL(request.url)
    if (env.CRON_KEY && url.searchParams.get('key') !== env.CRON_KEY) {
      return new Response('unauthorized', { status: 401 })
    }
    const r = await dispatch(env)
    return new Response(JSON.stringify(r, null, 2), {
      status: r.ok ? 200 : 502,
      headers: { 'content-type': 'application/json' },
    })
  },
}
