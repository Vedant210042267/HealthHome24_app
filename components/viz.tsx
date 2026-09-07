import type { ReactNode } from 'react'

/**
 * Categorical slots 1-3 of the validated default palette, light mode.
 * Validated with the data-viz palette checker (all-pairs, light, #ffffff surface):
 *   lightness band PASS · chroma floor PASS · CVD ΔE 9.2 PASS · normal-vision ΔE 24.0 PASS
 *   contrast WARN on aqua (2.82:1) — relieved by the numeric table beneath every chart.
 * Assigned in fixed order, never cycled.
 */
export const SERIES = {
  one: '#2a78d6', // blue
  two: '#eb6834', // orange
  three: '#1baf7a', // aqua
} as const

export type Segment = { label: string; value: number; color: string }

/** Stacked proportion bar. 2px surface gaps between fills, 4px rounded outer ends. */
export function StackedBar({ segments, max }: { segments: Segment[]; max: number }) {
  const visible = segments.filter((s) => s.value > 0)
  if (max <= 0 || visible.length === 0) {
    return <div className="h-3 w-full rounded bg-slate-100" />
  }
  return (
    <div className="flex h-3 w-full items-stretch gap-[2px]">
      {visible.map((s, i) => (
        <div
          key={s.label}
          title={`${s.label}: ₹${Math.round(s.value).toLocaleString('en-IN')}`}
          style={{
            width: `${(s.value / max) * 100}%`,
            background: s.color,
            borderTopLeftRadius: i === 0 ? 4 : 0,
            borderBottomLeftRadius: i === 0 ? 4 : 0,
            borderTopRightRadius: i === visible.length - 1 ? 4 : 0,
            borderBottomRightRadius: i === visible.length - 1 ? 4 : 0,
          }}
        />
      ))}
    </div>
  )
}

/** Single-series magnitude bar for use inside a table cell. */
export function InlineBar({ value, max, color = SERIES.one }: { value: number; max: number; color?: string }) {
  const width = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0
  return (
    <div className="h-2 w-full min-w-16 rounded bg-slate-100">
      <div
        className="h-2 rounded"
        style={{ width: `${width}%`, background: color }}
        title={`₹${Math.round(value).toLocaleString('en-IN')}`}
      />
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: i.color }} aria-hidden />
          <span>{i.label}</span>
          {i.value !== undefined && <span className="tnum font-medium text-slate-900">{i.value}</span>}
        </li>
      ))}
    </ul>
  )
}
