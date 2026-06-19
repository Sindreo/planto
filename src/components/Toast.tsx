import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * Lettvekts toast-system for kort tilbakemelding på handlinger («Vannet»,
 * «Lagret», «Slettet»), med valgfri handling (f.eks. «Angre»). Vises over
 * bunnmenyen og forsvinner av seg selv.
 */
type ToastAction = { label: string; onClick: () => void }

type ToastInput = {
  message: string
  action?: ToastAction
  tone?: 'success' | 'error'
  duration?: number
}

type ToastItem = ToastInput & { id: number; tone: 'success' | 'error' }

const ToastContext = createContext<(input: ToastInput) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++idRef.current
      const item: ToastItem = { ...input, id, tone: input.tone ?? 'success' }
      setToasts((ts) => [...ts, item])
      // Litt lengre levetid når det finnes en handling å rekke å trykke på.
      const duration = input.duration ?? (input.action ? 6000 : 3500)
      window.setTimeout(() => remove(id), duration)
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ${
              t.tone === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
            }`}
          >
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  remove(t.id)
                }}
                className="shrink-0 font-semibold text-brand-300 hover:text-brand-200"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
