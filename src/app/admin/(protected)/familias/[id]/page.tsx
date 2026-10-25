/** Detalle de una familia: cupo, invitados, historial y envío. */
import {
  AlertTriangle,
  Baby,
  CalendarClock,
  Pencil,
  Phone,
  User,
  UtensilsCrossed,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { FamilyActions } from "@/components/admin/family-actions"
import { PageHeader } from "@/components/admin/page-header"
import {
  DeliveryChip,
  IncompleteMenuChip,
  ReviewChip,
  RsvpChip,
} from "@/components/admin/status-chips"
import {
  MessagePreview,
  WhatsAppSender,
  type WhatsAppMessage,
} from "@/components/admin/whatsapp-sender"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatLongDate } from "@/lib/date"
import { getSiteUrl } from "@/lib/env"
import { GUEST_TYPE_LABEL } from "@/lib/types"
import {
  buildInvitationUrl,
  buildWhatsAppInvitationLink,
  buildWhatsAppReminderLink,
} from "@/lib/whatsapp"
import { getFamilyDetail, requireEvent } from "@/server/queries"

export const metadata: Metadata = { title: "Detalle de familia" }

const DELIVERY_ACTION_LABEL: Record<string, string> = {
  preparada: "Invitación preparada",
  mensaje_copiado: "Mensaje copiado",
  enlace_copiado: "Enlace copiado",
  abierta_whatsapp: "Abierta en WhatsApp",
  marcada_enviada: "Marcada como enviada",
  omitida: "Omitida en la cola",
  token_regenerado: "Enlace regenerado",
  invitacion_deshabilitada: "Invitación desactivada",
  invitacion_habilitada: "Invitación activada",
}

