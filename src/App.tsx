import { useCallback, useEffect, useState } from 'react'
import { CommandPalette } from './components/layout/CommandPalette'
import { ConnectionsDialog } from './components/layout/ConnectionsDialog'
import { ResizableAside, useSidebarLayout } from './components/layout/ResizableAside'
import { SettingsDialog } from './components/layout/SettingsDialog'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { CreateTableDialog } from './components/tables/CreateTableDialog'
import { TablesDashboard } from './components/tables/TablesDashboard'
import { TableView } from './components/tables/TableView'
import { useHashRoute } from './hooks/useHashRoute'
import { SettingsProvider, useSettings } from './hooks/useSettings'
import { TablesProvider } from './hooks/useTables'
import { ToastProvider } from './hooks/useToast'
import type { ConnectionKind } from './lib/connections'

function Shell() {
  const { route, navigate } = useHashRoute()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [connDialog, setConnDialog] = useState<{ open: boolean; newKind?: ConnectionKind }>({ open: false })
  const { readOnly } = useSettings()
  const layout = useSidebarLayout()
  const { toggle: toggleSidebar } = layout

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
      // Ctrl+B recolhe/expande o menu lateral (fora de campos de texto)
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable="true"]')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !typing) {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [toggleSidebar])

  const openCreate = useCallback(() => !readOnly && setCreateOpen(true), [readOnly])
  const manageConnections = useCallback(() => setConnDialog({ open: true }), [])
  const addAws = useCallback(() => setConnDialog({ open: true, newKind: 'aws' }), [])
  const goHome = useCallback(() => navigate(), [navigate])
  const openTable = useCallback((n: string) => navigate(n), [navigate])

  const sidebarProps = {
    current: route.table,
    onCreateTable: openCreate,
    onOpenSettings: () => setSettingsOpen(true),
    onNavigate: () => setMobileNav(false),
    onSwitchedConnection: () => {
      setMobileNav(false)
      navigate()
    },
    onManageConnections: manageConnections,
    onAddAws: addAws,
    onSearch: () => setPaletteOpen(true),
  }

  return (
    <div className="flex h-full">
      <ResizableAside width={layout.width} collapsed={layout.collapsed} onChange={layout.setLayout}>
        <Sidebar {...sidebarProps} collapsed={layout.collapsed} onToggleCollapse={toggleSidebar} />
      </ResizableAside>

      {mobileNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-zinc-950/40" onClick={() => setMobileNav(false)} />
          <aside className="animate-slide-in absolute inset-y-0 left-0 w-72 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <Sidebar {...sidebarProps} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar table={route.table} onMenu={() => setMobileNav(true)} onSearch={() => setPaletteOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {route.table ? (
            <TableView key={route.table} name={route.table} tab={route.tab} navigate={navigate} />
          ) : (
            <TablesDashboard onOpen={openTable} onCreateTable={openCreate} onOpenSettings={manageConnections} />
          )}
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onManageConnections={manageConnections} />
      <ConnectionsDialog
        open={connDialog.open}
        initialNew={connDialog.newKind}
        onClose={() => setConnDialog({ open: false })}
        onActivated={() => navigate()}
      />
      <CreateTableDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={openTable} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectTable={openTable}
        onHome={goHome}
        onCreateTable={openCreate}
      />
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <TablesProvider>
          <Shell />
        </TablesProvider>
      </ToastProvider>
    </SettingsProvider>
  )
}
