import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import type { AvType, Item, ScalarKeyType } from './types'

export function avType(av: AttributeValue): AvType {
  if (av.S !== undefined) return 'S'
  if (av.N !== undefined) return 'N'
  if (av.B !== undefined) return 'B'
  if (av.BOOL !== undefined) return 'BOOL'
  if (av.NULL !== undefined) return 'NULL'
  if (av.M !== undefined) return 'M'
  if (av.L !== undefined) return 'L'
  if (av.SS !== undefined) return 'SS'
  if (av.NS !== undefined) return 'NS'
  return 'BS'
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim())
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Converte um número DynamoDB (string) em number quando isso não perde precisão. */
function numberOrString(n: string): number | string {
  const num = Number(n)
  if (!Number.isFinite(num)) return n
  return String(num) === n.replace(/^\+/, '') ? num : n
}

export type Plain = null | boolean | number | string | Plain[] | { [k: string]: Plain }

/** AttributeValue → JSON "normal". Binários viram base64, sets viram arrays. */
export function toPlain(av: AttributeValue): Plain {
  switch (avType(av)) {
    case 'S':
      return av.S!
    case 'N':
      return numberOrString(av.N!)
    case 'B':
      return bytesToBase64(av.B!)
    case 'BOOL':
      return av.BOOL!
    case 'NULL':
      return null
    case 'M':
      return itemToPlain(av.M!)
    case 'L':
      return av.L!.map(toPlain)
    case 'SS':
      return [...av.SS!]
    case 'NS':
      return av.NS!.map(numberOrString)
    case 'BS':
      return av.BS!.map(bytesToBase64)
  }
}

export function itemToPlain(item: Item): { [k: string]: Plain } {
  const out: { [k: string]: Plain } = {}
  for (const [k, v] of Object.entries(item)) out[k] = toPlain(v)
  return out
}

/**
 * JSON "normal" → AttributeValue. `hint` é o valor original: quando presente,
 * preserva tipos que JSON não expressa (sets, binários, números grandes).
 */
