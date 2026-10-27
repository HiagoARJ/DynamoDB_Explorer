import type { TableDescription } from '@aws-sdk/client-dynamodb'
import { Database, HardDrive, KeyRound, Layers, Plus, RefreshCw, Rows3, Search, Table2, Unplug } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useTables } from '../../hooks/useTables'
import { keySchemaOf } from '../../lib/api'
import { formatBytes, formatNumber, relativeTime } from '../../lib/format'
import { Button } from '../ui/Button'
import { Input } from '../ui/Form'
import { Badge, Card, EmptyState, Spinner, statusTone } from '../ui/Misc'

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Database; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <Icon className="size-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </Card>
  )
}

function KeyCell({ k }: { k?: { name: string; type: string } }) {
  if (!k) return <span className="text-zinc-300 dark:text-zinc-600">—</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[13px]">{k.name}</span>
      <span className="text-[11px] text-zinc-400">({k.type})</span>
    </span>
  )
}

function billing(d?: TableDescription) {
  return d?.BillingModeSummary?.BillingMode === 'PAY_PER_REQUEST' ? 'Sob demanda' : 'Provisionado'
}

export function TablesDashboard({
  onOpen,
  onCreateTable,
  onOpenSettings,
}: {
  onOpen: (name: string) => void
  onCreateTable: () => void
  onOpenSettings: () => void
}) {
  const { names, tables, loading, error, refresh, lastLoadedAt } = useTables()
  const { connection, readOnly } = useSettings()
  const isAws = connection.kind === 'aws'
  const [q, setQ] = useState('')

  const totals = useMemo(() => {
    let items = 0
    let bytes = 0
    let gsi = 0
    let lsi = 0
    for (const d of Object.values(tables)) {
      items += d.ItemCount ?? 0
      bytes += d.TableSizeBytes ?? 0
      gsi += d.GlobalSecondaryIndexes?.length ?? 0
      lsi += d.LocalSecondaryIndexes?.length ?? 0
    }
    return { items, bytes, gsi, lsi }
  }, [tables])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? names.filter((n) => n.toLowerCase().includes(s)) : names
  }, [names, q])

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <Card>
          <EmptyState
            icon={Unplug}
            tone="error"
            title={`${connection.name} indisponível`}
            action={
              <>
                <Button icon={RefreshCw} onClick={() => refresh()} loading={loading}>
                  Tentar novamente
                </Button>
                <Button variant="ghost" onClick={onOpenSettings}>
                  Configurar conexão
                </Button>
              </>
            }
          >
            <p>{error}</p>
            {!isAws && (
            <pre className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 text-left font-mono text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              docker compose up -d{'\n'}npm run seed
            </pre>
            )}
          </EmptyState>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tabelas</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Tabelas DynamoDB em <span className="font-medium text-zinc-700 dark:text-zinc-300">{connection.name}</span>
            {isAws && <> · {connection.region}</>}
            {lastLoadedAt && <> · atualizado {relativeTime(lastLoadedAt)}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={RefreshCw} onClick={() => refresh()} loading={loading}>
            Atualizar
          </Button>
          <Button variant="primary" icon={Plus} onClick={onCreateTable} disabled={readOnly} title={readOnly ? 'Conexão somente leitura' : undefined}>
            Criar tabela
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Table2} label="Tabelas" value={formatNumber(names.length)} />
        <Stat icon={Rows3} label="Itens (aprox.)" value={formatNumber(totals.items)} />
        <Stat icon={HardDrive} label="Tamanho total" value={formatBytes(totals.bytes)} />
        <Stat icon={Layers} label="Índices" value={formatNumber(totals.gsi + totals.lsi)} sub={`${totals.gsi} GSI · ${totals.lsi} LSI`} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">
            Todas as tabelas <span className="font-normal text-zinc-400">({filtered.length})</span>
          </h2>
          <Input
            icon={Search}
            inputSize="sm"
            placeholder="Buscar por nome"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>

        {loading && names.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
            <Spinner /> Carregando tabelas…
          </div>
        ) : names.length === 0 ? (
          <EmptyState
            icon={Database}
            title="Nenhuma tabela encontrada"
            action={
              !readOnly && (
                <Button variant="primary" icon={Plus} onClick={onCreateTable}>
                  Criar tabela
                </Button>
              )
            }
          >
            {isAws ? (
              <>Nenhuma tabela visível na região <span className="font-mono">{connection.region}</span> com estas credenciais.</>
            ) : (
              <>
                Crie uma tabela ou popule dados de exemplo com{' '}
                <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">npm run seed</code>.
              </>
            )}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="px-4 py-2.5 font-medium">Nome</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Chave de partição</th>
                  <th className="px-4 py-2.5 font-medium">Chave de classificação</th>
                  <th className="px-4 py-2.5 text-right font-medium">Índices</th>
                  <th className="px-4 py-2.5 text-right font-medium">Itens</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tamanho</th>
                  <th className="px-4 py-2.5 font-medium">Capacidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {filtered.map((n) => {
                  const d = tables[n]
                  const keys = d ? keySchemaOf(d) : undefined
                  const idx = (d?.GlobalSecondaryIndexes?.length ?? 0) + (d?.LocalSecondaryIndexes?.length ?? 0)
                  return (
                    <tr
                      key={n}
                      onClick={() => onOpen(n)}
                      className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 font-medium text-indigo-600 dark:text-indigo-400">
                          <Table2 className="size-4 opacity-70" />
                          {n}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {d ? <Badge tone={statusTone(d.TableStatus)}>{d.TableStatus}</Badge> : <Spinner className="size-3.5" />}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <KeyRound className="size-3.5 text-amber-500" />
                          <KeyCell k={keys?.pk} />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <KeyCell k={keys?.sk} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{idx || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatNumber(d?.ItemCount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatBytes(d?.TableSizeBytes)}</td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{d ? billing(d) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
