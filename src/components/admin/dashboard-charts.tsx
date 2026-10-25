"use client"

/** Gráficas del panel. Todos los datos vienen de la base de datos. */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatShortDate } from "@/lib/date"
import type { EventTotals, MenuOrderRow } from "@/lib/types"

const PINK = "#ff2e9a"
const PURPLE = "#a855f7"
const LAVENDER = "#c7a4ff"
const YELLOW = "#ffc72c"
const RED = "#da291c"
const GREEN = "#10b981"

type Props = {
  totals: EventTotals
  order: MenuOrderRow[]
  timeline: { date: string; confirmadas: number; rechazadas: number; acumulado: number }[]
  families: { name: string; cupo: number; confirmados: number }[]
}

function ChartCard({
  title,
  description,
  children,
  empty,
}: {
  title: string
  description?: string
  children: React.ReactNode
  empty?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="font-heading text-base font-extrabold">{title}</h3>
      {description && <p className="mb-2 text-xs text-muted-foreground">{description}</p>}
      {empty ? (
        <p className="grid h-56 place-items-center text-sm text-muted-foreground">
          Todavía no hay datos suficientes.
        </p>
      ) : (
        <div className="h-56 w-full">{children}</div>
      )}
    </div>
  )
}

export function DashboardCharts({ totals, order, timeline, families }: Props) {
  const rsvpData = [
    { name: "Confirmadas", value: totals.confirmed_families, color: GREEN },
    { name: "Pendientes", value: totals.pending_families, color: YELLOW },
    { name: "No asistirán", value: totals.declined_families, color: RED },
  ].filter((item) => item.value > 0)

  const peopleData = [
    { name: "Niños", value: totals.confirmed_children, color: PINK },
    { name: "Adultos", value: totals.confirmed_adults, color: PURPLE },
  ].filter((item) => item.value > 0)

  const menuData = order
    .map((row) => ({
      name: row.name,
      cantidad: row.quantity,
      color: row.audience === "nino" ? PINK : PURPLE,
    }))
    .filter((row) => row.cantidad > 0)

  const quotaData = [...families]
    .filter((family) => family.cupo > 0)
    .sort((a, b) => b.confirmados / b.cupo - a.confirmados / a.cupo)
    .slice(0, 10)

  const timelineData = timeline.map((point) => ({
    ...point,
    etiqueta: formatShortDate(point.date),
  }))

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Estado de las confirmaciones"
        description="Distribución de respuestas por familia."
        empty={rsvpData.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rsvpData}
              dataKey="value"
              nameKey="name"
              innerRadius="45%"
              outerRadius="78%"
              paddingAngle={2}
            >
              {rsvpData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${Number(value ?? 0)} familia(s)`, ""]} />
            <Legend verticalAlign="bottom" height={28} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Niños y adultos"
        description="Asistentes confirmados por tipo."
        empty={peopleData.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={peopleData}
              dataKey="value"
              nameKey="name"
              outerRadius="78%"
              paddingAngle={2}
            >
              {peopleData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${Number(value ?? 0)} persona(s)`, ""]} />
            <Legend verticalAlign="bottom" height={28} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Confirmaciones en el tiempo"
        description="Familias que respondieron cada día."
        empty={timelineData.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timelineData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ece6f6" />
            <XAxis dataKey="etiqueta" fontSize={11} tickMargin={6} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Legend verticalAlign="top" height={28} />
            <Line
              type="monotone"
              dataKey="acumulado"
              name="Acumulado confirmadas"
              stroke={PINK}
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="confirmadas"
              name="Confirmadas"
              stroke={PURPLE}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="rechazadas"
              name="No asistirán"
              stroke={RED}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Popularidad de los menús"
        description="Cantidad elegida de cada menú."
        empty={menuData.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={menuData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ece6f6" />
            <XAxis
              dataKey="name"
              fontSize={10}
              interval={0}
              tickMargin={6}
              tickFormatter={(value: string) =>
                value.length > 14 ? `${value.slice(0, 13)}…` : value
              }
            />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip formatter={(value) => [`${Number(value ?? 0)} menú(s)`, ""]} />
            <Bar dataKey="cantidad" name="Cantidad" radius={[6, 6, 0, 0]}>
              {menuData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Uso del cupo por familia"
        description="Las diez familias con mayor ocupación de su cupo."
        empty={quotaData.length === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={quotaData}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 0, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ece6f6" />
            <XAxis type="number" fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="name" fontSize={11} width={80} />
            <Tooltip />
            <Legend verticalAlign="top" height={28} />
            <Bar dataKey="cupo" name="Cupo autorizado" fill={LAVENDER} radius={[0, 4, 4, 0]} />
            <Bar dataKey="confirmados" name="Confirmados" fill={PINK} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Menús por elegir"
        description="Comparación entre asistentes confirmados y menús ya seleccionados."
        empty={totals.confirmed_attendees === 0}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[
              {
                name: "Totales",
                asistentes: totals.confirmed_attendees,
                menus: totals.total_menus_selected,
                faltantes: Math.max(totals.missing_menus, 0),
              },
            ]}
            margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ece6f6" />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Legend verticalAlign="top" height={28} />
            <Bar dataKey="asistentes" name="Asistentes" fill={PURPLE} radius={[6, 6, 0, 0]} />
            <Bar dataKey="menus" name="Menús elegidos" fill={PINK} radius={[6, 6, 0, 0]} />
            <Bar dataKey="faltantes" name="Faltantes" fill={YELLOW} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  )
}
