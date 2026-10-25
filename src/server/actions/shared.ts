import "server-only"
import { createAdminSupabase } from "../supabase/server"

/** Resultado uniforme de las Server Actions. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

export function ok(): ActionResult
export function ok<T>(data: T): ActionResult<T>
export function ok<T>(data?: T) {
  return { ok: true, data } as ActionResult<T>
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors }
}

/** Convierte errores inesperados en un mensaje presentable. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    // Restricciones de la base de datos con mensajes ya redactados
    if (error.message.includes("Cupo excedido")) return error.message
    if (error.message.includes("duplicate key")) {
      if (error.message.includes("families_event_name_key")) {
        return "Ya existe una familia con ese nombre."
      }
      if (error.message.includes("guests_family_name_key")) {
        return "Ya existe una persona con ese nombre en la familia."
      }
      if (error.message.includes("menu_items_event_id_code_key")) {
        return "Ya existe un menú con ese código."
      }
      return "Ese registro ya existe."
    }
    return error.message
  }
  return "Ocurrió un error inesperado. Intenta de nuevo."
}

export type AuditEntry = {
  eventId?: string | null
  entityType: string
  entityId?: string | null
  action: string
  actorType: "admin" | "invitado" | "sistema"
  actorId?: string | null
  actorLabel?: string | null
  before?: unknown
  after?: unknown
  metadata?: unknown
}

/** Registro de auditoría. Nunca interrumpe la operación principal. */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminSupabase()
    await supabase.from("audit_logs").insert({
      event_id: entry.eventId ?? null,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      action: entry.action,
      actor_type: entry.actorType,
      actor_id: entry.actorId ?? null,
      actor_label: entry.actorLabel ?? null,
      before_data: entry.before ?? null,
      after_data: entry.after ?? null,
      metadata: entry.metadata ?? null,
    })
  } catch (error) {
    console.error("No se pudo escribir en audit_logs:", describeError(error))
  }
}

/** Token de invitación criptográficamente seguro (192 bits, base64url). */
export function generateInvitationToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
