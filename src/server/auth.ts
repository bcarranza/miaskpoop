/**
 * Autenticación y autorización de administradores.
 *
 * Toda ruta y acción administrativa pasa por aquí. Una sesión válida de
 * Supabase no basta: además debe existir un perfil activo en
 * admin_profiles.
 */
import "server-only"
import { redirect } from "next/navigation"
import { cache } from "react"
import type { AdminProfile } from "@/lib/types"
import { createServerSupabase, SupabaseNotConfiguredError } from "./supabase/server"

export type AdminSession = {
  userId: string
  email: string
  profile: AdminProfile
}

/** Devuelve la sesión administrativa vigente, o null. */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  let supabase
  try {
    supabase = await createServerSupabase()
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return null
    throw error
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle<AdminProfile>()

  if (!profile || !profile.is_active) return null

  return { userId: user.id, email: user.email ?? profile.email, profile }
})

/** Exige una sesión administrativa; si no existe, redirige al login. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) redirect("/admin/login")
  return session
}

/** Exige permisos de escritura (roles owner o admin). */
export async function requireWriteAccess(): Promise<AdminSession> {
  const session = await requireAdmin()
  if (session.profile.role === "viewer") {
    throw new Error("Tu cuenta tiene permisos de sólo lectura.")
  }
  return session
}

/**
 * Igual que requireWriteAccess pero devuelve un error en lugar de
 * lanzarlo: para usar dentro de Server Actions.
 */
export async function assertWriteAccess(): Promise<
  { ok: true; session: AdminSession } | { ok: false; error: string }
> {
  const session = await getAdminSession()
  if (!session) {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." }
  }
  if (session.profile.role === "viewer") {
    return { ok: false, error: "Tu cuenta tiene permisos de sólo lectura." }
  }
  return { ok: true, session }
}
