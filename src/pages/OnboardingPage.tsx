import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Alert, Button, Card, Input } from '../components/ui'

type Mode = 'create' | 'join'

/**
 * Vises etter innlogging når brukeren ennå ikke tilhører en husstand.
 * Den første personen oppretter husstanden og får en invitasjonskode; den
 * andre personen blir med via koden. Slik deler begge samme planteregister.
 */
export default function OnboardingPage() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [mode, setMode] = useState<Mode>('create')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'create') {
        const { error } = await supabase.rpc('create_household', {
          p_name: householdName.trim() || 'Vår husstand',
        })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('join_household', {
          p_invite_code: inviteCode.trim().toUpperCase(),
        })
        if (error) throw error
      }
      await refreshProfile()
    } catch (err) {
      setError(translateError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-4">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-brand-800">Velkommen{profile?.display_name ? `, ${profile.display_name}` : ''}!</h1>
        <p className="text-sm text-gray-600">
          Sett opp husstanden din for å dele planter med samboeren din.
        </p>
      </div>

      <Card>
        <div className="mb-4 flex rounded-xl bg-brand-50 p-1 text-sm font-medium">
          <button
            className={`flex-1 rounded-lg py-2 ${mode === 'create' ? 'bg-white shadow-sm text-brand-800' : 'text-gray-500'}`}
            onClick={() => setMode('create')}
            type="button"
          >
            Opprett husstand
          </button>
          <button
            className={`flex-1 rounded-lg py-2 ${mode === 'join' ? 'bg-white shadow-sm text-brand-800' : 'text-gray-500'}`}
            onClick={() => setMode('join')}
            type="button"
          >
            Bli med
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' ? (
            <>
              <Input
                label="Navn på husstanden"
                placeholder="F.eks. Hjemme hos oss"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Du får en invitasjonskode etterpå som du deler med den andre i husstanden.
              </p>
            </>
          ) : (
            <>
              <Input
                label="Invitasjonskode"
                placeholder="F.eks. 7KQ2P4"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                autoCapitalize="characters"
              />
              <p className="text-xs text-gray-500">
                Be den som opprettet husstanden om koden (vises i appen under «Husstand»).
              </p>
            </>
          )}

          {error && <Alert tone="error">{error}</Alert>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Vent litt…' : mode === 'create' ? 'Opprett og fortsett' : 'Bli med i husstanden'}
          </Button>
        </form>
      </Card>

      <button
        onClick={() => signOut()}
        className="mt-6 text-center text-sm text-gray-500 hover:text-gray-700"
        type="button"
      >
        Logg ut
      </button>
    </div>
  )
}

function translateError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/invalid invite|not found|no rows/i.test(msg)) return 'Fant ingen husstand med denne koden. Sjekk at den er riktig.'
  if (/already/i.test(msg)) return 'Du er allerede med i en husstand.'
  return msg
}
