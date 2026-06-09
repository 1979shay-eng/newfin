import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Feed from './pages/Feed'
import Companies from './pages/Companies'
import CompanyProfile from './pages/CompanyProfile'
import About from './pages/About'
import NotFound from './pages/NotFound'
import { useState } from 'react'
import Landing from './pages/Landing'
import { useAuth } from './lib/useAuth'

export default function App() {
  const { session, loading } = useAuth()
  // מצב "אורח" — מאפשר לצפות באתר בלי כניסה (שלב טרום-השקה; נכבה כשמפעילים שער אמיתי).
  const [guest, setGuest] = useState(() => localStorage.getItem('nf_guest') === '1')

  // טעינת מצב הזיהוי — מסך פתיחה קצר כדי למנוע הבהוב בין נחיתה לאפליקציה
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand-light" />
      </div>
    )
  }

  // לא מזוהה ולא אורח → דף נחיתה. אחרת → האפליקציה.
  if (!session && !guest) {
    return (
      <Landing
        onGuest={() => {
          localStorage.setItem('nf_guest', '1')
          setGuest(true)
        }}
      />
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Feed />} />
        <Route path="companies" element={<Companies />} />
        <Route path="company/:slug" element={<CompanyProfile />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
