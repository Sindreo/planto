import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Profile } from '../types/db'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  /** True mens vi laster session/profil ved oppstart. */
  loading: boolean
  /** True når brukeren kom inn via en «tilbakestill passord»-lenke. */
  passwordRecovery: boolean
  finishPasswordRecovery: () => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

// Supabase fjerner token-fragmentet fra URL-en etter innlesing, så vi sjekker
// det synkront ved modul-lasting – før klienten rekker å rydde.
const openedFromRecoveryLink =
  typeof window !== 'undefined' &&
  /type=recovery/.test(window.location.hash + window.location.search)

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(openedFromRecoveryLink)

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('Klarte ikke å hente profil:', error.message)
      setProfile(null)
      return
    }
    setProfile(data)
  }

  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    // Hent eksisterende session ved oppstart.
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      // Utløpt/ugyldig lenke gir ingen session – da er det ingen gjenoppretting.
      else setPasswordRecovery(false)
      setLoading(false)
    })

    // Lytt på innlogging/utlogging.
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setSession(newSession)
      if (newSession?.user) {
        await loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setPasswordRecovery(false)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        passwordRecovery,
        finishPasswordRecovery: () => setPasswordRecovery(false),
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth må brukes innenfor <AuthProvider>')
  return ctx
}
