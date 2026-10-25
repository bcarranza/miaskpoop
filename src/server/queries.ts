/**
 * Lecturas de datos.
 *
 * Las consultas administrativas usan la sesión del administrador, de
 * modo que RLS sigue aplicando. Las consultas públicas (invitación)
 * usan la clave de servicio pero filtran siempre por el token recibido,
 * así que una familia nunca puede ver datos de otra.
 */
import "server-only"
import { cache } from "react"
import type {
  ConfirmedAttendeeMenu,
  DeliveryLogRecord,
  EventRecord,
  EventTotals,
  FamilyRecord,
  FamilySummary,
  GuestRecord,
  MenuItemRecord,
  MenuOrderRow,
  RsvpResponseRecord,
} from "@/lib/types"
import { requireAdmin } from "./auth"
import {
  createAdminSupabase,
  createServerSupabase,
  SupabaseNotConfiguredError,
} from "./supabase/server"

export const EVENT_SLUG = "mia-kpop-party"

/** Evento activo. Devuelve null si Supabase no está configurado. */
export const getEvent = cache(async (): Promise<EventRecord | null> => {
  try {
    const supabase = createAdminSupabase()
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<EventRecord>()

    if (error) throw new Error(error.message)
    return data
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null
    throw error
  }
})

/** Evento activo o un error claro si no existe. */
export async function requireEvent(): Promise<EventRecord> {
  const event = await getEvent()
  if (!event) {
    throw new Error(
      "No hay ningún evento activo. Aplica las migraciones de supabase/migrations.",
    )
  }
  return event
}

// ---------------------------------------------------------------------
// Invitación pública (acceso por token)
// ---------------------------------------------------------------------

export type InvitationData = {
  event: EventRecord
  family: FamilySummary
  invitedChildren: GuestRecord[]
  companions: GuestRecord[]
  menus: MenuItemRecord[]
  currentResponse: RsvpResponseRecord | null
  /** Menú vigente por invitado. */
  selections: Record<string, string>
}

/**
 * Carga todo lo que necesita la invitación de una familia.
 *
 * El token actúa como credencial: si no coincide, no se devuelve nada.
 * Nunca se exponen datos de otras familias.
 */
