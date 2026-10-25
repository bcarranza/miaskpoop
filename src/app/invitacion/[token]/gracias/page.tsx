/** Pantalla de resultado después de confirmar. */
import { CalendarDays, CheckCircle2, Clock, Heart, MapPin, Pencil } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  AuroraBlobs,
  ConfettiRain,
  DecorStrip,
  DiscoBall,
  StarField,
} from "@/components/kpop/decor"
import { Button } from "@/components/ui/button"
import { formatLongDate, formatTime, isDeadlinePassed } from "@/lib/date"
import { getInvitationByToken } from "@/server/queries"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "¡Gracias!",
}

export default async function ThanksPage({
  params,
  searchParams,
}: PageProps<"/invitacion/[token]/gracias">) {
  const { token } = await params
  const query = await searchParams
  const data = await getInvitationByToken(token)

  if (!data) notFound()

  const { event, family } = data

  // El estado real viene de la base de datos; la URL sólo es informativa.
  const confirmed = family.rsvp_status === "confirmado"
  const declined = family.rsvp_status === "rechazado"
  const canEdit = event.allow_rsvp_edits && !isDeadlinePassed(event)
  // La URL puede traer el número de personas, pero el dato de confianza
  // es el que está guardado en la base de datos.
  void query
  const attendeeCount = family.confirmed_attendees

  return (
    <main className="kpop-stage relative flex min-h-dvh flex-col overflow-hidden">
      <AuroraBlobs />
      <StarField />
      {confirmed && <ConfettiRain />}

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        {confirmed ? (
          <>
            <div className="animate-float-slow mb-4">
              <DiscoBall size={76} />
            </div>

            <span className="mb-4 grid size-16 place-items-center rounded-3xl bg-emerald-400/20 text-emerald-300">
              <CheckCircle2 className="size-9" aria-hidden />
            </span>

            <h1 className="kpop-gradient-text text-center font-heading text-4xl font-black leading-tight">
              ¡Nos vemos en la fiesta!
            </h1>

            <p className="mt-3 text-center text-base text-lavender">
              Familia {family.name}, registramos{" "}
              <span className="font-bold text-white">
                {attendeeCount} {attendeeCount === 1 ? "persona" : "personas"}
              </span>{" "}
              con{" "}
              <span className="font-bold text-white">
                {family.menu_selections}{" "}
                {family.menu_selections === 1 ? "menú elegido" : "menús elegidos"}
              </span>
              .
            </p>

            {family.menu_incomplete && (
              <p className="mt-4 rounded-2xl border border-mcd-yellow/40 bg-mcd-yellow/10 px-4 py-3 text-center text-sm font-semibold text-mcd-yellow">
                Falta elegir el menú de alguna persona. Pueden completarlo con el botón de abajo.
              </p>
            )}
          </>
        ) : declined ? (
          <>
            <span className="mb-4 grid size-16 place-items-center rounded-3xl bg-white/10 text-lavender">
              <Heart className="size-8" aria-hidden />
            </span>

            <h1 className="text-center font-heading text-3xl font-black leading-tight text-white">
              ¡Gracias por avisarnos!
            </h1>

            <p className="mt-3 text-center text-base text-lavender">
              Registramos que la familia {family.name} no podrá acompañarnos. Los extrañaremos en
              la fiesta de {event.celebrant_name}.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-center font-heading text-3xl font-black text-white">
              Todavía no hemos recibido su confirmación
            </h1>
            <p className="mt-3 text-center text-base text-lavender">
              Si hubo algún problema al enviarla, vuelve a intentarlo.
            </p>
          </>
        )}

        {/* Recordatorio de los datos de la fiesta */}
        {confirmed && (
          <section className="kpop-glass mt-8 w-full rounded-3xl p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-lavender/80">
              Anota la fecha
            </h2>
            <dl className="space-y-3">
              <div className="flex items-center gap-3">
                <CalendarDays className="size-4 shrink-0 text-neon" aria-hidden />
                <dd className="text-sm font-bold capitalize text-white">
                  {formatLongDate(event.event_date)}
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="size-4 shrink-0 text-lavender" aria-hidden />
                <dd className="text-sm font-bold text-white">{formatTime(event.start_time)}</dd>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-mcd-yellow" aria-hidden />
                <div>
                  <dd className="text-sm font-bold text-white">{event.venue_name}</dd>
                  <dd className="text-xs text-lavender">{event.venue_address}</dd>
                </div>
              </div>
            </dl>
          </section>
        )}

        <div className="mt-8 flex w-full flex-col gap-3">
          {canEdit && (
            <Button
              render={<Link href={`/invitacion/${token}/confirmacion`} />}
              variant="secondary"
              className="h-12 w-full rounded-2xl bg-white/15 text-sm font-bold text-white hover:bg-white/25"
            >
              <Pencil className="mr-2 size-4" aria-hidden />
              Modificar mi respuesta
            </Button>
          )}

          <Button
            render={<Link href={`/invitacion/${token}`} />}
            variant="ghost"
            className="h-12 w-full rounded-2xl text-sm font-semibold text-lavender hover:bg-white/10 hover:text-white"
          >
            Ver la invitación
          </Button>
        </div>

        <DecorStrip className="mt-8" />

        {canEdit && (
          <p className="mt-4 text-center text-xs text-lavender/60">
            Pueden cambiar su respuesta hasta el{" "}
            <span className="capitalize">{formatLongDate(event.rsvp_deadline)}</span>.
          </p>
        )}
      </div>
    </main>
  )
}
