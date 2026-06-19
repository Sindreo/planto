import { useEffect } from 'react'

/**
 * Henter data på nytt når appen får fokus igjen (vindusfokus eller fane blir
 * synlig). Gir en «live»-følelse i en delt husstand: vanner samboeren en
 * plante, ser du det neste gang du åpner appen – uten manuell oppdatering.
 *
 * `refetch` bør være stabil (f.eks. fra useCallback) for å unngå unødige
 * av-/påkoblinger av lytterne.
 */
export function useRefetchOnFocus(refetch: () => void) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    window.addEventListener('focus', handler)
    document.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('focus', handler)
      document.removeEventListener('visibilitychange', handler)
    }
  }, [refetch])
}
