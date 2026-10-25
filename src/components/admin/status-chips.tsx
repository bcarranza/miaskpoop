import { AlertTriangle, Check, Clock, Send, UtensilsCrossed, X } from "lucide-react"
import {
  DELIVERY_STATUS_LABEL,
  RSVP_STATUS_LABEL,
  type DeliveryStatus,
  type RsvpStatus,
} from "@/lib/types"

const RSVP_STYLES: Record<RsvpStatus, string> = {
  confirmado: "bg-emerald-500/15 text-emerald-700",
  pendiente: "bg-mcd-yellow/25 text-amber-700",
  rechazado: "bg-muted text-muted-foreground",
}

export function RsvpChip({ status }: { status: RsvpStatus }) {
  const Icon = status === "confirmado" ? Check : status === "pendiente" ? Clock : X
  return (
    <span className={`chip ${RSVP_STYLES[status]}`}>
      <Icon className="size-3" aria-hidden />
      {RSVP_STATUS_LABEL[status]}
    </span>
  )
}

const DELIVERY_STYLES: Record<DeliveryStatus, string> = {
  enviada: "bg-emerald-500/15 text-emerald-700",
  abierta_whatsapp: "bg-grape/15 text-grape",
  lista: "bg-lavender/30 text-grape",
  no_preparada: "bg-muted text-muted-foreground",
}

export function DeliveryChip({ status }: { status: DeliveryStatus }) {
  return (
    <span className={`chip ${DELIVERY_STYLES[status]}`}>
      <Send className="size-3" aria-hidden />
      {DELIVERY_STATUS_LABEL[status]}
    </span>
  )
}

export function ReviewChip({ reason }: { reason?: string | null }) {
  return (
    <span className="chip bg-mcd-red/15 text-mcd-red" title={reason ?? undefined}>
      <AlertTriangle className="size-3" aria-hidden />
      Revisar
    </span>
  )
}

export function IncompleteMenuChip({ missing }: { missing: number }) {
  return (
    <span className="chip bg-mcd-yellow/25 text-amber-700">
      <UtensilsCrossed className="size-3" aria-hidden />
      Faltan {missing} menú{missing === 1 ? "" : "s"}
    </span>
  )
}
