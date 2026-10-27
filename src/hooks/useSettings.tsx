import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '../lib/client'
import {
  connectionTarget,
  DEFAULT_CONNECTION_ID,
  DEFAULT_LOCALSTACK,
  loadConnections,
  saveConnections,
  type Connection,
} from '../lib/connections'
import { readJSON, writeJSON } from '../lib/storage'

export type Theme = 'system' | 'light' | 'dark'
export type Density = 'compact' | 'comfortable'

export interface Settings {
  theme: Theme
  density: Density
  pageSize: number
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  density: 'comfortable',
  pageSize: 50,
}

interface SettingsCtx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  isDark: boolean

  connections: Connection[]
  connection: Connection
  setActiveConnection: (id: string) => void
  saveConnection: (c: Connection) => void
  deleteConnection: (id: string) => void

  client: DynamoDBClient
  /** Endpoint da conexão ativa, para exibição e mensagens de erro. */
  endpointLabel: string
  readOnly: boolean
}

const Ctx = createContext<SettingsCtx | null>(null)

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const s = readJSON<Partial<Settings>>('settings', {})
    return { theme: s.theme ?? 'system', density: s.density ?? 'comfortable', pageSize: s.pageSize ?? 50 }
  })
  const [conn, setConn] = useState(loadConnections)
  const systemDark = useSystemDark()
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  useEffect(() => saveConnections(conn.connections, conn.activeId), [conn])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      writeJSON('settings', next)
      return next
    })
  }, [])

  const setActiveConnection = useCallback((id: string) => setConn((c) => ({ ...c, activeId: id })), [])

  const saveConnection = useCallback((c: Connection) => {
    setConn((prev) => {
      const exists = prev.connections.some((x) => x.id === c.id)
      return {
        ...prev,
        connections: exists ? prev.connections.map((x) => (x.id === c.id ? c : x)) : [...prev.connections, c],
      }
    })
  }, [])

  const deleteConnection = useCallback((id: string) => {
    if (id === DEFAULT_CONNECTION_ID) return
    setConn((prev) => ({
      connections: prev.connections.filter((x) => x.id !== id),
      activeId: prev.activeId === id ? DEFAULT_CONNECTION_ID : prev.activeId,
    }))
  }, [])

  const connection = conn.connections.find((c) => c.id === conn.activeId) ?? DEFAULT_LOCALSTACK

  const client = useMemo(() => createClient(connection), [connection])
  const endpointLabel = useMemo(() => connectionTarget(connection), [connection])

  const value = useMemo(
    () => ({
      settings,
      update,
      isDark,
      connections: conn.connections,
      connection,
      setActiveConnection,
      saveConnection,
      deleteConnection,
      client,
      endpointLabel,
      readOnly: connection.readOnly,
    }),
    [settings, update, isDark, conn.connections, connection, setActiveConnection, saveConnection, deleteConnection, client, endpointLabel],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSettings fora do SettingsProvider')
  return c
}
