import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { ChevronRight, KeyRound } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { avType, bytesToBase64 } from '../../lib/convert'
import { detectDate, formatBytes, formatDateTime } from '../../lib/format'
import type { Item } from '../../lib/types'
import { TypeBadge } from '../ui/Misc'

const TOKEN_RE =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],])/g

/** Realce de sintaxe leve para JSON já formatado. */
export function highlightJson(src: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of src.matchAll(TOKEN_RE)) {
    const idx = m.index!
    if (idx > last) out.push(src.slice(last, idx))
    const tok = m[0]
    let cls = 'json-num'
    if (tok.startsWith('"')) cls = m[2] ? 'json-key' : 'json-str'
    else if (tok === 'true' || tok === 'false') cls = 'json-bool'
    else if (tok === 'null') cls = 'json-null'
    else if (/^[{}[\],]$/.test(tok)) cls = 'json-punc'
    out.push(
      <span key={i++} className={cls}>
        {tok}
      </span>,
    )
    last = idx + tok.length
  }
  if (last < src.length) out.push(src.slice(last))
  return out
}

export function JsonBlock({ value, className = '' }: { value: unknown; className?: string }) {
  const text = useMemo(() => JSON.stringify(value, null, 2), [value])
  const nodes = useMemo(() => highlightJson(text), [text])
  return (
    <pre className={`font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-all ${className}`}>{nodes}</pre>
  )
}

/* ---------------- Árvore de atributos ---------------- */

function scalarDisplay(av: AttributeValue): ReactNode {
  const t = avType(av)
  switch (t) {
    case 'S':
      return <span className="json-str break-all">"{av.S}"</span>
    case 'N':
      return <span className="json-num">{av.N}</span>
    case 'BOOL':
      return <span className="json-bool">{String(av.BOOL)}</span>
    case 'NULL':
      return <span className="json-null">null</span>
    case 'B':
      return (
        <span className="text-fuchsia-600 dark:text-fuchsia-300" title={bytesToBase64(av.B!)}>
          {formatBytes(av.B!.length)} · <span className="font-mono">{bytesToBase64(av.B!).slice(0, 40)}</span>
          {bytesToBase64(av.B!).length > 40 && '…'}
        </span>
      )
    default:
      return null
  }
}

function childrenOf(av: AttributeValue): [string, AttributeValue][] | null {
  switch (avType(av)) {
    case 'M':
      return Object.entries(av.M!).sort(([a], [b]) => a.localeCompare(b))
    case 'L':
      return av.L!.map((v, i) => [String(i), v])
    case 'SS':
      return av.SS!.map((v, i) => [String(i), { S: v }])
    case 'NS':
      return av.NS!.map((v, i) => [String(i), { N: v }])
    case 'BS':
      return av.BS!.map((v, i) => [String(i), { B: v }])
    default:
      return null
  }
}

function TreeNode({
  name,
  av,
  depth,
  isKey,
  isIndex,
}: {
  name: string
  av: AttributeValue
  depth: number
  isKey?: boolean
  isIndex?: boolean
}) {
  const kids = childrenOf(av)
  const [open, setOpen] = useState(depth < 1)
  const t = avType(av)
  const date = kids ? null : detectDate(av)
  const summary = kids ? (t === 'M' ? `{${kids.length}}` : `[${kids.length}]`) : null

  return (
    <div>
      <div
        className={`group flex min-h-7 items-start gap-1.5 rounded-md py-1 pr-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${kids ? 'cursor-pointer' : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => kids && setOpen((o) => !o)}
      >
        <span className="flex size-4 shrink-0 items-center justify-center pt-0.5">
          {kids && (
            <ChevronRight className={`size-3.5 text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`} />
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 pt-px">
          {isKey && <KeyRound className="size-3 text-amber-500" />}
          <span className={`font-mono text-[12.5px] ${isIndex ? 'text-zinc-400' : 'json-key'}`}>{name}</span>
        </span>
        <TypeBadge type={t} className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1 pt-px font-mono text-[12.5px]">
          {kids ? <span className="text-zinc-400">{summary}</span> : scalarDisplay(av)}
          {date && (
            <span className="ml-2 font-sans text-[11px] text-zinc-400" title={date.toISOString()}>
              {formatDateTime(date)}
            </span>
          )}
        </span>
      </div>
      {kids && open && (
        <div>
          {kids.length === 0 ? (
            <p className="py-1 text-xs text-zinc-400" style={{ paddingLeft: (depth + 1) * 16 + 24 }}>
              vazio
            </p>
          ) : (
            kids.map(([k, v]) => (
              <TreeNode key={k} name={k} av={v} depth={depth + 1} isIndex={t !== 'M'} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function ItemTree({ item, keyNames }: { item: Item; keyNames: string[] }) {
  const entries = useMemo(() => {
    const keys = keyNames.filter((k) => item[k]).map((k) => [k, item[k]] as const)
    const rest = Object.entries(item)
      .filter(([k]) => !keyNames.includes(k))
      .sort(([a], [b]) => a.localeCompare(b))
    return [...keys, ...rest]
  }, [item, keyNames])

  return (
    <div className="py-1">
      {entries.map(([k, v]) => (
        <TreeNode key={k} name={k} av={v} depth={0} isKey={keyNames.includes(k)} />
      ))}
    </div>
  )
}
