// Cria tabelas de exemplo no LocalStack com dados variados (todos os tipos DynamoDB).
// Uso: npm run seed            → cria o que não existir e grava os itens
//      npm run seed -- --reset → exclui e recria as tabelas de exemplo
import {
  BatchWriteItemCommand,
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  UpdateTimeToLiveCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'

try {
  process.loadEnvFile?.('.env')
} catch {
  // sem .env — usa os padrões
}

const endpoint = process.env.LOCALSTACK_URL || 'http://localhost:4566'
const region = process.env.AWS_REGION || 'us-east-1'
const reset = process.argv.includes('--reset')

const client = new DynamoDBClient({
  endpoint,
  region,
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
})

// PRNG determinístico para dados reproduzíveis
let seed = 42
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min
const pad = (n, w = 4) => String(n).padStart(w, '0')
const daysAgo = (d) => new Date(Date.UTC(2026, 8, 25) - d * 86400000 - int(0, 86399) * 1000)

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Felipe', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Larissa', 'Marcos', 'Natália', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Tiago']
const LAST = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Lima', 'Costa', 'Ferreira', 'Almeida', 'Ribeiro']
const CITIES = [
  ['São Paulo', 'SP'],
  ['Rio de Janeiro', 'RJ'],
  ['Belo Horizonte', 'MG'],
  ['Curitiba', 'PR'],
  ['Porto Alegre', 'RS'],
  ['Recife', 'PE'],
  ['Salvador', 'BA'],
  ['Fortaleza', 'CE'],
]
const TAGS = ['vip', 'beta', 'newsletter', 'b2b', 'mobile', 'early-adopter', 'suporte-prioritario']
const CATEGORIES = ['eletrônicos', 'casa', 'escritório', 'games', 'livros', 'esporte', 'áudio']
const STATUSES = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']

/* ---------------- definições ---------------- */

const tables = [
  {
    TableName: 'Users',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'email-index',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'Orders',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'customerId', AttributeType: 'S' },
      { AttributeName: 'orderId', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
      { AttributeName: 'total', AttributeType: 'N' },
    ],
    KeySchema: [
      { AttributeName: 'customerId', KeyType: 'HASH' },
      { AttributeName: 'orderId', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'status-createdAt-index',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'INCLUDE', NonKeyAttributes: ['total', 'itemsCount'] },
      },
    ],
    LocalSecondaryIndexes: [
      {
        IndexName: 'customer-total-index',
        KeySchema: [
          { AttributeName: 'customerId', KeyType: 'HASH' },
          { AttributeName: 'total', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'KEYS_ONLY' },
      },
    ],
  },
  {
    TableName: 'Products',
    BillingMode: 'PROVISIONED',
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    AttributeDefinitions: [{ AttributeName: 'sku', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'sku', KeyType: 'HASH' }],
  },
  {
    TableName: 'DeviceEvents',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'deviceId', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'N' },
    ],
    KeySchema: [
      { AttributeName: 'deviceId', KeyType: 'HASH' },
      { AttributeName: 'timestamp', KeyType: 'RANGE' },
    ],
    StreamSpecification: { StreamEnabled: true, StreamViewType: 'NEW_AND_OLD_IMAGES' },
  },
]

/* ---------------- dados ---------------- */

function users() {
  return Array.from({ length: 60 }, (_, i) => {
    const first = pick(FIRST)
    const last = pick(LAST)
    const [city, state] = pick(CITIES)
    const tags = new Set(Array.from({ length: int(0, 3) }, () => pick(TAGS)))
    const u = {
      userId: `USR-${pad(i + 1)}`,
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@exemplo.com.br`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
      age: int(18, 70),
      active: rand() > 0.2,
      createdAt: daysAgo(int(30, 900)).toISOString(),
      lastLoginEpoch: Math.floor(daysAgo(int(0, 30)).getTime() / 1000),
      address: { street: `Rua ${pick(LAST)}, ${int(10, 2000)}`, city, state, zip: `${int(10000, 99999)}-${pad(int(0, 999), 3)}` },
      roles: rand() > 0.85 ? ['admin', 'user'] : ['user'],
      preferences: { theme: pick(['dark', 'light', 'system']), notifications: { email: rand() > 0.3, push: rand() > 0.5 } },
      avatar: Buffer.from(`avatar-${i}`),
    }
    if (tags.size) u.tags = tags
    if (rand() > 0.7) u.phone = `+55 11 9${int(1000, 9999)}-${int(1000, 9999)}`
    if (rand() > 0.9) u.deletedAt = null
    return u
  })
}

function orders() {
  const out = []
  let n = 1
  for (let c = 1; c <= 25; c++) {
    for (let k = 0; k < int(2, 12); k++) {
      const created = daysAgo(int(0, 365))
      const lines = Array.from({ length: int(1, 4) }, () => ({
        sku: `SKU-${pad(int(1, 40))}`,
        qty: int(1, 5),
        price: Number((rand() * 500 + 10).toFixed(2)),
      }))
      const total = Number(lines.reduce((s, l) => s + l.qty * l.price, 0).toFixed(2))
      const [city, state] = pick(CITIES)
      const o = {
        customerId: `USR-${pad(c)}`,
        orderId: `${created.toISOString().slice(0, 10)}#${pad(n++, 5)}`,
        status: pick(STATUSES),
        createdAt: created.toISOString(),
        total,
        itemsCount: lines.length,
        items: lines,
        shipping: { method: pick(['PAC', 'SEDEX', 'Retirada']), city, state },
        paymentMethod: pick(['pix', 'credit_card', 'boleto']),
        notes: rand() > 0.8 ? 'Entregar em horário comercial' : null,
        ttl: Math.floor(created.getTime() / 1000) + 3 * 365 * 86400,
      }
      if (rand() > 0.75) o.coupons = new Set([pick(['BEMVINDO10', 'FRETEGRATIS', 'BLACK25', 'VOLTA5'])])
      out.push(o)
    }
  }
  return out
}

