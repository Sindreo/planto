import { Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { useAuth } from './context/AuthContext'
import { Spinner } from './components/ui'
import Layout from './components/Layout'
import MissingConfigPage from './pages/MissingConfigPage'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import PlantsPage from './pages/PlantsPage'

export default function App() {
  const { session, profile, loading } = useAuth()

  // 1) Frontend mangler Supabase-nøkler → vis oppsettsguide.
  if (!isSupabaseConfigured) return <MissingConfigPage />

  // 2) Laster session/profil.
  if (loading) {
    return (
      <div className="grid min-h-full place-items-center">
        <Spinner label="Laster Planto…" />
      </div>
    )
  }

  // 3) Ikke innlogget.
  if (!session) return <LoginPage />

  // 4) Innlogget, men ikke knyttet til en husstand ennå.
  if (!profile?.household_id) return <OnboardingPage />

  // 5) Klar – vis appen.
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PlantsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
