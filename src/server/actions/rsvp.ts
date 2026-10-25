"use server"

/**
 * Confirmación de asistencia por parte de las familias invitadas.
 *
 * Sin cuentas ni registro: el token de la URL es la credencial. Por eso
 * esta acción aplica límite de intentos, revalida todo en el servidor y
 * delega la escritura a la función transaccional submit_rsvp, donde la
 * base de datos vuelve a verificar el cupo y los menús.
 */
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { RSVP_ERROR_MESSAGE, type SubmitRsvpResult } from "@/lib/types"
import {
  fieldErrors,
  firstErrorMessage,
  rsvpSubmissionSchema,
  type RsvpSubmissionInput,
} from "@/lib/validation"
import { getClientIp, checkRateLimit, hashIp } from "../rate-limit"
import { createAdminSupabase } from "../supabase/server"
import { describeError, fail, ok, type ActionResult } from "./shared"

export type RsvpSuccess = {
  status: "confirmado" | "rechazado"
  attendeeCount: number
  childrenCount: number
  adultsCount: number
  revision: number
  duplicate: boolean
}

/** Hasta 12 envíos por IP cada 10 minutos. */
const RSVP_LIMIT = 12
const RSVP_WINDOW_MS = 10 * 60 * 1000

export async function submitRsvp(
  token: string,
  input: RsvpSubmissionInput,
): Promise<ActionResult<RsvpSuccess>> {
  if (!token || token.length < 16) {
    return fail(RSVP_ERROR_MESSAGE.token_invalido)
  }

  const requestHeaders = await headers()
  const ip = getClientIp(requestHeaders)
  const limit = checkRateLimit(`rsvp:${ip ?? "desconocida"}`, RSVP_LIMIT, RSVP_WINDOW_MS)

  if (!limit.allowed) {
    return fail(
      `Demasiados intentos seguidos. Espera ${limit.retryAfterSeconds} segundos e inténtalo otra vez.`,
    )
  }

  // Validación en el servidor, independiente de la del navegador.
  const parsed = rsvpSubmissionSchema.safeParse(input)
  if (!parsed.success) {
    return fail(firstErrorMessage(parsed.error), fieldErrors(parsed.error))
  }
  const data = parsed.data

  try {
    const supabase = createAdminSupabase()

    const payload = {
      attending: data.attending,
      responder_name: data.responder_name ?? null,
      message: data.message ?? null,
      attendees: data.attending
        ? data.attendees.map((attendee) => ({
            guest_id: attendee.guest_id ?? null,
            name: attendee.name,
            guest_type: attendee.guest_type,
            is_invited_child: attendee.is_invited_child,
            menu_item_id: attendee.menu_item_id,
          }))
        : [],
    }

    const { data: result, error } = await supabase.rpc("submit_rsvp", {
      p_token: token,
      p_payload: payload,
      p_idempotency_key: data.idempotency_key,
      p_ip_hash: hashIp(ip),
      p_user_agent: requestHeaders.get("user-agent")?.slice(0, 300) ?? null,
    })

    if (error) throw new Error(error.message)

    const outcome = result as SubmitRsvpResult | null
    if (!outcome) return fail("No pudimos registrar la confirmación. Intenta de nuevo.")

    if (!outcome.ok) {
      let message = RSVP_ERROR_MESSAGE[outcome.code] ?? "No pudimos registrar la confirmación."
      if (outcome.code === "cupo_excedido" && outcome.max_attendees !== undefined) {
        const personas = outcome.max_attendees === 1 ? "persona" : "personas"
        message = `Esta invitación permite un máximo de ${outcome.max_attendees} ${personas}.`
      }
      return fail(message)
    }

    revalidatePath(`/invitacion/${token}`)
    revalidatePath("/admin")
    revalidatePath("/admin/familias")
    revalidatePath("/admin/confirmaciones")
    revalidatePath("/admin/pedidos")
    revalidatePath("/admin/reportes")

    return ok({
      status: outcome.status === "confirmado" ? "confirmado" : "rechazado",
      attendeeCount: outcome.attendee_count,
      childrenCount: outcome.children_count,
      adultsCount: outcome.adults_count,
      revision: outcome.revision,
      duplicate: outcome.duplicate,
    })
  } catch (error) {
    return fail(describeError(error))
  }
}
