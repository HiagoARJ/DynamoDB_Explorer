import type { ScalarKeyType } from '../../lib/types'
import { Input, KEY_TYPES, Select } from '../ui/Form'

export interface KeyDraft {
  name: string
  type: ScalarKeyType
}

export function KeyInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: KeyDraft
  onChange: (v: KeyDraft) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="flex gap-2">
      <Input
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 font-mono"
      />
      <Select
        value={value.type}
        onChange={(e) => onChange({ ...value, type: e.target.value as ScalarKeyType })}
        disabled={disabled}
        className="w-32"
      >
        {KEY_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </Select>
    </div>
  )
}

export const NAME_RE = /^[a-zA-Z0-9_.-]{3,255}$/

export function validateName(name: string, what: string): string | null {
  if (!name.trim()) return `Informe o nome ${what}.`
  if (!NAME_RE.test(name)) return 'Use 3–255 caracteres: letras, números, "_", "-" ou ".".'
  return null
}
