import { Fragment, type ReactNode } from 'react'

/**
 * Bittleliten, trygg markdown-renderer for chat-svar. Støtter det Planto faktisk
 * bruker: avsnitt, linjeskift, punkt-/nummerlister og inline **fet**, *kursiv*
 * og `kode`. Ingen rå HTML settes inn (ingen XSS-risiko) – alt bygges som React-
 * noder. Ufullstendig markdown (f.eks. en uavsluttet ** mens svaret strømmer)
 * vises bare som vanlig tekst til den lukkes.
 */
export default function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <Block key={i} text={block} />
      ))}
    </div>
  )
}

function Block({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return null

  // Punktliste: alle linjer starter med -, * eller •
  if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
    return (
      <ul className="list-disc space-y-0.5 pl-5">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.replace(/^\s*[-*•]\s+/, ''))}</li>
        ))}
      </ul>
    )
  }

  // Nummerert liste: alle linjer starter med «1. »
  if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
    return (
      <ol className="list-decimal space-y-0.5 pl-5">
        {lines.map((l, i) => (
          <li key={i}>{renderInline(l.replace(/^\s*\d+\.\s+/, ''))}</li>
        ))}
      </ol>
    )
  }

  // Avsnitt: behold enkle linjeskift som <br/>.
  const parts = text.split('\n')
  return (
    <p>
      {parts.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {renderInline(line)}
        </Fragment>
      ))}
    </p>
  )
}

/** Inline-formatering: **fet**, *kursiv* / _kursiv_, `kode`. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[2] !== undefined) nodes.push(<strong key={key++}>{m[2]}</strong>)
    else if (m[3] !== undefined) nodes.push(<em key={key++}>{m[3]}</em>)
    else if (m[4] !== undefined) nodes.push(<em key={key++}>{m[4]}</em>)
    else if (m[5] !== undefined)
      nodes.push(
        <code key={key++} className="rounded bg-brand-100/70 px-1 py-0.5 text-[0.85em]">
          {m[5]}
        </code>,
      )
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}
