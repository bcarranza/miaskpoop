/** Confirmaciones recibidas, con el detalle de cada asistente y su menú. */
import { Baby, Download, UserRound, UtensilsCrossed } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/admin/page-header"
import { IncompleteMenuChip, ReviewChip, RsvpChip } from "@/components/admin/status-chips"
import { StatCard } from "@/components/admin/stat-card"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/date"
import {
  getEventTotals,
  listConfirmedAttendees,
  listFamilies,
  requireEvent,
} from "@/server/queries"

export const metadata: Metadata = { title: "Confirmaciones" }

export default async function ConfirmationsPage() {
  const [event, families, attendees, totals] = await Promise.all([
    requireEvent(),
    listFamilies(),
    listConfirmedAttendees(),
    getEventTotals(),
  ])

  const answered = families
    .filter((family) => family.rsvp_status !== "pendiente")
    .sort((a, b) => (b.rsvp_submitted_at ?? "").localeCompare(a.rsvp_submitted_at ?? ""))

  const pending = families.filter((family) => family.rsvp_status === "pendiente")

  const attendeesByFamily = new Map<string, typeof attendees>()
  for (const attendee of attendees) {
    const list = attendeesByFamily.get(attendee.family_id) ?? []
    list.push(attendee)
    attendeesByFamily.set(attendee.family_id, list)
  }

  return (
    <>
      <PageHeader
        title="Confirmaciones"
        description="Respuestas recibidas de las familias, con el menú elegido por cada asistente."
      >
        <Button
          render={<a href="/api/admin/exportar?tipo=asistentes" />}
          variant="outline"
          className="rounded-xl"
        >
          <Download className="mr-1.5 size-4" aria-hidden />
          Exportar asistentes
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Familias confirmadas" value={totals.confirmed_families} tone="green" />
        <StatCard label="Pendientes" value={totals.pending_families} tone="yellow" />
        <StatCard label="No asistirán" value={totals.declined_families} tone="neutral" />
        <StatCard
          label="Asistentes confirmados"
          value={totals.confirmed_attendees}
          total={totals.total_capacity}
          tone="neon"
        />
      </div>

      {answered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-semibold">Todavía no hay confirmaciones.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            En cuanto una familia responda, aparecerá aquí con el detalle de su menú.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {answered.map((family) => {
            const familyAttendees = attendeesByFamily.get(family.id) ?? []
            return (
              <li key={family.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/familias/${family.id}`}
                      className="font-heading text-lg font-extrabold underline-offset-2 hover:underline"
                    >
                      Familia {family.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {family.primary_contact_name} ·{" "}
                      {family.whatsapp_phone_display ?? family.whatsapp_phone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Respondió {formatDateTime(family.rsvp_submitted_at, event.timezone)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <RsvpChip status={family.rsvp_status} />
                    {family.needs_review && <ReviewChip reason={family.review_reason} />}
                    {family.menu_incomplete && (
                      <IncompleteMenuChip
                        missing={family.confirmed_attendees - family.menu_selections}
                      />
                    )}
                  </div>
                </div>

                {family.rsvp_status === "confirmado" && (
                  <>
                    <p className="mt-3 text-sm">
                      <span className="font-bold">{family.confirmed_attendees}</span> de{" "}
                      {family.max_attendees} cupos ·{" "}
                      <span className="font-bold">{family.confirmed_children}</span> niño(s) y{" "}
                      <span className="font-bold">{family.confirmed_adults}</span> adulto(s) ·{" "}
                      <span className="font-bold">{family.menu_selections}</span> menú(s)
                    </p>

                    {familyAttendees.length > 0 && (
                      <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                        {familyAttendees.map((attendee) => (
                          <li
                            key={attendee.guest_id}
                            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                          >
                            <span className="flex items-center gap-2">
                              {attendee.guest_type === "nino" ? (
                                <Baby
                                  className="size-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                              ) : (
                                <UserRound
                                  className="size-4 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                              )}
                              <span className="font-semibold">{attendee.guest_name}</span>
                              {attendee.is_invited_child && (
                                <span className="chip bg-lavender/25 text-grape">Invitado</span>
                              )}
                            </span>

                            <span
                              className={`flex items-center gap-1.5 text-sm ${
                                attendee.menu_name
                                  ? attendee.selection_needs_review
                                    ? "font-semibold text-mcd-red"
                                    : "text-muted-foreground"
                                  : "font-semibold text-mcd-red"
                              }`}
                            >
                              <UtensilsCrossed className="size-3.5" aria-hidden />
                              {attendee.menu_name ?? "SIN MENÚ"}
                              {attendee.selection_needs_review && " (revisar)"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {family.rsvp_status === "rechazado" && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Esta familia no asistirá. Sus cupos quedan libres y no suman a los totales.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {pending.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-heading text-lg font-extrabold">
            Familias pendientes ({pending.length})
          </h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {pending.map((family) => (
              <li
                key={family.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <Link
                  href={`/admin/familias/${family.id}`}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  {family.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  Cupo {family.max_attendees} ·{" "}
                  {family.delivery_status === "enviada"
                    ? `Invitación enviada ${formatDateTime(
                        family.invitation_sent_at,
                        event.timezone,
                      )}`
                    : "Invitación sin marcar como enviada"}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/invitaciones?vista=recordatorios"
            className="mt-3 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Enviar recordatorios por WhatsApp
          </Link>
        </section>
      )}
    </>
  )
}
