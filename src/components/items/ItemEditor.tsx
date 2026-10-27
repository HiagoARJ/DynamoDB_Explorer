import type { TableDescription } from '@aws-sdk/client-dynamodb'
import { CircleAlert, CircleCheck, CopyPlus, FilePlus2, Pencil, Save, WandSparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { describeError, keySchemaOf, putItem } from '../../lib/api'
import { avEquals, avType, itemFromDdbJson, itemFromPlain, itemToDdbJson, itemToPlain, orderItem } from '../../lib/convert'
import { formatBytes } from '../../lib/format'
import type { Item } from '../../lib/types'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Segmented } from '../ui/Misc'

export type EditorMode = 'create' | 'edit' | 'duplicate'
type Format = 'plain' | 'ddb'

function serialize(item: Item, format: Format, keyNames: string[]): string {
  const ordered = orderItem(item, keyNames)
  return JSON.stringify(format === 'plain' ? itemToPlain(ordered) : itemToDdbJson(ordered), null, 2)
}

function templateFor(table: TableDescription): Item {
  const keys = keySchemaOf(table)
  const out: Item = {}
  if (keys) {
    for (const k of [keys.pk, keys.sk]) {
      if (!k) continue
      out[k.name] = k.type === 'N' ? { N: '0' } : k.type === 'B' ? { B: new Uint8Array() } : { S: '' }
    }
  }
  return out
}

export function ItemEditor({
  open,
  mode,
  table,
  original,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: EditorMode
  table: TableDescription
  original?: Item
  onClose: () => void
  onSaved: (item: Item, mode: EditorMode) => void
}) {
  const { client } = useSettings()
  const keys = keySchemaOf(table)
  const keyNames = keys ? [keys.pk.name, ...(keys.sk ? [keys.sk.name] : [])] : []
  const [format, setFormat] = useState<Format>('plain')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setFormat('plain')
    setText(serialize(original ?? templateFor(table), 'plain', keyNames))
    setSaveError(null)
    setTimeout(() => taRef.current?.focus(), 50)
  }, [open, original, table])

  const parse = (src: string, fmt: Format): Item => {
    const json = JSON.parse(src)
    return fmt === 'plain' ? itemFromPlain(json, original) : itemFromDdbJson(json)
  }

  const result = useMemo((): { item?: Item; error?: string } => {
    if (!open) return {}
    let item: Item
    try {
      item = parse(text, format)
    } catch (e) {
      return { error: e instanceof SyntaxError ? `JSON inválido: ${e.message}` : (e as Error).message }
    }
    if (!keys) return { item }
    for (const k of [keys.pk, keys.sk]) {
      if (!k) continue
      const v = item[k.name]
      if (!v) return { error: `O atributo de chave "${k.name}" é obrigatório.` }
      if (avType(v) !== k.type) return { error: `A chave "${k.name}" deve ser do tipo ${k.type} (recebido ${avType(v)}).` }
      if (k.type === 'S' && v.S === '') return { error: `A chave "${k.name}" não pode ser vazia.` }
    }
    if (mode === 'edit' && original) {
      const changed = [keys.pk, keys.sk].some((k) => k && !avEquals(item[k.name], original[k.name]))
      if (changed)
        return { error: 'A chave primária não pode ser alterada na edição. Use “Duplicar” para criar um item com outra chave.' }
    }
    return { item }
  }, [text, format, keys, mode, original, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const size = useMemo(() => (result.item ? new Blob([JSON.stringify(itemToDdbJson(result.item))]).size : 0), [result.item])

  const switchFormat = (next: Format) => {
    if (next === format) return
    try {
      setText(serialize(parse(text, format), next, keyNames))
      setFormat(next)
    } catch {
      setFormat(next) // mantém o texto; o usuário verá o erro de validação
    }
  }

  const prettify = () => {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2))
    } catch {
      /* já sinalizado */
    }
  }

  const save = async () => {
    if (!result.item || busy) return
    setBusy(true)
    setSaveError(null)
    try {
      await putItem(client, table.TableName!, result.item, mode === 'edit' ? {} : { mustNotExist: keys?.pk.name })
      onSaved(result.item, mode)
      onClose()
    } catch (e) {
      setSaveError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void save()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const { selectionStart: s, selectionEnd: end } = ta
      const next = text.slice(0, s) + '  ' + text.slice(end)
      setText(next)
      requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2))
    }
  }

  const lines = text.split('\n').length
  const title = mode === 'create' ? 'Criar item' : mode === 'edit' ? 'Editar item' : 'Duplicar item'
  const Icon = mode === 'create' ? FilePlus2 : mode === 'edit' ? Pencil : CopyPlus

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="lg"
      icon={Icon}
      title={title}
      description={
        <>
          Tabela <span className="font-mono">{table.TableName}</span>
          {mode !== 'edit' && ' · não sobrescreve itens existentes'}
        </>
      }
      footer={
        <>
          <span className="mr-auto hidden text-xs text-zinc-400 sm:block">Ctrl + Enter para salvar</span>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" icon={Save} onClick={save} loading={busy} disabled={!result.item}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="xs"
            value={format}
            onChange={switchFormat}
            options={[
              { value: 'plain', label: 'JSON', title: 'JSON comum — tipos de sets e binários do item original são preservados' },
              { value: 'ddb', label: 'DynamoDB JSON', title: 'Formato com tipos explícitos: {"S": "..."}' },
            ]}
          />
          <div className="flex-1" />
          <Button size="xs" variant="ghost" icon={WandSparkles} onClick={prettify}>
            Formatar
          </Button>
        </div>

        <div className="flex h-[min(55vh,480px)] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950">
          <div
            ref={gutterRef}
            aria-hidden
            className="w-10 shrink-0 overflow-hidden border-r border-zinc-200 py-3 pr-2 text-right font-mono text-[12.5px] leading-[1.6] text-zinc-400 select-none dark:border-zinc-800 dark:text-zinc-600"
          >
            {Array.from({ length: lines }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            ref={taRef}
            value={text}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onScroll={(e) => {
              if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop
            }}
            className="flex-1 resize-none bg-transparent px-3 py-3 font-mono text-[12.5px] leading-[1.6] whitespace-pre outline-none"
          />
        </div>

        {saveError ? (
          <p className="flex items-start gap-2 text-[13px] text-rose-600 dark:text-rose-400">
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {saveError}
          </p>
        ) : result.error ? (
          <p className="flex items-start gap-2 text-[13px] text-rose-600 dark:text-rose-400">
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {result.error}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-[13px] text-emerald-600 dark:text-emerald-400">
            <CircleCheck className="size-4" /> Item válido · {Object.keys(result.item ?? {}).length} atributos · ~
            {formatBytes(size)}
            {size > 400 * 1024 && <span className="text-rose-500"> (limite do DynamoDB: 400 KB)</span>}
          </p>
        )}
      </div>
    </Dialog>
  )
}
