// הגדרת GitHub Actions secrets דרך ה-API (חד-פעמי).
// קורא token מ-git credential manager ואת הערכים מ-collector/.env — שום סוד לא מודפס.
// הרצה: node collector/set-secrets.mjs
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import sodium from 'libsodium-wrappers'

const REPO = '1979shay-eng/newfin'

// token מ-git credential manager
const cred = execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n\n' }).toString()
const token = cred.match(/^password=(.+)$/m)?.[1]
if (!token) throw new Error('לא נמצא token של GitHub')

// ערכי הסודות מ-.env
const __dir = dirname(fileURLToPath(import.meta.url))
const env = {}
for (const line of readFileSync(resolve(__dir, '.env'), 'utf8').split('\n')) {
  const [k, ...v] = line.split('=')
  if (k && v.length) env[k.trim()] = v.join('=').trim()
}

const api = (path, opts = {}) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...opts.headers,
    },
  })

await sodium.ready

// מפתח ציבורי של הריפו להצפנת sealed-box
const pkRes = await api('/actions/secrets/public-key')
if (!pkRes.ok) throw new Error(`public-key: ${pkRes.status} ${await pkRes.text()}`)
const { key, key_id } = await pkRes.json()
const pubKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)

for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'GROQ_API_KEY']) {
  const value = env[name]
  if (!value) {
    console.warn(`⚠️  ${name} חסר ב-.env — דולג`)
    continue
  }
  const encrypted = sodium.to_base64(
    sodium.crypto_box_seal(sodium.from_string(value), pubKey),
    sodium.base64_variants.ORIGINAL,
  )
  const res = await api(`/actions/secrets/${name}`, {
    method: 'PUT',
    body: JSON.stringify({ encrypted_value: encrypted, key_id }),
  })
  console.log(`${res.ok ? '✅' : '❌'} ${name} → ${res.status}`)
}
