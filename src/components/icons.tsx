import type { ReactNode, SVGProps } from 'react'

/**
 * Planto-ikonsett – håndtegnede SVG-linjeikoner som matcher brandet.
 * Alle bruker `currentColor`, så fargen styres med tekstfarge-klasser og
 * størrelsen med høyde/bredde-klasser fra kallstedet. Ingen emojier i UI-et.
 */
type IconProps = SVGProps<SVGSVGElement>

/** Felles innpakning for linjeikoner (stroke, avrundede hjørner). */
function Line({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

/** Planto-merket: en spire med to blader – brukes som logo/badge. */
export function PlantoMark(props: IconProps) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 21v-7.5" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" />
      <path
        d="M12 14.5c0-3.6-2.7-6.2-6.4-6.2-.1 3.6 2.6 6.2 6.4 6.2Z"
        fill="currentColor"
      />
      <path
        d="M12 12.5c0-3.3 2.5-5.8 6-5.8.1 3.3-2.5 5.8-6 5.8Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Potteplante – plassholder der det ennå ikke finnes bilde. */
export function PlantMark(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 13.5V9" />
      <path d="M12 11.6C12 8.8 9.9 6.9 7 6.9c0 2.8 2.1 4.7 5 4.7Z" />
      <path d="M12 10.6c0-2.6 1.9-4.5 4.7-4.5 0 2.6-1.9 4.5-4.7 4.5Z" />
      <path d="M6.6 13.5h10.8l-1.1 6.1a1.5 1.5 0 0 1-1.5 1.2H9.2a1.5 1.5 0 0 1-1.5-1.2Z" />
    </Line>
  )
}

/** Vanndråpe – vanning. */
export function Drop(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 3.5S5.5 10.7 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10.7 12 3.5 12 3.5Z" />
    </Line>
  )
}

/** Blad – gjødsling / frisk plante. */
export function Leaf(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M4 20C4 11.7 9.7 5 20 5c0 9.3-6.7 15-16 15Z" />
      <path d="M4.5 19.5C8.5 15 12.5 11 18 8.5" />
    </Line>
  )
}

/** Notat / rediger. */
export function Note(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1 1-4Z" />
      <path d="m14.5 6.5 3 3" />
    </Line>
  )
}

/** Kalender – «I dag». */
export function Calendar(props: IconProps) {
  return (
    <Line {...props}>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M4 10h16M8 4v3M16 4v3" />
    </Line>
  )
}

/** Forstørrelsesglass med blad – «Sjekk en plante». */
export function Lens(props: IconProps) {
  return (
    <Line {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20.5 20.5-4-4" />
      <path d="M8.7 12.6C8.7 10 10.6 8.1 13.2 8.1c0 2.6-1.9 4.5-4.5 4.5Z" />
    </Line>
  )
}

/** Kamera – last opp bilde. */
export function Camera(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M4 8.5h3l1.5-2.2h7L18 8.5h2A1.5 1.5 0 0 1 21.5 10v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z" />
      <circle cx="12" cy="13.5" r="3.3" />
    </Line>
  )
}

/** Gnist – AI-handlinger. */
export function Sparkle(props: IconProps) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M11.5 2.5c.45 4.7 1.95 6.2 6.65 6.65-4.7.45-6.2 1.95-6.65 6.65-.45-4.7-1.95-6.2-6.65-6.65 4.7-.45 6.2-1.95 6.65-6.65Z" />
      <path d="M18 14.5c.25 2.25.95 2.95 3.2 3.2-2.25.25-2.95.95-3.2 3.2-.25-2.25-.95-2.95-3.2-3.2 2.25-.25 2.95-.95 3.2-3.2Z" />
    </svg>
  )
}

/** Hake – fullført. */
export function Check(props: IconProps) {
  return (
    <Line {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Line>
  )
}

/** Stedsnål – plassering. */
export function Pin(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </Line>
  )
}

/** Pil tilbake. */
export function ArrowLeft(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Line>
  )
}

/** Pluss – legg til. */
export function Plus(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 5v14M5 12h14" />
    </Line>
  )
}

/** Kryss – lukk. */
export function Close(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Line>
  )
}

/** Varseltrekant – «trenger hjelp». */
export function Alert(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 4 2.8 19.5h18.4Z" />
      <path d="M12 10v4M12 17h.01" />
    </Line>
  )
}
