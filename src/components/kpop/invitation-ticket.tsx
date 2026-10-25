/**
 * Boleto de concierto con los datos de la invitación de una familia.
 * Es sólo presentación: no recibe ni muestra datos de otras familias.
 */
import { CalendarDays, Clock, MapPin, Users } from "lucide-react"
import { formatLongDate, formatTime } from "@/lib/date"
import { joinNames } from "@/lib/whatsapp"
import { DiscoBall, Microphone, Sparkle } from "./decor"

type Props = {
  celebrantName: string
  celebrantAge: number
  familyName: string
  invitedChildren: string[]
  maxAttendees: number
  eventDate: string
  startTime: string
  venueName: string
  venueAddress: string
}

export function InvitationTicket({
  celebrantName,
  celebrantAge,
  familyName,
  invitedChildren,
  maxAttendees,
  eventDate,
  startTime,
  venueName,
  venueAddress,
}: Props) {
  const personas = maxAttendees === 1 ? "persona" : "personas"

  return (
    <article className="kpop-holo-border animate-pop relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a1043] via-[#1f0d35] to-[#140822] shadow-2xl">
      {/* Franja superior del boleto */}
      <header className="relative overflow-hidden bg-gradient-to-r from-neon via-magenta to-grape px-5 py-4">
        <div aria-hidden className="kpop-decor absolute -right-3 -top-6 opacity-60">
          <DiscoBall size={64} />
        </div>
        <p className="text-[0.65rem] font-black uppercase tracking-[0.3em] text-white/80">
          Admite {maxAttendees} {personas}
        </p>
        <h2 className="font-heading text-xl font-black uppercase tracking-wide text-white">
          Boleto de entrada
        </h2>
      </header>

      {/* Perforación */}
      <div aria-hidden className="relative">
        <div className="kpop-perforation" />
        <span className="absolute -left-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-[#1a0b2e]" />
        <span className="absolute -right-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-[#1a0b2e]" />
      </div>

      {/* Cuerpo */}
      <div className="px-5 py-6 sm:px-7">
        <p className="text-sm font-semibold text-lavender">¡Hola, familia {familyName}!</p>

        <h3 className="kpop-gradient-text mt-2 font-heading text-3xl font-black leading-tight sm:text-4xl">
          ¡{celebrantName.toLocaleUpperCase("es-GT")} CUMPLE {celebrantAge} AÑOS!
        </h3>

        <p className="kpop-text-glow mt-1 font-heading text-sm font-extrabold uppercase tracking-[0.25em] text-white">
          You&apos;re invited!
        </p>

        <p className="mt-4 text-sm leading-relaxed text-lavender">
          ¡{celebrantName} quiere celebrar sus {celebrantAge} años contigo! Prepárate para una
          fiesta K-pop llena de música, juegos y sorpresas.
        </p>

        {invitedChildren.length > 0 && (
          <p className="mt-4 rounded-2xl border border-mcd-yellow/30 bg-mcd-yellow/10 px-4 py-3 text-sm text-white">
            <span className="font-bold text-mcd-yellow">
              {invitedChildren.length === 1 ? "Invitada especial: " : "Invitados especiales: "}
            </span>
            {joinNames(invitedChildren)}.
          </p>
        )}

        {/* Detalles */}
        <dl className="mt-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neon/20 text-neon">
              <CalendarDays className="size-4" aria-hidden />
            </span>
            <div>
              <dt className="sr-only">Fecha</dt>
              <dd className="text-sm font-bold capitalize text-white">
                {formatLongDate(eventDate)}
              </dd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-grape/25 text-lavender">
              <Clock className="size-4" aria-hidden />
            </span>
            <div>
              <dt className="sr-only">Hora</dt>
              <dd className="text-sm font-bold text-white">{formatTime(startTime)}</dd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mcd-yellow/20 text-mcd-yellow">
              <MapPin className="size-4" aria-hidden />
            </span>
            <div>
              <dt className="sr-only">Lugar</dt>
              <dd className="text-sm font-bold text-white">{venueName}</dd>
              <dd className="text-xs text-lavender">{venueAddress}</dd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white">
              <Users className="size-4" aria-hidden />
            </span>
            <div>
              <dt className="sr-only">Cupos autorizados</dt>
              <dd className="text-sm font-bold text-white">
                Válida para un máximo de {maxAttendees} {personas}
              </dd>
              <dd className="text-xs text-lavender">
                El total incluye a los niños invitados.
              </dd>
            </div>
          </div>
        </dl>
      </div>

      {/* Franja inferior */}
      <footer className="flex items-center justify-between border-t border-white/10 bg-black/25 px-5 py-3">
        <div aria-hidden className="kpop-decor flex items-center gap-2 opacity-70">
          <Microphone size={22} />
          <Sparkle size={12} color="#ffffff" />
          <Sparkle size={10} color="#ffc72c" />
        </div>
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-lavender/60">
          Familia {familyName}
        </p>
      </footer>
    </article>
  )
}
