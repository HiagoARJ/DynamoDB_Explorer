import {
  Database,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Table2,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { routeHref } from '../../hooks/useHashRoute'
import { useSettings } from '../../hooks/useSettings'
import { useTables } from '../../hooks/useTables'
import { formatNumber } from '../../lib/format'
import { IconButton } from '../ui/Button'
import { Input } from '../ui/Form'
import { Spinner } from '../ui/Misc'
import { Tooltip } from '../ui/Tooltip'
import { ConnectionSwitcher } from './ConnectionSwitcher'

export function Sidebar({
  current,
  onCreateTable,
  onOpenSettings,
  onNavigate,
  onSwitchedConnection,
  onManageConnections,
  onAddAws,
  onSearch,
  collapsed = false,
  onToggleCollapse,
}: {
  current?: string
  onCreateTable: () => void
  onOpenSettings: () => void
  onNavigate?: () => void
  onSwitchedConnection: () => void
  onManageConnections: () => void
  onAddAws: () => void
  onSearch: () => void
  collapsed?: boolean
  /** Ausente no menu móvel (sempre expandido). */
  onToggleCollapse?: () => void
}) {
  const { names, tables, loading, refresh, connection } = useTables()
  const { endpointLabel, readOnly } = useSettings()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? names.filter((n) => n.toLowerCase().includes(s)) : names
  }, [names, q])

  const linkCls = (active: boolean) =>
    `group flex items-center rounded-lg text-[13px] transition-colors ${
      collapsed ? 'size-10 justify-center' : 'gap-2.5 px-2.5 py-1.5'
    } ${
      active
        ? 'bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800/80 dark:text-white dark:ring-zinc-700/60'
        : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100'
    }`

  const statusDot =
    connection === 'online' ? 'bg-emerald-500' : connection === 'offline' ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'
  const statusLabel = connection === 'online' ? 'Conectado' : connection === 'offline' ? 'Sem conexão' : 'Conectando…'
  const createLabel = readOnly ? 'Conexão somente leitura' : 'Criar tabela'

  const switcher = (
    <ConnectionSwitcher
      onSwitched={onSwitchedConnection}
      onManage={onManageConnections}
      onAddAws={onAddAws}
      compact={collapsed}
    />
  )

  /* ---------------- recolhido: só ícones ---------------- */
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center">
        <Tooltip label="Expandir menu">
          <button
            onClick={onToggleCollapse}
            aria-label="Expandir menu"
            className="group/logo relative mt-4 mb-3 flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30"
          >
            <Database className="size-4 transition-opacity group-hover/logo:opacity-0" />
            <PanelLeftOpen className="absolute size-4 opacity-0 transition-opacity group-hover/logo:opacity-100" />
          </button>
        </Tooltip>

        <div className="pb-3">{switcher}</div>

        <nav className="flex flex-col items-center gap-1">
          <Tooltip label="Painel">
            <a href={routeHref()} onClick={onNavigate} className={linkCls(!current)} aria-label="Painel">
              <LayoutDashboard className="size-4 opacity-70" />
            </a>
          </Tooltip>
          <Tooltip label="Ir para tabela… (Ctrl K)">
            <button onClick={onSearch} className={linkCls(false)} aria-label="Ir para tabela">
              <Search className="size-4 opacity-70" />
            </button>
          </Tooltip>
        </nav>

        <div className="my-3 h-px w-8 bg-zinc-200 dark:bg-zinc-800" />

        <div className="flex flex-col items-center gap-0.5">
          <Tooltip label="Atualizar tabelas">
            <IconButton icon={RefreshCw} label="Atualizar tabelas" onClick={() => refresh()} loading={loading} title="" />
          </Tooltip>
          <Tooltip label={createLabel}>
            <IconButton icon={Plus} label={createLabel} onClick={onCreateTable} disabled={readOnly} title="" />
          </Tooltip>
        </div>

        <div className="mt-2 flex min-h-0 w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden pb-3">
          {loading && names.length === 0 ? (
            <Spinner className="mt-2 size-4 text-zinc-400" />
          ) : (
            names.map((n) => {
              const d = tables[n]
              const active = n === current
              return (
                <Tooltip
                  key={n}
                  label={
                    <>
                      {n}
                      {d?.ItemCount !== undefined && <span className="ml-1.5 opacity-60">{formatNumber(d.ItemCount)} itens</span>}
                    </>
                  }
                >
                  <a href={routeHref(n)} onClick={onNavigate} className={`${linkCls(active)} shrink-0`} aria-label={n}>
                    <Table2 className={`size-4 ${active ? 'text-indigo-500' : 'opacity-60'}`} />
                  </a>
                </Tooltip>
              )
            })
          )}
        </div>

        <div className="flex w-full flex-col items-center gap-1 border-t border-zinc-200 py-2.5 dark:border-zinc-800">
          <Tooltip
            label={
              <>
                {statusLabel}
                <span className="ml-1.5 opacity-60">{endpointLabel}</span>
              </>
            }
          >
            <span className="flex size-8 items-center justify-center" aria-label={statusLabel}>
              <span className={`size-2.5 rounded-full ${statusDot}`} />
            </span>
          </Tooltip>
          <Tooltip label="Preferências">
            <IconButton icon={Settings} label="Preferências" onClick={onOpenSettings} title="" />
          </Tooltip>
          <Tooltip label="Expandir menu (Ctrl B)">
            <IconButton icon={PanelLeftOpen} label="Expandir menu" onClick={onToggleCollapse} title="" />
          </Tooltip>
        </div>
      </div>
    )
  }

  /* ---------------- expandido ---------------- */
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
          <Database className="size-4" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight">DynamoDB Explorer</p>
          <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">LocalStack · AWS</p>
        </div>
        {onToggleCollapse && (
          <IconButton icon={PanelLeftClose} label="Recolher menu (Ctrl B)" size="xs" className="-mr-1.5" onClick={onToggleCollapse} />
        )}
      </div>

      <div className="px-2.5 pb-3">{switcher}</div>

      <nav className="px-2.5">
        <a href={routeHref()} onClick={onNavigate} className={linkCls(!current)}>
          <LayoutDashboard className="size-4 opacity-70" />
          Painel
        </a>
      </nav>

      <div className="mt-4 flex items-center justify-between gap-2 pr-2.5 pl-4">
        <p className="truncate text-[11px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          Tabelas <span className="ml-1 font-normal">{names.length}</span>
        </p>
        <div className="flex shrink-0 items-center">
          <IconButton icon={RefreshCw} label="Atualizar tabelas" size="xs" onClick={() => refresh()} loading={loading} />
          <IconButton icon={Plus} label={createLabel} size="xs" onClick={onCreateTable} disabled={readOnly} />
        </div>
      </div>

      <div className="px-2.5 pt-2 pb-1.5">
        <Input
          icon={Search}
          inputSize="sm"
          placeholder="Filtrar tabelas"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          right={
            q && (
              <button onClick={() => setQ('')} className="rounded p-0.5 text-zinc-400 hover:text-zinc-600" aria-label="Limpar">
                <X className="size-3.5" />
              </button>
            )
          }
        />
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-3">
        {loading && names.length === 0 ? (
          <div className="flex items-center gap-2 px-2.5 py-3 text-xs text-zinc-500">
            <Spinner className="size-3.5" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2.5 py-3 text-xs text-zinc-500 dark:text-zinc-400">
            {q ? 'Nenhuma tabela encontrada.' : connection === 'offline' ? 'Sem conexão.' : 'Nenhuma tabela.'}
          </p>
        ) : (
          filtered.map((n) => {
            const d = tables[n]
            const active = n === current
            return (
              <a key={n} href={routeHref(n)} onClick={onNavigate} className={linkCls(active)} title={n}>
                <Table2 className={`size-4 shrink-0 ${active ? 'text-indigo-500' : 'opacity-60'}`} />
                <span className="min-w-0 flex-1 truncate">{n}</span>
                {d?.ItemCount !== undefined && (
                  <span className="text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">
                    {formatNumber(d.ItemCount)}
                  </span>
                )}
              </a>
            )
          })
        )}
      </div>

      <div className="border-t border-zinc-200 p-2.5 dark:border-zinc-800">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <span className="relative flex size-2.5 shrink-0">
            <span className={`absolute inset-0 rounded-full ${statusDot}`} />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-xs font-medium">{statusLabel}</p>
            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400" title={endpointLabel}>
              {endpointLabel}
            </p>
          </div>
          <IconButton icon={Settings} label="Preferências" size="xs" onClick={onOpenSettings} />
        </div>
      </div>
    </div>
  )
}
