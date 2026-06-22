import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logError } from '../lib/log'

/**
 * Fanger render-feil så en enkelt ødelagt komponent ikke gir helhvit skjerm.
 * Viser en vennlig fallback og logger feilen til error_logs.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void logError('react-render', error)
    console.error(info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="grid min-h-[60vh] place-items-center p-6 text-center">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Noe gikk galt</h1>
          <p className="mt-1 text-sm text-gray-500">Prøv å laste appen på nytt.</p>
          <button
            onClick={() => location.reload()}
            className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            type="button"
          >
            Last på nytt
          </button>
        </div>
      </div>
    )
  }
}
