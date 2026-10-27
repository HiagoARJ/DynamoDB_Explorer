import type { TableDescription } from '@aws-sdk/client-dynamodb'
import { Code2, Filter, Play, Plus, RotateCcw, ScanLine, Search, Trash2 } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { keySchemaOf } from '../../lib/api'
import { buildExpressions, explainExpressions } from '../../lib/expressions'
import type { FilterOperator, FilterSpec, FilterValueType, QuerySpec, SkOperator } from '../../lib/types'
import { Button, IconButton } from '../ui/Button'
import { Checkbox, Input, Select } from '../ui/Form'
import { Card, Segmented, TypeBadge } from '../ui/Misc'

const SK_OPS: { value: SkOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '<', label: 'Menor que' },
  { value: '<=', label: 'Menor ou igual' },
  { value: '>', label: 'Maior que' },
  { value: '>=', label: 'Maior ou igual' },
  { value: 'between', label: 'Entre' },
  { value: 'begins_with', label: 'Começa com' },
]

const FILTER_OPS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'Igual a' },
  { value: '<>', label: 'Diferente de' },
  { value: '<', label: 'Menor que' },
  { value: '<=', label: 'Menor ou igual' },
  { value: '>', label: 'Maior que' },
  { value: '>=', label: 'Maior ou igual' },
  { value: 'between', label: 'Entre' },
  { value: 'begins_with', label: 'Começa com' },
  { value: 'contains', label: 'Contém' },
  { value: 'not_contains', label: 'Não contém' },
  { value: 'exists', label: 'Existe' },
  { value: 'not_exists', label: 'Não existe' },
]

const FILTER_TYPES: { value: FilterValueType; label: string }[] = [
  { value: 'S', label: 'String' },
  { value: 'N', label: 'Number' },
  { value: 'BOOL', label: 'Boolean' },
  { value: 'NULL', label: 'Null' },
  { value: 'B', label: 'Binary' },
]

let filterSeq = 0
export const newFilter = (): FilterSpec => ({ id: `f${++filterSeq}`, attr: '', type: 'S', op: '=', value: '', value2: '' })

