import { Plug, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSettings, type Settings as S } from '../../hooks/useSettings'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, Select } from '../ui/Form'
import { Segmented } from '../ui/Misc'

export function SettingsDialog({
  open,
  onClose,
  onManageConnections,
}: {
  open: boolean
  onClose: () => void
  onManageConnections: () => void
}) {
  const { settings, update } = useSettings()
  const [draft, setDraft] = useState<S>(settings)

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  const set = (patch: Partial<S>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Preferências"
      description="Aparência e comportamento da exploração de itens."
      icon={Settings}
      footer={
        <>
          <Button
            variant="ghost"
            icon={Plug}
            className="mr-auto"
            onClick={() => {
              onClose()
              onManageConnections()
            }}
          >
            Gerenciar conexões
          </Button>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={() => {
              update(draft)
              onClose()
            }}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Tema">
          <Segmented
            value={draft.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: 'system', label: 'Sistema' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
            ]}
          />
        </Field>
        <Field label="Densidade da tabela">
          <Segmented
            value={draft.density}
            onChange={(density) => set({ density })}
            options={[
              { value: 'compact', label: 'Compacta' },
              { value: 'comfortable', label: 'Confortável' },
            ]}
          />
        </Field>
        <Field label="Itens por página">
          <Select value={draft.pageSize} onChange={(e) => set({ pageSize: Number(e.target.value) })}>
            {[25, 50, 100, 250, 500, 1000].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  )
}
