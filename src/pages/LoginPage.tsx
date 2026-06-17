import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Alert, Button, Card, Input } from '../components/ui'
import { PlantoMark } from '../components/icons'

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() } },
        })
        if (error) throw error
        setInfo(
          'Nesten i mål! Vi har sendt deg en bekreftelses-e-post. ' +
            'Klikk lenken i den for å aktivere kontoen, så kan du logge inn.',
        )
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // Videre navigering håndteres av AuthProvider + App.
      }
    } catch (err) {
      setError(translateAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-brand-600">
          <PlantoMark className="h-9 w-9 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-brand-800">Planto</h1>
        <p className="text-sm text-gray-600">
          Friske stueplanter – sammen, uten å glemme vanningen.
        </p>
      </div>

      <Card>
        <div className="mb-4 flex rounded-xl bg-brand-50 p-1 text-sm font-medium">
          <button
            className={`flex-1 rounded-lg py-2 ${mode === 'signin' ? 'bg-white shadow-sm text-brand-800' : 'text-gray-500'}`}
            onClick={() => setMode('signin')}
            type="button"
          >
            Logg inn
          </button>
          <button
            className={`flex-1 rounded-lg py-2 ${mode === 'signup' ? 'bg-white shadow-sm text-brand-800' : 'text-gray-500'}`}
            onClick={() => setMode('signup')}
            type="button"
          >
            Ny konto
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <Input
              label="Visningsnavn"
              placeholder="F.eks. Sindre"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />
          )}
          <Input
            label="E-post"
            type="email"
            placeholder="deg@eksempel.no"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Passord"
            type="password"
            placeholder="Minst 6 tegn"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          {error && <Alert tone="error">{error}</Alert>}
          {info && <Alert tone="info">{info}</Alert>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Vent litt…' : mode === 'signin' ? 'Logg inn' : 'Opprett konto'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

function translateAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/invalid login credentials/i.test(msg)) return 'Feil e-post eller passord.'
  if (/user already registered/i.test(msg)) return 'Det finnes allerede en konto med denne e-posten.'
  if (/password should be at least/i.test(msg)) return 'Passordet må være minst 6 tegn.'
  if (/email not confirmed/i.test(msg)) return 'Bekreft e-posten din før du logger inn.'
  return msg
}
