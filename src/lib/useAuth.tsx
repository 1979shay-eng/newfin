// קונטקסט זיהוי — עוטף את Supabase Auth (Google OAuth).
// בנוסף טוען את פרופיל המשתמש מטבלת users (tier + is_admin), רושם כניסה
// ומעדכן last_seen. מייל/סיסמה יתווספו בהמשך.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'
import { track } from './track'
import { mergeWatchOnLogin } from './watchlist'

export type Profile = {
  id: string
  email: string | null
  tier: 'free' | 'premium'
  is_admin: boolean
}

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  configured: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // מזהי משתמשים שכבר רשמנו להם כניסה בחיים של הטאב (מונע ספירת login כפולה ברענון)
  const loggedIn = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // רישום כניסה רק באירוע SIGNED_IN אמיתי (לא INITIAL_SESSION של רענון)
      if (event === 'SIGNED_IN' && s?.user && !loggedIn.current.has(s.user.id)) {
        loggedIn.current.add(s.user.id)
        void track('login')
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // טעינת הפרופיל + עדכון last_seen בכל פעם שמשתמש מתחבר
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) {
      setProfile(null)
      return
    }
    let alive = true
    supabase
      .from('users')
      .select('id, email, tier, is_admin')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setProfile(data as Profile)
      })
    // last_seen — סימון נוכחות, לא קריטי אם נכשל
    void supabase.from('users').update({ last_seen: new Date().toISOString() }).eq('id', uid)
    // מיזוג רשימת המעקב המקומית עם הענן (פעם אחת לכל כניסה)
    void mergeWatchOnLogin(uid)
    return () => {
      alive = false
    }
  }, [session?.user?.id])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isAdmin: profile?.is_admin ?? false,
        loading,
        configured: isSupabaseConfigured,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
