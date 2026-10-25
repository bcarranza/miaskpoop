"use client"

/**
 * Formulario de familia: datos de contacto, cupo autorizado y niños
 * invitados.
 *
 * El cupo lo decide la persona administradora y siempre incluye a los
 * niños invitados.
 */
import { AlertCircle, Baby, Loader2, Minus, Plus, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { normalizePhone } from "@/lib/phone"
import { MAX_ATTENDEES_LIMIT } from "@/lib/validation"
import { createFamily, updateFamily } from "@/server/actions/families"

export type FamilyFormValues = {
  name: string
  primary_contact_name: string
  whatsapp_phone: string
  secondary_contact_name: string
  secondary_contact_phone: string
  max_attendees: number
  invitation_enabled: boolean
  notes: string
  invited_children: { id?: string; name: string }[]
}

type Props = {
  familyId?: string
  initial?: Partial<FamilyFormValues>
  /** Asistentes ya confirmados, para avisar si se reduce el cupo. */
  confirmedAttendees?: number
}

const EMPTY: FamilyFormValues = {
  name: "",
  primary_contact_name: "",
  whatsapp_phone: "",
  secondary_contact_name: "",
  secondary_contact_phone: "",
  max_attendees: 2,
  invitation_enabled: true,
  notes: "",
  invited_children: [],
}

export function FamilyForm({ familyId, initial, confirmedAttendees = 0 }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<FamilyFormValues>({ ...EMPTY, ...initial })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof FamilyFormValues>(key: K, value: FamilyFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  const phoneCheck = values.whatsapp_phone.trim()
    ? normalizePhone(values.whatsapp_phone)
    : null

  const childrenCount = values.invited_children.filter((c) => c.name.trim() !== "").length
  const quotaBelowChildren = childrenCount > values.max_attendees
  const quotaBelowConfirmed = confirmedAttendees > values.max_attendees

  const addChild = () =>
    set("invited_children", [...values.invited_children, { name: "" }])

  const removeChild = (index: number) =>
    set(
      "invited_children",
      values.invited_children.filter((_, i) => i !== index),
    )

  const updateChild = (index: number, name: string) =>
    set(
      "invited_children",
      values.invited_children.map((child, i) => (i === index ? { ...child, name } : child)),
    )

  const handleSubmit = (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    setError(null)
    setFieldErrors({})

    const payload = {
      ...values,
      secondary_contact_name: values.secondary_contact_name.trim() || null,
      secondary_contact_phone: values.secondary_contact_phone.trim() || undefined,
      notes: values.notes.trim() || null,
      invited_children: values.invited_children
        .filter((child) => child.name.trim() !== "")
        .map((child) => ({ ...child, name: child.name.trim() })),
    }

    startTransition(async () => {
      if (familyId) {
        const result = await updateFamily(familyId, payload)
        if (!result.ok) {
          setError(result.error)
          setFieldErrors(result.fieldErrors ?? {})
          return
        }

        if (result.data.needsReview) {
          toast.warning("Familia guardada, pero requiere revisión", {
            description: result.data.reviewReason ?? undefined,
            duration: 8000,
          })
        } else {
          toast.success("Familia actualizada")
        }
        router.push(`/admin/familias/${familyId}`)
      } else {
        const result = await createFamily(payload)
        if (!result.ok) {
          setError(result.error)
          setFieldErrors(result.fieldErrors ?? {})
          return
        }

        toast.success("Familia creada", {
          description: "Ya puedes enviarle su invitación por WhatsApp.",
        })
        router.push(`/admin/familias/${result.data.id}`)
      }
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

      {/* Datos de la familia */}
      <fieldset className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Datos de la familia
        </legend>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field
            label="Nombre de la familia"
            hint="Como aparecerá en la invitación: «¡Hola, familia López!»"
            error={fieldErrors.name}
            required
          >
            <input
              type="text"
              value={values.name}
              onChange={(changeEvent) => set("name", changeEvent.target.value)}
              required
              maxLength={120}
              placeholder="López"
              className="input-base"
            />
          </Field>

          <Field
            label="Persona responsable"
            hint="A quien le escribirás por WhatsApp."
            error={fieldErrors.primary_contact_name}
            required
          >
            <input
              type="text"
              value={values.primary_contact_name}
              onChange={(changeEvent) => set("primary_contact_name", changeEvent.target.value)}
              required
              maxLength={120}
              placeholder="Ana López"
              className="input-base"
            />
          </Field>

          <Field
            label="WhatsApp"
            hint={
              phoneCheck?.ok
                ? `Se guardará como ${phoneCheck.e164}`
                : "Escribe 5555 0101 para Guatemala, o usa + para otro país."
            }
            error={
              fieldErrors["whatsapp_phone"] ??
              (phoneCheck && !phoneCheck.ok ? phoneCheck.error : undefined)
            }
            required
          >
            <input
              type="tel"
              inputMode="tel"
              value={values.whatsapp_phone}
              onChange={(changeEvent) => set("whatsapp_phone", changeEvent.target.value)}
              required
              placeholder="5555 0101"
              className="input-base"
            />
          </Field>

          <Field label="Contacto secundario (opcional)">
            <input
              type="text"
              value={values.secondary_contact_name}
              onChange={(changeEvent) => set("secondary_contact_name", changeEvent.target.value)}
              maxLength={120}
              placeholder="Carlos López"
              className="input-base"
            />
          </Field>

          <Field
            label="WhatsApp secundario (opcional)"
            error={fieldErrors.secondary_contact_phone}
          >
            <input
              type="tel"
              inputMode="tel"
              value={values.secondary_contact_phone}
              onChange={(changeEvent) => set("secondary_contact_phone", changeEvent.target.value)}
              placeholder="5555 0102"
              className="input-base"
            />
          </Field>
        </div>
      </fieldset>

      {/* Cupo */}
      <fieldset className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Cupo autorizado
        </legend>

        <p className="mt-2 text-sm text-muted-foreground">
          Tú decides cuántas personas puede traer esta familia. El total{" "}
          <span className="font-semibold text-foreground">incluye a los niños invitados</span>.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => set("max_attendees", Math.max(0, values.max_attendees - 1))}
            aria-label="Reducir cupo"
            className="grid size-11 place-items-center rounded-xl border border-border transition hover:bg-muted"
          >
            <Minus className="size-4" aria-hidden />
          </button>

          <input
            type="number"
            min={0}
            max={MAX_ATTENDEES_LIMIT}
            value={values.max_attendees}
            onChange={(changeEvent) =>
              set("max_attendees", Number(changeEvent.target.value) || 0)
            }
            aria-label="Cupo máximo de personas"
            className="h-11 w-20 rounded-xl border border-input bg-background text-center font-heading text-xl font-black tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <button
            type="button"
            onClick={() =>
              set("max_attendees", Math.min(MAX_ATTENDEES_LIMIT, values.max_attendees + 1))
            }
            aria-label="Aumentar cupo"
            className="grid size-11 place-items-center rounded-xl border border-border transition hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden />
          </button>

          <div className="text-sm">
            <p className="font-semibold">
              {values.max_attendees === 1 ? "1 persona" : `${values.max_attendees} personas`}
            </p>
            <p className="text-muted-foreground">
              {childrenCount} niño(s) invitado(s) ·{" "}
              {Math.max(values.max_attendees - childrenCount, 0)} acompañante(s) disponibles
            </p>
          </div>
        </div>

        {fieldErrors.max_attendees && (
          <p className="mt-2 text-sm font-semibold text-mcd-red">{fieldErrors.max_attendees}</p>
        )}

        {quotaBelowChildren && (
          <p className="mt-3 rounded-xl border border-mcd-red/40 bg-mcd-red/10 px-3 py-2 text-sm font-semibold text-mcd-red">
            El cupo debe alcanzar para los {childrenCount} niños invitados.
          </p>
        )}

        {!quotaBelowChildren && quotaBelowConfirmed && (
          <p className="mt-3 rounded-xl border border-mcd-yellow/50 bg-mcd-yellow/10 px-3 py-2 text-sm font-semibold text-amber-700">
            Esta familia ya confirmó {confirmedAttendees} asistentes. Si reduces el cupo a{" "}
            {values.max_attendees}, la familia quedará marcada para revisión y tendrás que
            acordar el cambio con ellos.
          </p>
        )}
      </fieldset>

      {/* Niños invitados */}
      <fieldset className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Niños invitados
        </legend>

        <p className="mt-2 text-sm text-muted-foreground">
          Los nombres aparecerán en la invitación y en el mensaje de WhatsApp. Una familia puede
          tener varios niños invitados.
        </p>

        {values.invited_children.length > 0 && (
          <ul className="mt-4 space-y-2">
            {values.invited_children.map((child, index) => (
              <li key={index} className="flex items-center gap-2">
                <Baby className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  type="text"
                  value={child.name}
                  onChange={(changeEvent) => updateChild(index, changeEvent.target.value)}
                  maxLength={80}
                  placeholder={`Nombre del niño/a ${index + 1}`}
                  aria-label={`Nombre del niño o niña ${index + 1}`}
                  className="input-base flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeChild(index)}
                  aria-label={`Quitar ${child.name || "niño/a"}`}
                  className="grid size-10 shrink-0 place-items-center rounded-xl text-mcd-red transition hover:bg-mcd-red/10"
                >
                  <Minus className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {fieldErrors["invited_children.0.name"] && (
          <p className="mt-2 text-sm font-semibold text-mcd-red">
            {fieldErrors["invited_children.0.name"]}
          </p>
        )}

        <button
          type="button"
          onClick={addChild}
          className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-semibold transition hover:border-primary hover:text-primary"
        >
          <Plus className="size-4" aria-hidden />
          Agregar niño o niña invitado
        </button>
      </fieldset>

      {/* Notas y estado */}
      <fieldset className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Notas internas
        </legend>

        <textarea
          value={values.notes}
          onChange={(changeEvent) => set("notes", changeEvent.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Alergias, parentesco, recordatorios… (no se muestra a la familia)"
          aria-label="Notas internas"
          className="input-base mt-3 resize-none"
        />

        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={values.invitation_enabled}
            onChange={(changeEvent) => set("invitation_enabled", changeEvent.target.checked)}
            className="mt-0.5 size-4 accent-[#ff2e9a]"
          />
          <span className="text-sm">
            <span className="font-semibold">Invitación activa</span>
            <span className="block text-muted-foreground">
              Si la desactivas, el enlace deja de funcionar y la familia no podrá confirmar.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending || quotaBelowChildren}
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
              {familyId ? "Guardar cambios" : "Crear familia"}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="rounded-xl border border-border px-5 py-3 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">
        {label}
        {required && <span className="ml-0.5 text-mcd-red">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-semibold text-mcd-red">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  )
}
