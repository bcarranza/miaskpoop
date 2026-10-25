/**
 * Definición de los reportes exportables a Excel.
 *
 * Las funciones son puras: reciben datos y devuelven la especificación
 * de hojas que buildWorkbook convierte en XLSX. Así se pueden probar
 * sin generar archivos.
 */
import { formatDateTime, formatLongDate, formatTime } from "../date"
import {
  DELIVERY_STATUS_LABEL,
  GUEST_TYPE_LABEL,
  RSVP_STATUS_LABEL,
  type ConfirmedAttendeeMenu,
  type EventRecord,
  type EventTotals,
  type FamilySummary,
  type MenuOrderRow,
} from "../types"
import type { SheetSpec } from "./workbook"

export type ExportKind =
  | "familias"
  | "confirmadas"
  | "pendientes"
  | "rechazadas"
  | "asistentes"
  | "menus"
  | "pedido"
  | "incompletos"
  | "revision"
  | "completo"

export const EXPORT_LABELS: Record<ExportKind, string> = {
  familias: "Todas las familias",
  confirmadas: "Familias confirmadas",
  pendientes: "Familias pendientes",
  rechazadas: "Familias que no asistirán",
  asistentes: "Todos los asistentes",
  menus: "Selección de menús por persona",
  pedido: "Resumen del pedido de McDonald's",
  incompletos: "Familias con menús incompletos",
  revision: "Familias que requieren revisión",
  completo: "Reporte completo (todas las hojas)",
}

function quetzales(cents: number | null): string | number | null {
  if (cents === null) return null
  return Number((cents / 100).toFixed(2))
}

export function buildFamiliesSheet(
  families: FamilySummary[],
  name = "Familias",
): SheetSpec {
  return {
    name,
    columns: [
      { header: "Familia", key: "familia", width: 24 },
      { header: "Responsable", key: "responsable", width: 26 },
      { header: "WhatsApp", key: "whatsapp", width: 20 },
      { header: "Cupos máximos", key: "cupos", width: 15 },
      { header: "Niños invitados", key: "ninos", width: 30 },
      { header: "Confirmación", key: "estado", width: 16 },
      { header: "Asistentes confirmados", key: "asistentes", width: 20 },
      { header: "Niños confirmados", key: "ninos_confirmados", width: 18 },
      { header: "Adultos confirmados", key: "adultos", width: 18 },
      { header: "Menús elegidos", key: "menus", width: 15 },
      { header: "Cupos sin usar", key: "restantes", width: 15 },
      { header: "Envío de invitación", key: "envio", width: 22 },
      { header: "Invitación enviada el", key: "enviada", width: 22 },
      { header: "Confirmó el", key: "confirmo", width: 22 },
      { header: "Recordatorios", key: "recordatorios", width: 14 },
      { header: "Requiere revisión", key: "revision", width: 18 },
      { header: "Motivo de revisión", key: "motivo", width: 40 },
      { header: "Notas", key: "notas", width: 40 },
    ],
    rows: families.map((family) => ({
      familia: family.name,
      responsable: family.primary_contact_name,
      whatsapp: family.whatsapp_phone_display ?? family.whatsapp_phone,
      cupos: family.max_attendees,
      ninos: (family.invited_children_names ?? []).join(", "),
      estado: RSVP_STATUS_LABEL[family.rsvp_status],
      asistentes: family.confirmed_attendees,
      ninos_confirmados: family.confirmed_children,
      adultos: family.confirmed_adults,
      menus: family.menu_selections,
      restantes: family.remaining_slots,
      envio: DELIVERY_STATUS_LABEL[family.delivery_status],
      enviada: formatDateTime(family.invitation_sent_at),
      confirmo: formatDateTime(family.rsvp_submitted_at),
      recordatorios: family.reminder_count,
      revision: family.needs_review ? "Sí" : "No",
      motivo: family.review_reason ?? "",
      notas: family.notes ?? "",
    })),
    totals: {
      familia: `TOTAL (${families.length} familias)`,
      cupos: families.reduce((sum, f) => sum + f.max_attendees, 0),
      asistentes: families.reduce((sum, f) => sum + f.confirmed_attendees, 0),
      ninos_confirmados: families.reduce((sum, f) => sum + f.confirmed_children, 0),
      adultos: families.reduce((sum, f) => sum + f.confirmed_adults, 0),
      menus: families.reduce((sum, f) => sum + f.menu_selections, 0),
    },
  }
}

