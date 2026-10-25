/**
 * Esquemas de validación compartidos entre el navegador y el servidor.
 * El servidor siempre vuelve a validar lo que llega del cliente.
 */
import { z } from "zod"
import { normalizePhone } from "./phone"

const nombre = (campo: string, max = 120) =>
  z
    .string({ error: `${campo} es obligatorio.` })
    .trim()
    .min(2, `${campo} debe tener al menos 2 caracteres.`)
    .max(max, `${campo} no puede pasar de ${max} caracteres.`)

/** Teléfono que se guarda siempre normalizado a E.164. */
export const phoneSchema = z
  .string({ error: "El número de WhatsApp es obligatorio." })
  .trim()
  .min(1, "El número de WhatsApp es obligatorio.")
  .transform((value, ctx) => {
    const result = normalizePhone(value)
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error })
      return z.NEVER
    }
    return result
  })

export const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null
    const result = normalizePhone(value)
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error })
      return z.NEVER
    }
    return result.e164
  })

export const MAX_ATTENDEES_LIMIT = 50

/** Cupo autorizado: lo decide la persona administradora, sin tope fijo
 *  por familia más allá de un límite de seguridad. */
export const maxAttendeesSchema = z.coerce
  .number({ error: "Indica cuántas personas puede traer la familia." })
  .int("El cupo debe ser un número entero.")
  .min(0, "El cupo no puede ser negativo.")
  .max(MAX_ATTENDEES_LIMIT, `El cupo no puede pasar de ${MAX_ATTENDEES_LIMIT} personas.`)

export const invitedChildSchema = z.object({
  id: z.uuid().optional(),
  name: nombre("El nombre del niño o niña", 80),
})

export const familyFormSchema = z
  .object({
    name: nombre("El nombre de la familia"),
    primary_contact_name: nombre("El nombre de la persona responsable"),
    whatsapp_phone: phoneSchema,
    secondary_contact_name: z.string().trim().max(120).optional().nullable(),
    secondary_contact_phone: optionalPhoneSchema,
    max_attendees: maxAttendeesSchema,
    invitation_enabled: z.boolean().default(true),
    notes: z.string().trim().max(1000).optional().nullable(),
    invited_children: z
      .array(invitedChildSchema)
      .max(20, "Máximo 20 niños invitados por familia.")
      .default([]),
  })
  .superRefine((data, ctx) => {
    const children = data.invited_children ?? []

    if (children.length > data.max_attendees) {
      ctx.addIssue({
        code: "custom",
        path: ["max_attendees"],
        message: `El cupo (${data.max_attendees}) debe incluir a los ${children.length} niños invitados.`,
      })
    }

    const seen = new Set<string>()
    children.forEach((child, index) => {
      const key = child.name.trim().toLocaleLowerCase("es")
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["invited_children", index, "name"],
          message: "Este nombre ya está en la lista.",
        })
      }
      seen.add(key)
    })
  })

export type FamilyFormInput = z.input<typeof familyFormSchema>
export type FamilyFormOutput = z.output<typeof familyFormSchema>

/** Un asistente confirmado y su menú. */
export const rsvpAttendeeSchema = z.object({
  guest_id: z.uuid().nullable().optional(),
  name: nombre("El nombre", 80),
  guest_type: z.enum(["nino", "adulto"], { error: "Indica si es niño o adulto." }),
  is_invited_child: z.boolean().default(false),
  menu_item_id: z.uuid({ error: "Elige un menú para esta persona." }),
})

export const rsvpSubmissionSchema = z
  .object({
    attending: z.boolean({ error: "Indica si asistirán." }),
    responder_name: z.string().trim().max(120).optional().nullable(),
    message: z.string().trim().max(500).optional().nullable(),
    attendees: z.array(rsvpAttendeeSchema).default([]),
    idempotency_key: z.string().trim().min(8).max(100),
  })
  .superRefine((data, ctx) => {
    if (!data.attending) return

    if (data.attendees.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["attendees"],
        message: "Selecciona al menos una persona que asistirá.",
      })
      return
    }

    const seen = new Set<string>()
    data.attendees.forEach((attendee, index) => {
      const key = attendee.name.trim().toLocaleLowerCase("es")
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["attendees", index, "name"],
          message: "Hay dos personas con el mismo nombre.",
        })
      }
      seen.add(key)
    })
  })

