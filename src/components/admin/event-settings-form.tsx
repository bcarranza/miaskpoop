"use client"

/** Configuración del evento. */
import { AlertCircle, Loader2, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { formatLongDate, formatTime } from "@/lib/date"
import type { EventRecord } from "@/lib/types"
import { updateEventSettings } from "@/server/actions/settings"

type Values = {
  name: string
  celebrant_name: string
  celebrant_age: number
  event_date: string
  start_time: string
  timezone: string
  venue_name: string
  venue_address: string
  venue_maps_url: string
  rsvp_deadline: string
  allow_rsvp_edits: boolean
  invitation_headline: string
  invitation_subheadline: string
  invitation_message: string
  theme_primary_color: string
  theme_secondary_color: string
  theme_accent_color: string
  background_image_url: string
  music_enabled: boolean
  music_url: string
}

export function EventSettingsForm({ event }: { event: EventRecord }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [values, setValues] = useState<Values>({
    name: event.name,
    celebrant_name: event.celebrant_name,
    celebrant_age: event.celebrant_age,
    event_date: event.event_date.slice(0, 10),
    start_time: event.start_time.slice(0, 5),
    timezone: event.timezone,
    venue_name: event.venue_name,
    venue_address: event.venue_address,
    venue_maps_url: event.venue_maps_url ?? "",
    rsvp_deadline: event.rsvp_deadline.slice(0, 10),
    allow_rsvp_edits: event.allow_rsvp_edits,
    invitation_headline: event.invitation_headline,
    invitation_subheadline: event.invitation_subheadline,
    invitation_message: event.invitation_message,
    theme_primary_color: event.theme_primary_color,
    theme_secondary_color: event.theme_secondary_color,
    theme_accent_color: event.theme_accent_color,
    background_image_url: event.background_image_url ?? "",
    music_enabled: event.music_enabled,
    music_url: event.music_url ?? "",
  })

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  const handleSubmit = (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    setError(null)
    setFieldErrors({})

    startTransition(async () => {
      const result = await updateEventSettings({
        ...values,
        whatsapp_invitation_template: event.whatsapp_invitation_template,
        whatsapp_reminder_template: event.whatsapp_reminder_template,
      })

      if (!result.ok) {
        setError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
        return
      }

      toast.success("Configuración guardada")
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-mcd-red/40 bg-mcd-red/10 px-4 py-3 text-sm font-medium text-mcd-red"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          La fiesta
        </legend>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del evento" error={fieldErrors.name}>
            <input
              type="text"
              value={values.name}
              onChange={(changeEvent) => set("name", changeEvent.target.value)}
              className="input-base"
            />
          </Field>

          <Field label="Nombre de la cumpleañera" error={fieldErrors.celebrant_name}>
            <input
              type="text"
              value={values.celebrant_name}
              onChange={(changeEvent) => set("celebrant_name", changeEvent.target.value)}
              className="input-base"
            />
          </Field>

          <Field label="Edad que cumple" error={fieldErrors.celebrant_age}>
            <input
              type="number"
              min={1}
              max={120}
              value={values.celebrant_age}
              onChange={(changeEvent) =>
                set("celebrant_age", Number(changeEvent.target.value) || 1)
              }
              className="input-base"
            />
          </Field>

          <Field
            label="Fecha de la fiesta"
            hint={formatLongDate(values.event_date)}
            error={fieldErrors.event_date}
          >
            <input
              type="date"
              value={values.event_date}
              onChange={(changeEvent) => set("event_date", changeEvent.target.value)}
              className="input-base"
            />
          </Field>

          <Field
            label="Hora de inicio"
            hint={formatTime(values.start_time)}
            error={fieldErrors.start_time}
          >
            <input
              type="time"
              value={values.start_time}
              onChange={(changeEvent) => set("start_time", changeEvent.target.value)}
              className="input-base"
            />
          </Field>

          <Field label="Zona horaria" error={fieldErrors.timezone}>
            <input
              type="text"
              value={values.timezone}
              onChange={(changeEvent) => set("timezone", changeEvent.target.value)}
              className="input-base"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          El lugar
        </legend>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del lugar" error={fieldErrors.venue_name}>
            <input
              type="text"
              value={values.venue_name}
              onChange={(changeEvent) => set("venue_name", changeEvent.target.value)}
              className="input-base"
            />
          </Field>

          <Field label="Dirección" error={fieldErrors.venue_address}>
            <input
              type="text"
              value={values.venue_address}
              onChange={(changeEvent) => set("venue_address", changeEvent.target.value)}
              className="input-base"
            />
          </Field>

          <Field
            label="Enlace de mapa (opcional)"
            className="sm:col-span-2"
            error={fieldErrors.venue_maps_url}
          >
            <input
              type="url"
              value={values.venue_maps_url}
              onChange={(changeEvent) => set("venue_maps_url", changeEvent.target.value)}
              placeholder="https://maps.app.goo.gl/…"
              className="input-base"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Confirmaciones
        </legend>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            label="Fecha límite para confirmar"
            hint={formatLongDate(values.rsvp_deadline)}
            error={fieldErrors.rsvp_deadline}
          >
            <input
              type="date"
              value={values.rsvp_deadline}
              onChange={(changeEvent) => set("rsvp_deadline", changeEvent.target.value)}
              className="input-base"
            />
          </Field>
        </div>

        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={values.allow_rsvp_edits}
            onChange={(changeEvent) => set("allow_rsvp_edits", changeEvent.target.checked)}
            className="mt-0.5 size-4 accent-[#ff2e9a]"
          />
          <span className="text-sm">
            <span className="font-semibold">
              Permitir que las familias modifiquen su confirmación
            </span>
            <span className="block text-muted-foreground">
              Siempre dentro de la fecha límite. Si lo desactivas, cada familia podrá responder
              una sola vez.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Textos de la invitación
        </legend>

        <div className="mt-3 space-y-4">
          <Field label="Título principal" error={fieldErrors.invitation_headline}>
            <input
              type="text"
              value={values.invitation_headline}
              onChange={(changeEvent) => set("invitation_headline", changeEvent.target.value)}
              className="input-base"
            />
          </Field>

          <Field label="Subtítulo" error={fieldErrors.invitation_subheadline}>
            <input
              type="text"
              value={values.invitation_subheadline}
              onChange={(changeEvent) =>
                set("invitation_subheadline", changeEvent.target.value)
              }
              className="input-base"
            />
          </Field>

          <Field label="Mensaje de bienvenida" error={fieldErrors.invitation_message}>
            <textarea
              value={values.invitation_message}
              onChange={(changeEvent) => set("invitation_message", changeEvent.target.value)}
              rows={3}
              className="input-base resize-none"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Apariencia
        </legend>

        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <ColorField
            label="Color principal"
            value={values.theme_primary_color}
            onChange={(value) => set("theme_primary_color", value)}
            error={fieldErrors.theme_primary_color}
          />
          <ColorField
            label="Color secundario"
            value={values.theme_secondary_color}
            onChange={(value) => set("theme_secondary_color", value)}
            error={fieldErrors.theme_secondary_color}
          />
          <ColorField
            label="Color de acento"
            value={values.theme_accent_color}
            onChange={(value) => set("theme_accent_color", value)}
            error={fieldErrors.theme_accent_color}
          />
        </div>

        <Field
          label="Imagen de fondo (URL, opcional)"
          className="mt-4"
          error={fieldErrors.background_image_url}
        >
          <input
            type="url"
            value={values.background_image_url}
            onChange={(changeEvent) => set("background_image_url", changeEvent.target.value)}
            placeholder="https://…"
            className="input-base"
          />
        </Field>

        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={values.music_enabled}
            onChange={(changeEvent) => set("music_enabled", changeEvent.target.checked)}
            className="mt-0.5 size-4 accent-[#ff2e9a]"
          />
          <span className="text-sm">
            <span className="font-semibold">Mostrar video de YouTube en la invitación</span>
            <span className="block text-muted-foreground">
              El video aparece al final de la página principal y de cada invitación; la persona
              decide cuándo reproducirlo.
            </span>
          </span>
        </label>

        {values.music_enabled && (
          <Field
            label="Enlace del video de YouTube"
            className="mt-3"
            error={fieldErrors.music_url}
            hint="Por ejemplo https://www.youtube.com/watch?v=… o https://youtu.be/…"
          >
            <input
              type="url"
              value={values.music_url}
              onChange={(changeEvent) => set("music_url", changeEvent.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="input-base"
            />
          </Field>
        )}
      </fieldset>

      <button
        type="submit"
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
            Guardar configuración
          </>
        )}
      </button>
    </form>
  )
}

function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string
  hint?: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-semibold text-mcd-red">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs capitalize text-muted-foreground">{hint}</span>
      )}
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(changeEvent) => onChange(changeEvent.target.value)}
          aria-label={label}
          className="size-11 shrink-0 cursor-pointer rounded-xl border border-input"
        />
        <input
          type="text"
          value={value}
          onChange={(changeEvent) => onChange(changeEvent.target.value)}
          className="input-base font-mono text-sm uppercase"
        />
      </span>
      {error && <span className="mt-1 block text-xs font-semibold text-mcd-red">{error}</span>}
    </label>
  )
}
