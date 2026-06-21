import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { chatAboutPlant } from '../lib/ai'
import { translateError } from '../lib/errors'
import type { Plant, PlantChatMessage } from '../types/db'
import type { DiagnosisResult } from '../types/ai'
import { Sparkle } from './icons'

const SUGGESTIONS = [
  'Hvor viktig er det å følge vanneplanen?',
  'Hvor mye vann bør den ha hver gang?',
  'Hvordan vet jeg om den får for lite eller mye lys?',
]

/**
 * Chat om en konkret plante. Meldingene lagres i `plant_chat_messages` og deles
 * i husstanden. Svaret genereres av Edge-funksjonen plant-ai (Haiku) med
 * plantens stelldata som kontekst.
 */
export default function PlantChat({
  plant,
  speciesLatin,
  latestDiagnosis,
}: {
  plant: Plant
  speciesLatin: string | null
  latestDiagnosis: DiagnosisResult | null
}) {
  const { session } = useAuth()
  const [messages, setMessages] = useState<PlantChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('plant_chat_messages')
      .select('*')
      .eq('plant_id', plant.id)
      .order('created_at', { ascending: true })
    setMessages((data ?? []) as PlantChatMessage[])
  }, [plant.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, sending])

  function buildContext(): Record<string, unknown> {
    return {
      nickname: plant.nickname,
      species: plant.species,
      latin_name: speciesLatin,
      location: plant.location,
      light_needs: plant.light_needs,
      water_interval_days: plant.water_interval_days,
      fertilize_interval_days: plant.fertilize_interval_days,
      repot_interval_months: plant.repot_interval_months,
      toxic_to_pets: plant.toxic_to_pets,
      last_watered_at: plant.last_watered_at,
      next_water_due: plant.next_water_due,
      latest_diagnosis: latestDiagnosis
        ? `${latestDiagnosis.overall_health ?? 'ukjent'}${
            latestDiagnosis.likely_issues?.[0] ? ` – ${latestDiagnosis.likely_issues[0].issue}` : ''
          }`
        : null,
    }
  }

  async function sendMessage(text: string) {
    const message = text.trim()
    if (!message || sending) return
    setError(null)
    setSending(true)
    setInput('')
    // Vis brukerens melding umiddelbart (optimistisk).
    const optimistic: PlantChatMessage = {
      id: 'tmp',
      plant_id: plant.id,
      user_id: session?.user?.id ?? null,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    }
    setMessages((m) => [...m, optimistic])
    try {
      await chatAboutPlant(
        { plantId: plant.id, message, context: buildContext() },
        session?.access_token,
      )
      await load()
    } catch (err) {
      setError(translateError(err))
      setMessages((m) => m.filter((x) => x.id !== 'tmp'))
      setInput(message)
    } finally {
      setSending(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void sendMessage(input)
  }

  return (
    <section className="rounded-2xl border border-brand-100 bg-white p-4">
      <h2 className="flex items-center gap-2 font-semibold text-gray-900">
        <Sparkle className="h-4 w-4 text-brand-600" />
        Spør Planto
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Lurer du på noe om {plant.nickname}? Spør om vanning, lys, stell – Planto kjenner
        stelldataene til planten.
      </p>

      {messages.length > 0 && (
        <div
          ref={listRef}
          className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-xl bg-brand-50/40 p-3"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-brand-600 text-white'
                    : 'border border-brand-100 bg-white text-gray-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-brand-100 bg-white px-3 py-2 text-sm text-gray-500">
                Planto skriver…
              </div>
            </div>
          )}
        </div>
      )}

      {messages.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={sending}
              onClick={() => void sendMessage(s)}
              className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Skriv et spørsmål…"
          disabled={sending}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:opacity-50 sm:text-sm"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  )
}
