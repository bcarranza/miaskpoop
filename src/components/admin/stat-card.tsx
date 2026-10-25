import type { LucideIcon } from "lucide-react"

type Tone = "neon" | "grape" | "lavender" | "yellow" | "red" | "neutral" | "green"

const TONES: Record<Tone, { badge: string; value: string }> = {
  neon: { badge: "bg-neon/15 text-neon", value: "text-neon" },
  grape: { badge: "bg-grape/15 text-grape", value: "text-grape" },
  lavender: { badge: "bg-lavender/25 text-grape", value: "text-grape" },
  yellow: { badge: "bg-mcd-yellow/20 text-amber-600", value: "text-amber-600" },
  red: { badge: "bg-mcd-red/15 text-mcd-red", value: "text-mcd-red" },
  green: { badge: "bg-emerald-500/15 text-emerald-600", value: "text-emerald-600" },
  neutral: { badge: "bg-muted text-muted-foreground", value: "text-foreground" },
}

type Props = {
  label: string
  value: number | string
  hint?: string
  icon?: LucideIcon
  tone?: Tone
  /** Valor secundario, p. ej. la capacidad total. */
  total?: number
}

export function StatCard({ label, value, hint, icon: Icon, tone = "neutral", total }: Props) {
  const colors = TONES[tone]

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${colors.badge}`}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>

      <p className={`mt-2 font-heading text-3xl font-black tabular-nums ${colors.value}`}>
        {value}
        {total !== undefined && (
          <span className="ml-1 text-base font-bold text-muted-foreground">/ {total}</span>
        )}
      </p>

      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