export type RsvpSubmissionInput = z.input<typeof rsvpSubmissionSchema>
export type RsvpSubmissionOutput = z.output<typeof rsvpSubmissionSchema>

export const menuItemFormSchema = z.object({
  id: z.uuid().optional(),
  code: z
    .string()
    .trim()
    .min(2, "El código es obligatorio.")
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Usa sólo minúsculas, números y guiones bajos."),
  name: nombre("El nombre del menú", 120),
  description: z.string().trim().max(400).optional().nullable(),
  audience: z.enum(["nino", "adulto"], { error: "Indica para quién es el menú." }),
  image_url: z.union([z.literal(""), z.url("La imagen debe ser una URL válida.")]).optional().nullable(),
  /** Precio opcional en quetzales; se guarda en centavos. */
  price: z
    .union([z.literal(""), z.coerce.number().min(0, "El precio no puede ser negativo.")])
    .optional()
    .nullable(),
  is_available: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
})

export type MenuItemFormInput = z.input<typeof menuItemFormSchema>

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6})$/, "Usa un color en formato #RRGGBB.")

export const eventSettingsSchema = z
  .object({
    name: nombre("El nombre del evento"),
    celebrant_name: nombre("El nombre de la cumpleañera", 80),
    celebrant_age: z.coerce
      .number({ error: "Indica la edad." })
      .int()
      .min(1, "La edad debe ser mayor a 0.")
      .max(120),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD."),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Usa el formato HH:MM."),
    timezone: z.string().trim().min(3).default("America/Guatemala"),
    venue_name: nombre("El nombre del lugar"),
    venue_address: nombre("La dirección del lugar", 200),
    venue_maps_url: z.union([z.literal(""), z.url("El enlace del mapa no es válido.")]).optional().nullable(),
    rsvp_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD."),
    allow_rsvp_edits: z.boolean().default(true),
    invitation_headline: z.string().trim().min(3).max(120),
    invitation_subheadline: z.string().trim().min(2).max(120),
    invitation_message: z.string().trim().min(5).max(600),
    whatsapp_invitation_template: z
      .string()
      .trim()
      .min(20, "La plantilla es demasiado corta.")
      .max(3000, "WhatsApp no admite mensajes tan largos."),
    whatsapp_reminder_template: z.string().trim().min(20).max(3000),
    theme_primary_color: hexColor,
    theme_secondary_color: hexColor,
    theme_accent_color: hexColor,
    background_image_url: z.union([z.literal(""), z.url()]).optional().nullable(),
    music_enabled: z.boolean().default(false),
    music_url: z.union([z.literal(""), z.url()]).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.rsvp_deadline > data.event_date) {
      ctx.addIssue({
        code: "custom",
        path: ["rsvp_deadline"],
        message: "La fecha límite no puede ser posterior a la fiesta.",
      })
    }
    if (!data.whatsapp_invitation_template.includes("{{RSVP_URL}}")) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp_invitation_template"],
        message: "La plantilla debe incluir {{RSVP_URL}} para que la familia pueda confirmar.",
      })
    }
    if (!data.whatsapp_reminder_template.includes("{{RSVP_URL}}")) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp_reminder_template"],
        message: "El recordatorio debe incluir {{RSVP_URL}}.",
      })
    }
  })

export type EventSettingsInput = z.input<typeof eventSettingsSchema>

/** Primer mensaje de error de un ZodError, listo para mostrar. */
export function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos ingresados."
}

/** Errores agrupados por campo, para formularios. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".")
    if (!(key in result)) result[key] = issue.message
  }
  return result
}
