import {
  BatchWriteItemCommand,
  CreateTableCommand,
  DeleteItemCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
  ListTablesCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateTableCommand,
  UpdateTimeToLiveCommand,
  type AttributeDefinition,
  type CreateTableCommandInput,
  type DynamoDBClient,
  type GlobalSecondaryIndex,
  type TableDescription,
  type TimeToLiveDescription,
  type WriteRequest,
} from '@aws-sdk/client-dynamodb'
import { buildExpressions } from './expressions'
import type { Item, KeySchemaInfo, PageResult, QuerySpec, ScalarKeyType } from './types'

export async function listAllTables(client: DynamoDBClient): Promise<string[]> {
  const names: string[] = []
  let start: string | undefined
  do {
    const res = await client.send(new ListTablesCommand({ ExclusiveStartTableName: start, Limit: 100 }))
    names.push(...(res.TableNames ?? []))
    start = res.LastEvaluatedTableName
  } while (start)
  return names.sort((a, b) => a.localeCompare(b))
}

export async function describeTable(client: DynamoDBClient, name: string): Promise<TableDescription> {
  const res = await client.send(new DescribeTableCommand({ TableName: name }))
  return res.Table!
}

export async function describeTtl(client: DynamoDBClient, name: string): Promise<TimeToLiveDescription | undefined> {
  try {
    const res = await client.send(new DescribeTimeToLiveCommand({ TableName: name }))
    return res.TimeToLiveDescription
  } catch {
    return undefined
  }
}

export async function updateTtl(client: DynamoDBClient, table: string, attr: string, enabled: boolean) {
  await client.send(
    new UpdateTimeToLiveCommand({
      TableName: table,
      TimeToLiveSpecification: { AttributeName: attr, Enabled: enabled },
    }),
  )
}

/** Extrai o esquema de chaves da tabela base ou de um índice. */
export function keySchemaOf(table: TableDescription, indexName = ''): KeySchemaInfo | undefined {
  const index =
    indexName === ''
      ? undefined
      : [...(table.GlobalSecondaryIndexes ?? []), ...(table.LocalSecondaryIndexes ?? [])].find(
          (i) => i.IndexName === indexName,
        )
  const schema = indexName === '' ? table.KeySchema : index?.KeySchema
  if (!schema) return undefined
  const typeOf = (n: string): ScalarKeyType =>
    (table.AttributeDefinitions?.find((a) => a.AttributeName === n)?.AttributeType as ScalarKeyType) ?? 'S'
  const hash = schema.find((k) => k.KeyType === 'HASH')!
  const range = schema.find((k) => k.KeyType === 'RANGE')
  return {
    pk: { name: hash.AttributeName!, type: typeOf(hash.AttributeName!) },
    sk: range ? { name: range.AttributeName!, type: typeOf(range.AttributeName!) } : undefined,
  }
}

export function tableKeyNames(table: TableDescription): string[] {
  const k = keySchemaOf(table)
  return k ? [k.pk.name, ...(k.sk ? [k.sk.name] : [])] : []
}

const MAX_REQUESTS_PER_PAGE = 40

/**
 * Executa Scan/Query e continua paginando internamente até preencher `pageSize`
 * itens (filtros são aplicados depois do Limit no DynamoDB, o que gera páginas vazias).
 */
