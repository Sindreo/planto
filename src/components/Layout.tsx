import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Household } from '../types/db'

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
      <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-lg">
              🌱
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

      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  )
}
