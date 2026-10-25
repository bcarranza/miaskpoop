"use client"

/** Tabla de familias con búsqueda, filtros y ordenamiento. */
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Baby,
  Eye,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  DELIVERY_STATUS_LABEL,
  RSVP_STATUS_LABEL,
  type DeliveryStatus,
  type FamilySummary,
  type RsvpStatus,
} from "@/lib/types"
import {
  DeliveryChip,
  IncompleteMenuChip,
  ReviewChip,
  RsvpChip,
} from "./status-chips"

type SortKey =
  | "name"
  | "max_attendees"
  | "confirmed_attendees"
  | "rsvp_status"
  | "delivery_status"
  | "menu_selections"

type Props = {
  families: FamilySummary[]
  initialSearch?: string
  initialReviewOnly?: boolean
  showArchived?: boolean
}

export function FamilyTable({
  families,
  initialSearch = "",
  initialReviewOnly = false,
  showArchived = false,
}: Props) {
  const [search, setSearch] = useState(initialSearch)
  const [rsvpFilter, setRsvpFilter] = useState<RsvpStatus | "todas">("todas")
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryStatus | "todas">("todas")
  const [reviewOnly, setReviewOnly] = useState(initialReviewOnly)
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [ascending, setAscending] = useState(true)

  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()

  const filtered = useMemo(() => {
    const term = normalize(search.trim())

    const result = families.filter((family) => {
      if (term !== "") {
        const haystack = normalize(
          [
            family.name,
            family.primary_contact_name,
            family.whatsapp_phone,
            family.whatsapp_phone_display ?? "",
            (family.invited_children_names ?? []).join(" "),
            family.notes ?? "",
          ].join(" "),
        )
        if (!haystack.includes(term)) return false
      }
      if (rsvpFilter !== "todas" && family.rsvp_status !== rsvpFilter) return false
      if (deliveryFilter !== "todas" && family.delivery_status !== deliveryFilter) return false
      if (reviewOnly && !family.needs_review) return false
      if (incompleteOnly && !family.menu_incomplete) return false
      return true
    })

    const compare = (a: FamilySummary, b: FamilySummary): number => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name, "es")
        case "rsvp_status":
          return a.rsvp_status.localeCompare(b.rsvp_status, "es")
        case "delivery_status":
          return a.delivery_status.localeCompare(b.delivery_status, "es")
        default:
          return (a[sortKey] as number) - (b[sortKey] as number)
      }
    }

    return result.sort((a, b) => (ascending ? compare(a, b) : -compare(a, b)))
  }, [
    families,
    search,
    rsvpFilter,
    deliveryFilter,
    reviewOnly,
    incompleteOnly,
    sortKey,
    ascending,
  ])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setAscending((current) => !current)
    } else {
      setSortKey(key)
      setAscending(true)
    }
  }


  const totals = useMemo(
    () => ({
      cupo: filtered.reduce((sum, f) => sum + f.max_attendees, 0),
      confirmados: filtered.reduce((sum, f) => sum + f.confirmed_attendees, 0),
      menus: filtered.reduce((sum, f) => sum + f.menu_selections, 0),
    }),
    [filtered],
  )

  const hasFilters =
    search !== "" ||
    rsvpFilter !== "todas" ||
    deliveryFilter !== "todas" ||
    reviewOnly ||
    incompleteOnly

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Buscar
            </span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(changeEvent) => setSearch(changeEvent.target.value)}
                placeholder="Familia, responsable, teléfono o niño"
                className="input-base pl-9"
              />
            </span>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Confirmación
            </span>
            <select
              value={rsvpFilter}
              onChange={(changeEvent) =>
                setRsvpFilter(changeEvent.target.value as RsvpStatus | "todas")
              }
              className="input-base"
            >
              <option value="todas">Todas</option>
              {(Object.keys(RSVP_STATUS_LABEL) as RsvpStatus[]).map((status) => (
                <option key={status} value={status}>
                  {RSVP_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Envío
            </span>
            <select
              value={deliveryFilter}
              onChange={(changeEvent) =>
                setDeliveryFilter(changeEvent.target.value as DeliveryStatus | "todas")
              }
              className="input-base"
            >
              <option value="todas">Todos</option>
              {(Object.keys(DELIVERY_STATUS_LABEL) as DeliveryStatus[]).map((status) => (
                <option key={status} value={status}>
                  {DELIVERY_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reviewOnly}
              onChange={(changeEvent) => setReviewOnly(changeEvent.target.checked)}
              className="size-4 accent-[#ff2e9a]"
            />
            Sólo las que requieren revisión
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={incompleteOnly}
              onChange={(changeEvent) => setIncompleteOnly(changeEvent.target.checked)}
              className="size-4 accent-[#ff2e9a]"
            />
            Sólo con menús incompletos
          </label>

          <Link
            href={showArchived ? "/admin/familias" : "/admin/familias?archivadas=1"}
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            {showArchived ? "Ocultar archivadas" : "Mostrar archivadas"}
          </Link>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setRsvpFilter("todas")
                setDeliveryFilter("todas")
                setReviewOnly(false)
                setIncompleteOnly(false)
              }}
              className="flex items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline"
            >
              <X className="size-3.5" aria-hidden />
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Resumen de lo filtrado */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} de {families.length} familia(s) · {totals.cupo} cupos ·{" "}
        {totals.confirmados} confirmados · {totals.menus} menús
      </p>

      {/* Tabla (escritorio) */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                <SortButton label="Familia" column="name" activeKey={sortKey} ascending={ascending} onToggle={toggleSort} />
              </th>
              <th scope="col" className="px-4 py-3">
                Niños invitados
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                <SortButton label="Cupo" column="max_attendees" activeKey={sortKey} ascending={ascending} onToggle={toggleSort} />
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                <SortButton label="Confirmados" column="confirmed_attendees" activeKey={sortKey} ascending={ascending} onToggle={toggleSort} />
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                <SortButton label="Menús" column="menu_selections" activeKey={sortKey} ascending={ascending} onToggle={toggleSort} />
              </th>
              <th scope="col" className="px-4 py-3">
                <SortButton label="Estado" column="rsvp_status" activeKey={sortKey} ascending={ascending} onToggle={toggleSort} />
              </th>
              <th scope="col" className="px-4 py-3">
                <SortButton label="Envío" column="delivery_status" activeKey={sortKey} ascending={ascending} onToggle={toggleSort} />
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((family) => (
              <tr key={family.id} className="transition hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/familias/${family.id}`}
                    className="font-bold text-foreground underline-offset-2 hover:underline"
                  >
                    {family.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {family.primary_contact_name} ·{" "}
                    {family.whatsapp_phone_display ?? family.whatsapp_phone}
                  </p>
                  {family.archived_at && (
                    <span className="chip mt-1 bg-muted text-muted-foreground">Archivada</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  {(family.invited_children_names ?? []).length === 0 ? (
                    <span className="text-xs text-muted-foreground">Sin niños precargados</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {(family.invited_children_names ?? []).map((name) => (
                        <span
                          key={name}
                          className="chip bg-lavender/25 text-grape"
                        >
                          <Baby className="size-3" aria-hidden />
                          {name}
                        </span>
                      ))}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-center font-bold tabular-nums">
                  {family.max_attendees}
                </td>

                <td className="px-4 py-3 text-center tabular-nums">
                  <span className="font-bold">{family.confirmed_attendees}</span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    ({family.confirmed_children}N/{family.confirmed_adults}A)
                  </span>
                </td>

                <td className="px-4 py-3 text-center tabular-nums">
                  {family.menu_selections}
                </td>

                <td className="px-4 py-3">
                  <span className="flex flex-col items-start gap-1">
                    <RsvpChip status={family.rsvp_status} />
                    {family.needs_review && <ReviewChip reason={family.review_reason} />}
                    {family.menu_incomplete && (
                      <IncompleteMenuChip
                        missing={family.confirmed_attendees - family.menu_selections}
                      />
                    )}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <DeliveryChip status={family.delivery_status} />
                </td>

                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/familias/${family.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-muted"
                  >
                    <Eye className="size-3.5" aria-hidden />
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No hay familias que coincidan con los filtros.
          </p>
        )}
      </div>

      {/* Tarjetas (teléfono y tableta) */}
      <ul className="space-y-3 lg:hidden">
        {filtered.map((family) => (
          <li key={family.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/familias/${family.id}`}
                  className="font-heading text-base font-extrabold underline-offset-2 hover:underline"
                >
                  {family.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {family.primary_contact_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {family.whatsapp_phone_display ?? family.whatsapp_phone}
                </p>
              </div>
              <RsvpChip status={family.rsvp_status} />
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted/60 py-2">
                <dt className="text-[0.65rem] uppercase text-muted-foreground">Cupo</dt>
                <dd className="font-heading text-lg font-black tabular-nums">
                  {family.max_attendees}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/60 py-2">
                <dt className="text-[0.65rem] uppercase text-muted-foreground">Confirmados</dt>
                <dd className="font-heading text-lg font-black tabular-nums">
                  {family.confirmed_attendees}
                </dd>
              </div>
              <div className="rounded-xl bg-muted/60 py-2">
                <dt className="text-[0.65rem] uppercase text-muted-foreground">Menús</dt>
                <dd className="font-heading text-lg font-black tabular-nums">
                  {family.menu_selections}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <DeliveryChip status={family.delivery_status} />
              {family.needs_review && <ReviewChip reason={family.review_reason} />}
              {family.menu_incomplete && (
                <IncompleteMenuChip
                  missing={family.confirmed_attendees - family.menu_selections}
                />
              )}
            </div>
          </li>
        ))}

        {filtered.length === 0 && (
          <li className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No hay familias que coincidan con los filtros.
          </li>
        )}
      </ul>
    </div>
  )
}

/** Encabezado ordenable. Vive fuera del componente para no recrearse. */
function SortButton({
  label,
  column,
  activeKey,
  ascending,
  onToggle,
}: {
  label: string
  column: SortKey
  activeKey: SortKey
  ascending: boolean
  onToggle: (column: SortKey) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className="flex items-center gap-1 font-bold uppercase tracking-wide transition hover:text-foreground"
    >
      {label}
      {activeKey === column ? (
        ascending ? (
          <ArrowUp className="size-3" aria-hidden />
        ) : (
          <ArrowDown className="size-3" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-40" aria-hidden />
      )}
    </button>
  )
}
