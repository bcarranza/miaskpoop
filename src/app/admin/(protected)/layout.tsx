import { requireAdmin } from "@/server/auth"
import { AdminShell } from "@/components/admin/admin-shell"
import { getEvent } from "@/server/queries"

export const dynamic = "force-dynamic"

export default async function AdminProtectedLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin()
  const event = await getEvent()

  return (
    <AdminShell
      email={session.email}
      fullName={session.profile.full_name}
      role={session.profile.role}
      eventName={event?.name ?? "Mía's K-pop Party"}
    >
      {children}
    </AdminShell>
  )
}
