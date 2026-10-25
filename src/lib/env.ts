/**
 * Variables de entorno.
 *
 * Se leen de forma perezosa para que `next build` funcione aunque las
 * credenciales de Supabase todavía no estén configuradas. Si faltan, la
 * aplicación muestra instrucciones en vez de fallar con un error opaco.
 *
 * SUPABASE_SERVICE_ROLE_KEY nunca se expone al navegador: sólo se lee
 * desde código que corre en el servidor.
 */

export type EnvStatus = {
  configured: boolean
  missing: string[]
}

function read(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() !== "" ? value.trim() : undefined
}

export function getSupabaseUrl(): string | undefined {
  return read("NEXT_PUBLIC_SUPABASE_URL")
}

export function getSupabaseAnonKey(): string | undefined {
  return read("NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

export function getSupabaseServiceRoleKey(): string | undefined {
  if (typeof window !== "undefined") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no puede leerse en el navegador. Úsala sólo en el servidor.",
    )
  }
  return read("SUPABASE_SERVICE_ROLE_KEY")
}

/** URL pública del sitio, usada para construir los enlaces de invitación. */
export function getSiteUrl(): string {
  const explicit = read("NEXT_PUBLIC_SITE_URL")
  if (explicit) return explicit.replace(/\/+$/, "")

  // Vercel expone el dominio de producción y el de cada despliegue.
  const production = read("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL")
  if (production) return `https://${production.replace(/\/+$/, "")}`

  const vercel = read("NEXT_PUBLIC_VERCEL_URL") ?? read("VERCEL_URL")
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`

  return "http://localhost:3000"
}

/** Estado de la configuración del cliente público (navegador + servidor). */
export function getPublicEnvStatus(): EnvStatus {
  const missing: string[] = []
  if (!getSupabaseUrl()) missing.push("NEXT_PUBLIC_SUPABASE_URL")
  if (!getSupabaseAnonKey()) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  return { configured: missing.length === 0, missing }
}

/** Estado de la configuración completa, incluyendo la clave de servicio. */
export function getServerEnvStatus(): EnvStatus {
  const { missing } = getPublicEnvStatus()
  if (!getSupabaseServiceRoleKey()) missing.push("SUPABASE_SERVICE_ROLE_KEY")
  return { configured: missing.length === 0, missing }
}
