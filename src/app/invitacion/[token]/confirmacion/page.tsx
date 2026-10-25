/** Confirmación de asistencia y selección de menús. */
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AuroraBlobs, StarField } from "@/components/kpop/decor"
import { RsvpWizard } from "@/components/rsvp/rsvp-wizard"
import { formatLongDate } from "@/lib/date"
import { isDeadlinePassed } from "@/lib/date"
import { getInvitationByToken } from "@/server/queries"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Confirmar asistencia",
}

export default async function ConfirmationPage({
  params,
}: PageProps<"/invitacion/[token]/confirmacion">) {
  const { token } = await params
  const data = await getInvitationByToken(token)

  if (!data) notFound()

  const { event, family, invitedChildren, companions, menus, currentResponse } = data

  // Invitación desactivada o plazo vencido: no se muestra el formulario.
  if (!family.invitation_enabled || isDeadlinePassed(event)) {
    redirect(`/invitacion/${token}`)
  }

  // Ya respondió y el evento no admite modificaciones.
  if (family.rsvp_status !== "pendiente" && !event.allow_rsvp_edits) {
    redirect(`/invitacion/${token}`)
  }

  return (
    <main className="kpop-stage relative flex min-h-dvh flex-col overflow-hidden">
      <AuroraBlobs />
      <StarField />

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href={`/invitacion/${token}`}
          className="mb-5 inline-flex w-fit items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-lavender transition hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la invitación
        </Link>

        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-lavender/80">
            Familia {family.name}
          </p>
          <h1 className="kpop-gradient-text font-heading text-3xl font-black leading-tight">
            Confirmar asistencia
          </h1>
          <p className="mt-2 text-sm text-lavender">
            Fiesta de {event.celebrant_name} ·{" "}
            <span className="capitalize">{formatLongDate(event.event_date)}</span>
          </p>
        </header>

        <div className="kpop-glass rounded-3xl p-5 sm:p-6">
          <RsvpWizard
            token={token}
            familyName={family.name}
            maxAttendees={family.max_attendees}
            celebrantName={event.celebrant_name}
            rsvpDeadline={event.rsvp_deadline}
            allowEdits={event.allow_rsvp_edits}
            invitedChildren={invitedChildren}
            companions={companions}
            menus={menus}
            selections={data.selections}
            hasPreviousResponse={family.rsvp_status !== "pendiente"}
            previousAttending={family.rsvp_status === "confirmado"}
            previousResponderName={currentResponse?.responder_name ?? null}
            previousMessage={currentResponse?.message ?? null}
          />
        </div>

        <p className="mt-6 text-center text-xs text-lavender/60">
          No necesitas crear ninguna cuenta. Este enlace es personal de tu familia.
        </p>
      </div>
    </main>
  )
}
