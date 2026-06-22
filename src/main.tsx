import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { ToastProvider } from './components/Toast.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { logError } from './lib/log.ts'
import './index.css'

// Fang feil som ellers bare ville havnet i konsollen.
window.addEventListener('error', (e) => void logError('window.error', e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => void logError('unhandledrejection', e.reason))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
