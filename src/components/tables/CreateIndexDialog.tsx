import type { TableDescription } from '@aws-sdk/client-dynamodb'
import { Layers, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { createGsi, describeError, type NewGsi } from '../../lib/api'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Checkbox, Field, Input, Select } from '../ui/Form'
import { KeyInput, validateName, type KeyDraft } from './KeyInputs'

export function CreateIndexDialog({
  open,
  onClose,
  table,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  table: TableDescription
  onCreated: () => void
}) {
  const { client } = useSettings()
  const toast = useToast()
  const [name, setName] = useState('')
  const [pk, setPk] = useState<KeyDraft>({ name: '', type: 'S' })
  const [useSk, setUseSk] = useState(false)
  const [sk, setSk] = useState<KeyDraft>({ name: '', type: 'S' })
  const [projection, setProjection] = useState<NewGsi['projection']>('ALL')
  const [include, setInclude] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const provisioned = table.BillingModeSummary?.BillingMode !== 'PAY_PER_REQUEST'
  const [rcu, setRcu] = useState(5)
  const [wcu, setWcu] = useState(5)

  useEffect(() => {
    if (open) {
      setName('')
      setPk({ name: '', type: 'S' })
      setUseSk(false)
      setSk({ name: '', type: 'S' })
      setProjection('ALL')
      setInclude('')
      setError(null)
    }
  }, [open])

  // Preenche o tipo automaticamente quando o atributo já existe nas definições da tabela.
  const withKnownType = (k: KeyDraft): KeyDraft => {
    const def = table.AttributeDefinitions?.find((a) => a.AttributeName === k.name.trim())
    return def ? { ...k, type: def.AttributeType as KeyDraft['type'] } : k
  }

  const submit = async () => {
    setError(null)
    const nameErr = validateName(name, 'do índice')
    if (nameErr) return setError(nameErr)
    if (!pk.name.trim()) return setError('Informe a chave de partição do índice.')
    if (useSk && !sk.name.trim()) return setError('Informe a chave de classificação do índice.')
    setBusy(true)
    try {
      await createGsi(client, table, {
        name,
        pk: { name: pk.name.trim(), type: pk.type },
        sk: useSk ? { name: sk.name.trim(), type: sk.type } : undefined,
        projection,
        nonKeyAttributes: include.split(',').map((s) => s.trim()).filter(Boolean),
        rcu: provisioned ? rcu : undefined,
        wcu: provisioned ? wcu : undefined,
      })
      toast('success', 'Índice criado', name)
      onClose()
      onCreated()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      icon={Layers}
      title="Criar índice secundário global"
      description={`Tabela ${table.TableName}`}
      footer={
        <>
          {error && <p className="mr-auto max-w-sm text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" icon={Plus} onClick={submit} loading={busy}>
            Criar índice
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome do índice">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="status-index" className="font-mono" />
        </Field>
        <Field label="Chave de partição">
          <KeyInput value={pk} onChange={(k) => setPk(withKnownType(k))} placeholder="atributo" />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Chave de classificação</span>
            <Checkbox checked={useSk} onChange={setUseSk} label={<span className="text-xs text-zinc-500">usar</span>} />
          </div>
          <KeyInput value={sk} onChange={(k) => setSk(withKnownType(k))} placeholder="atributo" disabled={!useSk} />
        </div>
        <Field label="Atributos projetados">
          <Select value={projection} onChange={(e) => setProjection(e.target.value as NewGsi['projection'])}>
            <option value="ALL">ALL — todos os atributos</option>
            <option value="KEYS_ONLY">KEYS_ONLY — apenas chaves</option>
            <option value="INCLUDE">INCLUDE — chaves + atributos escolhidos</option>
          </Select>
        </Field>
        {projection === 'INCLUDE' && (
          <Field label="Atributos incluídos" hint="Separados por vírgula.">
            <Input value={include} onChange={(e) => setInclude(e.target.value)} placeholder="status, total" />
          </Field>
        )}
        {provisioned && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Leitura (RCU)">
              <Input type="number" min={1} value={rcu} onChange={(e) => setRcu(Math.max(1, Number(e.target.value)))} />
            </Field>
            <Field label="Escrita (WCU)">
              <Input type="number" min={1} value={wcu} onChange={(e) => setWcu(Math.max(1, Number(e.target.value)))} />
            </Field>
          </div>
        )}
      </div>
    </Dialog>
  )
}
