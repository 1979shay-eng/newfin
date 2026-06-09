import { useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const { signInWithGoogle, signInWithEmail, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Escape לסגירה + נעילת גלילת רקע
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    if (!configured) {
      setStatus('error')
      setErrorMsg('החיבור עדיין לא הוגדר (Supabase). נסה שוב מאוחר יותר.')
      return
    }
    setStatus('sending')
    const { error } = await signInWithEmail(email.trim())
    if (error) {
      setStatus('error')
      setErrorMsg(error)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="animate-fade-up w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="כניסה למערכת"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">כניסה ל-NewFin</h2>
            <p className="mt-1 text-sm text-slate-500">מודיעין שוק ההון — מזוקק לתובנה.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="-mt-1 -ml-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {status === 'sent' ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <div className="text-2xl">📨</div>
            <p className="mt-2 text-sm font-semibold text-emerald-800">קישור כניסה נשלח</p>
            <p className="mt-1 text-xs text-emerald-700">
              בדוק את תיבת המייל של <span className="font-medium">{email}</span> ולחץ על הקישור.
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={signInWithGoogle}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-[0.99]"
            >
              <GoogleIcon />
              המשך עם Google
            </button>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">או במייל</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={sendLink}>
              <label htmlFor="auth-email" className="mb-1.5 block text-xs font-medium text-slate-600">
                כתובת מייל
              </label>
              <input
                id="auth-email"
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-left text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              {status === 'error' && (
                <p className="mt-2 flex items-center gap-1 text-xs text-red-600">
                  <span>⚠️</span>
                  {errorMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={status === 'sending'}
                className="mt-3 h-11 w-full rounded-xl bg-brand text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.99] disabled:opacity-60"
              >
                {status === 'sending' ? 'שולח…' : 'שלח קישור כניסה'}
              </button>
            </form>
          </>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
          בהמשך אתה מאשר את תנאי השימוש ומדיניות הפרטיות.
          <br />
          חינם, בלי כרטיס אשראי.
        </p>
      </div>
    </div>
  )
}