export function buildAttendeesSheet(attendees: ConfirmedAttendeeMenu[]): SheetSpec {
  return {
    name: "Asistentes",
    columns: [
      { header: "Familia", key: "familia", width: 24 },
      { header: "Responsable", key: "responsable", width: 26 },
      { header: "Nombre", key: "nombre", width: 26 },
      { header: "Tipo", key: "tipo", width: 12 },
      { header: "Invitado especial", key: "invitado", width: 16 },
      { header: "Menú", key: "menu", width: 34 },
      { header: "Requiere revisión", key: "revision", width: 18 },
    ],
    rows: attendees.map((attendee) => ({
      familia: attendee.family_name,
      responsable: attendee.primary_contact_name,
      nombre: attendee.guest_name,
      tipo: GUEST_TYPE_LABEL[attendee.guest_type],
      invitado: attendee.is_invited_child ? "Sí" : "No",
      menu: attendee.menu_name ?? "SIN MENÚ",
      revision: attendee.selection_needs_review ? "Sí" : "No",
    })),
    totals: {
      familia: `TOTAL: ${attendees.length} asistentes`,
      tipo: `${attendees.filter((a) => a.guest_type === "nino").length} niños / ${
        attendees.filter((a) => a.guest_type === "adulto").length
      } adultos`,
      menu: `${attendees.filter((a) => a.menu_item_id !== null).length} menús elegidos`,
    },
  }
}

export function buildOrderSheet(order: MenuOrderRow[], totals: EventTotals): SheetSpec {
  const adults = order.filter((row) => row.audience === "adulto")
  const children = order.filter((row) => row.audience === "nino")
  const hasPrices = order.some((row) => row.price_cents !== null)

  const columns = [
    { header: "Menú", key: "menu", width: 38 },
    { header: "Para", key: "para", width: 12 },
    { header: "Cantidad", key: "cantidad", width: 12 },
    { header: "Disponible", key: "disponible", width: 12 },
  ]
  if (hasPrices) {
    columns.push(
      { header: "Precio unitario (Q)", key: "precio", width: 18 },
      { header: "Subtotal (Q)", key: "subtotal", width: 16 },
    )
  }

  const rows = [...adults, ...children].map((row) => ({
    menu: row.name,
    para: row.audience === "adulto" ? "Adultos" : "Niños",
    cantidad: row.quantity,
    disponible: row.is_available ? "Sí" : "No",
    ...(hasPrices
      ? { precio: quetzales(row.price_cents), subtotal: quetzales(row.subtotal_cents) }
      : {}),
  }))

  const subtotalCents = order.reduce((sum, row) => sum + (row.subtotal_cents ?? 0), 0)

  return {
    name: "Pedido McDonald's",
    columns,
    rows,
    totals: {
      menu: "TOTAL DE MENÚS",
      para: `${adults.reduce((s, r) => s + r.quantity, 0)} adultos / ${children.reduce(
        (s, r) => s + r.quantity,
        0,
      )} Cajitas`,
      cantidad: totals.total_menus_selected,
      ...(hasPrices ? { subtotal: quetzales(subtotalCents) } : {}),
    },
  }
}

export function buildSummarySheet(event: EventRecord, totals: EventTotals): SheetSpec {
  return {
    name: "Resumen",
    columns: [
      { header: "Dato", key: "dato", width: 38 },
      { header: "Valor", key: "valor", width: 44 },
    ],
    rows: [
      { dato: "Evento", valor: event.name },
      { dato: "Cumpleañera", valor: `${event.celebrant_name} (${event.celebrant_age} años)` },
      { dato: "Fecha", valor: formatLongDate(event.event_date) },
      { dato: "Hora", valor: formatTime(event.start_time) },
      { dato: "Lugar", valor: `${event.venue_name}, ${event.venue_address}` },
      { dato: "Fecha límite para confirmar", valor: formatLongDate(event.rsvp_deadline) },
      { dato: "", valor: "" },
      { dato: "Familias invitadas", valor: totals.total_families },
      { dato: "Invitaciones marcadas como enviadas", valor: totals.invitations_sent },
      { dato: "Familias confirmadas", valor: totals.confirmed_families },
      { dato: "Familias pendientes", valor: totals.pending_families },
      { dato: "Familias que no asistirán", valor: totals.declined_families },
      { dato: "Familias que requieren revisión", valor: totals.families_needing_review },
      { dato: "", valor: "" },
      { dato: "Capacidad total autorizada", valor: totals.total_capacity },
      { dato: "Asistentes confirmados", valor: totals.confirmed_attendees },
      { dato: "Niños confirmados", valor: totals.confirmed_children },
      { dato: "Adultos confirmados", valor: totals.confirmed_adults },
      { dato: "", valor: "" },
      { dato: "Menús seleccionados", valor: totals.total_menus_selected },
      { dato: "Menús pendientes de elegir", valor: totals.missing_menus },
      { dato: "Familias con menús incompletos", valor: totals.families_with_incomplete_menus },
      { dato: "", valor: "" },
      { dato: "Reporte generado el", valor: formatDateTime(new Date().toISOString()) },
    ],
  }
}

