"use client"

/** Edición de las plantillas de WhatsApp con vista previa en vivo. */
import { AlertCircle, Copy, Loader2, RotateCcw, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import type { EventRecord } from "@/lib/types"
import {
  buildInvitationUrl,
  buildTemplateTokens,
  renderTemplate,
  TEMPLATE_TOKEN_HELP,
  type WhatsAppFamilyInput,
} from "@/lib/whatsapp"
import { updateWhatsAppTemplates } from "@/server/actions/settings"
import { MessagePreview } from "./whatsapp-sender"

type Props = {
  event: EventRecord
  sampleFamily: WhatsAppFamilyInput
  sampleIsReal: boolean
}

export function WhatsAppTemplateForm({ event, sampleFamily, sampleIsReal }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [invitation, setInvitation] = useState(event.whatsapp_invitation_template)
  const [reminder, setReminder] = useState(event.whatsapp_reminder_template)
  const [error, setError] = useState<string | null>(null)

  const tokens = useMemo(
    () =>
      buildTemplateTokens(
        sampleFamily,
        event,
        buildInvitationUrl("https://tu-dominio.vercel.app", "TOKEN_DE_EJEMPLO"),
      ),
    [sampleFamily, event],
  )

  const invitationPreview = renderTemplate(invitation, tokens)
  const reminderPreview = renderTemplate(reminder, tokens)

  const unresolved = (text: string) => text.match(/\{\{\s*[A-Z_]+\s*\}\}/g) ?? []
  const invitationUnresolved = unresolved(invitationPreview)
  const reminderUnresolved = unresolved(reminderPreview)

  const save = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateWhatsAppTemplates(invitation, reminder)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success("Plantillas guardadas")
      router.refresh()
    })
  }

  const reset = () => {
    setInvitation(event.whatsapp_invitation_template)
    setReminder(event.whatsapp_reminder_template)
    setError(null)
  }

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      toast.success(`${token} copiado`)
    } catch {
      toast.error("No pudimos copiar.")
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-mcd-red/40 bg-mcd-red/10 px-4 py-3 text-sm font-medium text-mcd-red"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {/* Marcadores disponibles */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-extrabold">Marcadores disponibles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Haz clic en uno para copiarlo y pégalo en la plantilla.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATE_TOKEN_HELP.map((item) => (
            <li key={item.token}>
              <button
                type="button"
                onClick={() => copyToken(item.token)}
                className="flex w-full items-start gap-2 rounded-xl border border-border p-2.5 text-left transition hover:border-primary/40 hover:bg-muted"
              >
                <Copy className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs font-bold text-primary">
                    {item.token}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Invitación */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-extrabold">Mensaje de invitación</h2>

        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plantilla ({invitation.length} caracteres)
            </span>
            <textarea
              value={invitation}
              onChange={(changeEvent) => {
                setInvitation(changeEvent.target.value)
                setError(null)
              }}
              rows={18}
              maxLength={3000}
              className="input-base resize-y font-mono text-xs leading-relaxed"
            />
          </label>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vista previa{" "}
              {sampleIsReal ? `(familia ${sampleFamily.name})` : "(familia de ejemplo)"}
            </p>
            <MessagePreview message={invitationPreview} />

            {!invitation.includes("{{RSVP_URL}}") && (
              <p className="mt-2 rounded-xl border border-mcd-red/40 bg-mcd-red/10 px-3 py-2 text-xs font-semibold text-mcd-red">
                Falta {"{{RSVP_URL}}"}: sin ese marcador la familia no recibe su enlace de
                confirmación.
              </p>
            )}

            {invitationUnresolved.length > 0 && (
              <p className="mt-2 rounded-xl border border-mcd-yellow/50 bg-mcd-yellow/10 px-3 py-2 text-xs font-semibold text-amber-700">
                Marcadores desconocidos: {invitationUnresolved.join(", ")}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Recordatorio */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-extrabold">Mensaje de recordatorio</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para las familias que aún no confirman o les faltan menús. Se registra por separado de
          la invitación inicial.
        </p>

        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plantilla ({reminder.length} caracteres)
            </span>
            <textarea
              value={reminder}
              onChange={(changeEvent) => {
                setReminder(changeEvent.target.value)
                setError(null)
              }}
              rows={14}
              maxLength={3000}
              className="input-base resize-y font-mono text-xs leading-relaxed"
            />
          </label>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vista previa
            </p>
            <MessagePreview message={reminderPreview} />

            {!reminder.includes("{{RSVP_URL}}") && (
              <p className="mt-2 rounded-xl border border-mcd-red/40 bg-mcd-red/10 px-3 py-2 text-xs font-semibold text-mcd-red">
                Falta {"{{RSVP_URL}}"}.
              </p>
            )}

            {reminderUnresolved.length > 0 && (
              <p className="mt-2 rounded-xl border border-mcd-yellow/50 bg-mcd-yellow/10 px-3 py-2 text-xs font-semibold text-amber-700">
                Marcadores desconocidos: {reminderUnresolved.join(", ")}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Guardando…
            </>
          ) : (
            <>
              <Save className="size-4" aria-hidden />
              Guardar plantillas
            </>
          )}
        </button>

        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
        >
          <RotateCcw className="size-4" aria-hidden />
          Descartar cambios
        </button>
      </div>
    </div>
  )
}