export function fromPlain(value: unknown, hint?: AttributeValue): AttributeValue {
  const h = hint ? avType(hint) : undefined
  if (value === null || value === undefined) return { NULL: true }
  if (typeof value === 'boolean') return { BOOL: value }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Número inválido: ${value}`)
    return { N: String(value) }
  }
  if (typeof value === 'string') {
    if (h === 'N' && value.trim() !== '' && !Number.isNaN(Number(value))) return { N: value.trim() }
    if (h === 'B') return { B: base64ToBytes(value) }
    return { S: value }
  }
  if (Array.isArray(value)) {
    if (value.length > 0) {
      if (h === 'SS' && value.every((v) => typeof v === 'string')) return { SS: dedupe(value as string[]) }
      if (h === 'NS' && value.every((v) => typeof v === 'number' || (typeof v === 'string' && !Number.isNaN(Number(v)))))
        return { NS: dedupe(value.map(String)) }
      if (h === 'BS' && value.every((v) => typeof v === 'string'))
        return { BS: (value as string[]).map(base64ToBytes) }
    }
    const hintList = h === 'L' ? hint!.L! : undefined
    return { L: value.map((v, i) => fromPlain(v, hintList?.[i])) }
  }
  if (typeof value === 'object') {
    const hintMap = h === 'M' ? hint!.M! : undefined
    const m: Item = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue
      m[k] = fromPlain(v, hintMap?.[k])
    }
    return { M: m }
  }
  throw new Error(`Tipo não suportado: ${typeof value}`)
}

export function itemFromPlain(obj: unknown, hint?: Item): Item {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('O item deve ser um objeto JSON.')
  const out: Item = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined) continue
    out[k] = fromPlain(v, hint?.[k])
  }
  return out
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

/* ---------- DynamoDB JSON (formato wire, com binários em base64) ---------- */

export type DdbJson = Record<string, unknown>

export function toDdbJson(av: AttributeValue): DdbJson {
  switch (avType(av)) {
    case 'B':
      return { B: bytesToBase64(av.B!) }
    case 'BS':
      return { BS: av.BS!.map(bytesToBase64) }
    case 'M':
      return { M: itemToDdbJson(av.M!) }
    case 'L':
      return { L: av.L!.map(toDdbJson) }
    default:
      return { ...av } as DdbJson
  }
}

export function itemToDdbJson(item: Item): Record<string, DdbJson> {
  const out: Record<string, DdbJson> = {}
  for (const [k, v] of Object.entries(item)) out[k] = toDdbJson(v)
  return out
}

const AV_KEYS: AvType[] = ['S', 'N', 'B', 'BOOL', 'NULL', 'M', 'L', 'SS', 'NS', 'BS']

export function fromDdbJson(json: unknown, path = ''): AttributeValue {
  if (!json || typeof json !== 'object' || Array.isArray(json))
    throw new Error(`Valor inválido em "${path || 'raiz'}": esperado um objeto como {"S": "..."}.`)
  const keys = Object.keys(json)
  if (keys.length !== 1 || !AV_KEYS.includes(keys[0] as AvType))
    throw new Error(`Valor inválido em "${path}": use exatamente um tipo (${AV_KEYS.join(', ')}).`)
  const t = keys[0] as AvType
  const v = (json as Record<string, unknown>)[t]
  const fail = (msg: string) => {
    throw new Error(`"${path}" (${t}): ${msg}`)
  }
  switch (t) {
    case 'S':
      if (typeof v !== 'string') fail('esperado string')
      return { S: v as string }
    case 'N':
      if ((typeof v !== 'string' && typeof v !== 'number') || Number.isNaN(Number(v))) fail('esperado número em string')
      return { N: String(v) }
    case 'B':
      if (typeof v !== 'string') fail('esperado base64')
      return { B: base64ToBytes(v as string) }
    case 'BOOL':
      if (typeof v !== 'boolean') fail('esperado true/false')
      return { BOOL: v as boolean }
    case 'NULL':
      if (v !== true) fail('esperado true')
      return { NULL: true }
    case 'M':
      return { M: itemFromDdbJson(v, path) }
    case 'L':
      if (!Array.isArray(v)) fail('esperado array')
      return { L: (v as unknown[]).map((e, i) => fromDdbJson(e, `${path}[${i}]`)) }
    case 'SS':
      if (!Array.isArray(v) || !v.every((e) => typeof e === 'string') || v.length === 0) fail('esperado array não vazio de strings')
      return { SS: dedupe(v as string[]) }
    case 'NS':
      if (!Array.isArray(v) || v.length === 0 || !v.every((e) => !Number.isNaN(Number(e)))) fail('esperado array não vazio de números')
      return { NS: dedupe((v as unknown[]).map(String)) }
    case 'BS':
      if (!Array.isArray(v) || v.length === 0 || !v.every((e) => typeof e === 'string')) fail('esperado array não vazio de base64')
      return { BS: (v as string[]).map(base64ToBytes) }
  }
}

export function itemFromDdbJson(obj: unknown, path = ''): Item {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('O item deve ser um objeto JSON.')
  const out: Item = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = fromDdbJson(v, path ? `${path}.${k}` : k)
  }
  return out
}

/* ---------- chaves ---------- */

/** Reordena os atributos: chaves primeiro, depois ordem alfabética (só afeta a exibição/serialização). */
export function orderItem(item: Item, keyNames: string[]): Item {
  const out: Item = {}
  for (const k of keyNames) if (item[k]) out[k] = item[k]
  for (const k of Object.keys(item).sort((a, b) => a.localeCompare(b))) if (!(k in out)) out[k] = item[k]
  return out
}

export function scalarToAv(type: ScalarKeyType, raw: string): AttributeValue {
  if (type === 'N') {
    if (raw.trim() === '' || Number.isNaN(Number(raw))) throw new Error(`"${raw}" não é um número válido.`)
    return { N: raw.trim() }
  }
  if (type === 'B') return { B: base64ToBytes(raw) }
  return { S: raw }
}

export function keyOf(item: Item, keyNames: string[]): Item {
  const k: Item = {}
  for (const n of keyNames) if (item[n]) k[n] = item[n]
  return k
}

export function scalarString(av: AttributeValue | undefined): string {
  if (!av) return ''
  if (av.S !== undefined) return av.S
  if (av.N !== undefined) return av.N
  if (av.B !== undefined) return bytesToBase64(av.B)
  return JSON.stringify(toPlain(av))
}

export function keyId(item: Item, keyNames: string[]): string {
  return keyNames.map((n) => scalarString(item[n])).join('\u0000')
}

export function avEquals(a: AttributeValue | undefined, b: AttributeValue | undefined): boolean {
  if (!a || !b) return a === b
  return JSON.stringify(toDdbJson(a)) === JSON.stringify(toDdbJson(b))
}