export function buildIncompleteSheet(families: FamilySummary[]): SheetSpec {
  return {
    name: "Menús incompletos",
    columns: [
      { header: "Familia", key: "familia", width: 24 },
      { header: "Responsable", key: "responsable", width: 26 },
      { header: "WhatsApp", key: "whatsapp", width: 20 },
      { header: "Asistentes confirmados", key: "asistentes", width: 20 },
      { header: "Menús elegidos", key: "menus", width: 16 },
      { header: "Menús faltantes", key: "faltantes", width: 16 },
    ],
    rows: families.map((family) => ({
      familia: family.name,
      responsable: family.primary_contact_name,
      whatsapp: family.whatsapp_phone_display ?? family.whatsapp_phone,
      asistentes: family.confirmed_attendees,
      menus: family.menu_selections,
      faltantes: Math.max(family.confirmed_attendees - family.menu_selections, 0),
    })),
  }
}

export function buildReviewSheet(families: FamilySummary[]): SheetSpec {
  return {
    name: "Requieren revisión",
    columns: [
      { header: "Familia", key: "familia", width: 24 },
      { header: "Responsable", key: "responsable", width: 26 },
      { header: "WhatsApp", key: "whatsapp", width: 20 },
      { header: "Cupo", key: "cupo", width: 10 },
      { header: "Confirmados", key: "confirmados", width: 14 },
      { header: "Motivo", key: "motivo", width: 60 },
    ],
    rows: families.map((family) => ({
      familia: family.name,
      responsable: family.primary_contact_name,
      whatsapp: family.whatsapp_phone_display ?? family.whatsapp_phone,
      cupo: family.max_attendees,
      confirmados: family.confirmed_attendees,
      motivo: family.review_reason ?? "Revisar con la familia.",
    })),
  }
}

export type ExportData = {
  event: EventRecord
  totals: EventTotals
  families: FamilySummary[]
  attendees: ConfirmedAttendeeMenu[]
  order: MenuOrderRow[]
}

/** Decide qué hojas lleva cada exportación. */
export function buildExportSheets(kind: ExportKind, data: ExportData): SheetSpec[] {
  const { event, totals, families, attendees, order } = data

  switch (kind) {
    case "familias":
      return [buildSummarySheet(event, totals), buildFamiliesSheet(families)]
    case "confirmadas":
      return [
        buildFamiliesSheet(
          families.filter((f) => f.rsvp_status === "confirmado"),
          "Familias confirmadas",
        ),
      ]
    case "pendientes":
      return [
        buildFamiliesSheet(
          families.filter((f) => f.rsvp_status === "pendiente"),
          "Familias pendientes",
        ),
      ]
    case "rechazadas":
      return [
        buildFamiliesSheet(
          families.filter((f) => f.rsvp_status === "rechazado"),
          "No asistirán",
        ),
      ]
    case "asistentes":
      return [buildAttendeesSheet(attendees)]
    case "menus":
      return [buildAttendeesSheet(attendees), buildOrderSheet(order, totals)]
    case "pedido":
      return [buildOrderSheet(order, totals), buildSummarySheet(event, totals)]
    case "incompletos":
      return [buildIncompleteSheet(families.filter((f) => f.menu_incomplete))]
    case "revision":
      return [buildReviewSheet(families.filter((f) => f.needs_review))]
    case "completo":
      return [
        buildSummarySheet(event, totals),
        buildFamiliesSheet(families),
        buildAttendeesSheet(attendees),
        buildOrderSheet(order, totals),
        buildIncompleteSheet(families.filter((f) => f.menu_incomplete)),
        buildReviewSheet(families.filter((f) => f.needs_review)),
      ]
  }
}

/** Nombre de archivo con la fecha, sin acentos ni espacios. */
export function buildExportFileName(kind: ExportKind, extension = "xlsx"): string {
  const today = new Date().toISOString().slice(0, 10)
  return `mia-kpop-${kind}-${today}.${extension}`
}
