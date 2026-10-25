/**
 * Clientes de Supabase para el servidor.
 *
 *  - createServerSupabase(): usa la sesión del administrador (cookies) y
 *    por lo tanto queda sujeto a las políticas RLS.
 *  - createAdminSupabase(): usa la clave de servicio. Sólo para código
 *    del servidor: flujos de invitados validados por token y operaciones
 *    administrativas. Nunca debe llegar al navegador.
 */
import "server-only"
import { createServerClient } from "@supabase/ssr"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env"

export class SupabaseNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `Supabase no está configurado. Falta definir: ${missing.join(", ")}. ` +
        "Copia .env.example a .env.local y completa los valores.",
    )
    this.name = "SupabaseNotConfiguredError"
  }
}

/** Cliente ligado a la sesión del administrador (respeta RLS). */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const url = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()

  if (!url || !anonKey) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !anonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    ].filter((v): v is string => v !== null)
    throw new SupabaseNotConfiguredError(missing)
  }

  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // En Server Components no se pueden escribir cookies; el
          // middleware se encarga de refrescar la sesión.
        }
      },
    },
  })
}

/**
 * Cliente con clave de servicio. Omite RLS, así que cada uso debe
 * aplicar sus propios controles (token de invitación o sesión de
 * administrador verificada).
 */
export function createAdminSupabase(): SupabaseClient {
  const url = getSupabaseUrl()
  const serviceKey = getSupabaseServiceRoleKey()

  if (!url || !serviceKey) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !serviceKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter((v): v is string => v !== null)
    throw new SupabaseNotConfiguredError(missing)
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** true si la aplicación puede hablar con la base de datos. */
export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey() && getSupabaseServiceRoleKey())
}
