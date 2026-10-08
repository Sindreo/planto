import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Alert, Button, Card, Input } from '../components/ui'
import { PlantoMark } from '../components/icons'

/** Vises når brukeren har åpnet «tilbakestill passord»-lenken fra e-posten. */
export default function ResetPasswordPage() {
  const { finishPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passordene er ikke like.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      // Brukeren er allerede innlogget via lenken – gå rett inn i appen.
      finishPasswordRecovery()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/password should be at least/i.test(msg)) setError('Passordet må være minst 6 tegn.')
      else if (/should be different/i.test(msg))
        setError('Det nye passordet må være forskjellig fra det gamle.')
      else setError(msg)
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
        <h1 className="text-2xl font-bold text-brand-800">Velg nytt passord</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nytt passord"
            type="password"
            placeholder="Minst 6 tegn"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <Input
            label="Gjenta passord"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />

          {error && <Alert tone="error">{error}</Alert>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Lagrer…' : 'Lagre nytt passord'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
