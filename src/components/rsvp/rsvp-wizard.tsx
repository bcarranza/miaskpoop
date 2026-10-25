"use client"

/**
 * Formulario de confirmación de asistencia.
 *
 * Pensado para teléfonos: un paso a la vez, botones grandes y el
 * contador de cupos siempre visible.
 *
 * El cupo se valida aquí (primera capa), en la Server Action (segunda)
 * y dentro de la transacción de PostgreSQL (tercera y definitiva).
 */
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Baby,
  Check,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  Send,
  User,
  UtensilsCrossed,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useId, useMemo, useRef, useState, useTransition } from "react"
import { formatLongDate } from "@/lib/date"
import type { GuestRecord, MenuItemRecord } from "@/lib/types"
import { submitRsvp } from "@/server/actions/rsvp"

export type RsvpWizardProps = {
  token: string
  familyName: string
  maxAttendees: number
  celebrantName: string
  rsvpDeadline: string
  allowEdits: boolean
  invitedChildren: GuestRecord[]
  companions: GuestRecord[]
  menus: MenuItemRecord[]
  /** Menú vigente por invitado (para precargar al modificar). */
  selections: Record<string, string>
  /** true si la familia ya respondió antes. */
  hasPreviousResponse: boolean
  previousAttending: boolean
  previousResponderName: string | null
  previousMessage: string | null
}

type Attendee = {
  key: string
  guestId: string | null
  name: string
  type: "nino" | "adulto"
  isInvitedChild: boolean
  menuItemId: string | null
}

type Step = "asistencia" | "personas" | "menus" | "resumen"

const STEP_ORDER: Step[] = ["asistencia", "personas", "menus", "resumen"]

const STEP_TITLES: Record<Step, string> = {
  asistencia: "¿Podrán acompañarnos?",
  personas: "¿Quiénes vienen?",
  menus: "Elijan su menú",
  resumen: "Revisen y confirmen",
}

let keyCounter = 0
const nextKey = () => `a${(keyCounter += 1)}`

