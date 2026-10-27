import type { TableDescription } from '@aws-sdk/client-dynamodb'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { describeError, describeTable, listAllTables } from '../lib/api'
import { useSettings } from './useSettings'

export type ConnectionState = 'connecting' | 'online' | 'offline'

interface TablesCtx {
  names: string[]
  tables: Record<string, TableDescription>
  loading: boolean
  error: string | null
  connection: ConnectionState
  lastLoadedAt: Date | null
  refresh: () => Promise<void>
  refreshTable: (name: string) => Promise<TableDescription | undefined>
}

const Ctx = createContext<TablesCtx | null>(null)

async function mapLimit<T, R>(arr: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(arr.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, arr.length) }, async () => {
    while (i < arr.length) {
      const idx = i++
      out[idx] = await fn(arr[idx])
    }
  })
  await Promise.all(workers)
  return out
}

export function TablesProvider({ children }: { children: ReactNode }) {
  const { client, endpointLabel } = useSettings()
  const [names, setNames] = useState<string[]>([])
  const [tables, setTables] = useState<Record<string, TableDescription>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)
  const reqId = useRef(0)

  const refresh = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    try {
      const list = await listAllTables(client)
      if (id !== reqId.current) return
      setNames(list)
      setConnection('online')
      setError(null)
      const descs = await mapLimit(list, 8, (n) => describeTable(client, n).catch(() => undefined))
      if (id !== reqId.current) return
      const map: Record<string, TableDescription> = {}
      list.forEach((n, i) => {
        if (descs[i]) map[n] = descs[i]!
      })
      setTables(map)
      setLastLoadedAt(new Date())
    } catch (err) {
      if (id !== reqId.current) return
      setError(describeError(err, endpointLabel))
      setConnection('offline')
      setNames([])
      setTables({})
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [client, endpointLabel])

  const refreshTable = useCallback(
    async (name: string) => {
      try {
        const d = await describeTable(client, name)
        setTables((t) => ({ ...t, [name]: d }))
        return d
      } catch (err) {
        if ((err as { name?: string }).name === 'ResourceNotFoundException') {
          setNames((n) => n.filter((x) => x !== name))
          setTables((t) => {
            const next = { ...t }
            delete next[name]
            return next
          })
          return undefined
        }
        throw err
      }
    },
    [client],
  )

  useEffect(() => {
    setConnection('connecting')
    setNames([])
    setTables({})
    setError(null)
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ names, tables, loading, error, connection, lastLoadedAt, refresh, refreshTable }),
    [names, tables, loading, error, connection, lastLoadedAt, refresh, refreshTable],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTables(): TablesCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTables fora do TablesProvider')
  return c
}