export async function fetchPage(
  client: DynamoDBClient,
  table: TableDescription,
  spec: QuerySpec,
  startKey: Item | undefined,
  signal?: AbortSignal,
): Promise<PageResult> {
  const keys = keySchemaOf(table, spec.indexName)
  const expr = buildExpressions(spec, keys)
  const t0 = performance.now()
  const items: Item[] = []
  let lastKey = startKey
  let scanned = 0
  let consumed = 0
  let requests = 0

  do {
    const base = {
      TableName: table.TableName!,
      IndexName: spec.indexName || undefined,
      Limit: spec.pageSize - items.length,
      ExclusiveStartKey: lastKey,
      ReturnConsumedCapacity: 'TOTAL' as const,
      ...expr,
    }
    const res =
      spec.mode === 'query'
        ? await client.send(new QueryCommand({ ...base, ScanIndexForward: !spec.descending }), { abortSignal: signal })
        : await client.send(new ScanCommand(base), { abortSignal: signal })
    requests++
    items.push(...((res.Items ?? []) as Item[]))
    scanned += res.ScannedCount ?? 0
    consumed += res.ConsumedCapacity?.CapacityUnits ?? 0
    lastKey = res.LastEvaluatedKey as Item | undefined
  } while (lastKey && items.length < spec.pageSize && requests < MAX_REQUESTS_PER_PAGE)

  return {
    items,
    lastKey,
    count: items.length,
    scannedCount: scanned,
    consumed,
    requests,
    durationMs: performance.now() - t0,
  }
}

/** Amostra de itens (para inferir esquema). */
export async function sampleItems(client: DynamoDBClient, table: string, limit = 200): Promise<Item[]> {
  const res = await client.send(new ScanCommand({ TableName: table, Limit: limit }))
  return (res.Items ?? []) as Item[]
}

export async function putItem(
  client: DynamoDBClient,
  table: string,
  item: Item,
  opts: { mustNotExist?: string } = {},
) {
  await client.send(
    new PutItemCommand({
      TableName: table,
      Item: item,
      ...(opts.mustNotExist
        ? { ConditionExpression: 'attribute_not_exists(#pk)', ExpressionAttributeNames: { '#pk': opts.mustNotExist } }
        : {}),
    }),
  )
}

export async function deleteItem(client: DynamoDBClient, table: string, key: Item) {
  await client.send(new DeleteItemCommand({ TableName: table, Key: key }))
}

export async function batchDelete(
  client: DynamoDBClient,
  table: string,
  keys: Item[],
  onProgress?: (done: number) => void,
) {
  let done = 0
  for (let i = 0; i < keys.length; i += 25) {
    let pending: WriteRequest[] = keys.slice(i, i + 25).map((k) => ({ DeleteRequest: { Key: k } }))
    let attempt = 0
    while (pending.length) {
      const res = await client.send(new BatchWriteItemCommand({ RequestItems: { [table]: pending } }))
      const left = res.UnprocessedItems?.[table] ?? []
      done += pending.length - left.length
      onProgress?.(done)
      pending = left
      if (pending.length) {
        if (++attempt > 8) throw new Error(`${pending.length} itens não puderam ser excluídos.`)
        await new Promise((r) => setTimeout(r, 50 * 2 ** attempt))
      }
    }
  }
}

export async function createTable(client: DynamoDBClient, input: CreateTableCommandInput) {
  await client.send(new CreateTableCommand(input))
}

export async function deleteTable(client: DynamoDBClient, name: string) {
  await client.send(new DeleteTableCommand({ TableName: name }))
}

export interface NewGsi {
  name: string
  pk: { name: string; type: ScalarKeyType }
  sk?: { name: string; type: ScalarKeyType }
  projection: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
  nonKeyAttributes: string[]
  rcu?: number
  wcu?: number
}

export function gsiToInput(g: NewGsi): { index: GlobalSecondaryIndex; attrs: AttributeDefinition[] } {
  const attrs: AttributeDefinition[] = [{ AttributeName: g.pk.name, AttributeType: g.pk.type }]
  if (g.sk) attrs.push({ AttributeName: g.sk.name, AttributeType: g.sk.type })
  return {
    attrs,
    index: {
      IndexName: g.name,
      KeySchema: [
        { AttributeName: g.pk.name, KeyType: 'HASH' },
        ...(g.sk ? [{ AttributeName: g.sk.name, KeyType: 'RANGE' as const }] : []),
      ],
      Projection: {
        ProjectionType: g.projection,
        ...(g.projection === 'INCLUDE' ? { NonKeyAttributes: g.nonKeyAttributes } : {}),
      },
      ...(g.rcu && g.wcu ? { ProvisionedThroughput: { ReadCapacityUnits: g.rcu, WriteCapacityUnits: g.wcu } } : {}),
    },
  }
}

