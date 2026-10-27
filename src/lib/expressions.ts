import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { base64ToBytes, scalarToAv } from './convert'
import type { FilterSpec, FilterValueType, KeySchemaInfo, QuerySpec } from './types'

export interface BuiltExpressions {
  KeyConditionExpression?: string
  FilterExpression?: string
  ProjectionExpression?: string
  ExpressionAttributeNames?: Record<string, string>
  ExpressionAttributeValues?: Record<string, AttributeValue>
}

class Builder {
  names: Record<string, string> = {}
  values: Record<string, AttributeValue> = {}
  private nameIdx = new Map<string, string>()
  private v = 0

  name(attr: string): string {
    let ph = this.nameIdx.get(attr)
    if (!ph) {
      ph = `#n${this.nameIdx.size}`
      this.nameIdx.set(attr, ph)
      this.names[ph] = attr
    }
    return ph
  }

  value(av: AttributeValue): string {
    const ph = `:v${this.v++}`
    this.values[ph] = av
    return ph
  }
}

export function filterValueToAv(type: FilterValueType, raw: string): AttributeValue {
  switch (type) {
    case 'S':
      return { S: raw }
    case 'N':
      if (raw.trim() === '' || Number.isNaN(Number(raw))) throw new Error(`"${raw}" não é um número válido.`)
      return { N: raw.trim() }
    case 'B':
      return { B: base64ToBytes(raw) }
    case 'BOOL':
      return { BOOL: raw === 'true' }
    case 'NULL':
      return { NULL: true }
  }
}

function buildFilter(b: Builder, f: FilterSpec): string {
  const n = b.name(f.attr.trim())
  const val = () => b.value(filterValueToAv(f.type, f.value))
  switch (f.op) {
    case 'exists':
      return `attribute_exists(${n})`
    case 'not_exists':
      return `attribute_not_exists(${n})`
    case 'begins_with':
      return `begins_with(${n}, ${val()})`
    case 'contains':
      return `contains(${n}, ${val()})`
    case 'not_contains':
      return `NOT contains(${n}, ${val()})`
    case 'between':
      return `${n} BETWEEN ${val()} AND ${b.value(filterValueToAv(f.type, f.value2))}`
    default:
      return `${n} ${f.op} ${val()}`
  }
}

export function buildExpressions(spec: QuerySpec, keys: KeySchemaInfo | undefined): BuiltExpressions {
  const b = new Builder()
  const out: BuiltExpressions = {}

  if (spec.mode === 'query') {
    if (!keys) throw new Error('Esquema de chaves desconhecido.')
    if (spec.pkValue === '') throw new Error(`Informe o valor da chave de partição "${keys.pk.name}".`)
    const parts = [`${b.name(keys.pk.name)} = ${b.value(scalarToAv(keys.pk.type, spec.pkValue))}`]
    if (keys.sk && spec.skOp && spec.skValue !== '') {
      const n = b.name(keys.sk.name)
      const v1 = b.value(scalarToAv(keys.sk.type, spec.skValue))
      if (spec.skOp === 'begins_with') parts.push(`begins_with(${n}, ${v1})`)
      else if (spec.skOp === 'between') {
        if (spec.skValue2 === '') throw new Error('Informe os dois valores do intervalo (between).')
        parts.push(`${n} BETWEEN ${v1} AND ${b.value(scalarToAv(keys.sk.type, spec.skValue2))}`)
      } else parts.push(`${n} ${spec.skOp} ${v1}`)
    }
    out.KeyConditionExpression = parts.join(' AND ')
  }

  const filters = spec.filters.filter((f) => f.attr.trim() !== '')
  if (filters.length) out.FilterExpression = filters.map((f) => buildFilter(b, f)).join(' AND ')

  const proj = spec.projection
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (proj.length) out.ProjectionExpression = proj.map((p) => b.name(p)).join(', ')

  if (Object.keys(b.names).length) out.ExpressionAttributeNames = b.names
  if (Object.keys(b.values).length) out.ExpressionAttributeValues = b.values
  return out
}

/** Representação legível da expressão (para mostrar ao usuário). */
export function explainExpressions(e: BuiltExpressions): string {
  const sub = (s?: string) => {
    if (!s) return s
    let r = s
    // placeholders mais longos primeiro, para "#n10" não ser trocado por "#n1"
    const byLen = <T,>(o: Record<string, T>) => Object.entries(o).sort((a, b) => b[0].length - a[0].length)
    for (const [ph, name] of byLen(e.ExpressionAttributeNames ?? {})) r = r.split(ph).join(name)
    for (const [ph, av] of byLen(e.ExpressionAttributeValues ?? {})) {
      const v = av.S !== undefined ? JSON.stringify(av.S) : av.N ?? (av.BOOL !== undefined ? String(av.BOOL) : av.NULL ? 'null' : '<binário>')
      r = r.split(ph).join(v)
    }
    return r
  }
  return [
    e.KeyConditionExpression && `KEY  ${sub(e.KeyConditionExpression)}`,
    e.FilterExpression && `FILTER  ${sub(e.FilterExpression)}`,
    e.ProjectionExpression && `PROJECT  ${sub(e.ProjectionExpression)}`,
  ]
    .filter(Boolean)
    .join('\n')
}
