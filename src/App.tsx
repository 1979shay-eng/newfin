import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Feed from './pages/Feed'
import Companies from './pages/Companies'
import CompanyProfile from './pages/CompanyProfile'
import About from './pages/About'
import NotFound from './pages/NotFound'

export default function App() {
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
