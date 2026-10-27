import type { TableDescription, TimeToLiveDescription } from '@aws-sdk/client-dynamodb'
import { Check, Clock, Copy, Info, Power, KeyRound, RefreshCw, Shapes } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { describeError, describeTtl, keySchemaOf, sampleItems, updateTtl } from '../../lib/api'
import { avType } from '../../lib/convert'
import { copyText, formatBytes, formatDateTime, formatNumber } from '../../lib/format'
import type { AvType, Item } from '../../lib/types'
import { Button, IconButton } from '../ui/Button'
import { Input } from '../ui/Form'
import { Badge, Card, CardHeader, Spinner, statusTone, TypeBadge } from '../ui/Misc'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(120px,40%)_1fr] gap-3 py-2 text-sm">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function CopyValue({ value }: { value: string }) {
  const [ok, setOk] = useState(false)
  return (
    <span className="group inline-flex max-w-full items-center gap-1">
      <span className="truncate font-mono text-xs" title={value}>
        {value}
      </span>
      <IconButton
        icon={ok ? Check : Copy}
        label="Copiar"
        size="xs"
        onClick={async () => {
          if (await copyText(value)) {
            setOk(true)
            setTimeout(() => setOk(false), 1200)
          }
        }}
      />
    </span>
  )
}

interface AttrStat {
  name: string
  count: number
  types: Partial<Record<AvType, number>>
}