function products() {
  return Array.from({ length: 40 }, (_, i) => {
    const cats = new Set([pick(CATEGORIES), pick(CATEGORIES)])
    return {
      sku: `SKU-${pad(i + 1)}`,
      name: `${pick(['Fone', 'Teclado', 'Mouse', 'Cadeira', 'Monitor', 'Luminária', 'Caixa de som', 'Livro', 'Mochila'])} ${pick(['Pro', 'Max', 'Lite', 'X', 'Plus', ''])}`.trim(),
      price: Number((rand() * 3000 + 19.9).toFixed(2)),
      stock: int(0, 500),
      categories: cats,
      ratings: new Set(Array.from({ length: int(1, 5) }, () => int(1, 5))),
      dimensions: { widthCm: int(5, 80), heightCm: int(2, 60), depthCm: int(2, 50), weightKg: Number((rand() * 15).toFixed(2)) },
      available: rand() > 0.15,
      thumbnail: Buffer.from(Array.from({ length: 32 }, () => int(0, 255))),
      launchedAt: daysAgo(int(10, 1500)).toISOString().slice(0, 10),
      ...(rand() > 0.6 ? { discountPct: int(5, 40) } : {}),
    }
  })
}

function deviceEvents() {
  const out = []
  const base = Date.UTC(2026, 8, 24, 0, 0, 0)
  for (let d = 1; d <= 6; d++) {
    for (let e = 0; e < 60; e++) {
      out.push({
        deviceId: `sensor-${pad(d, 2)}`,
        timestamp: base + e * 60_000 * int(1, 20) + d * 7,
        type: pick(['temperature', 'humidity', 'heartbeat', 'alert']),
        payload: { value: Number((rand() * 40).toFixed(2)), unit: pick(['°C', '%']), battery: int(5, 100) },
        tags: ['iot', `zona-${int(1, 4)}`],
        acknowledged: rand() > 0.5,
      })
    }
  }
  // remove duplicatas de chave
  const seen = new Set()
  return out.filter((x) => {
    const k = `${x.deviceId}|${x.timestamp}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/* ---------------- execução ---------------- */

async function writeAll(table, items) {
  for (let i = 0; i < items.length; i += 25) {
    let pending = items.slice(i, i + 25).map((it) => ({
      PutRequest: { Item: marshall(it, { removeUndefinedValues: true, convertClassInstanceToMap: true }) },
    }))
    while (pending.length) {
      const res = await client.send(new BatchWriteItemCommand({ RequestItems: { [table]: pending } }))
      pending = res.UnprocessedItems?.[table] ?? []
    }
  }
}

async function main() {
  console.log(`→ LocalStack: ${endpoint} (${region})`)
  let existing
  try {
    existing = new Set((await client.send(new ListTablesCommand({}))).TableNames ?? [])
  } catch (err) {
    console.error(`✗ Não foi possível conectar ao LocalStack em ${endpoint}. Rode "docker compose up -d" primeiro.`)
    console.error(`  ${err.message}`)
    process.exit(1)
  }

  for (const def of tables) {
    if (existing.has(def.TableName) && reset) {
      await client.send(new DeleteTableCommand({ TableName: def.TableName }))
      existing.delete(def.TableName)
      console.log(`  - ${def.TableName} excluída`)
    }
    if (!existing.has(def.TableName)) {
      await client.send(new CreateTableCommand(def))
      await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: def.TableName })
      console.log(`  + ${def.TableName} criada`)
    } else {
      console.log(`  = ${def.TableName} já existe (use --reset para recriar)`)
    }
  }

  await client
    .send(new UpdateTimeToLiveCommand({ TableName: 'Orders', TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true } }))
    .catch(() => {})

  const data = { Users: users(), Orders: orders(), Products: products(), DeviceEvents: deviceEvents() }
  for (const [table, items] of Object.entries(data)) {
    await writeAll(table, items)
    console.log(`  ✓ ${items.length} itens em ${table}`)
  }
  console.log('Pronto! Rode "npm run dev" e abra http://localhost:5173')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
