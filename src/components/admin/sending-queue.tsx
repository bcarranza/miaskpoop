"use client"

/**
 * Cola de envío manual.
 *
 * Se seleccionan varias familias y se avanza de una en una. Nunca se
 * abren decenas de conversaciones ni se envía nada automáticamente:
 * cada mensaje lo envía la persona administradora.
 */
import {
  ArrowRight,
  CheckCheck,
  ChevronLeft,
  ListChecks,
  SkipForward,
  Users,
} from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { logDeliveryAction } from "@/server/actions/families"
import { MessagePreview, WhatsAppSender, type WhatsAppMessage } from "./whatsapp-sender"
import { DeliveryChip, RsvpChip } from "./status-chips"
import type { DeliveryStatus, RsvpStatus } from "@/lib/types"

export type QueueItem = {
  message: WhatsAppMessage
  maxAttendees: number
  invitedChildren: string[]
  rsvpStatus: RsvpStatus
  deliveryStatus: DeliveryStatus
  reminderCount: number
}

type Props = {
  items: QueueItem[]
  kind: "invitacion" | "recordatorio"
  preferDesktop: boolean
  emptyMessage: string
}

export function SendingQueue({ items, kind, preferDesktop, emptyMessage }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [queue, setQueue] = useState<string[] | null>(null)
  const [position, setPosition] = useState(0)
  const [done, setDone] = useState<Set<string>>(new Set())

  const byId = useMemo(
    () => new Map(items.map((item) => [item.message.familyId, item])),
    [items],
  )

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(items.map((item) => item.message.familyId)))
  const clearAll = () => setSelected(new Set())

  const startQueue = () => {
    if (selected.size === 0) {
      toast.error("Selecciona al menos una familia.")
      return
    }
    const order = items
      .map((item) => item.message.familyId)
      .filter((id) => selected.has(id))
    setQueue(order)
    setPosition(0)
    setDone(new Set())
  }

  const skip = (id: string) => {
    startTransition(async () => {
      await logDeliveryAction(id, "omitida", kind)
      router.refresh()
    })
    advance()
  }

  const advance = () => {
    setPosition((current) => current + 1)
  }

  // ------------------------------------------------------------------
  // Modo cola: una familia a la vez
  // ------------------------------------------------------------------
  if (queue) {
    const finished = position >= queue.length

    if (finished) {
      return (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600">
            <CheckCheck className="size-7" aria-hidden />
          </span>
          <h2 className="font-heading text-xl font-black">Terminaste la cola</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Marcaste {done.size} de {queue.length}{" "}
            {kind === "invitacion" ? "invitaciones" : "recordatorios"} como enviados.
          </p>
          <button
            type="button"
            onClick={() => {
              setQueue(null)
              setSelected(new Set())
              router.refresh()
            }}
            className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            Volver a la lista
          </button>
        </div>
      )
    }

    const currentId = queue[position]
    const item = byId.get(currentId)

    if (!item) {
      advance()
      return null
    }

    return (
      <div className="space-y-4">
        {/* Avance */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setQueue(null)
                router.refresh()
              }}
              className="flex items-center gap-1 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden />
              Salir de la cola
            </button>
            <p className="text-sm font-bold tabular-nums">
              {position + 1} de {queue.length}
            </p>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="kpop-quota-fill h-full rounded-full transition-all duration-500"
              style={{ width: `${((position + 1) / queue.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Familia actual */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-xl font-black">
                Familia {item.message.familyName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {item.message.contactName} · {item.message.phoneDisplay}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <RsvpChip status={item.rsvpStatus} />
              <DeliveryChip status={item.deliveryStatus} />
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
                Cupo autorizado
              </dt>
              <dd className="font-heading text-xl font-black tabular-nums">
                {item.maxAttendees}
              </dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
                Niños invitados
              </dt>
              <dd className="text-sm font-semibold">
                {item.invitedChildren.length > 0
                  ? item.invitedChildren.join(", ")
                  : "Sin precargar"}
              </dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
                Recordatorios
              </dt>
              <dd className="font-heading text-xl font-black tabular-nums">
                {item.reminderCount}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Vista previa del mensaje
            </p>
            <MessagePreview message={item.message.message} />
          </div>

          <div className="mt-5">
            <WhatsAppSender
              data={item.message}
              kind={kind}
              preferDesktop={preferDesktop}
              alreadySent={item.deliveryStatus === "enviada" && kind === "invitacion"}
              onSent={() => {
                setDone((current) => new Set(current).add(currentId))
              }}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={advance}
              className="flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2.5 text-sm font-bold text-secondary-foreground transition hover:brightness-95"
            >
              Siguiente familia
              <ArrowRight className="size-4" aria-hidden />
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => skip(currentId)}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
            >
              <SkipForward className="size-4" aria-hidden />
              Omitir
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Modo lista: selección de familias
  // ------------------------------------------------------------------
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600">
          <CheckCheck className="size-6" aria-hidden />
        </span>
        <p className="text-sm font-semibold">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4">
        <p className="mr-auto flex items-center gap-2 text-sm">
          <Users className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-bold">{selected.size}</span> de {items.length} seleccionadas
        </p>

        <button
          type="button"
          onClick={selectAll}
          className="rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted"
        >
          Seleccionar todas
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={startQueue}
          disabled={selected.size === 0}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          <ListChecks className="size-4" aria-hidden />
          Iniciar cola de envío
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const id = item.message.familyId
          const checked = selected.has(id)
          return (
            <li
              key={id}
              className={`rounded-2xl border bg-card p-4 transition ${
                checked ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
              }`}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(id)}
                  className="mt-1 size-4 shrink-0 accent-[#ff2e9a]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-base font-extrabold">
                      {item.message.familyName}
                    </span>
                    <RsvpChip status={item.rsvpStatus} />
                    <DeliveryChip status={item.deliveryStatus} />
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {item.message.contactName} · {item.message.phoneDisplay} · cupo{" "}
                    {item.maxAttendees}
                  </span>
                  {item.message.error && (
                    <span className="mt-1 block text-xs font-semibold text-mcd-red">
                      {item.message.error}
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