export default async function FamilyDetailPage({
  params,
}: PageProps<"/admin/familias/[id]">) {
  const { id } = await params
  const [detail, event] = await Promise.all([getFamilyDetail(id), requireEvent()])

  if (!detail) notFound()

  const { family, guests, responses, deliveryLogs, selections } = detail

  const invitationUrl = buildInvitationUrl(getSiteUrl(), family.invitation_token)
  const familyForWhatsApp = {
    name: family.name,
    primary_contact_name: family.primary_contact_name,
    whatsapp_phone: family.whatsapp_phone,
    max_attendees: family.max_attendees,
    invited_children_names: family.invited_children_names ?? [],
  }

  const invitationLink = buildWhatsAppInvitationLink(familyForWhatsApp, event, invitationUrl)
  const reminderLink = buildWhatsAppReminderLink(familyForWhatsApp, event, invitationUrl)

  const toMessage = (
    link: typeof invitationLink,
  ): WhatsAppMessage => ({
    familyId: family.id,
    familyName: family.name,
    contactName: family.primary_contact_name,
    phoneDisplay: family.whatsapp_phone_display ?? family.whatsapp_phone,
    message: link.ok ? link.message : "",
    href: link.ok ? link.href : "",
    desktopHref: link.ok ? link.desktopHref : "",
    invitationUrl,
    error: link.ok ? undefined : link.error,
  })

  const invitedChildren = guests.filter((guest) => guest.is_invited_child)
  const companions = guests.filter((guest) => !guest.is_invited_child)
  const attending = guests.filter((guest) => guest.is_attending)

  return (
    <>
      <PageHeader
        title={`Familia ${family.name}`}
        description={`${family.primary_contact_name} · ${
          family.whatsapp_phone_display ?? family.whatsapp_phone
        }`}
        backHref="/admin/familias"
        backLabel="Familias"
      >
        <Button
          render={<Link href={`/admin/familias/${family.id}/editar`} />}
          className="rounded-xl"
        >
          <Pencil className="mr-1.5 size-4" aria-hidden />
          Editar
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        <RsvpChip status={family.rsvp_status} />
        <DeliveryChip status={family.delivery_status} />
        {family.needs_review && <ReviewChip reason={family.review_reason} />}
        {family.menu_incomplete && (
          <IncompleteMenuChip missing={family.confirmed_attendees - family.menu_selections} />
        )}
        {!family.invitation_enabled && (
          <span className="chip bg-muted text-muted-foreground">Invitación desactivada</span>
        )}
        {family.archived_at && (
          <span className="chip bg-muted text-muted-foreground">Archivada</span>
        )}
      </div>

      {family.needs_review && (
        <div className="mb-6 rounded-2xl border border-mcd-red/40 bg-mcd-red/10 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-mcd-red">
            <AlertTriangle className="size-4" aria-hidden />
            Esta familia requiere revisión
          </p>
          <p className="mt-1 text-sm text-mcd-red/90">
            {family.review_reason ?? "Revisa los datos con la familia."}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* Cupo */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-extrabold">Cupo autorizado</h2>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Cupo" value={family.max_attendees} />
              <Stat label="Confirmados" value={family.confirmed_attendees} />
              <Stat label="Disponibles" value={family.remaining_slots} />
              <Stat label="Menús" value={family.menu_selections} />
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="kpop-quota-fill h-full rounded-full transition-all"
                style={{
                  width: `${
                    family.max_attendees === 0
                      ? 0
                      : Math.min((family.confirmed_attendees / family.max_attendees) * 100, 100)
                  }%`,
                }}
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {family.confirmed_attendees} de {family.max_attendees}{" "}
              {family.max_attendees === 1 ? "cupo utilizado" : "cupos utilizados"} ·{" "}
              {family.confirmed_children} niño(s) y {family.confirmed_adults} adulto(s)
            </p>
          </section>

          {/* Invitados */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-extrabold">Invitados</h2>
            <p className="text-sm text-muted-foreground">
              Los niños invitados los defines tú; los acompañantes los agrega la familia al
              confirmar.
            </p>

            <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Niños invitados ({invitedChildren.length})
            </h3>
            {invitedChildren.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Sin niños precargados. Edita la familia para agregarlos.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {invitedChildren.map((guest) => (
                  <GuestRow
                    key={guest.id}
                    name={guest.name}
                    type={guest.guest_type}
                    attending={guest.is_attending}
                    menu={selections[guest.id]?.menu_name}
                    menuNeedsReview={selections[guest.id]?.needs_review}
                    invited
                  />
                ))}
              </ul>
            )}

            <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Acompañantes ({companions.length})
            </h3>
            {companions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                La familia todavía no agregó acompañantes.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {companions.map((guest) => (
                  <GuestRow
                    key={guest.id}
                    name={guest.name}
                    type={guest.guest_type}
                    attending={guest.is_attending}
                    menu={selections[guest.id]?.menu_name}
                    menuNeedsReview={selections[guest.id]?.needs_review}
                  />
                ))}
              </ul>
            )}

            {attending.length > 0 && (
              <p className="mt-4 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                <span className="font-bold">{attending.length}</span> persona(s) asistirán con{" "}
                <span className="font-bold">{family.menu_selections}</span> menú(s) elegido(s).
              </p>
            )}
          </section>

          {/* Historial de confirmaciones */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-extrabold">
              Historial de confirmaciones
            </h2>

            {responses.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Todavía no hay respuestas de esta familia.
              </p>
            ) : (
              <ol className="mt-3 space-y-3">
                {responses.map((response) => (
                  <li
                    key={response.id}
                    className={`rounded-xl border p-3 ${
                      response.is_current ? "border-primary/40 bg-accent/40" : "border-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <RsvpChip status={response.status} />
                        <span className="text-xs font-semibold text-muted-foreground">
                          Revisión {response.revision}
                          {response.is_current && " · vigente"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarClock className="size-3.5" aria-hidden />
                        {formatDateTime(response.submitted_at, event.timezone)}
                      </span>
                    </div>

                    <p className="mt-1.5 text-sm">
                      {response.attendee_count} persona(s) · {response.children_count} niño(s) ·{" "}
                      {response.adults_count} adulto(s)
                      {response.responder_name && ` · respondió ${response.responder_name}`}
                    </p>

                    {response.message && (
                      <p className="mt-1.5 rounded-lg bg-muted/60 px-3 py-2 text-sm italic">
                        “{response.message}”
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Envío por WhatsApp */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-extrabold">Enviar por WhatsApp</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se abre WhatsApp con el mensaje listo. Tú presionas Enviar y luego marcas la
              invitación como enviada.
            </p>

            <div className="mt-4">
              <WhatsAppSender
                data={toMessage(invitationLink)}
                kind="invitacion"
                alreadySent={family.delivery_status === "enviada"}
              />
            </div>

            {invitationLink.ok && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  Ver el mensaje de invitación
                </summary>
                <div className="mt-2">
                  <MessagePreview message={invitationLink.message} />
                </div>
              </details>
            )}

            <hr className="my-5 border-border" />

            <h3 className="font-heading text-base font-extrabold">Recordatorio</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {family.reminder_count > 0
                ? `Ya enviaste ${family.reminder_count} recordatorio(s). Último: ${formatDateTime(
                    family.last_reminder_at,
                    event.timezone,
                  )}`
                : "Útil si la familia aún no confirma o le faltan menús."}
            </p>

            <div className="mt-3">
              <WhatsAppSender
                data={toMessage(reminderLink)}
                kind="recordatorio"
                compact
              />
            </div>

            {reminderLink.ok && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  Ver el mensaje de recordatorio
                </summary>
                <div className="mt-2">
                  <MessagePreview message={reminderLink.message} />
                </div>
              </details>
            )}
          </section>

          {/* Enlace y acciones */}
          <FamilyActions
            familyId={family.id}
            invitationUrl={invitationUrl}
            invitationEnabled={family.invitation_enabled}
            archived={Boolean(family.archived_at)}
            needsReview={family.needs_review}
          />

          {/* Datos de contacto */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-extrabold">Contacto</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <dt className="text-xs text-muted-foreground">Responsable</dt>
                  <dd className="font-semibold">{family.primary_contact_name}</dd>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <dt className="text-xs text-muted-foreground">WhatsApp</dt>
                  <dd className="font-semibold">
                    {family.whatsapp_phone_display ?? family.whatsapp_phone}
                  </dd>
                </div>
              </div>

              {family.secondary_contact_name && (
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">Contacto secundario</dt>
                    <dd className="font-semibold">{family.secondary_contact_name}</dd>
                    {family.secondary_contact_phone && (
                      <dd className="text-muted-foreground">
                        {family.secondary_contact_phone}
                      </dd>
                    )}
                  </div>
                </div>
              )}
            </dl>

            {family.notes && (
              <div className="mt-4 rounded-xl bg-muted/60 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Notas internas
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{family.notes}</p>
              </div>
            )}

            <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>Creada</dt>
                <dd>{formatDateTime(family.created_at, event.timezone)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Invitación enviada</dt>
                <dd>{formatDateTime(family.invitation_sent_at, event.timezone)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Abierta por primera vez</dt>
                <dd>{formatDateTime(family.invitation_opened_at, event.timezone)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Confirmó</dt>
                <dd>{formatDateTime(family.rsvp_submitted_at, event.timezone)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Fecha límite</dt>
                <dd>{formatLongDate(event.rsvp_deadline)}</dd>
              </div>
            </dl>
          </section>

          {/* Bitácora de envíos */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-heading text-lg font-extrabold">Bitácora de envíos</h2>
            {deliveryLogs.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Sin actividad registrada todavía.
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {deliveryLogs.map((log) => (
                  <li key={log.id} className="flex items-start justify-between gap-3 text-sm">
                    <span>
                      <span className="font-semibold">
                        {DELIVERY_ACTION_LABEL[log.action] ?? log.action}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {log.kind === "recordatorio" ? "Recordatorio" : "Invitación"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(log.created_at, event.timezone)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3 text-center">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-2xl font-black tabular-nums">{value}</p>
    </div>
  )
}

function GuestRow({
  name,
  type,
  attending,
  menu,
  menuNeedsReview,
  invited,
}: {
  name: string
  type: "nino" | "adulto"
  attending: boolean | null
  menu?: string
  menuNeedsReview?: boolean
  invited?: boolean
}) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <span className="flex min-w-0 items-start gap-2">
        {type === "nino" ? (
          <Baby className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="block text-xs text-muted-foreground">
            {GUEST_TYPE_LABEL[type]}
            {invited && " · invitado especial"}
          </span>
          {menu && (
            <span
              className={`mt-0.5 flex items-center gap-1 text-xs ${
                menuNeedsReview ? "font-semibold text-mcd-red" : "text-muted-foreground"
              }`}
            >
              <UtensilsCrossed className="size-3" aria-hidden />
              {menu}
              {menuNeedsReview && " (revisar)"}
            </span>
          )}
        </span>
      </span>

      <span
        className={`chip shrink-0 ${
          attending === true
            ? "bg-emerald-500/15 text-emerald-700"
            : attending === false
              ? "bg-muted text-muted-foreground"
              : "bg-mcd-yellow/25 text-amber-700"
        }`}
      >
        {attending === true ? "Asiste" : attending === false ? "No asiste" : "Sin respuesta"}
      </span>
    </li>
  )
}
