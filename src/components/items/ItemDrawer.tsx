import { Check, ChevronDown, ChevronUp, Copy, CopyPlus, KeyRound, Lock, Pencil, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { itemToDdbJson, itemToPlain, orderItem, scalarString } from '../../lib/convert'
import { copyText, formatBytes } from '../../lib/format'
import type { Item } from '../../lib/types'
import { Button, IconButton } from '../ui/Button'
import { Drawer } from '../ui/Dialog'
import { Segmented } from '../ui/Misc'
import { ItemTree, JsonBlock } from './JsonView'

type View = 'tree' | 'json' | 'ddb'

export function ItemDrawer({
  item,
  keyNames,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onPrev,
  onNext,
  position,
  readOnly,
}: {
  item: Item | null
  keyNames: string[]
  onClose: () => void
  onEdit: (it: Item) => void
  onDuplicate: (it: Item) => void
  onDelete: (it: Item) => void
  onPrev?: () => void
  onNext?: () => void
  position?: string
  readOnly?: boolean
}) {
  const [view, setView] = useState<View>('tree')
  const [copied, setCopied] = useState(false)

  const ordered = useMemo(() => (item ? orderItem(item, keyNames) : null), [item, keyNames])
  const plain = useMemo(() => (ordered ? itemToPlain(ordered) : null), [ordered])
  const ddb = useMemo(() => (ordered ? itemToDdbJson(ordered) : null), [ordered])
  const size = useMemo(() => (ddb ? new Blob([JSON.stringify(ddb)]).size : 0), [ddb])

  if (!item) return null

  const copy = async () => {
    const text = JSON.stringify(view === 'ddb' ? ddb : plain, null, 2)
    if (await copyText(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
  }

  return (
    <Drawer open={!!item} onClose={onClose}>
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Item {position && <span className="tabular-nums">· {position}</span>}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {keyNames.map((k) => (
              <span
                key={k}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 font-mono text-xs text-amber-800 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20"
              >
                <KeyRound className="size-3 shrink-0" />
                <span className="opacity-70">{k}:</span>
                <span className="truncate">{scalarString(item[k])}</span>
              </span>
            ))}
          </div>
        </div>
        <IconButton icon={ChevronUp} label="Item anterior" onClick={onPrev} disabled={!onPrev} />
        <IconButton icon={ChevronDown} label="Próximo item" onClick={onNext} disabled={!onNext} />
        <IconButton icon={X} label="Fechar (Esc)" onClick={onClose} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <Segmented
          size="xs"
          value={view}
          onChange={setView}
          options={[
            { value: 'tree', label: 'Árvore' },
            { value: 'json', label: 'JSON' },
            { value: 'ddb', label: 'DynamoDB JSON' },
          ]}
        />
        <div className="flex-1" />
        <span className="text-xs text-zinc-400">
          {Object.keys(item).length} atributos · ~{formatBytes(size)}
        </span>
        <IconButton icon={copied ? Check : Copy} label="Copiar JSON" size="xs" onClick={copy} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {view === 'tree' ? (
          <ItemTree item={item} keyNames={keyNames} />
        ) : (
          <JsonBlock value={view === 'ddb' ? ddb : plain} className="px-1 py-1" />
        )}
      </div>

      {readOnly ? (
        <div className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <Lock className="size-3.5 text-amber-500" /> Conexão somente leitura — edição desativada.
        </div>
      ) : (
      <div className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Button variant="danger-ghost" size="sm" icon={Trash2} onClick={() => onDelete(item)}>
          Excluir
        </Button>
        <div className="flex-1" />
        <Button size="sm" icon={CopyPlus} onClick={() => onDuplicate(item)}>
          Duplicar
        </Button>
        <Button size="sm" variant="primary" icon={Pencil} onClick={() => onEdit(item)}>
          Editar
        </Button>
      </div>
      )}
    </Drawer>
  )
}
