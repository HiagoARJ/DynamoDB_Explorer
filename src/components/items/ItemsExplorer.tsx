import type { TableDescription } from '@aws-sdk/client-dynamodb'
import {
  Braces,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FilePlus2,
  FileSpreadsheet,
  Gauge,
  Rows2,
  Rows3,
  SearchX,
  Sheet,
  Table as TableIcon,
  Timer,
  Trash2,
  TriangleAlert,
  X,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { batchDelete, describeError, fetchPage, isAbort, keySchemaOf, tableKeyNames } from '../../lib/api'
import { itemToDdbJson, itemToPlain, keyId, keyOf, orderItem } from '../../lib/convert'
import { avSearchText, avSortValue, downloadFile, formatNumber, toCSV, toJSONExport } from '../../lib/format'
import { readJSON, writeJSON } from '../../lib/storage'
import type { Item, PageResult, QuerySpec } from '../../lib/types'
import { Button, IconButton } from '../ui/Button'
import { ConfirmDialog } from '../ui/Dialog'
import { Checkbox, Input } from '../ui/Form'
import { Card, EmptyState, MenuItem, MenuLabel, Popover, Segmented, Spinner } from '../ui/Misc'
import { ItemDrawer } from './ItemDrawer'
import { ItemEditor, type EditorMode } from './ItemEditor'
import { ItemsGrid, type SortState } from './ItemsGrid'
import { JsonBlock } from './JsonView'
import { QueryBuilder } from './QueryBuilder'

function defaultSpec(pageSize: number, indexName = ''): QuerySpec {
  return {
    mode: indexName ? 'query' : 'scan',
    indexName,
    pkValue: '',
    skOp: '',
    skValue: '',
    skValue2: '',
    descending: false,
    filters: [],
    projection: '',
    pageSize,
  }
}

interface ColPrefs {
  hidden: string[]
  widths: Record<string, number>
}

export function ItemsExplorer({
  table,
  initialIndex,
  onDataChanged,
}: {
  table: TableDescription
  initialIndex?: string
  onDataChanged: () => void
}) {
  const { client, settings, update, readOnly, connection } = useSettings()
  const toast = useToast()
  const tableName = table.TableName!
  const keyNames = useMemo(() => tableKeyNames(table), [table])
  const rowId = useCallback((it: Item) => keyId(it, keyNames), [keyNames])

  const [spec, setSpec] = useState<QuerySpec>(() => defaultSpec(settings.pageSize, initialIndex))
  const [applied, setApplied] = useState<QuerySpec | null>(null)
  const [pageKeys, setPageKeys] = useState<(Item | undefined)[]>([undefined])
  const [pageIdx, setPageIdx] = useState(0)
  const [result, setResult] = useState<PageResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [view, setView] = useState<'table' | 'json'>('table')
  const [jsonFormat, setJsonFormat] = useState<'plain' | 'ddb'>('plain')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [prefs, setPrefs] = useState<ColPrefs>(() => readJSON(`cols:${connection.id}:${tableName}`, { hidden: [], widths: {} }))
  const [colFilter, setColFilter] = useState('')

  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ mode: EditorMode; item?: Item } | null>(null)
  const [toDelete, setToDelete] = useState<Item[] | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  useEffect(() => writeJSON(`cols:${connection.id}:${tableName}`, prefs), [prefs, tableName, connection.id])

  const run = useCallback(
    async (s: QuerySpec, idx: number, keys: (Item | undefined)[]) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      setError(null)
      try {
        const res = await fetchPage(client, table, s, keys[idx], ctrl.signal)
        if (ctrl.signal.aborted) return
        setResult(res)
        setApplied(s)
        setPageIdx(idx)
        const next = keys.slice(0, idx + 1)
        if (res.lastKey) next.push(res.lastKey)
        setPageKeys(next)
        setSelected(new Set())
      } catch (e) {
        if (isAbort(e) || ctrl.signal.aborted) return
        setError(describeError(e))
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    },
    [client, table],
  )

  // Executa automaticamente um Scan ao abrir a tabela (como o console da AWS).
  useEffect(() => {
    if (spec.mode === 'scan') void run(spec, 0, [undefined])
    return () => abortRef.current?.abort()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const execute = () => void run(spec, 0, [undefined])
  const reload = () => applied && void run(applied, pageIdx, pageKeys)

  const reset = () => {
    const s = defaultSpec(spec.pageSize)
    setSpec(s)
    void run(s, 0, [undefined])
  }

  /* ---------- colunas ---------- */

  const allColumns = useMemo(() => {
    const idxKeys = applied?.indexName ? keySchemaOf(table, applied.indexName) : undefined
    const seen = new Set<string>()
    for (const it of result?.items ?? []) for (const k of Object.keys(it)) seen.add(k)
    const pinned = [...keyNames]
    if (idxKeys) for (const k of [idxKeys.pk.name, idxKeys.sk?.name]) if (k && !pinned.includes(k)) pinned.push(k)
    const rest = [...seen].filter((c) => !pinned.includes(c)).sort((a, b) => a.localeCompare(b))
    return [...pinned.filter((k) => seen.has(k) || keyNames.includes(k)), ...rest]
  }, [result, keyNames, applied, table])

  const columns = useMemo(() => allColumns.filter((c) => !prefs.hidden.includes(c)), [allColumns, prefs.hidden])

  const widths = useMemo(() => {
    const w: Record<string, number> = {}
    for (const c of allColumns) w[c] = prefs.widths[c] ?? (keyNames.includes(c) ? 220 : 180)
    return w
  }, [allColumns, prefs.widths, keyNames])

  /* ---------- itens visíveis (busca + ordenação local) ---------- */

  const visible = useMemo(() => {
    let items = result?.items ?? []
    const q = search.trim().toLowerCase()
    if (q) items = items.filter((it) => Object.values(it).some((av) => avSearchText(av).includes(q)))
    if (sort) {
      const dir = sort.dir === 'asc' ? 1 : -1
      items = [...items].sort((a, b) => {
        const va = avSortValue(a[sort.col])
        const vb = avSortValue(b[sort.col])
        if (va === vb) return 0
        if (va === '') return 1
        if (vb === '') return -1
        return (va < vb ? -1 : 1) * dir
      })
    }
    return items
  }, [result, search, sort])

  const drawerIndex = drawerId ? visible.findIndex((i) => rowId(i) === drawerId) : -1
  const drawerItem = drawerIndex >= 0 ? visible[drawerIndex] : null

  const onSort = (col: string) =>
    setSort((s) => (s?.col !== col ? { col, dir: 'asc' } : s.dir === 'asc' ? { col, dir: 'desc' } : null))

  /* ---------- seleção / exportação ---------- */

  const selectedItems = useMemo(
    () => (result?.items ?? []).filter((i) => selected.has(rowId(i))),
    [result, selected, rowId],
  )

  const exportItems = (format: 'csv' | 'json' | 'ddb') => {
    const items = selectedItems.length ? selectedItems : visible
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    if (format === 'csv') downloadFile(`${tableName}-${stamp}.csv`, toCSV(items, columns), 'text/csv;charset=utf-8')
    else
      downloadFile(
        `${tableName}-${stamp}${format === 'ddb' ? '.ddb' : ''}.json`,
        toJSONExport(items.map((i) => orderItem(i, keyNames)), format === 'json' ? 'plain' : 'ddb'),
        'application/json',
      )
    toast('success', 'Exportado', `${items.length} item(ns)`)
  }

  /* ---------- CRUD ---------- */

  const onSaved = (item: Item, mode: EditorMode) => {
    toast('success', mode === 'edit' ? 'Item atualizado' : 'Item criado')
    onDataChanged()
    if (mode === 'edit' && result) {
      const id = rowId(item)
      setResult({ ...result, items: result.items.map((i) => (rowId(i) === id ? item : i)) })
    } else {
      reload()
      if (!applied) execute()
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(0)
    try {
      const keys = toDelete.map((i) => keyOf(i, keyNames))
      await batchDelete(client, tableName, keys, (n) => setDeleting(n))
      const ids = new Set(toDelete.map(rowId))
      if (result) setResult({ ...result, items: result.items.filter((i) => !ids.has(rowId(i))) })
      setSelected((s) => new Set([...s].filter((id) => !ids.has(id))))
      if (drawerId && ids.has(drawerId)) setDrawerId(null)
      toast('success', `${toDelete.length} item(ns) excluído(s)`)
      setToDelete(null)
      onDataChanged()
    } catch (e) {
      toast('error', 'Falha ao excluir', describeError(e))
    } finally {
      setDeleting(null)
    }
  }

  const density = settings.density
  const hasMore = pageKeys.length > pageIdx + 1

  return (
    <div className="space-y-4">
      <QueryBuilder
        table={table}
        spec={spec}
        onChange={setSpec}
        onRun={execute}
        onReset={reset}
        loading={loading}
        knownAttributes={allColumns}
      />

      <Card className="overflow-hidden">
        {/* barra de ferramentas */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800/80">
          {selected.size > 0 ? (
            <>
              <span className="rounded-md bg-indigo-50 px-2 py-1 text-[13px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                {selected.size} selecionado(s)
              </span>
              <Button size="sm" variant="ghost" icon={X} onClick={() => setSelected(new Set())}>
                Limpar
              </Button>
              {!readOnly && (
                <Button size="sm" variant="danger-ghost" icon={Trash2} onClick={() => setToDelete(selectedItems)}>
                  Excluir
                </Button>
              )}
            </>
          ) : (
            <Input
              icon={Search}
              inputSize="sm"
              placeholder="Buscar nesta página"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
              right={
                search && (
                  <button onClick={() => setSearch('')} className="rounded p-0.5 text-zinc-400 hover:text-zinc-600" aria-label="Limpar busca">
                    <X className="size-3.5" />
                  </button>
                )
              }
            />
          )}

          <div className="flex-1" />

          <Segmented
            size="xs"
            value={view}
            onChange={setView}
            options={[
              { value: 'table', label: 'Tabela', icon: TableIcon },
              { value: 'json', label: 'JSON', icon: Braces },
            ]}
          />

          {view === 'table' ? (
            <>
              <Popover
                width="w-64"
                trigger={({ toggle, open }) => <IconButton icon={Columns3} label="Colunas" active={open} onClick={toggle} />}
              >
                {() => (
                  <div>
                    <div className="p-1.5">
                      <Input inputSize="sm" placeholder="Filtrar colunas" value={colFilter} onChange={(e) => setColFilter(e.target.value)} />
                    </div>
                    <div className="max-h-72 overflow-y-auto px-1">
                      {allColumns
                        .filter((c) => c.toLowerCase().includes(colFilter.toLowerCase()))
                        .map((c) => (
                          <div key={c} className="rounded-lg px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                            <Checkbox
                              checked={!prefs.hidden.includes(c)}
                              onChange={(v) =>
                                setPrefs((p) => ({
                                  ...p,
                                  hidden: v ? p.hidden.filter((h) => h !== c) : [...p.hidden, c],
                                }))
                              }
                              label={<span className="truncate font-mono text-xs">{c}</span>}
                              className="w-full"
                            />
                          </div>
                        ))}
                    </div>
                    <div className="mt-1 flex gap-1 border-t border-zinc-200 p-1.5 dark:border-zinc-800">
                      <Button size="xs" variant="ghost" icon={Eye} onClick={() => setPrefs((p) => ({ ...p, hidden: [] }))}>
                        Todas
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        icon={EyeOff}
                        onClick={() => setPrefs((p) => ({ ...p, hidden: allColumns.filter((c) => !keyNames.includes(c)) }))}
                      >
                        Só chaves
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setPrefs((p) => ({ ...p, widths: {} }))}>
                        Larguras
                      </Button>
                    </div>
                  </div>
                )}
              </Popover>
              <IconButton
                icon={density === 'compact' ? Rows3 : Rows2}
                label={density === 'compact' ? 'Densidade: compacta' : 'Densidade: confortável'}
                onClick={() => update({ density: density === 'compact' ? 'comfortable' : 'compact' })}
              />
            </>
          ) : (
            <Segmented
              size="xs"
              value={jsonFormat}
              onChange={setJsonFormat}
              options={[
                { value: 'plain', label: 'JSON' },
                { value: 'ddb', label: 'DynamoDB' },
              ]}
            />
          )}

          <Popover
            width="w-60"
            trigger={({ toggle, open }) => <IconButton icon={Download} label="Exportar" active={open} onClick={toggle} />}
          >
            {(close) => (
              <>
                <MenuLabel>{selectedItems.length ? `Exportar ${selectedItems.length} selecionado(s)` : `Exportar ${visible.length} item(ns)`}</MenuLabel>
                <MenuItem icon={FileSpreadsheet} onClick={() => (exportItems('csv'), close())}>
                  CSV
                </MenuItem>
                <MenuItem icon={FileJson} onClick={() => (exportItems('json'), close())}>
                  JSON
                </MenuItem>
                <MenuItem icon={Sheet} onClick={() => (exportItems('ddb'), close())}>
                  DynamoDB JSON
                </MenuItem>
              </>
            )}
          </Popover>

          <Button
            size="sm"
            variant="primary"
            icon={FilePlus2}
            onClick={() => setEditor({ mode: 'create' })}
            disabled={readOnly}
            title={readOnly ? 'Conexão somente leitura' : undefined}
          >
            Criar item
          </Button>
        </div>

        {/* estatísticas */}
        {result && !error && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-200 bg-zinc-50/60 px-4 py-1.5 text-xs text-zinc-500 dark:border-zinc-800/80 dark:bg-zinc-950/30 dark:text-zinc-400">
            <span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatNumber(result.count)}</span> retornado(s)
              {search && <> · {formatNumber(visible.length)} na busca</>}
            </span>
            <span title="Itens avaliados antes dos filtros">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatNumber(result.scannedCount)}</span> lido(s)
            </span>
            <span className="flex items-center gap-1">
              <Timer className="size-3.5" /> {result.durationMs.toFixed(0)} ms
              {result.requests > 1 && <> · {result.requests} requisições</>}
            </span>
            <span className="flex items-center gap-1" title="Capacidade consumida">
              <Gauge className="size-3.5" /> {result.consumed.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} RCU
            </span>
            <span className="text-zinc-400">
              {applied?.mode === 'query' ? 'Query' : 'Scan'} em {applied?.indexName || tableName}
            </span>
          </div>
        )}

        {/* conteúdo */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-indigo-500/10">
              <div className="animate-progress h-full w-1/3 bg-indigo-500" />
            </div>
          )}

          {error ? (
            <EmptyState icon={TriangleAlert} tone="error" title="Erro ao consultar">
              {error}
            </EmptyState>
          ) : !result ? (
            loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-500">
                <Spinner /> Consultando…
              </div>
            ) : (
              <EmptyState icon={Search} title="Pronto para consultar">
                Preencha a chave de partição e clique em <b>Executar</b>.
              </EmptyState>
            )
          ) : visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={search ? 'Nenhum item corresponde à busca' : 'Nenhum item retornado'}
              action={
                !search &&
                (hasMore ? (
                  <Button icon={ChevronRight} onClick={() => void run(applied!, pageIdx + 1, pageKeys)}>
                    Continuar lendo
                  </Button>
                ) : (
                  !readOnly && (
                    <Button icon={FilePlus2} onClick={() => setEditor({ mode: 'create' })}>
                      Criar item
                    </Button>
                  )
                ))
              }
            >
              {hasMore && !search
                ? 'Os filtros não encontraram itens neste trecho da tabela, mas ainda há dados a ler.'
                : search
                  ? 'A busca é aplicada apenas aos itens carregados nesta página.'
                  : undefined}
            </EmptyState>
          ) : view === 'table' ? (
            <div className={`max-h-[70vh] overflow-auto ${loading ? 'opacity-60' : ''}`}>
              <ItemsGrid
                items={visible}
                columns={columns}
                keyNames={keyNames}
                widths={widths}
                onResize={(c, w) => setPrefs((p) => ({ ...p, widths: { ...p.widths, [c]: w } }))}
                selected={selected}
                rowId={rowId}
                onToggle={(id) =>
                  setSelected((s) => {
                    const n = new Set(s)
                    if (n.has(id)) n.delete(id)
                    else n.add(id)
                    return n
                  })
                }
                onToggleAll={(all) => setSelected(all ? new Set(visible.map(rowId)) : new Set())}
                onOpen={(it) => setDrawerId(rowId(it))}
                activeId={drawerId ?? undefined}
                sort={sort}
                onSort={onSort}
                density={density}
                search={search}
              />
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto bg-zinc-50/50 p-4 dark:bg-zinc-950/30">
              <JsonBlock
                value={visible.map((i) => {
                  const o = orderItem(i, keyNames)
                  return jsonFormat === 'plain' ? itemToPlain(o) : itemToDdbJson(o)
                })}
              />
            </div>
          )}
        </div>

        {/* paginação */}
        {result && !error && (
          <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800/80">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Página <span className="font-medium text-zinc-800 tabular-nums dark:text-zinc-200">{pageIdx + 1}</span>
              {hasMore ? ' · há mais itens' : ' · fim dos resultados'}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                icon={ChevronLeft}
                disabled={pageIdx === 0 || loading}
                onClick={() => void run(applied!, pageIdx - 1, pageKeys)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="ghost"
                iconRight={ChevronRight}
                disabled={!hasMore || loading}
                onClick={() => void run(applied!, pageIdx + 1, pageKeys)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ItemDrawer
        item={drawerItem}
        keyNames={keyNames}
        position={drawerIndex >= 0 ? `${drawerIndex + 1} de ${visible.length}` : undefined}
        onClose={() => setDrawerId(null)}
        onPrev={drawerIndex > 0 ? () => setDrawerId(rowId(visible[drawerIndex - 1])) : undefined}
        onNext={drawerIndex >= 0 && drawerIndex < visible.length - 1 ? () => setDrawerId(rowId(visible[drawerIndex + 1])) : undefined}
        onEdit={(it) => setEditor({ mode: 'edit', item: it })}
        onDuplicate={(it) => setEditor({ mode: 'duplicate', item: it })}
        onDelete={(it) => setToDelete([it])}
        readOnly={readOnly}
      />

      <ItemEditor
        open={!!editor}
        mode={editor?.mode ?? 'create'}
        table={table}
        original={editor?.item}
        onClose={() => setEditor(null)}
        onSaved={onSaved}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => deleting === null && setToDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting !== null}
        title={toDelete && toDelete.length > 1 ? `Excluir ${toDelete.length} itens` : 'Excluir item'}
        confirmLabel={deleting !== null && toDelete && toDelete.length > 25 ? `Excluindo ${deleting}/${toDelete.length}` : 'Excluir'}
        confirmText={toDelete && toDelete.length > 10 ? 'excluir' : undefined}
      >
        {toDelete?.length === 1 ? (
          <>
            O item com chave{' '}
            <span className="font-mono font-semibold">
              {keyNames.map((k) => keyId({ [k]: toDelete[0][k] }, [k])).join(' / ')}
            </span>{' '}
            será excluído permanentemente de <span className="font-mono">{tableName}</span>.
          </>
        ) : (
          <>
            {toDelete?.length} itens serão excluídos permanentemente de <span className="font-mono">{tableName}</span>.
            Essa ação não pode ser desfeita.
          </>
        )}
      </ConfirmDialog>
    </div>
  )
}
