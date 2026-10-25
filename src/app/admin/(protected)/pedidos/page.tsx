/**
 * Pedido para McDonald's.
 *
 * Todas las cantidades se derivan de las confirmaciones reales
 * guardadas en la base de datos.
 */
import {
  AlertTriangle,
  Baby,
  CheckCircle2,
  Download,
  FileText,
  UserRound,
  UtensilsCrossed,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { Button } from "@/components/ui/button"
import { formatLongDate, formatTime } from "@/lib/date"
import {
  getEventTotals,
  getMenuOrderSummary,
  listConfirmedAttendees,
  listFamilies,
  requireEvent,
} from "@/server/queries"

export const metadata: Metadata = { title: "Pedido McDonald's" }

export default async function OrdersPage() {
  const [event, totals, order, families, attendees] = await Promise.all([
    requireEvent(),
    getEventTotals(),
    getMenuOrderSummary(),
    listFamilies(),
    listConfirmedAttendees(),
  ])

  const adultMenus = order.filter((row) => row.audience === "adulto")
  const childMenus = order.filter((row) => row.audience === "nino")

  const adultTotal = adultMenus.reduce((sum, row) => sum + row.quantity, 0)
  const childTotal = childMenus.reduce((sum, row) => sum + row.quantity, 0)

  const incomplete = families.filter((family) => family.menu_incomplete)
  const needsReview = families.filter((family) => family.needs_review)
  const attendeesWithoutMenu = attendees.filter((attendee) => attendee.menu_item_id === null)

  const hasPrices = order.some((row) => row.price_cents !== null)
  const estimatedCents = order.reduce((sum, row) => sum + (row.subtotal_cents ?? 0), 0)

  const ready = totals.missing_menus === 0 && totals.confirmed_attendees > 0

  return (
    <>
      <PageHeader
        title="Pedido para McDonald's"
        description={`${event.venue_name} · ${formatLongDate(event.event_date)} a las ${formatTime(
          event.start_time,
        )}`}
      >
        <Button render={<a href="/api/admin/pedido/pdf" />} className="rounded-xl">
          <FileText className="mr-1.5 size-4" aria-hidden />
          Generar pedido final para McDonald&apos;s
        </Button>
        <Button
          render={<a href="/api/admin/exportar?tipo=pedido" />}
          variant="outline"
          className="rounded-xl"
        >
          <Download className="mr-1.5 size-4" aria-hidden />
          Excel
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Asistentes confirmados"
          value={totals.confirmed_attendees}
          icon={CheckCircle2}
          tone="neon"
        />
        <StatCard label="Menús de adultos" value={adultTotal} icon={UserRound} tone="grape" />
        <StatCard label="Cajitas Felices" value={childTotal} icon={Baby} tone="lavender" />
        <StatCard
          label="Total de menús"
          value={totals.total_menus_selected}
          icon={UtensilsCrossed}
          tone="yellow"
        />
        <StatCard
          label="Menús por elegir"
          value={totals.missing_menus}
          icon={AlertTriangle}
          tone={totals.missing_menus > 0 ? "red" : "green"}
        />
      </div>

      {/* Estado del pedido */}
      {ready ? (
        <div className="mb-6 flex items-start gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <p className="font-bold text-emerald-700">El pedido está completo</p>
            <p className="mt-1 text-sm text-emerald-900/80">
              Los {totals.total_menus_selected} menús coinciden con los{" "}
              {totals.confirmed_attendees} asistentes confirmados. Ya puedes generar el PDF para
              el restaurante.
            </p>
          </div>
        </div>
      ) : (
        totals.missing_menus > 0 && (
          <div className="mb-6 flex items-start gap-2 rounded-2xl border border-mcd-red/40 bg-mcd-red/10 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-mcd-red" aria-hidden />
            <div>
              <p className="font-bold text-mcd-red">
                Faltan {totals.missing_menus} menú(s) por elegir
              </p>
              <p className="mt-1 text-sm text-mcd-red/90">
                El número de menús debe igualar al de asistentes confirmados antes de cerrar el
                pedido.{" "}
                <Link
                  href="/admin/invitaciones?vista=recordatorios"
                  className="font-semibold underline"
                >
                  Enviar recordatorio a las familias
                </Link>
              </p>
            </div>
          </div>
        )
      )}

      {/* Detalle por menú */}
      <div className="grid gap-5 lg:grid-cols-2">
        <OrderTable
          title="Menús para adultos"
          icon="adulto"
          rows={adultMenus}
          total={adultTotal}
          hasPrices={hasPrices}
        />
        <OrderTable
          title="Cajita Feliz (niños)"
          icon="nino"
          rows={childMenus}
          total={childTotal}
          hasPrices={hasPrices}
        />
      </div>

      {/* Gran total */}
      <div className="mt-5 rounded-2xl bg-gradient-to-r from-neon to-grape p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
              Total de menús para el restaurante
            </p>
            <p className="font-heading text-4xl font-black tabular-nums">
              {totals.total_menus_selected}
            </p>
            <p className="mt-1 text-sm text-white/85">
              {adultTotal} menús de adulto + {childTotal} Cajitas Felices ·{" "}
              {totals.confirmed_attendees} asistentes confirmados
            </p>
          </div>

          {hasPrices && (
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-white/80">
                Costo estimado
              </p>
              <p className="font-heading text-3xl font-black tabular-nums">
                Q {(estimatedCents / 100).toFixed(2)}
              </p>
              <p className="text-xs text-white/75">Referencial: confirmar con el restaurante</p>
            </div>
          )}
        </div>
      </div>

      {/* Pendientes */}
      {(incomplete.length > 0 || needsReview.length > 0) && (
        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          {incomplete.length > 0 && (
            <div className="rounded-2xl border border-mcd-yellow/50 bg-card p-5">
              <h2 className="font-heading text-lg font-extrabold">
                Familias con menús incompletos ({incomplete.length})
              </h2>
              <ul className="mt-3 divide-y divide-border">
                {incomplete.map((family) => (
                  <li
                    key={family.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <Link
                      href={`/admin/familias/${family.id}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {family.name}
                    </Link>
                    <span className="text-xs font-semibold text-amber-700">
                      Faltan {family.confirmed_attendees - family.menu_selections} de{" "}
                      {family.confirmed_attendees}
                    </span>
                  </li>
                ))}
              </ul>
              <a
                href="/api/admin/exportar?tipo=incompletos"
                className="mt-3 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                Exportar a Excel
              </a>
            </div>
          )}

          {needsReview.length > 0 && (
            <div className="rounded-2xl border border-mcd-red/40 bg-card p-5">
              <h2 className="font-heading text-lg font-extrabold">
                Familias que requieren revisión ({needsReview.length})
              </h2>
              <ul className="mt-3 divide-y divide-border">
                {needsReview.map((family) => (
                  <li key={family.id} className="py-2.5 text-sm">
                    <Link
                      href={`/admin/familias/${family.id}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {family.name}
                    </Link>
                    <p className="text-xs text-mcd-red">
                      {family.review_reason ?? "Revisar con la familia."}
                    </p>
                  </li>
                ))}
              </ul>
              <a
                href="/api/admin/exportar?tipo=revision"
                className="mt-3 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                Exportar a Excel
              </a>
            </div>
          )}
        </section>
      )}

      {attendeesWithoutMenu.length > 0 && (
        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-extrabold">
            Asistentes sin menú ({attendeesWithoutMenu.length})
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {attendeesWithoutMenu.map((attendee) => (
              <li
                key={attendee.guest_id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">{attendee.guest_name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · familia {attendee.family_name}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {attendee.guest_type === "nino" ? "Cajita Feliz" : "Menú de adulto"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function OrderTable({
  title,
  icon,
  rows,
  total,
  hasPrices,
}: {
  title: string
  icon: "nino" | "adulto"
  rows: Awaited<ReturnType<typeof getMenuOrderSummary>>
  total: number
  hasPrices: boolean
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-heading text-lg font-extrabold">
        {icon === "nino" ? (
          <Baby className="size-5 text-primary" aria-hidden />
        ) : (
          <UserRound className="size-5 text-grape" aria-hidden />
        )}
        {title}
      </h2>

      <table className="mt-3 w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="pb-2 font-bold uppercase tracking-wide">
              Menú
            </th>
            <th scope="col" className="pb-2 text-right font-bold uppercase tracking-wide">
              Cantidad
            </th>
            {hasPrices && (
              <th scope="col" className="pb-2 text-right font-bold uppercase tracking-wide">
                Subtotal
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.menu_item_id}>
              <td className="py-2.5">
                {row.name}
                {!row.is_available && (
                  <span className="chip ml-2 bg-muted text-muted-foreground">No disponible</span>
                )}
              </td>
              <td className="py-2.5 text-right font-heading text-xl font-black tabular-nums">
                {row.quantity}
              </td>
              {hasPrices && (
                <td className="py-2.5 text-right tabular-nums">
                  {row.subtotal_cents === null
                    ? "—"
                    : `Q ${(row.subtotal_cents / 100).toFixed(2)}`}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border">
            <td className="pt-2.5 font-bold">Total</td>
            <td className="pt-2.5 text-right font-heading text-xl font-black tabular-nums">
              {total}
            </td>
            {hasPrices && (
              <td className="pt-2.5 text-right font-bold tabular-nums">
                Q{" "}
                {(
                  rows.reduce((sum, row) => sum + (row.subtotal_cents ?? 0), 0) / 100
                ).toFixed(2)}
              </td>
            )}
          </tr>
        </tfoot>
      </table>
    </section>
  )
}
