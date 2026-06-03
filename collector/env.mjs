// טעינת collector/.env (בלי תלות חיצונית)
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const env = {}
try {
  for (const line of readFileSync(resolve(__dir, '.env'), 'utf8').split('\n')) {
    if (line.trim().startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
} catch {
  /* אין .env — נשתמש במשתני סביבה */
}

export function getEnv(key) {
  return env[key] || process.env[key] || ''
}
