# מפעיל את ה-workflow "איסוף נתונים ממאיה" דרך GitHub API (workflow_dispatch).
# רץ מ-Windows Task Scheduler כל 15 דקות — גיבוי ל-scheduler של GitHub שדוחה
# ריצות מתוזמנות בשעות. אין כאן סודות: ה-token נקרא מ-git credential manager.
$ErrorActionPreference = 'Stop'

$cred = "protocol=https`nhost=github.com`n`n" | git credential fill
$token = ($cred | Select-String '^password=(.+)$').Matches[0].Groups[1].Value
if (-not $token) { exit 1 }

Invoke-RestMethod -Method Post `
  -Uri 'https://api.github.com/repos/1979shay-eng/newfin/actions/workflows/collect.yml/dispatches' `
  -Headers @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'newfin-trigger' } `
  -Body '{"ref":"main"}' -ContentType 'application/json'
