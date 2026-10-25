/**
 * Envío asistido por WhatsApp desde una Mac.
 *
 * No se usa la API de WhatsApp Business, ni Twilio, ni proveedores de
 * pago, ni librerías no oficiales, ni automatización del navegador.
 * Sólo se construyen enlaces "click to chat" oficiales; la persona
 * administradora presiona Enviar manualmente.
 *
 *   https://wa.me/<numero>?text=<mensaje>        (WhatsApp Web / app)
 *   whatsapp://send?phone=<numero>&text=<mensaje> (app de escritorio)
 */
import { formatLongDate, formatTime } from "./date"
import { normalizePhone } from "./phone"
import type { EventRecord, FamilyRecord } from "./types"

/** Datos mínimos de la familia necesarios para armar el mensaje. */
export type WhatsAppFamilyInput = Pick<
  FamilyRecord,
  "name" | "primary_contact_name" | "whatsapp_phone" | "max_attendees"
> & {
  invited_children_names?: string[] | null
}

/** Datos mínimos del evento necesarios para armar el mensaje. */
export type WhatsAppEventInput = Pick<
  EventRecord,
  | "celebrant_name"
  | "celebrant_age"
  | "event_date"
  | "start_time"
  | "timezone"
  | "venue_name"
  | "venue_address"
  | "rsvp_deadline"
  | "whatsapp_invitation_template"
  | "whatsapp_reminder_template"
>

export type WhatsAppLink = {
  ok: true
  /** Mensaje ya personalizado, tal como se verá en WhatsApp. */
  message: string
  /** Enlace oficial wa.me (abre WhatsApp Web o la app según el sistema). */
  href: string
  /** Enlace con el esquema de la app; en macOS suele abrir WhatsApp Desktop. */
  desktopHref: string
  /** Número en E.164, para mostrarlo. */
  phoneE164: string
  /** Sólo dígitos, como lo exige wa.me. */
  phoneDigits: string
}

export type WhatsAppLinkError = { ok: false; error: string }

export type WhatsAppLinkResult = WhatsAppLink | WhatsAppLinkError

/** Une nombres en español: "Ana", "Ana y Luis", "Ana, Luis y Sofía". */
export function joinNames(names: readonly string[]): string {
  const clean = names.map((n) => n.trim()).filter((n) => n.length > 0)
  if (clean.length === 0) return ""
  if (clean.length === 1) return clean[0]
  if (clean.length === 2) return `${clean[0]} y ${clean[1]}`
  return `${clean.slice(0, -1).join(", ")} y ${clean[clean.length - 1]}`
}

/**
 * Cómo se menciona a los niños invitados dentro del texto de cupos.
 * Evita suposiciones de género y respeta singular/plural.
 */
export function buildInvitedChildrenLabel(names: readonly string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean)
  if (clean.length === 0) return "incluyendo a las personas invitadas"
  if (clean.length === 1) return `incluyendo a ${clean[0]}`
  return "incluyendo a los niños invitados"
}

/** Texto alternativo cuando la familia no tiene niños precargados. */
const FALLBACK_CHILDREN_NAMES = "su familia"

export type TemplateTokens = Record<string, string>

/** Valores de reemplazo para las plantillas de WhatsApp. */
export function buildTemplateTokens(
  family: WhatsAppFamilyInput,
  event: WhatsAppEventInput,
  invitationUrl: string,
): TemplateTokens {
  const children = (family.invited_children_names ?? []).filter(
    (name): name is string => typeof name === "string" && name.trim().length > 0,
  )

  return {
    FAMILY_NAME: family.name,
    CONTACT_NAME: family.primary_contact_name,
    CELEBRANT_NAME: event.celebrant_name,
    CELEBRANT_NAME_UPPER: event.celebrant_name.toLocaleUpperCase("es-GT"),
    CELEBRANT_AGE: String(event.celebrant_age),
    INVITED_CHILDREN_NAMES: children.length > 0 ? joinNames(children) : FALLBACK_CHILDREN_NAMES,
    INVITED_CHILDREN_LABEL: buildInvitedChildrenLabel(children),
    INVITED_CHILDREN_COUNT: String(children.length),
    EVENT_DATE: formatLongDate(event.event_date),
    EVENT_TIME: formatTime(event.start_time),
    VENUE: `${event.venue_name}, ${event.venue_address}`,
    VENUE_NAME: event.venue_name,
    VENUE_ADDRESS: event.venue_address,
    MAX_ATTENDEES: String(family.max_attendees),
    // Concordancia singular/plural
    PERSONAS: family.max_attendees === 1 ? "persona" : "personas",
    NINOS: children.length === 1 ? "niño invitado" : "niños invitados",
    RSVP_URL: invitationUrl,
    UNIQUE_RSVP_URL: invitationUrl,
    RSVP_DEADLINE: formatLongDate(event.rsvp_deadline),
  }
}

