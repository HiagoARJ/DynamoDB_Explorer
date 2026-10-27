import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { connectionEndpoint, type Connection } from './connections'

/** Endpoints relativos (ex.: "/localstack") passam pelo proxy do Vite/nginx. */
export function resolveEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '')
  if (trimmed.startsWith('/')) return window.location.origin + trimmed
  return trimmed
}

export function createClient(c: Connection): DynamoDBClient {
  const endpoint = connectionEndpoint(c)
  return new DynamoDBClient({
    ...(endpoint ? { endpoint: resolveEndpoint(endpoint) } : {}),
    region: c.region || 'us-east-1',
    credentials: {
      accessKeyId: c.accessKeyId || (c.kind === 'aws' ? '' : 'test'),
      secretAccessKey: c.secretAccessKey || (c.kind === 'aws' ? '' : 'test'),
      ...(c.sessionToken.trim() ? { sessionToken: c.sessionToken.trim() } : {}),
    },
    maxAttempts: 2,
  })
}