export async function createGsi(client: DynamoDBClient, table: TableDescription, g: NewGsi) {
  const { index, attrs } = gsiToInput(g)
  const existing = table.AttributeDefinitions ?? []
  const merged = [...existing]
  for (const a of attrs) {
    const found = merged.find((e) => e.AttributeName === a.AttributeName)
    if (found && found.AttributeType !== a.AttributeType)
      throw new Error(`O atributo "${a.AttributeName}" já está definido como ${found.AttributeType}.`)
    if (!found) merged.push(a)
  }
  await client.send(
    new UpdateTableCommand({
      TableName: table.TableName,
      AttributeDefinitions: merged,
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: index.IndexName,
            KeySchema: index.KeySchema,
            Projection: index.Projection,
            ProvisionedThroughput: index.ProvisionedThroughput,
          },
        },
      ],
    }),
  )
}

export async function deleteGsi(client: DynamoDBClient, table: string, indexName: string) {
  await client.send(
    new UpdateTableCommand({
      TableName: table,
      GlobalSecondaryIndexUpdates: [{ Delete: { IndexName: indexName } }],
    }),
  )
}

/* ---------- erros ---------- */

export function describeError(err: unknown, endpoint?: string): string {
  const e = err as { name?: string; message?: string; code?: string; $metadata?: { httpStatusCode?: number } }
  const status = e?.$metadata?.httpStatusCode
  const msg = e?.message ?? String(err)
  const connection =
    e?.name === 'TypeError' ||
    e?.name === 'AggregateError' ||
    e?.code === 'ECONNREFUSED' ||
    /Failed to fetch|NetworkError|ECONNREFUSED|socket hang up|Load failed/i.test(msg) ||
    ((status === 500 || status === 502 || status === 503 || status === 504) &&
      /Deserialization|UnknownError|Unexpected|non-JSON|JSON/i.test(`${e?.name} ${msg}`))
  if (connection) {
    if (endpoint?.includes('amazonaws.com'))
      return `Não foi possível conectar a ${endpoint}. Verifique a região, sua rede e se as credenciais estão preenchidas.`
    return `Não foi possível conectar${endpoint ? ` a ${endpoint}` : ''}. Verifique se o LocalStack está rodando (docker compose up -d).`
  }
  if (
    e?.name === 'UnrecognizedClientException' ||
    e?.name === 'InvalidSignatureException' ||
    e?.name === 'InvalidClientTokenId' ||
    e?.name === 'CredentialsProviderError' ||
    /Resolved credential object is not valid/i.test(msg)
  )
    return 'Credenciais inválidas: confira a Access Key, a Secret Key e (se usar SSO/STS) o Session Token.'
  if (e?.name === 'ExpiredTokenException') return 'As credenciais temporárias expiraram. Gere um novo Session Token.'
  if (e?.name === 'AccessDeniedException') return `Acesso negado pelo IAM: ${msg}`
  if (e?.name === 'ResourceNotFoundException') return 'Tabela ou índice não encontrado.'
  if (e?.name === 'ConditionalCheckFailedException') return 'Já existe um item com essa chave primária.'
  if (e?.name === 'ResourceInUseException') return `Recurso em uso: ${msg}`
  if (e?.name === 'ValidationException') return `Validação: ${msg}`
  if (e?.name === 'UnknownError' || !msg || msg === e?.name) {
    if (status === 403)
      return `O servidor recusou a requisição (HTTP 403)${endpoint ? ` em ${endpoint}` : ''}. Em LocalStack isso costuma ser bloqueio de CORS: use o endpoint "/localstack" (proxy) ou libere a origem com EXTRA_CORS_ALLOWED_ORIGINS.`
    if (status) return `Resposta inesperada do servidor (HTTP ${status})${endpoint ? ` em ${endpoint}` : ''}.`
  }
  return msg
}

export function isAbort(err: unknown): boolean {
  return (err as { name?: string })?.name === 'AbortError'
}
