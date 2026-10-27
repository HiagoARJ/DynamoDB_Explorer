import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { ArrowDown, ArrowUp, CalendarClock, KeyRound } from 'lucide-react'
import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { avType } from '../../lib/convert'
import { avPreview, detectDate, formatBytes, formatDateTime, relativeTime } from '../../lib/format'
import type { Item } from '../../lib/types'
import { Checkbox } from '../ui/Form'

export interface SortState {
  col: string
  dir: 'asc' | 'desc'
}

function highlight(text: string, q: string): ReactNode {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="hl">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

function Cell({ av, q }: { av: AttributeValue | undefined; q: string }) {
  if (!av) return null
  const t = avType(av)
  switch (t) {
    case 'S': {
      const d = detectDate(av)
      return (
        <span className="flex min-w-0 items-center gap-1.5" title={d ? `${formatDateTime(d)} (${relativeTime(d)})` : av.S}>
          {d && <CalendarClock className="size-3.5 shrink-0 text-sky-500/80" />}
          <span className="truncate">{highlight(av.S!, q)}</span>
        </span>
      )
    }
    case 'N': {
      const d = detectDate(av)
      return (
        <span
          className="flex min-w-0 items-center gap-1.5 font-mono text-[12.5px] text-amber-700 tabular-nums dark:text-amber-300"
          title={d ? `${formatDateTime(d)} (${relativeTime(d)})` : av.N}
        >
          {d && <CalendarClock className="size-3.5 shrink-0 text-sky-500/80" />}
          <span className="truncate">{highlight(av.N!, q)}</span>
        </span>
      )
    }
    case 'BOOL':
      return (
        <span
          className={`inline-flex rounded-md px-1.5 py-px font-mono text-[11px] font-medium ${
            av.BOOL
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400'
          }`}
        >
          {String(av.BOOL)}
        </span>
      )
    case 'NULL':
      return <span className="font-mono text-xs text-zinc-400 italic">null</span>
    case 'B':
      return <span className="text-xs text-fuchsia-600 dark:text-fuchsia-300">Binário · {formatBytes(av.B!.length)}</span>
    default: {
      const count = t === 'M' ? Object.keys(av.M!).length : (av.L ?? av.SS ?? av.NS ?? av.BS ?? []).length
      const preview = avPreview(av, 300)
      return (
        <span className="flex min-w-0 items-center gap-1.5" title={preview}>
          <span
            className={`shrink-0 rounded px-1 font-mono text-[10px] font-semibold ${
              t === 'M' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300' : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
            }`}
          >
            {t === 'M' ? `{${count}}` : `${t === 'L' ? '' : t + ' '}[${count}]`}
          </span>
          <span className="truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{highlight(preview, q)}</span>
        </span>
      )
    }
  }
}

const CHECK_W = 40

export function ItemsGrid({
  items,
  columns,
  keyNames,
  widths,
  onResize,
  selected,
  rowId,
  onToggle,
  onToggleAll,
  onOpen,
  activeId,
  sort,
  onSort,
  density,
  search,
}: {
  items: Item[]
  columns: string[]
  keyNames: string[]
  widths: Record<string, number>
  onResize: (col: string, w: number) => void
  selected: Set<string>
  rowId: (it: Item) => string
  onToggle: (id: string) => void
  onToggleAll: (all: boolean) => void
  onOpen: (it: Item) => void
  activeId?: string
  sort: SortState | null
  onSort: (col: string) => void
  density: 'compact' | 'comfortable'
  search: string
}) {
  const drag = useRef<{ col: string; x: number; w: number } | null>(null)

  const startResize = useCallback(
    (e: ReactMouseEvent, col: string) => {
      e.preventDefault()
      e.stopPropagation()
      drag.current = { col, x: e.clientX, w: widths[col] ?? 180 }
      const move = (ev: MouseEvent) => {
        if (!drag.current) return
        onResize(drag.current.col, Math.max(70, Math.min(800, drag.current.w + ev.clientX - drag.current.x)))
      }
      const up = () => {
        drag.current = null
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', up)
        document.body.style.cursor = ''
      }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
      document.body.style.cursor = 'col-resize'
    },
    [widths, onResize],
  )

  const allSelected = items.length > 0 && items.every((i) => selected.has(rowId(i)))
  const someSelected = items.some((i) => selected.has(rowId(i)))
  const rowH = density === 'compact' ? 'h-8' : 'h-11'
  const pkCol = columns[0] && keyNames.includes(columns[0]) ? columns[0] : undefined
  const q = search.trim().toLowerCase()
  const totalWidth = CHECK_W + columns.reduce((s, c) => s + (widths[c] ?? 180), 0)

  return (
    <table className="table-fixed border-separate border-spacing-0 text-[13px]" style={{ width: totalWidth, minWidth: '100%' }}>
      <colgroup>
        <col style={{ width: CHECK_W }} />
        {columns.map((c) => (
          <col key={c} style={{ width: widths[c] ?? 180 }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className="sticky top-0 left-0 z-30 border-b border-zinc-200 bg-zinc-50 px-3 text-left dark:border-zinc-800 dark:bg-zinc-900">
            <Checkbox checked={allSelected} indeterminate={someSelected} onChange={onToggleAll} />
          </th>
          {columns.map((c) => {
            const isKey = keyNames.includes(c)
            const sorted = sort?.col === c ? sort.dir : null
            return (
              <th
                key={c}
                onClick={() => onSort(c)}
                className={`group/th sticky top-0 z-20 cursor-pointer border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-medium text-zinc-600 select-none hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 ${
                  c === pkCol ? 'left-10 z-30 shadow-[1px_0_0_var(--color-zinc-200)] dark:shadow-[1px_0_0_var(--color-zinc-800)]' : ''
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {isKey && <KeyRound className="size-3 shrink-0 text-amber-500" />}
                  <span className="truncate font-mono" title={c}>
                    {c}
                  </span>
                  {sorted === 'asc' && <ArrowUp className="size-3 shrink-0 text-indigo-500" />}
                  {sorted === 'desc' && <ArrowDown className="size-3 shrink-0 text-indigo-500" />}
                </span>
                <span
                  onMouseDown={(e) => startResize(e, c)}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-indigo-500/40 group-hover/th:bg-zinc-300/60 dark:group-hover/th:bg-zinc-700/60"
                />
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {items.map((it) => {
          const id = rowId(it)
          const isSel = selected.has(id)
          const isActive = id === activeId
          const bg = isActive
            ? 'bg-indigo-50 dark:bg-indigo-500/10'
            : isSel
              ? 'bg-indigo-50/60 dark:bg-indigo-500/[0.07]'
              : 'bg-white group-hover:bg-zinc-50 dark:bg-zinc-900/60 dark:group-hover:bg-zinc-800/60'
          // células sticky precisam de fundo opaco
          const stickyBg = isActive
            ? 'bg-indigo-50 dark:bg-[#1c1d33]'
            : isSel
              ? 'bg-[#f5f6ff] dark:bg-[#1a1b2b]'
              : 'bg-white group-hover:bg-zinc-50 dark:bg-zinc-900 dark:group-hover:bg-zinc-800'
          return (
            <tr key={id} className="group cursor-pointer" onClick={() => onOpen(it)}>
              <td
                className={`sticky left-0 z-10 border-b border-zinc-100 px-3 dark:border-zinc-800/70 ${rowH} ${stickyBg}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox checked={isSel} onChange={() => onToggle(id)} />
              </td>
              {columns.map((c) => (
                <td
                  key={c}
                  className={`overflow-hidden border-b border-zinc-100 px-3 whitespace-nowrap dark:border-zinc-800/70 ${rowH} ${
                    c === pkCol
                      ? `sticky left-10 z-10 font-medium shadow-[1px_0_0_var(--color-zinc-200)] dark:shadow-[1px_0_0_var(--color-zinc-800)] ${stickyBg}`
                      : bg
                  }`}
                >
                  <Cell av={it[c]} q={q} />
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
