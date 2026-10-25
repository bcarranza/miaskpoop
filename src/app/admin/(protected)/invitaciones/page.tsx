/**
 * Envío de invitaciones y recordatorios por WhatsApp.
 *
 * Los enlaces se arman en el servidor con la plantilla del evento y el
 * token único de cada familia. El envío siempre es manual.
 */
import { Info, MessageCircle, Send, Settings2 } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/admin/page-header"
import { SendingQueue, type QueueItem } from "@/components/admin/sending-queue"
import { StatCard } from "@/components/admin/stat-card"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/date"
import { getSiteUrl } from "@/lib/env"
import type { EventRecord, FamilySummary } from "@/lib/types"
import {
  buildInvitationUrl,
  buildWhatsAppInvitationLink,
  buildWhatsAppReminderLink,
} from "@/lib/whatsapp"
import { getEventTotals, listDeliveryLogs, listFamilies, requireEvent } from "@/server/queries"

export const metadata: Metadata = { title: "Invitaciones" }

const DELIVERY_ACTION_LABEL: Record<string, string> = {
  preparada: "preparó la invitación",
  mensaje_copiado: "copió el mensaje",
  enlace_copiado: "copió el enlace",
  abierta_whatsapp: "abrió WhatsApp",
  marcada_enviada: "marcó como enviada",
  omitida: "omitió en la cola",
  token_regenerado: "regeneró el enlace",
  invitacion_deshabilitada: "desactivó la invitación",
  invitacion_habilitada: "activó la invitación",
}

function toQueueItem(
  family: FamilySummary,
  event: EventRecord,
  kind: "invitacion" | "recordatorio",
): QueueItem {
  const invitationUrl = buildInvitationUrl(getSiteUrl(), family.invitation_token)
  const input = {
    name: family.name,
    primary_contact_name: family.primary_contact_name,
    whatsapp_phone: family.whatsapp_phone,
    max_attendees: family.max_attendees,
    invited_children_names: family.invited_children_names ?? [],
  }

  const link =
    kind === "invitacion"
      ? buildWhatsAppInvitationLink(input, event, invitationUrl)
      : buildWhatsAppReminderLink(input, event, invitationUrl)

  return {
    message: {
      familyId: family.id,
      familyName: family.name,
      contactName: family.primary_contact_name,
      phoneDisplay: family.whatsapp_phone_display ?? family.whatsapp_phone,
      message: link.ok ? link.message : "",
      href: link.ok ? link.href : "",
      desktopHref: link.ok ? link.desktopHref : "",
      invitationUrl,
      error: link.ok ? undefined : link.error,
    },
    maxAttendees: family.max_attendees,
    invitedChildren: family.invited_children_names ?? [],
    rsvpStatus: family.rsvp_status,
    deliveryStatus: family.delivery_status,
    reminderCount: family.reminder_count,
  }
}

export default async function InvitationsPage({
  searchParams,
}: PageProps<"/admin/invitaciones">) {
  const query = await searchParams
  const tab = (Array.isArray(query.vista) ? query.vista[0] : query.vista) ?? "invitaciones"

  const [event, families, totals, logs] = await Promise.all([
    requireEvent(),
    listFamilies(),
    getEventTotals(),
    listDeliveryLogs(25),
  ])

  const active = families.filter((family) => family.invitation_enabled)

  const pendingInvitations = active.filter(
    (family) => family.delivery_status !== "enviada",
  )

  // Recordatorios: sin confirmar, con menús incompletos o marcadas para revisión.
  const reminderTargets = active.filter(
    (family) =>
      family.delivery_status === "enviada" &&
      (family.rsvp_status === "pendiente" || family.menu_incomplete || family.needs_review),
  )

  const items =
    tab === "recordatorios"
      ? reminderTargets.map((family) => toQueueItem(family, event, "recordatorio"))
      : pendingInvitations.map((family) => toQueueItem(family, event, "invitacion"))

  return (
    <>
      <PageHeader
        title="Invitaciones por WhatsApp"
        description="Se abre WhatsApp con el mensaje personalizado ya escrito. Tú presionas Enviar y después marcas la invitación como enviada."
      >
        <Button
          render={<Link href="/admin/configuracion/whatsapp" />}
          variant="outline"
          className="rounded-xl"
        >
          <Settings2 className="mr-1.5 size-4" aria-hidden />
          Plantillas
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Familias con invitación activa"
          value={active.length}
          icon={MessageCircle}
          tone="grape"
        />
        <StatCard
          label="Marcadas como enviadas"
          value={totals.invitations_sent}
          total={families.length}
          icon={Send}
          tone="green"
        />
        <StatCard
          label="Pendientes de enviar"
          value={pendingInvitations.length}
          tone={pendingInvitations.length > 0 ? "yellow" : "green"}
        />
        <StatCard
          label="Necesitan recordatorio"
          value={reminderTargets.length}
          tone={reminderTargets.length > 0 ? "neon" : "neutral"}
        />
      </div>

      {/* Pestañas */}
      <div
        role="tablist"
        aria-label="Tipo de mensaje"
        className="mb-5 inline-flex rounded-xl border border-border bg-card p-1"
      >
        <Link
          href="/admin/invitaciones"
          role="tab"
          aria-selected={tab !== "recordatorios"}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
            tab !== "recordatorios"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Invitaciones ({pendingInvitations.length})
        </Link>
        <Link
          href="/admin/invitaciones?vista=recordatorios"
          role="tab"
          aria-selected={tab === "recordatorios"}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
            tab === "recordatorios"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Recordatorios ({reminderTargets.length})
        </Link>
      </div>

      <div className="mb-5 flex items-start gap-2 rounded-2xl border border-grape/25 bg-accent/60 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-grape" aria-hidden />
        <div>
          <p className="font-semibold text-accent-foreground">
            El envío es manual, de una familia a la vez.
          </p>
          <p className="mt-1 text-muted-foreground">
            No se usa la API de WhatsApp Business ni ningún servicio de mensajería masiva. El
            botón intenta abrir WhatsApp Desktop en tu Mac; si tu navegador no lo permite, se
            abrirá WhatsApp Web. Abrir WhatsApp no marca el mensaje como enviado.
          </p>
        </div>
      </div>

      <SendingQueue
        items={items}
        kind={tab === "recordatorios" ? "recordatorio" : "invitacion"}
        preferDesktop
        emptyMessage={
          tab === "recordatorios"
            ? "Ninguna familia necesita recordatorio por ahora."
            : "Todas las invitaciones activas están marcadas como enviadas."
        }
      />

      {/* Bitácora */}
      {logs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-heading text-lg font-extrabold">Actividad reciente</h2>
          <ol className="divide-y divide-border rounded-2xl border border-border bg-card">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <span>
                  <span className="font-bold">{log.family_name}</span>:{" "}
                  {DELIVERY_ACTION_LABEL[log.action] ?? log.action}
                  <span className="text-muted-foreground">
                    {" "}
                    ({log.kind === "recordatorio" ? "recordatorio" : "invitación"})
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(log.created_at, event.timezone)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}
