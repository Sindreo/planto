import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Household } from '../types/db'
import { Calendar, Lens, PlantMark, PlantoMark } from './icons'

/**
 * App-skall for innloggede brukere: topplinje med husstandsinfo,
 * invitasjonskode og utlogging.
 */
export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const [household, setHousehold] = useState<Household | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!profile?.household_id) return
    supabase
      .from('households')
      .select('*')
      .eq('id', profile.household_id)
      .maybeSingle()
      .then(({ data }) => setHousehold(data))
  }, [profile?.household_id])

  async function copyCode() {
    if (!household) return
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-full">
      <header
        className="sticky top-0 z-10 border-b border-brand-100 bg-white/90 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600">
              <PlantoMark className="h-5 w-5 text-white" />
            </span>
            <div className="leading-tight">
              <p className="font-bold text-brand-800">Planto</p>
              {household && (
                <p className="text-xs text-gray-500">{household.name}</p>
              )}
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800"
              aria-label="Meny"
              type="button"
            >
              {(profile?.display_name ?? '?').charAt(0).toUpperCase()}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-brand-100 bg-white p-4 shadow-lg">
                <p className="text-sm font-semibold text-gray-800">
                  {profile?.display_name ?? 'Bruker'}
                </p>
                {household && (
                  <div className="mt-3 rounded-xl bg-brand-50 p-3">
                    <p className="text-xs text-gray-500">Invitasjonskode</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <code className="text-lg font-bold tracking-widest text-brand-800">
                        {household.invite_code}
                      </code>
                      <button
                        onClick={copyCode}
                        className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-semibold text-white"
                        type="button"
                      >
                        {copied ? 'Kopiert!' : 'Kopier'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Del denne med samboeren din så dere deler de samme plantene.
                    </p>
                  </div>
                )}
                <button
                  onClick={() => signOut()}
                  className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  type="button"
                >
                  Logg ut
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <OfflineBanner />

      <main
        className="mx-auto max-w-2xl px-4 py-6"
        style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>

      {/* Bunn-navigasjon (mobil-først) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t border-brand-100 bg-white/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-2xl">
          <NavTab to="/" label="I dag" icon={<Calendar className="h-6 w-6" />} />
          <NavTab to="/diagnose" label="Sjekk" icon={<Lens className="h-6 w-6" />} />
          <NavTab to="/planter" label="Planter" icon={<PlantMark className="h-6 w-6" />} />
        </div>
      </nav>
    </div>
  )
}

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-800">
      Du er offline – viser sist lagrede data. Endringer krever nett.
    </div>
  )
}

function NavTab({ to, label, icon }: { to: string; label: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium ${
          isActive ? 'text-brand-700' : 'text-gray-400'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}
