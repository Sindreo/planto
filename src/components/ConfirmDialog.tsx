import { Button } from './ui'

/**
 * Enkel, design-konsistent bekreftelsesdialog som erstatter nettleserens
 * `confirm()`. Vises som et ark nederst på mobil og sentrert på større skjerm.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Bekreft',
  cancelLabel = 'Avbryt',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {message && <p className="mt-1 text-sm text-gray-600">{message}</p>}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {confirmLabel}
          </button>
          <Button variant="ghost" onClick={onCancel} className="flex-1">
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
