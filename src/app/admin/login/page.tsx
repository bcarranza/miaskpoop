import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuroraBlobs, DiscoBall, StarField } from "@/components/kpop/decor"
import { LoginForm } from "@/components/admin/login-form"
import { SetupNotice } from "@/components/setup-notice"
import { getServerEnvStatus } from "@/lib/env"
import { getAdminSession } from "@/server/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Iniciar sesión",
}

export default async function AdminLoginPage() {
  const env = getServerEnvStatus()
  if (!env.configured) {
    return <SetupNotice missing={env.missing} />
  }

  const session = await getAdminSession()
  if (session) redirect("/admin")

  return (
    <main className="kpop-stage relative flex min-h-dvh items-center justify-center overflow-hidden p-5">
      <AuroraBlobs />
      <StarField />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <DiscoBall size={64} />
          <h1 className="kpop-gradient-text mt-2 font-heading text-2xl font-black">
            Mía&apos;s K-pop Party
          </h1>
          <p className="text-sm text-lavender">Panel de administración</p>
        </div>

        <div className="kpop-glass rounded-3xl p-6">
          <LoginForm />
        </div>

        <p className="mt-5 text-center text-xs text-lavender/60">
          El primer usuario que se registre en Supabase Auth queda como propietario del panel.
        </p>
      </div>
    </main>
  )
}
