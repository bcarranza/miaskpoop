"use client"

/**
 * Cliente de Supabase para el navegador. Sólo usa la clave anónima,
 * que no tiene acceso directo a ninguna tabla (ver 0006_grants.sql):
 * sirve únicamente para iniciar y cerrar sesión de administradores.
 */
import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let cached: SupabaseClient | null = null

export function createBrowserSupabase(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Revisa tu archivo .env.local.",
    )
  }

  cached = createBrowserClient(url, anonKey)
  return cached
}
