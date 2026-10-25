/**
 * Invitación personalizada de una familia.
 *
 * El token de la URL es la credencial de acceso. Sólo se cargan y se
 * muestran los datos de esa familia.
 */
import { CheckCircle2, PartyPopper, Pencil, XCircle } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CountdownTimer } from "@/components/kpop/countdown"
import {
  AuroraBlobs,
  ConfettiRain,
  DecorStrip,
  StageLights,
  StarField,
} from "@/components/kpop/decor"
import { InvitationTicket } from "@/components/kpop/invitation-ticket"
import { MusicPlayer } from "@/components/kpop/music-player"
import { Button } from "@/components/ui/button"
import {
  formatLongDate,
  getCountdown,
  getEventStart,
  isDeadlinePassed,
} from "@/lib/date"
import { getInvitationByToken } from "@/server/queries"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Tu invitación",
}

export default async function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params
  const data = await getInvitationByToken(token)

  if (!data) notFound()

  const { event, family, invitedChildren, currentResponse } = data

  const start = getEventStart(event)
  const countdown = getCountdown(start)
  const deadlinePassed = isDeadlinePassed(event)

  const alreadyAnswered = family.rsvp_status !== "pendiente"
  const canEdit = event.allow_rsvp_edits && !deadlinePassed
  const canAnswer = family.invitation_enabled && !deadlinePassed

  return (
    <main className="kpop-stage relative flex min-h-dvh flex-col overflow-hidden">
      {event.music_enabled && event.music_url && (
        <MusicPlayer url={event.music_url} />
      )}
      <StageLights />
      <AuroraBlobs />
      <StarField />
      <ConfettiRain />

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12">
        <InvitationTicket
          celebrantName={event.celebrant_name}
          celebrantAge={event.celebrant_age}
          familyName={family.name}
          invitedChildren={family.invited_children_names ?? invitedChildren.map((c) => c.name)}
          maxAttendees={family.max_attendees}
          eventDate={event.event_date}
          startTime={event.start_time}
          venueName={event.venue_name}
          venueAddress={event.venue_address}
        />

        <CountdownTimer
          targetIso={start.toISOString()}
          initial={countdown}
          className="mt-8"
        />

        {/* Estado de la confirmación */}
        {alreadyAnswered && (
          <section
            className={`kpop-glass mt-8 rounded-3xl p-5 ${
              family.rsvp_status === "confirmado"
                ? "border-emerald-300/30"
                : "border-white/20"
            }`}
          >
            <div className="flex items-start gap-3">
              {family.rsvp_status === "confirmado" ? (
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-300" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 size-6 shrink-0 text-lavender" aria-hidden />
              )}
              <div>
                <h2 className="font-heading text-lg font-extrabold text-white">
                  {family.rsvp_status === "confirmado"
                    ? "¡Ya confirmaron su asistencia!"
                    : "Registramos que no podrán acompañarnos"}
                </h2>

                {family.rsvp_status === "confirmado" ? (
                  <p className="mt-1 text-sm text-lavender">
                    {family.confirmed_attendees}{" "}
                    {family.confirmed_attendees === 1 ? "persona" : "personas"} confirmadas (
                    {family.confirmed_children}{" "}
                    {family.confirmed_children === 1 ? "niño/a" : "niños"} y{" "}
                    {family.confirmed_adults}{" "}
                    {family.confirmed_adults === 1 ? "adulto" : "adultos"}) con{" "}
                    {family.menu_selections}{" "}
                    {family.menu_selections === 1 ? "menú elegido" : "menús elegidos"}.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-lavender">
                    ¡Gracias por avisarnos! Si cambian de planes, pueden actualizar su respuesta.
                  </p>
                )}

                {currentResponse?.message && (
                  <p className="mt-2 rounded-xl bg-black/25 px-3 py-2 text-xs italic text-lavender">
                    “{currentResponse.message}”
                  </p>
                )}

                {family.menu_incomplete && (
                  <p className="mt-3 rounded-xl border border-mcd-yellow/40 bg-mcd-yellow/10 px-3 py-2 text-xs font-semibold text-mcd-yellow">
                    Falta elegir el menú de alguna persona. Pueden completarlo desde el botón de
                    abajo.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Acción principal */}
        <div className="mt-8">
          {!family.invitation_enabled ? (
            <p className="kpop-glass rounded-2xl p-5 text-center text-sm text-lavender">
              Esta invitación está desactivada por el momento. Escríbenos por WhatsApp, por favor.
            </p>
          ) : deadlinePassed ? (
            <p className="kpop-glass rounded-2xl p-5 text-center text-sm text-lavender">
              El plazo para confirmar terminó el{" "}
              <span className="font-semibold capitalize text-white">
                {formatLongDate(event.rsvp_deadline)}
              </span>
              . Si aún quieren acompañarnos, escríbenos por WhatsApp.
            </p>
          ) : (
            <>
              {(!alreadyAnswered || canEdit) && (
                <Button
                  render={<Link href={`/invitacion/${token}/confirmacion`} />}
                  size="lg"
                  className="kpop-neon-glow h-14 w-full rounded-2xl bg-gradient-to-r from-neon to-grape text-base font-black uppercase tracking-wide text-white hover:from-magenta hover:to-grape"
                >
                  {alreadyAnswered ? (
                    <>
                      <Pencil className="mr-2 size-5" aria-hidden />
                      Modificar confirmación
                    </>
                  ) : (
                    <>
                      <PartyPopper className="mr-2 size-5" aria-hidden />
                      Confirmar asistencia
                    </>
                  )}
                </Button>
              )}

              {alreadyAnswered && !canEdit && (
                <p className="kpop-glass rounded-2xl p-4 text-center text-sm text-lavender">
                  Su confirmación ya quedó registrada y no puede modificarse. Si necesitan un
                  cambio, escríbenos por WhatsApp.
                </p>
              )}

              {canAnswer && !alreadyAnswered && (
                <p className="mt-3 text-center text-xs text-lavender/80">
                  Pueden confirmar hasta el{" "}
                  <span className="font-semibold capitalize text-lavender">
                    {formatLongDate(event.rsvp_deadline)}
                  </span>
                  . No hace falta crear ninguna cuenta.
                </p>
              )}
            </>
          )}
        </div>

        <DecorStrip className="mt-10" />

        <footer className="mt-6 text-center text-xs text-lavender/60">
          <p>
            Fiesta temática de K-pop. Sin relación con ningún grupo, artista ni sello musical.
          </p>
          <p className="mt-1">
            Este enlace es personal de la familia {family.name}; por favor no lo compartan.
          </p>
        </footer>
      </div>
    </main>
  )
}
