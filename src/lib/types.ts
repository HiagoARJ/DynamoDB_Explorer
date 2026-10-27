import type { AttributeValue } from '@aws-sdk/client-dynamodb'

export type Item = Record<string, AttributeValue>

export type AvType = 'S' | 'N' | 'B' | 'BOOL' | 'NULL' | 'M' | 'L' | 'SS' | 'NS' | 'BS'

export type ScalarKeyType = 'S' | 'N' | 'B'

export interface KeySchemaInfo {
  pk: { name: string; type: ScalarKeyType }
  sk?: { name: string; type: ScalarKeyType }
}

export type SkOperator = '=' | '<' | '<=' | '>' | '>=' | 'between' | 'begins_with'

export type FilterOperator =
  | '='
  | '<>'
  | '<'
  | '<='
  | '>'
  | '>='
  | 'between'
  | 'begins_with'
  | 'contains'
  | 'not_contains'
  | 'exists'
  | 'not_exists'

export type FilterValueType = 'S' | 'N' | 'B' | 'BOOL' | 'NULL'

export interface FilterSpec {
  id: string
  attr: string
  type: FilterValueType
  op: FilterOperator
  value: string
  value2: string
}

export interface QuerySpec {
  mode: 'scan' | 'query'
  /** '' = tabela base */
  indexName: string
  pkValue: string
  skOp: SkOperator | ''
  skValue: string
  skValue2: string
  descending: boolean
  filters: FilterSpec[]
  projection: string
  pageSize: number
}

export interface PageResult {
  items: Item[]
  lastKey?: Item
  count: number
  scannedCount: number
  consumed: number
  requests: number
  durationMs: number
}
