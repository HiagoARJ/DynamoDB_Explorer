import type { TableDescription } from '@aws-sdk/client-dynamodb'
import { KeyRound, Layers, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { deleteGsi, describeError, keySchemaOf } from '../../lib/api'
import { formatBytes, formatNumber } from '../../lib/format'
import type { AvType } from '../../lib/types'
import { Button, IconButton } from '../ui/Button'
import { ConfirmDialog } from '../ui/Dialog'
import { Badge, Card, EmptyState, statusTone, TypeBadge } from '../ui/Misc'
import { CreateIndexDialog } from './CreateIndexDialog'

interface IndexRow {
  kind: 'GSI' | 'LSI'
  name: string
  status?: string
  projection?: string
  nonKey?: string[]
  items?: number
  bytes?: number
}

export function IndexesTab({
  table,
  onChanged,
  onQueryIndex,
}: {
  table: TableDescription
  onChanged: () => void
  onQueryIndex: (indexName: string) => void
}) {
  const { client, readOnly } = useSettings()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const rows: IndexRow[] = [
    ...(table.GlobalSecondaryIndexes ?? []).map<IndexRow>((i) => ({
      kind: 'GSI',
      name: i.IndexName!,
      status: i.IndexStatus,
      projection: i.Projection?.ProjectionType,
      nonKey: i.Projection?.NonKeyAttributes,
      items: i.ItemCount,
      bytes: i.IndexSizeBytes,
    })),
    ...(table.LocalSecondaryIndexes ?? []).map<IndexRow>((i) => ({
      kind: 'LSI',
      name: i.IndexName!,
      status: 'ACTIVE',
      projection: i.Projection?.ProjectionType,
      nonKey: i.Projection?.NonKeyAttributes,
      items: i.ItemCount,
      bytes: i.IndexSizeBytes,
    })),
  ]

  const remove = async () => {
    if (!toDelete) return
    setBusy(true)
    try {
      await deleteGsi(client, table.TableName!, toDelete)
      toast('success', 'Índice excluído', toDelete)
      setToDelete(null)
      onChanged()
    } catch (e) {
      toast('error', 'Falha ao excluir índice', describeError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {rows.length ? `${rows.length} índice(s) secundário(s)` : 'Sem índices secundários'}
        </p>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setCreating(true)} disabled={readOnly} title={readOnly ? 'Conexão somente leitura' : undefined}>
          Criar índice
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Layers}
            title="Nenhum índice"
            action={
              !readOnly && (
                <Button icon={Plus} onClick={() => setCreating(true)}>
                  Criar índice global
                </Button>
              )
            }
          >
            Índices secundários permitem consultar os dados por outros atributos além da chave primária.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => {
            const keys = keySchemaOf(table, r.name)
            return (
              <Card key={r.name} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={r.kind === 'GSI' ? 'indigo' : 'violet'}>{r.kind}</Badge>
                      <h3 className="truncate font-mono text-sm font-semibold">{r.name}</h3>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <Badge tone={statusTone(r.status)}>{r.status ?? '—'}</Badge>
                      <span>{formatNumber(r.items)} itens</span>
                      <span>·</span>
                      <span>{formatBytes(r.bytes)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="xs" icon={Search} onClick={() => onQueryIndex(r.name)}>
                      Consultar
                    </Button>
                    {r.kind === 'GSI' && !readOnly && (
                      <IconButton icon={Trash2} label="Excluir índice" tone="danger" size="xs" onClick={() => setToDelete(r.name)} />
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    ['Partição', keys?.pk],
                    ['Classificação', keys?.sk],
                  ].map(([label, k]) => {
                    const key = k as { name: string; type: string } | undefined
                    return (
                      <div key={label as string} className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
                        <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <KeyRound className="size-3" /> {label as string}
                        </p>
                        {key ? (
                          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[13px]">
                            {key.name} <TypeBadge type={key.type as AvType} />
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[13px] text-zinc-400">—</p>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  Projeção: <span className="font-medium text-zinc-700 dark:text-zinc-300">{r.projection}</span>
                  {r.nonKey?.length ? <span className="font-mono"> ({r.nonKey.join(', ')})</span> : null}
                </p>
              </Card>
            )
          })}
        </div>
      )}

      <CreateIndexDialog open={creating} onClose={() => setCreating(false)} table={table} onCreated={onChanged} />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        busy={busy}
        title="Excluir índice"
        confirmLabel="Excluir índice"
      >
        O índice <span className="font-mono font-semibold">{toDelete}</span> será removido da tabela{' '}
        <span className="font-mono">{table.TableName}</span>. Os itens da tabela não são afetados.
      </ConfirmDialog>
    </div>
  )
}