export function RsvpWizard(props: RsvpWizardProps) {
  const {
    token,
    familyName,
    maxAttendees,
    celebrantName,
    rsvpDeadline,
    invitedChildren,
    companions,
    menus,
    selections,
    hasPreviousResponse,
    previousAttending,
    previousResponderName,
    previousMessage,
  } = props

  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const formId = useId()
  const idempotencyRef = useRef<string | null>(null)

  const [step, setStep] = useState<Step>("asistencia")
  const [attending, setAttending] = useState<boolean | null>(
    hasPreviousResponse ? previousAttending : null,
  )
  const [responderName, setResponderName] = useState(previousResponderName ?? "")
  const [message, setMessage] = useState(previousMessage ?? "")
  const [error, setError] = useState<string | null>(null)

  // Niños invitados: se marcan o desmarcan, nunca se eliminan.
  const [childSelection, setChildSelection] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      invitedChildren.map((child) => [
        child.id,
        hasPreviousResponse ? child.is_attending === true : true,
      ]),
    ),
  )

  const [childMenus, setChildMenus] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      invitedChildren.map((child) => [child.id, selections[child.id] ?? null]),
    ),
  )

  // Acompañantes: los agrega la familia, dentro del cupo autorizado.
  const [extras, setExtras] = useState<Attendee[]>(() =>
    companions
      .filter((guest) => !hasPreviousResponse || guest.is_attending === true)
      .map((guest) => ({
        key: nextKey(),
        guestId: guest.id,
        name: guest.name,
        type: guest.guest_type,
        isInvitedChild: false,
        menuItemId: selections[guest.id] ?? null,
      })),
  )

  const adultMenus = useMemo(() => menus.filter((m) => m.audience === "adulto"), [menus])
  const childMenuOptions = useMemo(() => menus.filter((m) => m.audience === "nino"), [menus])

  const selectedChildren = useMemo(
    () => invitedChildren.filter((child) => childSelection[child.id]),
    [invitedChildren, childSelection],
  )

  const usedSlots = selectedChildren.length + extras.length
  const remaining = Math.max(maxAttendees - usedSlots, 0)
  const overQuota = usedSlots > maxAttendees

  /** Lista final de asistentes, en el orden en que se muestran. */
  const attendees: Attendee[] = useMemo(
    () => [
      ...selectedChildren.map((child) => ({
        key: `child-${child.id}`,
        guestId: child.id,
        name: child.name,
        type: "nino" as const,
        isInvitedChild: true,
        menuItemId: childMenus[child.id] ?? null,
      })),
      ...extras,
    ],
    [selectedChildren, childMenus, extras],
  )

  const missingNames = extras.filter((extra) => extra.name.trim().length < 2).length
  const missingMenus = attendees.filter((attendee) => !attendee.menuItemId).length

  const duplicateNames = useMemo(() => {
    const seen = new Set<string>()
    const duplicates = new Set<string>()
    for (const attendee of attendees) {
      const key = attendee.name.trim().toLocaleLowerCase("es")
      if (key === "") continue
      if (seen.has(key)) duplicates.add(key)
      seen.add(key)
    }
    return duplicates
  }, [attendees])

  const invalidate = useCallback(() => {
    // Cualquier cambio invalida la clave de idempotencia: pasa a ser
    // un envío nuevo y no la repetición de uno anterior.
    idempotencyRef.current = null
    setError(null)
  }, [])

  // ------------------------------------------------------------------
  // Acciones sobre acompañantes
  // ------------------------------------------------------------------
  const addExtra = (type: "nino" | "adulto") => {
    if (usedSlots >= maxAttendees) return
    invalidate()
    setExtras((current) => [
      ...current,
      { key: nextKey(), guestId: null, name: "", type, isInvitedChild: false, menuItemId: null },
    ])
  }

  const removeExtra = (key: string) => {
    invalidate()
    setExtras((current) => current.filter((extra) => extra.key !== key))
  }

  const updateExtra = (key: string, patch: Partial<Attendee>) => {
    invalidate()
    setExtras((current) =>
      current.map((extra) => {
        if (extra.key !== key) return extra
        const updated = { ...extra, ...patch }
        // Si cambia de niño a adulto (o al revés), el menú deja de valer.
        if (patch.type && patch.type !== extra.type) updated.menuItemId = null
        return updated
      }),
    )
  }

  const toggleChild = (id: string) => {
    invalidate()
    setChildSelection((current) => {
      const next = !current[id]
      if (next && usedSlots >= maxAttendees) return current
      return { ...current, [id]: next }
    })
  }

  const setMenuFor = (attendee: Attendee, menuItemId: string) => {
    invalidate()
    if (attendee.isInvitedChild && attendee.guestId) {
      setChildMenus((current) => ({ ...current, [attendee.guestId as string]: menuItemId }))
    } else {
      setExtras((current) =>
        current.map((extra) => (extra.key === attendee.key ? { ...extra, menuItemId } : extra)),
      )
    }
  }

  // ------------------------------------------------------------------
  // Navegación entre pasos
  // ------------------------------------------------------------------
  const canContinue = (): { ok: boolean; reason?: string } => {
    if (step === "asistencia") {
      if (attending === null) return { ok: false, reason: "Elige una opción para continuar." }
      return { ok: true }
    }
    if (step === "personas") {
      if (usedSlots === 0) {
        return { ok: false, reason: "Selecciona al menos una persona que asistirá." }
      }
      if (overQuota) {
        return {
          ok: false,
          reason: `Esta invitación permite un máximo de ${maxAttendees} ${
            maxAttendees === 1 ? "persona" : "personas"
          }.`,
        }
      }
      if (missingNames > 0) {
        return { ok: false, reason: "Escribe el nombre de cada acompañante." }
      }
      if (duplicateNames.size > 0) {
        return { ok: false, reason: "Hay nombres repetidos. Cada persona necesita un nombre distinto." }
      }
      return { ok: true }
    }
    if (step === "menus") {
      if (missingMenus > 0) {
        return {
          ok: false,
          reason: `Falta elegir ${missingMenus} ${missingMenus === 1 ? "menú" : "menús"}.`,
        }
      }
      return { ok: true }
    }
    return { ok: true }
  }

  const goNext = () => {
    const check = canContinue()
    if (!check.ok) {
      setError(check.reason ?? null)
      return
    }
    setError(null)

    // Si no asisten, se salta directo al resumen.
    if (step === "asistencia" && attending === false) {
      setStep("resumen")
      return
    }

    const index = STEP_ORDER.indexOf(step)
    setStep(STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)])
  }

  const goBack = () => {
    setError(null)
    if (step === "resumen" && attending === false) {
      setStep("asistencia")
      return
    }
    const index = STEP_ORDER.indexOf(step)
    setStep(STEP_ORDER[Math.max(index - 1, 0)])
  }

  // ------------------------------------------------------------------
  // Envío
  // ------------------------------------------------------------------
  const handleSubmit = () => {
    if (attending === null) {
      setError("Elige si podrán acompañarnos.")
      return
    }

    if (attending) {
      const check = canContinue()
      if (!check.ok) {
        setError(check.reason ?? null)
        return
      }
      if (usedSlots === 0 || overQuota || missingMenus > 0 || missingNames > 0) {
        setError("Revisa los datos antes de enviar.")
        return
      }
    }

    if (!idempotencyRef.current) {
      idempotencyRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `rsvp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    }

    setError(null)

    startTransition(async () => {
      const result = await submitRsvp(token, {
        attending,
        responder_name: responderName.trim() || null,
        message: message.trim() || null,
        idempotency_key: idempotencyRef.current as string,
        attendees: attending
          ? attendees.map((attendee) => ({
              guest_id: attendee.guestId,
              name: attendee.name.trim(),
              guest_type: attendee.type,
              is_invited_child: attendee.isInvitedChild,
              menu_item_id: attendee.menuItemId as string,
            }))
          : [],
      })

      if (!result.ok) {
        // Error de validación: el siguiente intento es un envío nuevo.
        idempotencyRef.current = null
        setError(result.error)
        return
      }

      const estado = result.data.status === "confirmado" ? "confirmado" : "rechazado"
      router.push(
        `/invitacion/${token}/gracias?estado=${estado}&personas=${result.data.attendeeCount}`,
      )
    })
  }

  const stepIndex = STEP_ORDER.indexOf(step)
  const totalSteps = attending === false ? 2 : STEP_ORDER.length
  const displayIndex = attending === false && step === "resumen" ? 2 : stepIndex + 1

  return (
    <div className="w-full">
      {/* Progreso */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-lavender/80">
          <span>
            Paso {displayIndex} de {totalSteps}
          </span>
          <span>{STEP_TITLES[step]}</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={displayIndex}
          aria-label="Avance de la confirmación"
        >
          <div
            className="kpop-quota-fill h-full rounded-full transition-all duration-500"
            style={{ width: `${(displayIndex / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Contador de cupos */}
      {attending !== false && (
        <QuotaCounter used={usedSlots} max={maxAttendees} over={overQuota} />
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl border border-mcd-red/50 bg-mcd-red/15 px-4 py-3 text-sm font-medium text-white"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-mcd-red" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {/* ---------------------------------------------------------------
          Paso 1: asistencia
          --------------------------------------------------------------- */}
      {step === "asistencia" && (
        <section className="mt-6 space-y-3" aria-label="Asistencia">
          <button
            type="button"
            onClick={() => {
              invalidate()
              setAttending(true)
            }}
            aria-pressed={attending === true}
            className={`flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left transition ${
              attending === true
                ? "border-neon bg-neon/20 kpop-neon-glow"
                : "border-white/20 bg-white/5 hover:border-neon/60 hover:bg-white/10"
            }`}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-neon/25 text-white">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-heading text-lg font-extrabold text-white">
                ¡Sí asistiremos!
              </span>
              <span className="block text-sm text-lavender">
                Elegiremos quiénes vienen y su menú.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              invalidate()
              setAttending(false)
            }}
            aria-pressed={attending === false}
            className={`flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left transition ${
              attending === false
                ? "border-lavender bg-white/15"
                : "border-white/20 bg-white/5 hover:border-lavender/60 hover:bg-white/10"
            }`}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-lavender">
              <X className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-heading text-lg font-extrabold text-white">
                No podremos asistir
              </span>
              <span className="block text-sm text-lavender">
                Nos avisarán y liberamos el cupo.
              </span>
            </span>
          </button>
        </section>
      )}

      {/* ---------------------------------------------------------------
          Paso 2: personas
          --------------------------------------------------------------- */}
      {step === "personas" && (
        <section className="mt-6 space-y-6">
          {invitedChildren.length > 0 && (
            <div>
              <h3 className="mb-1 font-heading text-base font-extrabold text-white">
                {invitedChildren.length === 1
                  ? "Invitada o invitado especial"
                  : "Invitados especiales"}
              </h3>
              <p className="mb-3 text-xs text-lavender">
                Marca quién podrá acompañar a {celebrantName}.
              </p>
              <ul className="space-y-2">
                {invitedChildren.map((child) => {
                  const checked = Boolean(childSelection[child.id])
                  const blocked = !checked && usedSlots >= maxAttendees
                  return (
                    <li key={child.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition ${
                          checked
                            ? "border-neon bg-neon/15"
                            : blocked
                              ? "cursor-not-allowed border-white/10 bg-white/5 opacity-50"
                              : "border-white/20 bg-white/5 hover:border-neon/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="size-5 shrink-0 accent-[#ff2e9a]"
                          checked={checked}
                          disabled={blocked}
                          onChange={() => toggleChild(child.id)}
                        />
                        <Baby className="size-5 shrink-0 text-lavender" aria-hidden />
                        <span className="font-semibold text-white">{child.name}</span>
                        {blocked && (
                          <span className="ml-auto text-[0.7rem] text-mcd-yellow">
                            Sin cupo disponible
                          </span>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-1 font-heading text-base font-extrabold text-white">
              Acompañantes
            </h3>
            <p className="mb-3 text-xs text-lavender">
              Agrega a las personas que vendrán, dentro de los {maxAttendees}{" "}
              {maxAttendees === 1 ? "cupo autorizado" : "cupos autorizados"}.
            </p>

            {extras.length > 0 && (
              <ul className="mb-3 space-y-3">
                {extras.map((extra, index) => {
                  const isDuplicate = duplicateNames.has(
                    extra.name.trim().toLocaleLowerCase("es"),
                  )
                  return (
                    <li
                      key={extra.key}
                      className="rounded-2xl border-2 border-white/20 bg-white/5 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor={`${formId}-extra-${extra.key}`}
                          className="text-xs font-semibold uppercase tracking-wide text-lavender"
                        >
                          Acompañante {index + 1}
                        </label>
                        <button
                          type="button"
                          onClick={() => removeExtra(extra.key)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-mcd-red transition hover:bg-mcd-red/15"
                        >
                          <Minus className="size-3.5" aria-hidden />
                          Quitar
                        </button>
                      </div>

                      <input
                        id={`${formId}-extra-${extra.key}`}
                        type="text"
                        value={extra.name}
                        onChange={(event) =>
                          updateExtra(extra.key, { name: event.target.value })
                        }
                        placeholder="Nombre y apellido"
                        maxLength={80}
                        autoComplete="off"
                        aria-invalid={isDuplicate || extra.name.trim().length < 2}
                        className={`mt-2 w-full rounded-xl border bg-black/30 px-4 py-3 text-base text-white placeholder:text-lavender/50 focus:outline-none focus:ring-2 focus:ring-neon ${
                          isDuplicate ? "border-mcd-red" : "border-white/20"
                        }`}
                      />

                      {isDuplicate && (
                        <p className="mt-1.5 text-xs font-semibold text-mcd-red">
                          Este nombre ya está en la lista.
                        </p>
                      )}

                      <div
                        role="radiogroup"
                        aria-label={`Tipo de acompañante ${index + 1}`}
                        className="mt-3 grid grid-cols-2 gap-2"
                      >
                        {(
                          [
                            { value: "nino" as const, label: "Niño/a", icon: Baby },
                            { value: "adulto" as const, label: "Adulto", icon: User },
                          ]
                        ).map((option) => (
                          <label
                            key={option.value}
                            className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition ${
                              extra.type === option.value
                                ? "border-grape bg-grape/25 text-white"
                                : "border-white/20 bg-white/5 text-lavender hover:border-grape/50"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`${formId}-tipo-${extra.key}`}
                              value={option.value}
                              checked={extra.type === option.value}
                              onChange={() => updateExtra(extra.key, { type: option.value })}
                              className="sr-only"
                            />
                            <option.icon className="size-4" aria-hidden />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {remaining > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => addExtra("nino")}
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/25 bg-white/5 py-3 text-sm font-semibold text-lavender transition hover:border-neon hover:text-white"
                >
                  <Plus className="size-4" aria-hidden />
                  Agregar niño/a
                </button>
                <button
                  type="button"
                  onClick={() => addExtra("adulto")}
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/25 bg-white/5 py-3 text-sm font-semibold text-lavender transition hover:border-neon hover:text-white"
                >
                  <Plus className="size-4" aria-hidden />
                  Agregar adulto
                </button>
              </div>
            ) : (
              <p className="rounded-xl border border-mcd-yellow/40 bg-mcd-yellow/10 px-4 py-3 text-xs font-semibold text-mcd-yellow">
                Ya usaste los {maxAttendees} {maxAttendees === 1 ? "cupo" : "cupos"} de esta
                invitación. Si necesitan más lugares, escríbenos por WhatsApp.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------
          Paso 3: menús
          --------------------------------------------------------------- */}
      {step === "menus" && (
        <section className="mt-6 space-y-5">
          <p className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-lavender">
            Cada persona elige un menú. Las Cajitas Felices son para los niños y los menús
            completos para los adultos.
          </p>

          {attendees.map((attendee) => {
            const options = attendee.type === "nino" ? childMenuOptions : adultMenus
            return (
              <fieldset
                key={attendee.key}
                className="rounded-2xl border-2 border-white/20 bg-white/5 p-4"
              >
                <legend className="flex items-center gap-2 px-1 text-sm font-bold text-white">
                  {attendee.type === "nino" ? (
                    <Baby className="size-4 text-lavender" aria-hidden />
                  ) : (
                    <User className="size-4 text-lavender" aria-hidden />
                  )}
                  {attendee.name.trim() || "Sin nombre"}
                  <span className="text-xs font-normal text-lavender">
                    ({attendee.type === "nino" ? "Cajita Feliz" : "Menú de adulto"})
                  </span>
                </legend>

                {options.length === 0 ? (
                  <p className="mt-2 text-xs text-mcd-yellow">
                    No hay menús disponibles para esta edad. Escríbenos por WhatsApp.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {options.map((menu) => (
                      <label
                        key={menu.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${
                          attendee.menuItemId === menu.id
                            ? "border-neon bg-neon/15"
                            : "border-white/15 bg-black/20 hover:border-neon/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${formId}-menu-${attendee.key}`}
                          value={menu.id}
                          checked={attendee.menuItemId === menu.id}
                          onChange={() => setMenuFor(attendee, menu.id)}
                          className="mt-0.5 size-5 shrink-0 accent-[#ff2e9a]"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white">
                            {menu.name}
                          </span>
                          {menu.description && (
                            <span className="block text-xs text-lavender">
                              {menu.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            )
          })}
        </section>
      )}

      {/* ---------------------------------------------------------------
          Paso 4: resumen
          --------------------------------------------------------------- */}
      {step === "resumen" && (
        <section className="mt-6 space-y-5">
          {attending === false ? (
            <div className="rounded-2xl border-2 border-white/20 bg-white/5 p-5">
              <h3 className="font-heading text-lg font-extrabold text-white">
                No podrán acompañarnos
              </h3>
              <p className="mt-2 text-sm text-lavender">
                Registraremos que la familia {familyName} no asistirá. ¡Gracias por avisarnos!
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-white/20 bg-white/5 p-5">
              <h3 className="font-heading text-lg font-extrabold text-white">
                {usedSlots} {usedSlots === 1 ? "persona" : "personas"} asistirán
              </h3>
              <p className="mt-1 text-xs text-lavender">
                {attendees.filter((a) => a.type === "nino").length} niños ·{" "}
                {attendees.filter((a) => a.type === "adulto").length} adultos ·{" "}
                {attendees.length} {attendees.length === 1 ? "menú" : "menús"}
              </p>

              <ul className="mt-4 divide-y divide-white/10">
                {attendees.map((attendee) => {
                  const menu = menus.find((m) => m.id === attendee.menuItemId)
                  return (
                    <li key={attendee.key} className="flex items-start gap-3 py-3">
                      {attendee.type === "nino" ? (
                        <Baby className="mt-0.5 size-4 shrink-0 text-lavender" aria-hidden />
                      ) : (
                        <User className="mt-0.5 size-4 shrink-0 text-lavender" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {attendee.name.trim() || "Sin nombre"}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-lavender">
                          <UtensilsCrossed className="size-3" aria-hidden />
                          {menu?.name ?? "Sin menú"}
                        </p>
                      </div>
                      {attendee.isInvitedChild && (
                        <span className="rounded-full bg-mcd-yellow/20 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-mcd-yellow">
                          Invitado
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label
                htmlFor={`${formId}-responder`}
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-lavender"
              >
                ¿Quién confirma? (opcional)
              </label>
              <input
                id={`${formId}-responder`}
                type="text"
                value={responderName}
                onChange={(event) => {
                  invalidate()
                  setResponderName(event.target.value)
                }}
                maxLength={120}
                placeholder="Tu nombre"
                autoComplete="name"
                className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-base text-white placeholder:text-lavender/50 focus:outline-none focus:ring-2 focus:ring-neon"
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-message`}
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-lavender"
              >
                Mensaje para la familia anfitriona (opcional)
              </label>
              <textarea
                id={`${formId}-message`}
                value={message}
                onChange={(event) => {
                  invalidate()
                  setMessage(event.target.value)
                }}
                maxLength={500}
                rows={3}
                placeholder="Alergias, hora de llegada, lo que quieras contarnos…"
                className="w-full resize-none rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-base text-white placeholder:text-lavender/50 focus:outline-none focus:ring-2 focus:ring-neon"
              />
            </div>
          </div>

          <p className="text-center text-xs text-lavender/70">
            Pueden modificar su respuesta hasta el{" "}
            <span className="font-semibold capitalize">{formatLongDate(rsvpDeadline)}</span>.
          </p>
        </section>
      )}

      {/* Navegación */}
      <div className="mt-8 flex gap-3">
        {step !== "asistencia" && (
          <button
            type="button"
            onClick={goBack}
            disabled={pending}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-white/25 bg-white/5 px-5 py-4 text-sm font-bold text-lavender transition hover:bg-white/10 disabled:opacity-50"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Atrás
          </button>
        )}

        {step === "resumen" ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="kpop-neon-glow flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-neon to-grape px-5 py-4 text-base font-black uppercase tracking-wide text-white transition hover:from-magenta disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Enviando…
              </>
            ) : (
              <>
                <Send className="size-5" aria-hidden />
                {attending === false ? "Enviar respuesta" : "Confirmar asistencia"}
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={pending}
            className="kpop-neon-glow flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-neon to-grape px-5 py-4 text-base font-black uppercase tracking-wide text-white transition hover:from-magenta disabled:opacity-60"
          >
            Continuar
            <ArrowRight className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

/** Contador de cupos: "3 de 4 cupos utilizados". */
function QuotaCounter({
  used,
  max,
  over,
}: {
  used: number
  max: number
  over: boolean
}) {
  const percent = max === 0 ? 0 : Math.min((used / max) * 100, 100)

  return (
    <div
      className={`rounded-2xl border p-4 ${
        over ? "border-mcd-red/60 bg-mcd-red/15" : "border-white/15 bg-white/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white" aria-live="polite">
          {used} de {max} {max === 1 ? "cupo utilizado" : "cupos utilizados"}
        </p>
        {used === max && !over && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-300">
            <Check className="size-3.5" aria-hidden />
            Cupo completo
          </span>
        )}
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/30">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            over ? "bg-mcd-red" : "kpop-quota-fill"
          }`}
          style={{ width: `${over ? 100 : percent}%` }}
        />
      </div>

      {over && (
        <p className="mt-2 text-xs font-semibold text-white">
          Esta invitación permite un máximo de {max} {max === 1 ? "persona" : "personas"}.
        </p>
      )}
    </div>
  )
}
