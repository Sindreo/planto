import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost'
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed'
  const styles =
    variant === 'primary'
      ? 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800'
      : 'bg-transparent text-brand-700 hover:bg-brand-100'
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Input({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </span>
      )}
      <input
        className={`w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 sm:text-sm ${className}`}
        {...props}
      />
    </label>
  )
}

export function Textarea({
  label,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      )}
      <textarea
        className={`w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 sm:text-sm ${className}`}
        {...props}
      />
    </label>
  )
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-200"
      />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-brand-100 bg-white p-6 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-brand-700">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      {label && <span className="text-sm text-gray-600">{label}</span>}
    </div>
  )
}

/** Pulserende plassholder for lasteoppsett (skeleton). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-brand-100/70 ${className}`} />
}

export function Alert({
  children,
  tone = 'error',
}: {
  children: ReactNode
  tone?: 'error' | 'info'
}) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-brand-200 bg-brand-50 text-brand-800'
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm ${styles}`}>{children}</div>
  )
}
