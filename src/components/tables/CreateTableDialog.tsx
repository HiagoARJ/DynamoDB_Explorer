import type { AttributeDefinition, CreateTableCommandInput } from '@aws-sdk/client-dynamodb'
import { Layers, Plus, TableProperties, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useTables } from '../../hooks/useTables'
import { useToast } from '../../hooks/useToast'
import { createTable, describeError, gsiToInput, type NewGsi } from '../../lib/api'
import { Button, IconButton } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Checkbox, Field, Input, Select } from '../ui/Form'
import { Segmented } from '../ui/Misc'
import { KeyInput, validateName, type KeyDraft } from './KeyInputs'

interface GsiDraft {
  id: number
  name: string
  pk: KeyDraft
  useSk: boolean
  sk: KeyDraft
  projection: NewGsi['projection']
  include: string
}

let gsiSeq = 0
const newGsi = (): GsiDraft => ({
  id: ++gsiSeq,
  name: '',
  pk: { name: '', type: 'S' },
  useSk: false,
  sk: { name: '', type: 'S' },
  projection: 'ALL',
  include: '',
})

export function CreateTableDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const { client } = useSettings()
  const { refresh } = useTables()
  const toast = useToast()
  const [name, setName] = useState('')
  const [pk, setPk] = useState<KeyDraft>({ name: 'pk', type: 'S' })
  const [useSk, setUseSk] = useState(false)
  const [sk, setSk] = useState<KeyDraft>({ name: 'sk', type: 'S' })
  const [billing, setBilling] = useState<'PAY_PER_REQUEST' | 'PROVISIONED'>('PAY_PER_REQUEST')
  const [rcu, setRcu] = useState(5)
  const [wcu, setWcu] = useState(5)
  const [gsis, setGsis] = useState<GsiDraft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setPk({ name: 'pk', type: 'S' })
      setUseSk(false)
      setSk({ name: 'sk', type: 'S' })
      setBilling('PAY_PER_REQUEST')
      setGsis([])
      setError(null)
      setTouched(false)
    }
  }, [open])

  const nameError = validateName(name, 'da tabela')

  const build = (): CreateTableCommandInput => {
    if (nameError) throw new Error(nameError)
    if (!pk.name.trim()) throw new Error('Informe o nome da chave de partição.')
    if (useSk && !sk.name.trim()) throw new Error('Informe o nome da chave de classificação.')
    if (useSk && sk.name.trim() === pk.name.trim()) throw new Error('As chaves de partição e classificação devem ser diferentes.')

    const attrs = new Map<string, AttributeDefinition>()
    const addAttr = (k: KeyDraft) => {
      const n = k.name.trim()
      const prev = attrs.get(n)
      if (prev && prev.AttributeType !== k.type)
        throw new Error(`O atributo "${n}" foi definido com tipos diferentes (${prev.AttributeType} e ${k.type}).`)
      attrs.set(n, { AttributeName: n, AttributeType: k.type })
    }
    addAttr(pk)
    if (useSk) addAttr(sk)

    const provisioned = billing === 'PROVISIONED'
    const gsiNames = new Set<string>()
    const indexes = gsis.map((g) => {
      const err = validateName(g.name, 'do índice')
      if (err) throw new Error(`Índice: ${err}`)
      if (gsiNames.has(g.name)) throw new Error(`Índice "${g.name}" duplicado.`)
      gsiNames.add(g.name)
      if (!g.pk.name.trim()) throw new Error(`Informe a chave de partição do índice "${g.name}".`)
      if (g.useSk && !g.sk.name.trim()) throw new Error(`Informe a chave de classificação do índice "${g.name}".`)
      addAttr(g.pk)
      if (g.useSk) addAttr(g.sk)
      return gsiToInput({
        name: g.name,
        pk: { name: g.pk.name.trim(), type: g.pk.type },
        sk: g.useSk ? { name: g.sk.name.trim(), type: g.sk.type } : undefined,
        projection: g.projection,
        nonKeyAttributes: g.include.split(',').map((s) => s.trim()).filter(Boolean),
        rcu: provisioned ? rcu : undefined,
        wcu: provisioned ? wcu : undefined,
      }).index
    })

    return {
      TableName: name,
      AttributeDefinitions: [...attrs.values()],
      KeySchema: [
        { AttributeName: pk.name.trim(), KeyType: 'HASH' },
        ...(useSk ? [{ AttributeName: sk.name.trim(), KeyType: 'RANGE' as const }] : []),
      ],
      BillingMode: billing,
      ...(provisioned ? { ProvisionedThroughput: { ReadCapacityUnits: rcu, WriteCapacityUnits: wcu } } : {}),
      ...(indexes.length ? { GlobalSecondaryIndexes: indexes } : {}),
    }
  }

  const submit = async () => {
    setTouched(true)
    setError(null)
    let input: CreateTableCommandInput
    try {
      input = build()
    } catch (e) {
      setError((e as Error).message)
      return
    }
    setBusy(true)
    try {
      await createTable(client, input)
      toast('success', 'Tabela criada', name)
      await refresh()
      onClose()
      onCreated(name)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const updateGsi = (id: number, patch: Partial<GsiDraft>) =>
    setGsis((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      size="lg"
      icon={TableProperties}
      title="Criar tabela"
      description="Defina a chave primária, o modo de capacidade e, opcionalmente, índices secundários globais."
      footer={
        <>
          {error && <p className="mr-auto max-w-md text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" icon={Plus} onClick={submit} loading={busy}>
            Criar tabela
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Nome da tabela" error={touched ? nameError : null}>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex.: Orders"
            className="font-mono"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chave de partição" hint="Obrigatória — distribui os itens entre partições.">
            <KeyInput value={pk} onChange={setPk} placeholder="pk" />
          </Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Chave de classificação</span>
              <Checkbox checked={useSk} onChange={setUseSk} label={<span className="text-xs text-zinc-500">usar</span>} />
            </div>
            <KeyInput value={sk} onChange={setSk} placeholder="sk" disabled={!useSk} />
            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">Opcional — ordena itens da mesma partição.</span>
          </div>
        </div>

        <div className="grid items-end gap-4 sm:grid-cols-3">
          <Field label="Modo de capacidade">
            <Segmented
              value={billing}
              onChange={setBilling}
              options={[
                { value: 'PAY_PER_REQUEST', label: 'Sob demanda' },
                { value: 'PROVISIONED', label: 'Provisionado' },
              ]}
            />
          </Field>
          {billing === 'PROVISIONED' && (
            <>
              <Field label="Leitura (RCU)">
                <Input type="number" min={1} value={rcu} onChange={(e) => setRcu(Math.max(1, Number(e.target.value)))} />
              </Field>
              <Field label="Escrita (WCU)">
                <Input type="number" min={1} value={wcu} onChange={(e) => setWcu(Math.max(1, Number(e.target.value)))} />
              </Field>
            </>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
              <Layers className="size-4 text-zinc-400" /> Índices secundários globais
            </h3>
            <Button size="xs" icon={Plus} onClick={() => setGsis((g) => [...g, newGsi()])}>
              Adicionar índice
            </Button>
          </div>
          {gsis.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
              Nenhum índice. Você também pode criar índices depois, na aba “Índices”.
            </p>
          ) : (
            <div className="space-y-3">
              {gsis.map((g) => (
                <div key={g.id} className="space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex gap-2">
                    <Input
                      value={g.name}
                      onChange={(e) => updateGsi(g.id, { name: e.target.value })}
                      placeholder="nome-do-indice"
                      className="flex-1 font-mono"
                    />
                    <Select
                      value={g.projection}
                      onChange={(e) => updateGsi(g.id, { projection: e.target.value as NewGsi['projection'] })}
                      className="w-40"
                    >
                      <option value="ALL">Projeção: ALL</option>
                      <option value="KEYS_ONLY">KEYS_ONLY</option>
                      <option value="INCLUDE">INCLUDE</option>
                    </Select>
                    <IconButton
                      icon={Trash2}
                      label="Remover índice"
                      tone="danger"
                      size="md"
                      onClick={() => setGsis((gs) => gs.filter((x) => x.id !== g.id))}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <KeyInput value={g.pk} onChange={(pk) => updateGsi(g.id, { pk })} placeholder="chave de partição" />
                    <div className="flex items-center gap-2">
                      <Checkbox checked={g.useSk} onChange={(useSk) => updateGsi(g.id, { useSk })} />
                      <div className="flex-1">
                        <KeyInput
                          value={g.sk}
                          onChange={(sk) => updateGsi(g.id, { sk })}
                          placeholder="chave de classificação"
                          disabled={!g.useSk}
                        />
                      </div>
                    </div>
                  </div>
                  {g.projection === 'INCLUDE' && (
                    <Input
                      value={g.include}
                      onChange={(e) => updateGsi(g.id, { include: e.target.value })}
                      placeholder="atributos projetados, separados por vírgula"
                      inputSize="sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
