/** Reportes y exportaciones. */
import { Download, FileSpreadsheet, FileText } from "lucide-react"
import type { Metadata } from "next"
import { DashboardCharts } from "@/components/admin/dashboard-charts"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { EXPORT_LABELS, type ExportKind } from "@/lib/excel/export"
import {
  getConfirmationsOverTime,
  getEventTotals,
  getMenuOrderSummary,
  listFamilies,
  requireEvent,
} from "@/server/queries"

export const metadata: Metadata = { title: "Reportes" }

const EXPORT_GROUPS: { title: string; items: ExportKind[] }[] = [
  {
    title: "Familias",
    items: ["familias", "confirmadas", "pendientes", "rechazadas"],
  },
  {
    title: "Asistentes y menús",
    items: ["asistentes", "menus", "pedido"],
  },
  {
    title: "Pendientes",
    items: ["incompletos", "revision"],
  },
]

const EXPORT_DESCRIPTIONS: Record<ExportKind, string> = {
  familias: "Resumen del evento más la hoja completa de familias con cupos y estados.",
  confirmadas: "Sólo las familias que confirmaron asistencia.",
  pendientes: "Familias que todavía no han respondido.",
  rechazadas: "Familias que avisaron que no podrán asistir.",
  asistentes: "Una fila por persona confirmada, con su tipo y su menú.",
  menus: "Asistentes con su menú, más el resumen por menú.",
  pedido: "Cantidades por menú, listas para el restaurante.",
  incompletos: "Familias confirmadas a las que les falta elegir algún menú.",
  revision: "Familias marcadas para revisión, con el motivo.",
  completo: "Todas las hojas anteriores en un solo archivo.",
}

export default async function ReportsPage() {
  const [event, totals, families, order, timeline] = await Promise.all([
    requireEvent(),
    getEventTotals(),
    listFamilies(),
    getMenuOrderSummary(),
    getConfirmationsOverTime(),
  ])

  return (
    <>
      <PageHeader
        title="Reportes"
        description={`Datos reales de ${event.name}. Las descargas se generan en el momento desde la base de datos.`}
      >
        <a
          href="/api/admin/exportar?tipo=completo"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
        >
          <FileSpreadsheet className="size-4" aria-hidden />
          Reporte completo (Excel)
        </a>
        <a
          href="/api/admin/pedido/pdf"
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
        >
          <FileText className="size-4" aria-hidden />
          Pedido en PDF
        </a>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Familias" value={totals.total_families} tone="grape" />
        <StatCard label="Confirmadas" value={totals.confirmed_families} tone="green" />
        <StatCard label="Capacidad" value={totals.total_capacity} tone="neutral" />
        <StatCard
          label="Asistentes"
          value={totals.confirmed_attendees}
          total={totals.total_capacity}
          tone="neon"
        />
        <StatCard label="Menús" value={totals.total_menus_selected} tone="yellow" />
        <StatCard
          label="Por elegir"
          value={totals.missing_menus}
          tone={totals.missing_menus > 0 ? "red" : "green"}
        />
      </div>

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

      <section className="mt-8">
        <h2 className="mb-4 font-heading text-xl font-black">Exportar a Excel</h2>

        <div className="space-y-6">
          {EXPORT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((kind) => (
                  <li key={kind}>
                    <a
                      href={`/api/admin/exportar?tipo=${kind}`}
                      className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-md"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                        <Download className="size-4" aria-hidden />
                      </span>
                      <span>
                        <span className="block font-bold">{EXPORT_LABELS[kind]}</span>
                        <span className="block text-xs text-muted-foreground">
                          {EXPORT_DESCRIPTIONS[kind]}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
