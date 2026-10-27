import { Info, KeyRound, Layers, RefreshCw, Rows3, Table2, Trash2, Unplug } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { TableTab } from '../../hooks/useHashRoute'
import { useSettings } from '../../hooks/useSettings'
import { useTables } from '../../hooks/useTables'
import { useToast } from '../../hooks/useToast'
import { deleteTable, describeError, keySchemaOf } from '../../lib/api'
import { formatBytes, formatNumber } from '../../lib/format'
import { ItemsExplorer } from '../items/ItemsExplorer'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/Dialog'
import { Badge, Card, EmptyState, Spinner, statusTone, Tabs, TypeBadge } from '../ui/Misc'
import { IndexesTab } from './IndexesTab'
import { OverviewTab } from './OverviewTab'

export function TableView({
  name,
  tab,
  navigate,
}: {
  name: string
  tab: TableTab
  navigate: (table?: string, tab?: TableTab) => void
}) {
  const { tables, names, loading, error, refreshTable, refresh } = useTables()
  const { client, readOnly } = useSettings()
  const toast = useToast()
  const [refreshing, setRefreshing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [preset, setPreset] = useState<{ index: string; nonce: number } | null>(null)

  const table = tables[name]

  const reloadMeta = useCallback(async () => {
    try {
      await refreshTable(name)
    } catch (e) {
      toast('error', 'Falha ao atualizar a tabela', describeError(e))
    }
  }, [name, refreshTable, toast])

  // Enquanto a tabela ou algum índice estiver em transição (CREATING, UPDATING…), atualiza o status sozinho.
  const transitioning =
    !!table &&
    (table.TableStatus !== 'ACTIVE' || (table.GlobalSecondaryIndexes ?? []).some((i) => i.IndexStatus !== 'ACTIVE'))
  useEffect(() => {
    if (!transitioning) return
    const id = setInterval(() => void refreshTable(name).catch(() => {}), 2000)
    return () => clearInterval(id)
  }, [transitioning, name, refreshTable])

  if (!table) {
    if (error)
      return (
        <div className="p-6">
          <Card>
            <EmptyState icon={Unplug} tone="error" title="Sem conexão">
              {error}
            </EmptyState>
          </Card>
        </div>
      )
    if (loading || names.includes(name))
      return (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-zinc-500">
          <Spinner /> Carregando tabela…
        </div>
      )
    return (
      <div className="p-6">
        <Card>
          <EmptyState icon={Table2} title="Tabela não encontrada" action={<Button onClick={() => navigate()}>Voltar às tabelas</Button>}>
            A tabela <span className="font-mono">{name}</span> não existe neste endpoint/região.
          </EmptyState>
        </Card>
      </div>
    )
  }

  const keys = keySchemaOf(table)
  const indexCount = (table.GlobalSecondaryIndexes?.length ?? 0) + (table.LocalSecondaryIndexes?.length ?? 0)

  const doDelete = async () => {
    setDeleting(true)
    try {
      await deleteTable(client, name)
      toast('success', 'Tabela excluída', name)
      setConfirmDelete(false)
      navigate()
      await refresh()
    } catch (e) {
      toast('error', 'Falha ao excluir a tabela', describeError(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
            <Badge tone={statusTone(table.TableStatus)}>{table.TableStatus}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-zinc-500 dark:text-zinc-400">
            {keys && (
              <span className="flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-amber-500" />
                <span className="font-mono text-zinc-700 dark:text-zinc-300">{keys.pk.name}</span>
                <TypeBadge type={keys.pk.type} />
                {keys.sk && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-600">/</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{keys.sk.name}</span>
                    <TypeBadge type={keys.sk.type} />
                  </>
                )}
              </span>
            )}
            <span>{formatNumber(table.ItemCount)} itens</span>
            <span>{formatBytes(table.TableSizeBytes)}</span>
            <span>{table.BillingModeSummary?.BillingMode === 'PAY_PER_REQUEST' ? 'Sob demanda' : 'Provisionado'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            onClick={async () => {
              setRefreshing(true)
              await reloadMeta()
              setRefreshing(false)
            }}
          >
            Atualizar
          </Button>
          <Button
            size="sm"
            variant="danger-ghost"
            icon={Trash2}
            onClick={() => setConfirmDelete(true)}
            disabled={readOnly}
            title={readOnly ? 'Conexão somente leitura' : undefined}
          >
            Excluir tabela
          </Button>
        </div>
      </div>

      <Tabs<TableTab>
        value={tab}
        onChange={(t) => navigate(name, t)}
        items={[
          { id: 'items', label: 'Explorar itens', icon: Rows3 },
          { id: 'overview', label: 'Visão geral', icon: Info },
          { id: 'indexes', label: 'Índices', icon: Layers, count: indexCount },
        ]}
      />

      {tab === 'items' && (
        <ItemsExplorer
          key={`${name}:${preset?.nonce ?? 0}`}
          table={table}
          initialIndex={preset?.index}
          onDataChanged={reloadMeta}
        />
      )}
      {tab === 'overview' && <OverviewTab table={table} onChanged={reloadMeta} />}
      {tab === 'indexes' && (
        <IndexesTab
          table={table}
          onChanged={reloadMeta}
          onQueryIndex={(index) => {
            setPreset({ index, nonce: Date.now() })
            navigate(name, 'items')
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        busy={deleting}
        title="Excluir tabela"
        confirmLabel="Excluir tabela"
        confirmText={name}
      >
        A tabela <span className="font-mono font-semibold">{name}</span>, com {formatNumber(table.ItemCount)} item(ns) e{' '}
        {indexCount} índice(s), será excluída permanentemente.
      </ConfirmDialog>
    </div>
  )
}
