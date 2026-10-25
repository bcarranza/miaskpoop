"use client"

/**
 * Envío asistido por WhatsApp.
 *
 * Abre WhatsApp con el mensaje ya escrito; la persona administradora
 * presiona Enviar manualmente y después marca la invitación como
 * enviada. Abrir WhatsApp nunca marca el mensaje como enviado.
 */
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MessageCircle,
  Monitor,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import type { DeliveryLogAction } from "@/lib/types"
import { logDeliveryAction } from "@/server/actions/families"

export type WhatsAppMessage = {
  familyId: string
  familyName: string
  contactName: string
  phoneDisplay: string
  message: string
  href: string
  desktopHref: string
  invitationUrl: string
  error?: string
}

type Props = {
  data: WhatsAppMessage
  kind?: "invitacion" | "recordatorio"
  /** Prefiere el esquema de la app de escritorio (macOS). */
  preferDesktop?: boolean
  alreadySent?: boolean
  compact?: boolean
  onSent?: () => void
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Se intenta el método alternativo
  }

  try {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand("copy")
    document.body.removeChild(area)
    return copied
  } catch {
    return false
  }
}

export function WhatsAppSender({
  data,
  kind = "invitacion",
  preferDesktop = true,
  alreadySent = false,
  compact = false,
  onSent,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(alreadySent)
  const [opened, setOpened] = useState(false)

  const log = (action: DeliveryLogAction, preview?: string) => {
    startTransition(async () => {
      const result = await logDeliveryAction(data.familyId, action, kind, preview)
      if (!result.ok) toast.error(result.error)
      else router.refresh()
    })
  }

  if (data.error) {
    return (
      <p className="rounded-xl border border-mcd-red/40 bg-mcd-red/10 px-3 py-2 text-xs font-semibold text-mcd-red">
        No se puede armar el mensaje: {data.error}
      </p>
    )
  }

  const openWhatsApp = () => {
    // El esquema whatsapp:// suele abrir WhatsApp Desktop en macOS; si el
    // navegador no lo admite, el enlace wa.me funciona igual.
    const target = preferDesktop ? data.desktopHref : data.href
    window.open(target, "_blank", "noopener,noreferrer")
    setOpened(true)
    log("abierta_whatsapp", data.message)
  }

  const markSent = () => {
    setSent(true)
    log("marcada_enviada", data.message)
    toast.success(
      kind === "invitacion"
        ? `Invitación de la familia ${data.familyName} marcada como enviada`
        : `Recordatorio de la familia ${data.familyName} registrado`,
    )
    onSent?.()
  }

  const copyMessage = async () => {
    const copied = await copyToClipboard(data.message)
    if (copied) {
      toast.success("Mensaje copiado")
      log("mensaje_copiado")
    } else {
      toast.error("No pudimos copiar. Selecciona el texto manualmente.")
    }
  }

  const copyLink = async () => {
    const copied = await copyToClipboard(data.invitationUrl)
    if (copied) {
      toast.success("Enlace copiado")
      log("enlace_copiado")
    } else {
      toast.error("No pudimos copiar el enlace.")
    }
  }

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "space-y-3"}>
      <div className={compact ? "flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
        <button
          type="button"
          onClick={openWhatsApp}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-60"
        >
          <MessageCircle className="size-4" aria-hidden />
          {kind === "invitacion" ? "Enviar invitación" : "Enviar recordatorio"}
        </button>

        <button
          type="button"
          onClick={markSent}
          disabled={pending || sent}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition disabled:opacity-60 ${
            sent
              ? "bg-emerald-500/15 text-emerald-700"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {sent ? "Marcada como enviada" : "Marcar como enviada"}
        </button>

        <button
          type="button"
          onClick={copyMessage}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
        >
          <Copy className="size-4" aria-hidden />
          Copiar mensaje
        </button>

        <button
          type="button"
          onClick={copyLink}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-60"
        >
          <Link2 className="size-4" aria-hidden />
          Copiar enlace
        </button>
      </div>

      {!compact && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <a
              href={data.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setOpened(true)
                log("abierta_whatsapp", data.message)
              }}
              className="flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Abrir en WhatsApp Web
            </a>
            <span className="flex items-center gap-1">
              <Monitor className="size-3.5" aria-hidden />
              {preferDesktop
                ? "El botón intenta abrir WhatsApp Desktop"
                : "El botón abre WhatsApp Web"}
            </span>
          </div>

          {opened && !sent && (
            <p className="rounded-xl border border-mcd-yellow/50 bg-mcd-yellow/10 px-3 py-2 text-xs font-semibold text-amber-700">
              Abriste WhatsApp, pero el mensaje todavía no se marca como enviado. Presiona Enviar
              en WhatsApp y luego «Marcar como enviada».
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** Vista previa del mensaje tal como se verá en WhatsApp. */
export function MessagePreview({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-[#ECE5DD] p-3">
      <div className="max-w-full rounded-xl rounded-tr-none bg-[#DCF8C6] p-3 shadow-sm">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#111B21]">
          {message}
        </p>
      </div>
    </div>
  )
}
