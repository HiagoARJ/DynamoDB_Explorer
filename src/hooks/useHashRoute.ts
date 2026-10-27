import { useCallback, useEffect, useState } from 'react'

export type TableTab = 'items' | 'overview' | 'indexes'

export interface Route {
  table?: string
  tab: TableTab
}

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'tables' && parts[1]) {
    const tab = (['items', 'overview', 'indexes'] as const).find((t) => t === parts[2]) ?? 'items'
    return { table: decodeURIComponent(parts[1]), tab }
  }
  return { tab: 'items' }
}

export function routeHref(table?: string, tab: TableTab = 'items'): string {
  return table ? `#/tables/${encodeURIComponent(table)}/${tab}` : '#/'
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const navigate = useCallback((table?: string, tab: TableTab = 'items') => {
    window.location.hash = routeHref(table, tab)
  }, [])

  return { route, navigate }
}
