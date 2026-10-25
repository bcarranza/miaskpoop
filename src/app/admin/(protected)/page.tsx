/**
 * Panel principal.
 *
 * Todas las cifras se calculan en PostgreSQL a partir de los registros
 * reales de familias, invitados confirmados y menús elegidos.
 */
import {
  AlertTriangle,
  Baby,
  CheckCircle2,
  Clock,
  MessageCircle,
  Send,
  UsersRound,
  UtensilsCrossed,
  XCircle,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { DashboardCharts } from "@/components/admin/dashboard-charts"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { Button } from "@/components/ui/button"
import { formatLongDate, formatTime, getCountdown, getEventStart, isDeadlinePassed } from "@/lib/date"
import {
  getConfirmationsOverTime,
  getEventTotals,
  getMenuOrderSummary,
  listFamilies,
  requireEvent,
} from "@/server/queries"

export const metadata: Metadata = { title: "Panel" }

export default async function AdminDashboardPage() {
  const [event, totals, families, order, timeline] = await Promise.all([
    requireEvent(),
    getEventTotals(),
    listFamilies(),
    getMenuOrderSummary(),
    getConfirmationsOverTime(),
  ])

  const countdown = getCountdown(getEventStart(event))
  const deadlinePassed = isDeadlinePassed(event)

  const needsAttention = families.filter(
    (family) => family.needs_review || family.menu_incomplete,
  )
  const notSent = families.filter((family) => family.delivery_status !== "enviada")
  const capacityUse =
    totals.total_capacity > 0
      ? Math.round((totals.confirmed_attendees / totals.total_capacity) * 100)
      : 0

  return (
    <>
      <PageHeader
        title="Panel"
        description={`${event.celebrant_name} cumple ${event.celebrant_age} años · ${formatLongDate(
          event.event_date,
        )} a las ${formatTime(event.start_time)} · ${event.venue_name}`}
      >
        <Button render={<Link href="/admin/familias/nueva" />} className="rounded-xl">
          Nueva familia
        </Button>
        <Button
          render={<Link href="/admin/invitaciones" />}
          variant="outline"
          className="rounded-xl"
        >
          <MessageCircle className="mr-1.5 size-4" aria-hidden />
          Enviar invitaciones
        </Button>
      </PageHeader>

      {/* Avisos */}
      <div className="mb-6 space-y-3">
        {totals.total_families === 0 && (
          <div className="rounded-2xl border border-grape/30 bg-accent p-4">
            <p className="text-sm font-semibold text-accent-foreground">
              Todavía no hay familias registradas.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea la primera familia o importa tu lista desde Excel para empezar.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                render={<Link href="/admin/familias/nueva" />}
                size="sm"
                className="rounded-lg"
              >
                Crear familia
              </Button>
              <Button
                render={<Link href="/admin/familias/importar" />}
                size="sm"
                variant="outline"
                className="rounded-lg"
              >
                Importar desde Excel
              </Button>
            </div>
          </div>
        )}

        {needsAttention.length > 0 && (
          <div className="rounded-2xl border border-mcd-yellow/50 bg-mcd-yellow/10 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-700">
              <AlertTriangle className="size-4" aria-hidden />
              {needsAttention.length}{" "}
              {needsAttention.length === 1 ? "familia necesita" : "familias necesitan"} atención
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {needsAttention.slice(0, 4).map((family) => (
                <li key={family.id}>
                  <Link
                    href={`/admin/familias/${family.id}`}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {family.name}
                  </Link>
                  {": "}
                  {family.review_reason ??
                    `faltan ${family.confirmed_attendees - family.menu_selections} menú(s) por elegir.`}
                </li>
              ))}
            </ul>
            {needsAttention.length > 4 && (
              <Link
                href="/admin/familias?revision=1"
                className="mt-2 inline-block text-sm font-semibold text-amber-800 underline"
              >
                Ver todas
              </Link>
            )}
          </div>
        )}

        {deadlinePassed ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">
              El plazo para confirmar terminó el {formatLongDate(event.rsvp_deadline)}.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Puedes ampliarlo desde Configuración si aún faltan familias por responder.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm">
              <span className="font-bold">
                {countdown.isPast ? "La fiesta ya empezó" : `Faltan ${countdown.days} días`}
              </span>{" "}
              para la fiesta. Las familias pueden confirmar hasta el{" "}
              <span className="font-semibold">{formatLongDate(event.rsvp_deadline)}</span>.
            </p>
          </div>
        )}
      </div>

      {/* Familias e invitaciones */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Familias e invitaciones
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Familias invitadas"
            value={totals.total_families}
            icon={UsersRound}
            tone="grape"
          />
          <StatCard
            label="Invitaciones generadas"
            value={totals.invitations_generated}
            icon={MessageCircle}
            tone="lavender"
            hint="Con invitación activa"
          />
          <StatCard
            label="Marcadas como enviadas"
            value={totals.invitations_sent}
            total={totals.total_families}
            icon={Send}
            tone="neon"
          />
          <StatCard
            label="Confirmadas"
            value={totals.confirmed_families}
            icon={CheckCircle2}
            tone="green"
          />
          <StatCard
            label="Pendientes"
            value={totals.pending_families}
            icon={Clock}
            tone="yellow"
          />
          <StatCard
            label="No asistirán"
            value={totals.declined_families}
            icon={XCircle}
            tone="neutral"
          />
        </div>
      </section>

      {/* Asistencia y menús */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Asistencia y menús
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Capacidad autorizada"
            value={totals.total_capacity}
            icon={UsersRound}
            tone="neutral"
            hint="Suma de los cupos de cada familia"
          />
          <StatCard
            label="Asistentes confirmados"
            value={totals.confirmed_attendees}
            total={totals.total_capacity}
            icon={CheckCircle2}
            tone="neon"
            hint={`${capacityUse}% de la capacidad`}
          />
          <StatCard
            label="Niños confirmados"
            value={totals.confirmed_children}
            icon={Baby}
            tone="grape"
          />
          <StatCard
            label="Adultos confirmados"
            value={totals.confirmed_adults}
            icon={UsersRound}
            tone="lavender"
          />
          <StatCard
            label="Menús elegidos"
            value={totals.total_menus_selected}
            total={totals.confirmed_attendees}
            icon={UtensilsCrossed}
            tone="yellow"
          />
          <StatCard
            label="Menús por elegir"
            value={totals.missing_menus}
            icon={AlertTriangle}
            tone={totals.missing_menus > 0 ? "red" : "green"}
            hint={`${totals.families_with_incomplete_menus} familia(s) incompleta(s)`}
          />
        </div>
      </section>

      {/* Gráficas */}
      <DashboardCharts
        totals={totals}
        order={order}
        timeline={timeline}
        families={families.map((family) => ({
          name: family.name,
          cupo: family.max_attendees,
          confirmados: family.confirmed_attendees,
        }))}
      />

      {/* Accesos rápidos */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink
          href="/admin/invitaciones"
          title="Cola de envío por WhatsApp"
          description={`${notSent.length} familia(s) sin marcar como enviada.`}
        />
        <QuickLink
          href="/admin/pedidos"
          title="Pedido para McDonald's"
          description={`${totals.total_menus_selected} menús listos para el restaurante.`}
        />
        <QuickLink
          href="/admin/reportes"
          title="Reportes y exportaciones"
          description="Descarga Excel con familias, asistentes y menús."
        />
      </section>
    </>
  )
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-md"
    >
      <p className="font-heading text-base font-extrabold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  )
}