export async function getInvitationByToken(token: string): Promise<InvitationData | null> {
  if (!token || token.length < 16 || token.length > 200) return null

  let supabase
  try {
    supabase = createAdminSupabase()
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null
    throw error
  }

  const { data: family, error } = await supabase
    .from("v_family_summary")
    .select("*")
    .eq("invitation_token", token)
    .is("archived_at", null)
    .maybeSingle<FamilySummary>()

  if (error) throw new Error(error.message)
  if (!family) return null

  const [eventResult, guestsResult, menusResult, responseResult] = await Promise.all([
    supabase.from("events").select("*").eq("id", family.event_id).single<EventRecord>(),
    supabase
      .from("guests")
      .select("*")
      .eq("family_id", family.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("menu_items")
      .select("*")
      .eq("event_id", family.event_id)
      .eq("is_available", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("rsvp_responses")
      .select("*")
      .eq("family_id", family.id)
      .eq("is_current", true)
      .maybeSingle<RsvpResponseRecord>(),
  ])

  if (eventResult.error) throw new Error(eventResult.error.message)

  const guests = (guestsResult.data ?? []) as GuestRecord[]

  const { data: selectionRows } = await supabase
    .from("attendee_menu_selections")
    .select("guest_id, menu_item_id")
    .eq("family_id", family.id)
    .eq("is_current", true)

  const selections: Record<string, string> = {}
  for (const row of (selectionRows ?? []) as { guest_id: string; menu_item_id: string }[]) {
    selections[row.guest_id] = row.menu_item_id
  }

  return {
    event: eventResult.data,
    family,
    invitedChildren: guests.filter((g) => g.is_invited_child),
    companions: guests.filter((g) => !g.is_invited_child),
    menus: (menusResult.data ?? []) as MenuItemRecord[],
    currentResponse: responseResult.data ?? null,
    selections,
  }
}

/** Registra que el administrador abrió WhatsApp o que se vio la invitación. */
export async function touchInvitationOpened(familyId: string): Promise<void> {
  const supabase = createAdminSupabase()
  await supabase
    .from("families")
    .update({ invitation_opened_at: new Date().toISOString() })
    .eq("id", familyId)
    .is("invitation_opened_at", null)
}

// ---------------------------------------------------------------------
// Consultas administrativas
// ---------------------------------------------------------------------

export type FamilyFilters = {
  search?: string
  rsvpStatus?: string
  deliveryStatus?: string
  needsReview?: boolean
  incompleteMenus?: boolean
  includeArchived?: boolean
  orderBy?: "name" | "created_at" | "confirmed_attendees" | "max_attendees" | "rsvp_status"
  direction?: "asc" | "desc"
}

export async function listFamilies(filters: FamilyFilters = {}): Promise<FamilySummary[]> {
  await requireAdmin()
  const supabase = await createServerSupabase()
  const event = await requireEvent()

  let query = supabase.from("v_family_summary").select("*").eq("event_id", event.id)

  if (!filters.includeArchived) {
    query = query.is("archived_at", null)
  }
  if (filters.search && filters.search.trim() !== "") {
    const term = filters.search.trim().replace(/[%,()]/g, "")
    query = query.or(
      `name.ilike.%${term}%,primary_contact_name.ilike.%${term}%,whatsapp_phone.ilike.%${term}%,notes.ilike.%${term}%`,
    )
  }
  if (filters.rsvpStatus && filters.rsvpStatus !== "todas") {
    query = query.eq("rsvp_status", filters.rsvpStatus)
  }
  if (filters.deliveryStatus && filters.deliveryStatus !== "todas") {
    query = query.eq("delivery_status", filters.deliveryStatus)
  }
  if (filters.needsReview) {
    query = query.eq("needs_review", true)
  }
  if (filters.incompleteMenus) {
    query = query.eq("menu_incomplete", true)
  }

  const orderBy = filters.orderBy ?? "name"
  query = query.order(orderBy, { ascending: (filters.direction ?? "asc") === "asc" })

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as FamilySummary[]
}

export async function getFamilySummary(id: string): Promise<FamilySummary | null> {
  await requireAdmin()
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("v_family_summary")
    .select("*")
    .eq("id", id)
    .maybeSingle<FamilySummary>()
  if (error) throw new Error(error.message)
  return data
}

export type FamilyDetail = {
  family: FamilySummary
  guests: GuestRecord[]
  responses: RsvpResponseRecord[]
  deliveryLogs: DeliveryLogRecord[]
  selections: Record<string, { menu_item_id: string; menu_name: string; needs_review: boolean }>
}

export async function getFamilyDetail(id: string): Promise<FamilyDetail | null> {
  await requireAdmin()
  const supabase = await createServerSupabase()

  const { data: family, error } = await supabase
    .from("v_family_summary")
    .select("*")
    .eq("id", id)
    .maybeSingle<FamilySummary>()

  if (error) throw new Error(error.message)
  if (!family) return null

  const [guests, responses, logs, selections] = await Promise.all([
    supabase
      .from("guests")
      .select("*")
      .eq("family_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("rsvp_responses")
      .select("*")
      .eq("family_id", id)
      .order("revision", { ascending: false }),
    supabase
      .from("invitation_delivery_logs")
      .select("*")
      .eq("family_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("attendee_menu_selections")
      .select("guest_id, menu_item_id, needs_review, menu_items(name)")
      .eq("family_id", id)
      .eq("is_current", true),
  ])

  const selectionMap: FamilyDetail["selections"] = {}
  type SelectionRow = {
    guest_id: string
    menu_item_id: string
    needs_review: boolean
    menu_items: { name: string } | { name: string }[] | null
  }
  for (const row of (selections.data ?? []) as SelectionRow[]) {
    const related = Array.isArray(row.menu_items) ? row.menu_items[0] : row.menu_items
    selectionMap[row.guest_id] = {
      menu_item_id: row.menu_item_id,
      menu_name: related?.name ?? "—",
      needs_review: row.needs_review,
    }
  }

  return {
    family,
    guests: (guests.data ?? []) as GuestRecord[],
    responses: (responses.data ?? []) as RsvpResponseRecord[],
    deliveryLogs: (logs.data ?? []) as DeliveryLogRecord[],
    selections: selectionMap,
  }
}

/** Familia por id, con la fila base (para acciones). */
export async function getFamilyRecord(id: string): Promise<FamilyRecord | null> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from("families")
    .select("*")
    .eq("id", id)
    .maybeSingle<FamilyRecord>()
  if (error) throw new Error(error.message)
  return data
}

export async function getEventTotals(): Promise<EventTotals> {
  await requireAdmin()
  const supabase = await createServerSupabase()
  const event = await requireEvent()

  const { data, error } = await supabase
    .from("v_event_totals")
    .select("*")
    .eq("event_id", event.id)
    .maybeSingle<EventTotals>()

  if (error) throw new Error(error.message)

  return (
    data ?? {
      event_id: event.id,
      total_families: 0,
      confirmed_families: 0,
      pending_families: 0,
      declined_families: 0,
      families_needing_review: 0,
      invitations_generated: 0,
      invitations_sent: 0,
      invitations_ready: 0,
      invitations_opened: 0,
      invitations_not_prepared: 0,
      total_capacity: 0,
      confirmed_attendees: 0,
      confirmed_children: 0,
      confirmed_adults: 0,
      invited_children: 0,
      total_menus_selected: 0,
      missing_menus: 0,
      families_with_incomplete_menus: 0,
    }
  )
}

export async function listMenuItems(includeUnavailable = true): Promise<MenuItemRecord[]> {
  await requireAdmin()
  const supabase = await createServerSupabase()
  const event = await requireEvent()

  let query = supabase.from("menu_items").select("*").eq("event_id", event.id)
  if (!includeUnavailable) query = query.eq("is_available", true)

  const { data, error } = await query.order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as MenuItemRecord[]
}

export async function getMenuOrderSummary(): Promise<MenuOrderRow[]> {
  await requireAdmin()
  const supabase = await createServerSupabase()
  const event = await requireEvent()

  const { data, error } = await supabase
    .from("v_menu_order_summary")
    .select("*")
    .eq("event_id", event.id)
    .order("sort_order", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as MenuOrderRow[]
}

export async function listConfirmedAttendees(): Promise<ConfirmedAttendeeMenu[]> {
  await requireAdmin()
  const supabase = await createServerSupabase()
  const event = await requireEvent()

  const { data, error } = await supabase
    .from("v_confirmed_attendee_menus")
    .select("*")
    .eq("event_id", event.id)
    .order("family_name", { ascending: true })
    .order("guest_name", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ConfirmedAttendeeMenu[]
}

/** Confirmaciones vigentes con el nombre de la familia, para /admin/confirmaciones. */
export type RsvpWithFamily = RsvpResponseRecord & {
  family_name: string
  max_attendees: number
  menu_incomplete: boolean
}

export async function listCurrentResponses(): Promise<RsvpWithFamily[]> {
  await requireAdmin()
  const supabase = await createServerSupabase()
  const event = await requireEvent()

  const { data, error } = await supabase
    .from("rsvp_responses")
    .select("*, families!inner(name, max_attendees, event_id)")
    .eq("is_current", true)
    .eq("families.event_id", event.id)
    .order("submitted_at", { ascending: false })

  if (error) throw new Error(error.message)

  type Row = RsvpResponseRecord & {
    families: { name: string; max_attendees: number } | { name: string; max_attendees: number }[]
  }

  return ((data ?? []) as Row[]).map((row) => {
    const family = Array.isArray(row.families) ? row.families[0] : row.families
    return {
      ...row,
      family_name: family?.name ?? "—",
      max_attendees: family?.max_attendees ?? 0,
      menu_incomplete: false,
    }
  })
}

/** Serie de confirmaciones por día, para la gráfica del panel. */
export async function getConfirmationsOverTime(): Promise<
  { date: string; confirmadas: number; rechazadas: number; acumulado: number }[]
> {
  await requireAdmin()
  const supabase = await createServerSupabase()
  const event = await requireEvent()

  const { data, error } = await supabase
    .from("rsvp_responses")
    .select("submitted_at, status, is_current, families!inner(event_id)")
    .eq("is_current", true)
    .eq("families.event_id", event.id)
    .order("submitted_at", { ascending: true })

  if (error) throw new Error(error.message)

  const perDay = new Map<string, { confirmadas: number; rechazadas: number }>()
  for (const row of (data ?? []) as { submitted_at: string; status: string }[]) {
    const day = row.submitted_at.slice(0, 10)
    const bucket = perDay.get(day) ?? { confirmadas: 0, rechazadas: 0 }
    if (row.status === "confirmado") bucket.confirmadas += 1
    if (row.status === "rechazado") bucket.rechazadas += 1
    perDay.set(day, bucket)
  }

  let acumulado = 0
  return [...perDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => {
      acumulado += bucket.confirmadas
      return { date, ...bucket, acumulado }
    })
}

/** Historial de envíos, para /admin/invitaciones. */
export async function listDeliveryLogs(limit = 100): Promise<
  (DeliveryLogRecord & { family_name: string })[]
> {
  await requireAdmin()
  const supabase = await createServerSupabase()
  const event = await requireEvent()

  const { data, error } = await supabase
    .from("invitation_delivery_logs")
    .select("*, families!inner(name, event_id)")
    .eq("families.event_id", event.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  type Row = DeliveryLogRecord & { families: { name: string } | { name: string }[] }
  return ((data ?? []) as Row[]).map((row) => {
    const family = Array.isArray(row.families) ? row.families[0] : row.families
    return { ...row, family_name: family?.name ?? "—" }
  })
}