function FilterRow({
  f,
  onChange,
  onRemove,
  onEnter,
  listId,
}: {
  f: FilterSpec
  onChange: (f: FilterSpec) => void
  onRemove: () => void
  onEnter: () => void
  listId: string
}) {
  const noValue = f.op === 'exists' || f.op === 'not_exists' || f.type === 'NULL'
  const ops = FILTER_OPS.filter((o) => {
    if (f.type === 'BOOL' || f.type === 'NULL') return ['=', '<>', 'exists', 'not_exists'].includes(o.value)
    return true
  })
  const key = (e: KeyboardEvent) => e.key === 'Enter' && onEnter()
  return (
    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
      <Input
        inputSize="sm"
        placeholder="atributo"
        value={f.attr}
        list={listId}
        onChange={(e) => onChange({ ...f, attr: e.target.value })}
        onKeyDown={key}
        className="w-full font-mono sm:w-44"
      />
      <Select
        inputSize="sm"
        value={f.type}
        onChange={(e) => {
          const type = e.target.value as FilterValueType
          const op = ops.some((o) => o.value === f.op) || type === 'S' || type === 'N' ? f.op : '='
          onChange({ ...f, type, op, value: type === 'BOOL' ? 'true' : f.value })
        }}
        className="w-28"
      >
        {FILTER_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </Select>
      <Select
        inputSize="sm"
        value={f.op}
        onChange={(e) => onChange({ ...f, op: e.target.value as FilterOperator })}
        className="w-40"
      >
        {ops.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {!noValue &&
        (f.type === 'BOOL' ? (
          <Select inputSize="sm" value={f.value} onChange={(e) => onChange({ ...f, value: e.target.value })} className="w-28">
            <option value="true">true</option>
            <option value="false">false</option>
          </Select>
        ) : (
          <>
            <Input
              inputSize="sm"
              placeholder="valor"
              value={f.value}
              onChange={(e) => onChange({ ...f, value: e.target.value })}
              onKeyDown={key}
              className="min-w-24 flex-1"
            />
            {f.op === 'between' && (
              <Input
                inputSize="sm"
                placeholder="até"
                value={f.value2}
                onChange={(e) => onChange({ ...f, value2: e.target.value })}
                onKeyDown={key}
                className="min-w-24 flex-1"
              />
            )}
          </>
        ))}
      {noValue && <div className="flex-1" />}
      <IconButton icon={Trash2} label="Remover filtro" tone="danger" onClick={onRemove} />
    </div>
  )
}

export function QueryBuilder({
  table,
  spec,
  onChange,
  onRun,
  onReset,
  loading,
  knownAttributes,
}: {
  table: TableDescription
  spec: QuerySpec
  onChange: (s: QuerySpec) => void
  onRun: () => void
  onReset: () => void
  loading: boolean
  knownAttributes: string[]
}) {
  const [showExpr, setShowExpr] = useState(false)
  const keys = keySchemaOf(table, spec.indexName)
  const set = (patch: Partial<QuerySpec>) => onChange({ ...spec, ...patch })
  const listId = `attrs-${table.TableName}`

  const targets = useMemo(
    () => [
      { value: '', label: `Tabela · ${table.TableName}` },
      ...(table.GlobalSecondaryIndexes ?? []).map((i) => ({ value: i.IndexName!, label: `GSI · ${i.IndexName}` })),
      ...(table.LocalSecondaryIndexes ?? []).map((i) => ({ value: i.IndexName!, label: `LSI · ${i.IndexName}` })),
    ],
    [table],
  )

  const preview = useMemo(() => {
    try {
      return { text: explainExpressions(buildExpressions(spec, keys)) || '(sem expressões — todos os itens)' }
    } catch (e) {
      return { error: (e as Error).message }
    }
  }, [spec, keys])

  const enter = () => !loading && onRun()

  return (
    <Card>
      <datalist id={listId}>
        {knownAttributes.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800/80">
        <Segmented
          value={spec.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'scan', label: 'Scan', icon: ScanLine, title: 'Lê toda a tabela ou índice' },
            { value: 'query', label: 'Query', icon: Search, title: 'Busca por chave de partição' },
          ]}
        />
        <Select
          inputSize="sm"
          value={spec.indexName}
          onChange={(e) => set({ indexName: e.target.value, pkValue: '', skValue: '', skValue2: '' })}
          className="w-full min-w-0 sm:w-72"
        >
          {targets.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <div className="flex-1" />
        <IconButton
          icon={Code2}
          label="Mostrar expressões geradas"
          active={showExpr}
          onClick={() => setShowExpr((v) => !v)}
        />
      </div>

      <div className="space-y-4 px-4 py-4">
        {spec.mode === 'query' && keys && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                Chave de partição <span className="font-mono text-zinc-500">{keys.pk.name}</span>
                <TypeBadge type={keys.pk.type} />
              </label>
              <Input
                inputSize="sm"
                autoFocus
                placeholder={`Valor de ${keys.pk.name}`}
                value={spec.pkValue}
                onChange={(e) => set({ pkValue: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && enter()}
              />
            </div>
            {keys.sk && (
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                  Chave de classificação <span className="font-mono text-zinc-500">{keys.sk.name}</span>
                  <TypeBadge type={keys.sk.type} />
                </label>
                <div className="flex gap-2">
                  <Select
                    inputSize="sm"
                    value={spec.skOp}
                    onChange={(e) => set({ skOp: e.target.value as SkOperator | '' })}
                    className="w-40"
                  >
                    <option value="">Qualquer</option>
                    {SK_OPS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  {spec.skOp && (
                    <Input
                      inputSize="sm"
                      placeholder="valor"
                      value={spec.skValue}
                      onChange={(e) => set({ skValue: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && enter()}
                      className="flex-1"
                    />
                  )}
                  {spec.skOp === 'between' && (
                    <Input
                      inputSize="sm"
                      placeholder="até"
                      value={spec.skValue2}
                      onChange={(e) => set({ skValue2: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && enter()}
                      className="flex-1"
                    />
                  )}
                </div>
              </div>
            )}
            <Checkbox
              checked={spec.descending}
              onChange={(descending) => set({ descending })}
              label="Ordem decrescente (ScanIndexForward = false)"
              className="text-zinc-600 dark:text-zinc-400"
            />
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center gap-2">
            <Filter className="size-3.5 text-zinc-400" />
            <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Filtros</span>
            {spec.filters.length > 0 && <span className="text-xs text-zinc-400">todas as condições (AND)</span>}
          </div>
          <div className="space-y-2">
            {spec.filters.map((f, i) => (
              <FilterRow
                key={f.id}
                f={f}
                listId={listId}
                onEnter={enter}
                onChange={(nf) => set({ filters: spec.filters.map((x, j) => (j === i ? nf : x)) })}
                onRemove={() => set({ filters: spec.filters.filter((_, j) => j !== i) })}
              />
            ))}
            <Button size="xs" variant="ghost" icon={Plus} onClick={() => set({ filters: [...spec.filters, newFilter()] })}>
              Adicionar filtro
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            inputSize="sm"
            placeholder="Projeção (opcional): atributos separados por vírgula"
            value={spec.projection}
            list={listId}
            onChange={(e) => set({ projection: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && enter()}
            className="font-mono"
          />
          <Select
            inputSize="sm"
            value={spec.pageSize}
            onChange={(e) => set({ pageSize: Number(e.target.value) })}
            className="w-full sm:w-40"
          >
            {[25, 50, 100, 250, 500, 1000].map((n) => (
              <option key={n} value={n}>
                {n} por página
              </option>
            ))}
          </Select>
        </div>

        {showExpr && (
          <pre
            className={`overflow-x-auto rounded-lg px-3 py-2 font-mono text-xs ${
              preview.error
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                : 'bg-zinc-50 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'
            }`}
          >
            {preview.error ?? preview.text}
          </pre>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800/80">
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={onReset}>
          Redefinir
        </Button>
        <Button size="sm" variant="primary" icon={Play} onClick={onRun} loading={loading}>
          Executar
        </Button>
      </div>
    </Card>
  )
}
