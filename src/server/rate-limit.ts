/**
 * Limitación de intentos en memoria.
 *
 * Protege los endpoints públicos (confirmación de asistencia y apertura
 * de invitaciones) de abuso y de fuerza bruta sobre los tokens.
 *
 * Al ser en memoria, el límite es por instancia del servidor. Para una
 * fiesta de 40 a 80 familias es suficiente. Si en el futuro hiciera
 * falta algo más estricto, puede sustituirse por Upstash Redis sin
 * cambiar la interfaz.
 */
import "server-only"
import { createHash } from "node:crypto"

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000

function cleanup(now: number) {
  if (buckets.size < MAX_BUCKETS) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * @param key      Identificador del solicitante (IP + acción).
 * @param limit    Intentos permitidos dentro de la ventana.
 * @param windowMs Duración de la ventana en milisegundos.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  cleanup(now)

  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 }
}

/** Sólo para pruebas. */
export function resetRateLimits(): void {
  buckets.clear()
}

/**
 * Hash de la IP para la auditoría: permite detectar abuso sin guardar
 * datos personales de las familias invitadas.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  return createHash("sha256").update(`mia-kpop:${ip}`).digest("hex").slice(0, 32)
}

/** IP del cliente a partir de las cabeceras del proxy. */
export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? null
}