function inferSchema(items: Item[]): AttrStat[] {
  const map = new Map<string, AttrStat>()
  for (const it of items) {
    for (const [k, v] of Object.entries(it)) {
      let s = map.get(k)
      if (!s) map.set(k, (s = { name: k, count: 0, types: {} }))
      s.count++
      const t = avType(v)
      s.types[t] = (s.types[t] ?? 0) + 1
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function OverviewTab({ table, onChanged }: { table: TableDescription; onChanged: () => void }) {
  const { client, readOnly } = useSettings()
  const toast = useToast()
  const keys = keySchemaOf(table)
  const [ttl, setTtl] = useState<TimeToLiveDescription | undefined | null>(null)
  const [ttlAttr, setTtlAttr] = useState('ttl')
  const [ttlBusy, setTtlBusy] = useState(false)
  const [sample, setSample] = useState<Item[] | null>(null)
  const [sampling, setSampling] = useState(false)

  const name = table.TableName!

  const loadTtl = useCallback(() => {
    setTtl(null)
    describeTtl(client, name).then(setTtl)
  }, [client, name])

  const loadSample = useCallback(async () => {
    setSampling(true)
    try {
      setSample(await sampleItems(client, name, 200))
    } catch (e) {
      toast('error', 'Falha ao amostrar itens', describeError(e))
    } finally {
      setSampling(false)
    }
  }, [client, name, toast])

  useEffect(() => {
    loadTtl()
    void loadSample()
  }, [loadTtl, loadSample])

  const schema = useMemo(() => (sample ? inferSchema(sample) : []), [sample])
  const keyNames = new Set([keys?.pk.name, keys?.sk?.name])

  const toggleTtl = async (enable: boolean) => {
    const attr = enable ? ttlAttr.trim() : ttl?.AttributeName
    if (!attr) return
    setTtlBusy(true)
    try {
      await updateTtl(client, name, attr, enable)
      toast('success', enable ? 'TTL ativado' : 'TTL desativado', attr)
      loadTtl()
      onChanged()
    } catch (e) {
      toast('error', 'Falha ao alterar TTL', describeError(e))
    } finally {
      setTtlBusy(false)
    }
  }

  const provisioned = table.BillingModeSummary?.BillingMode !== 'PAY_PER_REQUEST'
  const avgSize = table.ItemCount ? (table.TableSizeBytes ?? 0) / table.ItemCount : undefined
  const ttlEnabled = ttl?.TimeToLiveStatus === 'ENABLED' || ttl?.TimeToLiveStatus === 'ENABLING'

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Itens (aprox.)</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">{formatNumber(table.ItemCount)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tamanho</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">{formatBytes(table.TableSizeBytes)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tamanho médio do item</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">
              {avgSize !== undefined ? formatBytes(Math.round(avgSize)) : '—'}
            </p>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Esquema inferido"
            icon={Shapes}
            description={
              sample
                ? `Baseado em uma amostra de ${formatNumber(sample.length)} item(ns). DynamoDB é schemaless — atributos podem variar.`
                : 'Analisando uma amostra dos itens…'
            }
            actions={<IconButton icon={RefreshCw} label="Nova amostra" onClick={loadSample} loading={sampling} />}
          />
          {sampling && !sample ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
              <Spinner /> Amostrando…
            </div>
          ) : schema.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">A tabela está vazia.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="px-4 py-2 font-medium">Atributo</th>
                    <th className="px-4 py-2 font-medium">Tipos</th>
                    <th className="w-[40%] px-4 py-2 font-medium">Presença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                  {schema.map((a) => {
                    const pct = sample!.length ? (a.count / sample!.length) * 100 : 0
                    return (
                      <tr key={a.name}>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 font-mono text-[13px]">
                            {keyNames.has(a.name) && <KeyRound className="size-3.5 text-amber-500" />}
                            {a.name}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(a.types).map(([t, n]) => (
                              <span key={t} className="inline-flex items-center gap-1" title={`${n} ocorrência(s)`}>
                                <TypeBadge type={t as AvType} />
                                {Object.keys(a.types).length > 1 && (
                                  <span className="text-[11px] text-zinc-400">{n}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-indigo-500/80"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-11 text-right text-xs text-zinc-500 tabular-nums">
                              {pct.toFixed(pct === 100 ? 0 : 1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Chave primária" icon={KeyRound} />
          <div className="space-y-2 p-4">
            {[
              ['Partição', keys?.pk],
              ['Classificação', keys?.sk],
            ].map(([label, k]) => {
              const key = k as { name: string; type: string } | undefined
              return (
                <div
                  key={label as string}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50"
                >
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{label as string}</span>
                  {key ? (
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[13px]">{key.name}</span>
                      <TypeBadge type={key.type as AvType} />
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Detalhes" icon={Info} />
          <dl className="divide-y divide-zinc-100 px-4 py-1 dark:divide-zinc-800/70">
            <Row label="Status">
              <Badge tone={statusTone(table.TableStatus)}>{table.TableStatus}</Badge>
            </Row>
            <Row label="Criada em">{formatDateTime(table.CreationDateTime)}</Row>
            <Row label="Capacidade">
              {provisioned
                ? `Provisionada · ${table.ProvisionedThroughput?.ReadCapacityUnits ?? 0} RCU / ${table.ProvisionedThroughput?.WriteCapacityUnits ?? 0} WCU`
                : 'Sob demanda'}
            </Row>
            <Row label="Classe">{table.TableClassSummary?.TableClass ?? 'STANDARD'}</Row>
            <Row label="Streams">
              {table.StreamSpecification?.StreamEnabled ? (
                <Badge tone="green">{table.StreamSpecification.StreamViewType}</Badge>
              ) : (
                <span className="text-zinc-400">Desativado</span>
              )}
            </Row>
            <Row label="Proteção contra exclusão">{table.DeletionProtectionEnabled ? 'Ativada' : 'Desativada'}</Row>
            <Row label="ARN">
              <CopyValue value={table.TableArn ?? ''} />
            </Row>
            <Row label="Atributos definidos">
              <div className="flex flex-wrap gap-1.5">
                {table.AttributeDefinitions?.map((a) => (
                  <span key={a.AttributeName} className="inline-flex items-center gap-1 font-mono text-xs">
                    {a.AttributeName}
                    <TypeBadge type={a.AttributeType as AvType} />
                  </span>
                ))}
              </div>
            </Row>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Time to Live (TTL)"
            icon={Clock}
            description="Itens com o atributo TTL expirado são removidos automaticamente."
          />
          <div className="p-4">
            {ttl === null ? (
              <Spinner />
            ) : ttlEnabled ? (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  <Badge tone="green">{ttl?.TimeToLiveStatus}</Badge>
                  <span className="font-mono text-[13px]">{ttl?.AttributeName}</span>
                </span>
                <Button size="sm" variant="danger-ghost" onClick={() => toggleTtl(false)} loading={ttlBusy} disabled={readOnly}>
                  Desativar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  inputSize="sm"
                  value={ttlAttr}
                  onChange={(e) => setTtlAttr(e.target.value)}
                  placeholder="atributo (epoch em segundos)"
                  className="flex-1 font-mono"
                />
                <Button size="sm" icon={Power} onClick={() => toggleTtl(true)} loading={ttlBusy} disabled={readOnly || !ttlAttr.trim()}>
                  Ativar
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
