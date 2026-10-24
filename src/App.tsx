import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Feed from './pages/Feed'
import Companies from './pages/Companies'
import Markets from './pages/Markets'
import Indicators from './pages/Indicators'
import CompanyProfile from './pages/CompanyProfile'
import About from './pages/About'
import Admin from './pages/Admin'
import NotFound from './pages/NotFound'
import { useEffect } from 'react'
import Landing from './pages/Landing'
import { useAuth } from './lib/useAuth'
import { trackPageView } from './lib/track'

// רושם צפייה בעמוד בכל שינוי נתיב (ממוזער — לא רושם אותו נתיב פעמיים ברצף).
function RouteTracker() {
  const { pathname } = useLocation()
  useEffect(() => {
    trackPageView(pathname)
  }, [pathname])
  return null
}

export default function App() {
  const { session, loading } = useAuth()

  // טעינת מצב הזיהוי — מסך פתיחה קצר כדי למנוע הבהוב בין נחיתה לאפליקציה
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand-light" />
      </div>
    )
  }

  // שער מלא: מי שלא מחובר תמיד רואה את דף הנחיתה. כדי להגיע לפיד חובה להתחבר.
  // בפיתוח מקומי (vite dev) השער פתוח — מאפשר בדיקות UI בלי OAuth. לא משפיע על פרודקשן.
  if (!session && !import.meta.env.DEV) {
    return <Landing />
  }

  return (
    <>
      <RouteTracker />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Feed />} />
          <Route path="markets" element={<Markets />} />
          <Route path="indicators" element={<Indicators />} />
          <Route path="companies" element={<Companies />} />
          <Route path="company/:slug" element={<CompanyProfile />} />
          <Route path="about" element={<About />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
