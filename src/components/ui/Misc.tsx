import { Loader2, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AvType } from '../../lib/types'

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />
}

type Tone = 'neutral' | 'indigo' | 'green' | 'amber' | 'rose' | 'sky' | 'violet'

const tones: Record<Tone, string> = {
  neutral: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-300 dark:ring-zinc-700/60',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/25',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25',
}

export function Badge({
  children,
  tone = 'neutral',
  icon: Icon,
  className = '',
  title,
}: {
  children: ReactNode
  tone?: Tone
  icon?: LucideIcon
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  )
}

export function statusTone(status?: string): Tone {
  if (status === 'ACTIVE') return 'green'
  if (status === 'CREATING' || status === 'UPDATING') return 'amber'
  if (status === 'DELETING') return 'rose'
  return 'neutral'
}

const typeTone: Record<AvType, string> = {
  S: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-300',
  N: 'text-amber-600 bg-amber-500/10 dark:text-amber-300',
  B: 'text-fuchsia-600 bg-fuchsia-500/10 dark:text-fuchsia-300',
  BOOL: 'text-violet-600 bg-violet-500/10 dark:text-violet-300',
  NULL: 'text-zinc-500 bg-zinc-500/10 dark:text-zinc-400',
  M: 'text-sky-600 bg-sky-500/10 dark:text-sky-300',
  L: 'text-cyan-600 bg-cyan-500/10 dark:text-cyan-300',
  SS: 'text-teal-600 bg-teal-500/10 dark:text-teal-300',
  NS: 'text-orange-600 bg-orange-500/10 dark:text-orange-300',
  BS: 'text-pink-600 bg-pink-500/10 dark:text-pink-300',
}

export const typeNames: Record<AvType, string> = {
  S: 'String',
  N: 'Number',
  B: 'Binary',
  BOOL: 'Boolean',
  NULL: 'Null',
  M: 'Map',
  L: 'List',
  SS: 'String Set',
  NS: 'Number Set',
  BS: 'Binary Set',
}

export function TypeBadge({ type, className = '' }: { type: AvType; className?: string }) {
  return (
    <span
      title={typeNames[type]}
      className={`inline-flex h-4 min-w-[1.5rem] items-center justify-center rounded px-1 font-mono text-[10px] leading-none font-semibold ${typeTone[type]} ${className}`}
    >
      {type}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-zinc-200 bg-zinc-50 px-1 font-sans text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
      {children}
    </kbd>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  tone = 'neutral',
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'error'
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div
        className={`mb-4 flex size-12 items-center justify-center rounded-2xl ring-1 ${
          tone === 'error'
            ? 'bg-rose-50 text-rose-500 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/20'
            : 'bg-zinc-100 text-zinc-400 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:ring-zinc-800'
        }`}
      >
        <Icon className="size-6" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60 ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  icon: Icon,
  description,
  actions,
}: {
  title: string
  icon?: LucideIcon
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800/80">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {Icon && <Icon className="size-4 text-zinc-400" />}
          {title}
        </h3>
        {description && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}

export interface TabItem<T extends string> {
  id: T
  label: string
  icon?: LucideIcon
  count?: number
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-zinc-200)] dark:shadow-[inset_0_-1px_0_var(--color-zinc-800)]"
    >
      {items.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`focus-ring relative flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? 'border-indigo-500 text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {t.icon && <t.icon className="size-4" />}
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
}: {
  options: { value: T; label: string; icon?: LucideIcon; title?: string }[]
  value: T
  onChange: (v: T) => void
  size?: 'xs' | 'sm'
}) {
  return (
    <div className="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/70">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`focus-ring inline-flex items-center gap-1.5 rounded-md font-medium transition-all ${
              size === 'xs' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-[13px]'
            } ${
              active
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {o.icon && <o.icon className="size-3.5" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Menu suspenso simples: fecha ao clicar fora ou com Esc. */
export function Popover({
  trigger,
  children,
  align = 'right',
  width = 'w-56',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={`animate-pop-in absolute top-full z-40 mt-1.5 ${align === 'right' ? 'right-0' : 'left-0'} ${width} rounded-xl border border-zinc-200 bg-white p-1 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon: Icon,
  children,
  onClick,
  hint,
  danger,
}: {
  icon?: LucideIcon
  children: ReactNode
  onClick: () => void
  hint?: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
    >
      {Icon && <Icon className="size-4 shrink-0 opacity-70" />}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">{children}</div>
}