/** Sustituye los marcadores {{TOKEN}} de una plantilla. */
export function renderTemplate(template: string, tokens: TemplateTokens): string {
  return template.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (match, key: string) => {
    const value = tokens[key]
    return value === undefined ? match : value
  })
}

/** Marcadores disponibles, para mostrarlos en el panel de configuración. */
export const TEMPLATE_TOKEN_HELP: { token: string; description: string }[] = [
  { token: "{{FAMILY_NAME}}", description: "Apellido o nombre de la familia" },
  { token: "{{CONTACT_NAME}}", description: "Nombre de la persona responsable" },
  { token: "{{CELEBRANT_NAME}}", description: "Nombre de la cumpleañera" },
  { token: "{{CELEBRANT_NAME_UPPER}}", description: "Nombre en mayúsculas: MÍA" },
  { token: "{{CELEBRANT_AGE}}", description: "Edad que cumple" },
  { token: "{{INVITED_CHILDREN_NAMES}}", description: "Niños invitados: «Sofía y Mateo»" },
  {
    token: "{{INVITED_CHILDREN_LABEL}}",
    description: "«incluyendo a Sofía» o «incluyendo a los niños invitados»",
  },
  { token: "{{EVENT_DATE}}", description: "jueves 12 de noviembre de 2026" },
  { token: "{{EVENT_TIME}}", description: "2:00 p. m." },
  { token: "{{VENUE}}", description: "Lugar completo con dirección" },
  { token: "{{MAX_ATTENDEES}}", description: "Cupo autorizado de la familia" },
  { token: "{{PERSONAS}}", description: "«persona» o «personas» según el cupo" },
  { token: "{{RSVP_URL}}", description: "Enlace único de confirmación" },
  { token: "{{RSVP_DEADLINE}}", description: "Fecha límite para confirmar" },
]

function buildLinks(phoneDigits: string, message: string) {
  // encodeURIComponent conserva emojis y tildes correctamente.
  const encoded = encodeURIComponent(message)
  return {
    href: `https://wa.me/${phoneDigits}?text=${encoded}`,
    desktopHref: `whatsapp://send?phone=${phoneDigits}&text=${encoded}`,
  }
}

/**
 * Construye el enlace de invitación personalizado para una familia.
 *
 * Es la utilidad central solicitada: valida el teléfono, normaliza a
 * +502 por omisión, arma el mensaje con la plantilla del evento e
 * incluye la URL única de confirmación de esa familia.
 */
export function buildWhatsAppInvitationLink(
  family: WhatsAppFamilyInput,
  event: WhatsAppEventInput,
  invitationUrl: string,
): WhatsAppLinkResult {
  const phone = normalizePhone(family.whatsapp_phone)
  if (!phone.ok) {
    return { ok: false, error: phone.error }
  }
  if (!invitationUrl || !/^https?:\/\//i.test(invitationUrl)) {
    return { ok: false, error: "El enlace de invitación no es válido." }
  }

  const tokens = buildTemplateTokens(family, event, invitationUrl)
  const message = renderTemplate(event.whatsapp_invitation_template, tokens)

  return {
    ok: true,
    message,
    phoneE164: phone.e164,
    phoneDigits: phone.digits,
    ...buildLinks(phone.digits, message),
  }
}

/** Igual que la invitación, pero con la plantilla de recordatorio. */
export function buildWhatsAppReminderLink(
  family: WhatsAppFamilyInput,
  event: WhatsAppEventInput,
  invitationUrl: string,
): WhatsAppLinkResult {
  const phone = normalizePhone(family.whatsapp_phone)
  if (!phone.ok) {
    return { ok: false, error: phone.error }
  }
  if (!invitationUrl || !/^https?:\/\//i.test(invitationUrl)) {
    return { ok: false, error: "El enlace de invitación no es válido." }
  }

  const tokens = buildTemplateTokens(family, event, invitationUrl)
  const message = renderTemplate(event.whatsapp_reminder_template, tokens)

  return {
    ok: true,
    message,
    phoneE164: phone.e164,
    phoneDigits: phone.digits,
    ...buildLinks(phone.digits, message),
  }
}

/** URL pública de la invitación de una familia. */
export function buildInvitationUrl(baseUrl: string, token: string): string {
  const normalized = baseUrl.replace(/\/+$/, "")
  return `${normalized}/invitacion/${token}`
}
