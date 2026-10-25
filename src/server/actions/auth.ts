"use server"

/** Inicio y cierre de sesión de administradores. */
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { checkRateLimit, getClientIp } from "../rate-limit"
import { createServerSupabase, SupabaseNotConfiguredError } from "../supabase/server"
import { fail, ok, type ActionResult } from "./shared"

const credentialsSchema = z.object({
  email: z.string().trim().pipe(z.email("Escribe un correo válido.")),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
})

/** Cinco intentos por IP cada diez minutos. */
const LOGIN_LIMIT = 5
const LOGIN_WINDOW_MS = 10 * 60 * 1000

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = credentialsSchema.safeParse({ email, password })
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Revisa tus datos.")
  }

  const requestHeaders = await headers()
  const ip = getClientIp(requestHeaders)
  const limit = checkRateLimit(`login:${ip ?? "desconocida"}`, LOGIN_LIMIT, LOGIN_WINDOW_MS)

  if (!limit.allowed) {
    return fail(
      `Demasiados intentos. Espera ${Math.ceil(limit.retryAfterSeconds / 60)} minuto(s) antes de volver a intentar.`,
    )
  }

  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error || !data.user) {
      // Mensaje genérico: no se revela si el correo existe.
      return fail("Correo o contraseña incorrectos.")
    }

    const { data: profile } = await supabase
      .from("admin_profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle<{ is_active: boolean }>()

    if (!profile) {
      await supabase.auth.signOut()
      return fail("Tu cuenta no tiene perfil de administrador. Pide que te habiliten el acceso.")
    }
    if (!profile.is_active) {
      await supabase.auth.signOut()
      return fail("Tu cuenta está desactivada. Pide a la cuenta propietaria que la habilite.")
    }

    revalidatePath("/admin", "layout")
    return ok({ redirectTo: "/admin" })
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return fail(error.message)
    }
    return fail("No pudimos iniciar sesión. Intenta de nuevo.")
  }
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createServerSupabase()
    await supabase.auth.signOut()
  } catch {
    // Sin configuración no hay sesión que cerrar.
  }
  revalidatePath("/admin", "layout")
  redirect("/admin/login")
}
