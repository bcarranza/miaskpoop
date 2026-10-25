/**
 * Tipos de dominio alineados con el esquema de PostgreSQL
 * (ver supabase/migrations).
 */

export type RsvpStatus = "pendiente" | "confirmado" | "rechazado"

export type DeliveryStatus = "no_preparada" | "lista" | "abierta_whatsapp" | "enviada"

export type GuestType = "nino" | "adulto"

export type AdminRole = "owner" | "admin" | "viewer"

export const RSVP_STATUS_LABEL: Record<RsvpStatus, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmada",
  rechazado: "No asistirá",
}

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  no_preparada: "Sin preparar",
  lista: "Lista para enviar",
  abierta_whatsapp: "Abierta en WhatsApp",
  enviada: "Marcada como enviada",
}

export const GUEST_TYPE_LABEL: Record<GuestType, string> = {
  nino: "Niño/a",
  adulto: "Adulto",
}

export type EventRecord = {
  id: string
  slug: string
  name: string
  celebrant_name: string
  celebrant_age: number
  event_date: string
  start_time: string
  timezone: string
  venue_name: string
  venue_address: string
  venue_maps_url: string | null
  theme: string
  rsvp_deadline: string
  allow_rsvp_edits: boolean
  invitation_headline: string
  invitation_subheadline: string
  invitation_message: string
  whatsapp_invitation_template: string
  whatsapp_reminder_template: string
  theme_primary_color: string
  theme_secondary_color: string
  theme_accent_color: string
  background_image_url: string | null
  music_enabled: boolean
  music_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type FamilyRecord = {
  id: string
  event_id: string
  name: string
  primary_contact_name: string
  whatsapp_phone: string
  whatsapp_phone_display: string | null
  secondary_contact_name: string | null
  secondary_contact_phone: string | null
  max_attendees: number
  invitation_token: string
  invitation_enabled: boolean
  rsvp_status: RsvpStatus
  delivery_status: DeliveryStatus
  invitation_sent_at: string | null
  invitation_opened_at: string | null
  rsvp_submitted_at: string | null
  reminder_count: number
  last_reminder_at: string | null
  needs_review: boolean
  review_reason: string | null
  notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

/** Fila de la vista v_family_summary: totales derivados de datos reales. */
export type FamilySummary = FamilyRecord & {
  invited_children_count: number
  invited_children_names: string[]
  confirmed_attendees: number
  confirmed_children: number
  confirmed_adults: number
  menu_selections: number
  selections_needing_review: number
  remaining_slots: number
  menu_incomplete: boolean
}

export type GuestRecord = {
  id: string
  family_id: string
  name: string
  guest_type: GuestType
  is_invited_child: boolean
  is_attending: boolean | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type MenuItemRecord = {
  id: string
  event_id: string
  code: string
  name: string
  description: string | null
  audience: GuestType
  image_url: string | null
  price_cents: number | null
  currency: string
  is_available: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type MenuOrderRow = {
  menu_item_id: string
  event_id: string
  code: string
  name: string
  description: string | null
  audience: GuestType
  is_available: boolean
  price_cents: number | null
  currency: string
  sort_order: number
  quantity: number
  subtotal_cents: number | null
}

export type EventTotals = {
  event_id: string
  total_families: number
  confirmed_families: number
  pending_families: number
  declined_families: number
  families_needing_review: number
  invitations_generated: number
  invitations_sent: number
  invitations_ready: number
  invitations_opened: number
  invitations_not_prepared: number
  total_capacity: number
  confirmed_attendees: number
  confirmed_children: number
  confirmed_adults: number
  invited_children: number
  total_menus_selected: number
  missing_menus: number
  families_with_incomplete_menus: number
}

export type ConfirmedAttendeeMenu = {
  event_id: string
  family_id: string
  family_name: string
  primary_contact_name: string
  guest_id: string
  guest_name: string
  guest_type: GuestType
  is_invited_child: boolean
  selection_id: string | null
  menu_item_id: string | null
  selection_needs_review: boolean | null
  selection_review_reason: string | null
  menu_code: string | null
  menu_name: string | null
  menu_audience: GuestType | null
  menu_price_cents: number | null
  menu_is_available: boolean | null
}

export type RsvpResponseRecord = {
  id: string
  family_id: string
  status: RsvpStatus
  attendee_count: number
  children_count: number
  adults_count: number
  responder_name: string | null
  message: string | null
  payload: unknown
  is_current: boolean
  revision: number
  source: "invitado" | "admin"
  idempotency_key: string | null
  submitted_at: string
}

export type DeliveryLogAction =
  | "preparada"
  | "mensaje_copiado"
  | "enlace_copiado"
  | "abierta_whatsapp"
  | "marcada_enviada"
  | "omitida"
  | "token_regenerado"
  | "invitacion_deshabilitada"
  | "invitacion_habilitada"

export type DeliveryLogRecord = {
  id: string
  family_id: string
  kind: "invitacion" | "recordatorio"
  action: DeliveryLogAction
  channel: string
  message_preview: string | null
  performed_by: string | null
  created_at: string
}

export type AdminProfile = {
  id: string
  email: string
  full_name: string | null
  role: AdminRole
  is_active: boolean
}

/** Códigos de error devueltos por la función submit_rsvp. */
export type RsvpErrorCode =
  | "token_invalido"
  | "invitacion_deshabilitada"
  | "evento_no_encontrado"
  | "fuera_de_plazo"
  | "edicion_no_permitida"
  | "sin_asistentes"
  | "cupo_excedido"
  | "datos_invitado_invalidos"
  | "nombres_duplicados"
  | "invitado_ajeno"
  | "menu_faltante"
  | "menu_invalido"

export type SubmitRsvpResult =
  | {
      ok: true
      duplicate: boolean
      family_id: string
      status: RsvpStatus
      attendee_count: number
      children_count: number
      adults_count: number
      revision: number
    }
  | {
      ok: false
      code: RsvpErrorCode
      max_attendees?: number
      requested?: number
      missing?: number
      invalid?: number
      deadline?: string
    }

/** Mensajes en español para cada código de error. */
export const RSVP_ERROR_MESSAGE: Record<RsvpErrorCode, string> = {
  token_invalido: "Esta invitación no es válida o ya no está disponible.",
  invitacion_deshabilitada:
    "Esta invitación fue desactivada. Contacta a la familia anfitriona, por favor.",
  evento_no_encontrado: "No encontramos la información de la fiesta.",
  fuera_de_plazo: "El plazo para confirmar ya terminó. Escríbenos por WhatsApp, por favor.",
  edicion_no_permitida: "Tu confirmación ya fue registrada y no puede modificarse.",
  sin_asistentes: "Selecciona al menos una persona que asistirá.",
  cupo_excedido: "Superaste el número de personas autorizadas en esta invitación.",
  datos_invitado_invalidos: "Revisa los nombres: hay datos incompletos.",
  nombres_duplicados: "Hay nombres repetidos. Cada persona debe tener un nombre distinto.",
  invitado_ajeno: "Uno de los invitados no corresponde a esta familia.",
  menu_faltante: "Falta elegir el menú de alguna persona.",
  menu_invalido: "Uno de los menús elegidos no está disponible o no corresponde a la edad.",
}
