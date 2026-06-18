import { Card } from '../components/ui'
import { PlantoMark } from '../components/icons'

/**
 * Vises hvis frontend mangler Supabase-nøkler. Gir konkrete steg slik at en
 * ikke-teknisk bruker kommer videre.
 */
export default function MissingConfigPage() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg items-center p-4">
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600">
            <PlantoMark className="h-5 w-5 text-white" />
          </span>
          <h1 className="text-xl font-bold text-brand-800">Planto er nesten klar</h1>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Appen mangler tilkobling til Supabase. Gjør dette én gang:
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>
            Kopier filen <code className="rounded bg-gray-100 px-1">.env.example</code> til{' '}
            <code className="rounded bg-gray-100 px-1">.env.local</code>.
          </li>
          <li>
            Lim inn <strong>Project URL</strong> og <strong>anon public key</strong> fra
            Supabase (Project Settings → API).
          </li>
          <li>
            Start utviklingsserveren på nytt:{' '}
            <code className="rounded bg-gray-100 px-1">npm run dev</code>.
          </li>
        </ol>
        <p className="mt-4 text-xs text-gray-500">
          Full steg-for-steg-guide ligger i <code>README.md</code>.
        </p>
      </Card>
    </div>
  )
}
