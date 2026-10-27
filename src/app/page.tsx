/**
 * Página pública de bienvenida.
 *
 * No muestra ninguna lista de familias, teléfonos ni datos de otras
 * personas: sólo la información general de la fiesta. Para confirmar
 * asistencia hace falta el enlace personalizado de cada familia.
 */
import { CalendarDays, Clock, Lock, MapPin, Music } from "lucide-react"
import type { Metadata } from "next"
import { CountdownTimer } from "@/components/kpop/countdown"
import {
  AuroraBlobs,
  ConfettiRain,
  DecorStrip,
  DiscoBall,
  Microphone,
  Sparkle,
  StageLights,
  StarField,
} from "@/components/kpop/decor"
import { VideoEmbed } from "@/components/kpop/video-embed"
import { SetupNotice } from "@/components/setup-notice"
import { formatLongDate, formatTime, getCountdown, getEventStart } from "@/lib/date"
import { getPublicEnvStatus } from "@/lib/env"
import { getEvent } from "@/server/queries"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Mía's K-pop Party",
}

export default async function LandingPage() {
  const event = await getEvent()

  if (!event) {
    const status = getPublicEnvStatus()
    return (
      <SetupNotice
        missing={
          status.missing.length > 0
            ? status.missing
            : ["Aplica las migraciones de supabase/migrations"]
        }
      />
    )
  }

  const start = getEventStart(event)
  const countdown = getCountdown(start)

  return (
    <main className="kpop-stage relative flex min-h-dvh flex-col overflow-hidden">
      <StageLights />
      <AuroraBlobs />
      <StarField />
      <ConfettiRain />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-5 py-10 sm:py-16">
        {/* Bola de disco */}
        <div className="animate-float-slow mb-2">
          <DiscoBall size={84} />
        </div>

        {/* Encabezado */}
        <p className="mb-3 flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.25em] text-lavender">
          <Music className="size-3.5" aria-hidden />
          K-pop Party
        </p>

        <h1 className="kpop-gradient-text text-center font-heading text-4xl font-black leading-[1.05] sm:text-6xl">
          {event.invitation_headline}
        </h1>

        <p className="kpop-text-glow mt-3 text-center font-heading text-xl font-extrabold uppercase tracking-[0.2em] text-white sm:text-2xl">
          {event.invitation_subheadline}
        </p>

        <DecorStrip className="mt-5" />

        <p className="mt-5 max-w-xl text-center text-base leading-relaxed text-lavender sm:text-lg">
          {event.invitation_message}
        </p>

        {/* Datos de la fiesta */}
        <section
          aria-label="Detalles de la fiesta"
          className="kpop-glass mt-8 w-full rounded-3xl p-5 sm:p-7"
        >
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neon/20 text-neon">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <div>
                <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-lavender/70">
                  Fecha
                </dt>
                <dd className="text-sm font-bold capitalize text-white">
                  {formatLongDate(event.event_date)}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-grape/25 text-lavender">
                <Clock className="size-5" aria-hidden />
              </span>
              <div>
                <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-lavender/70">
                  Hora
                </dt>
                <dd className="text-sm font-bold text-white">{formatTime(event.start_time)}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mcd-yellow/20 text-mcd-yellow">
                <MapPin className="size-5" aria-hidden />
              </span>
              <div>
                <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-lavender/70">
                  Lugar
                </dt>
                <dd className="text-sm font-bold text-white">{event.venue_name}</dd>
                <dd className="text-xs text-lavender">{event.venue_address}</dd>
              </div>
            </div>
          </dl>
        </section>

        {/* Cuenta regresiva */}
        <CountdownTimer
          targetIso={start.toISOString()}
          initial={countdown}
          className="mt-8 w-full max-w-lg"
        />

        {/* Aviso: la confirmación es por enlace personalizado */}
        <section className="kpop-glass mt-10 w-full rounded-3xl p-5 text-center sm:p-6">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-white/10 text-lavender">
            <Lock className="size-5" aria-hidden />
          </span>
          <h2 className="font-heading text-lg font-extrabold text-white">
            ¿Vienes a confirmar asistencia?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-lavender">
            Cada familia recibe por WhatsApp su propio enlace personalizado. Abre el enlace que te
            enviamos para confirmar y elegir los menús.
          </p>
          <p className="mt-3 text-xs text-lavender/70">
            Si no lo encuentras, escríbenos por WhatsApp y te lo reenviamos.
          </p>
        </section>

        {event.music_enabled && event.music_url && (
          <VideoEmbed url={event.music_url} className="mt-10" />
        )}

        {/* Pie decorativo */}
        <div
          aria-hidden
          className="kpop-decor mt-10 flex items-center justify-center gap-6 opacity-70"
        >
          <Microphone size={36} className="animate-float" />
          <Sparkle size={18} color="#ffffff" />
          <DiscoBall size={44} />
          <Sparkle size={18} color="#ffc72c" />
          <Microphone size={36} className="animate-float" />
        </div>

        <footer className="mt-8 text-center text-xs text-lavender/60">
          <p>
            {event.celebrant_name} cumple {event.celebrant_age} años ·{" "}
            {formatLongDate(event.event_date)}
          </p>
          <p className="mt-1">
            Fiesta temática de K-pop. Sin relación con ningún grupo, artista ni sello musical.
          </p>
        </footer>
      </div>
    </main>
  )
}
