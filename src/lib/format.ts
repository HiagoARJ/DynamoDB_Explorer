import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { avType, itemToDdbJson, itemToPlain, toPlain } from './convert'
import type { Item } from './types'

const nf = new Intl.NumberFormat('pt-BR')

export function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null) return '—'
  return nf.format(n)
}

export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[i]}`
}

export function formatDateTime(d: Date | undefined | null): string {
  if (!d) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'medium' })
}

export function relativeTime(d: Date): string {
  const diff = (d.getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month')
  return rtf.format(Math.round(diff / (86400 * 365)), 'year')
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

/** Detecta datas em strings ISO ou números epoch (segundos ou milissegundos). */
export function detectDate(av: AttributeValue): Date | null {
  if (av.S !== undefined && ISO_RE.test(av.S)) {
    const d = new Date(av.S)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (av.N !== undefined && /^\d{10}(\d{3})?$/.test(av.N)) {
    const n = Number(av.N)
    const ms = av.N.length === 13 ? n : n * 1000
    const d = new Date(ms)
    const y = d.getUTCFullYear()
    return y >= 2000 && y <= 2100 ? d : null
  }
  return null
}

export function avPreview(av: AttributeValue, max = 80): string {
  const t = avType(av)
  let s: string
  switch (t) {
    case 'S':
      s = av.S!
      break
    case 'N':
      s = av.N!
      break
    case 'B':
      s = `Binário (${formatBytes(av.B!.length)})`
      break
    case 'BOOL':
      s = String(av.BOOL)
      break
    case 'NULL':
      s = 'null'
      break
    case 'BS':
      s = `[${av.BS!.length} binários]`
      break
    default:
      s = JSON.stringify(toPlain(av))
  }
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export function avSortValue(av: AttributeValue | undefined): string | number {
  if (!av) return ''
  if (av.N !== undefined) return Number(av.N)
  if (av.S !== undefined) return av.S.toLowerCase()
  if (av.BOOL !== undefined) return av.BOOL ? 1 : 0
  return avPreview(av, 200)
}

export function avSearchText(av: AttributeValue): string {
  return avPreview(av, 10_000).toLowerCase()
}

/* ---------- exportação ---------- */

function csvCell(v: string): string {
  return /[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCSV(items: Item[], columns: string[]): string {
  const lines = [columns.map(csvCell).join(',')]
  for (const it of items) {
    lines.push(
      columns
        .map((c) => {
          const av = it[c]
          if (!av) return ''
          const p = toPlain(av)
          return csvCell(typeof p === 'object' && p !== null ? JSON.stringify(p) : String(p))
        })
        .join(','),
    )
  }
  return '﻿' + lines.join('\r\n')
}

export function toJSONExport(items: Item[], format: 'plain' | 'ddb'): string {
  return JSON.stringify(items.map((i) => (format === 'plain' ? itemToPlain(i) : itemToDdbJson(i))), null, 2)
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
