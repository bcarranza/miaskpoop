import { Info } from "lucide-react"
import type { Metadata } from "next"
import { MenuManager } from "@/components/admin/menu-manager"
import { PageHeader } from "@/components/admin/page-header"
import { getAdminSession } from "@/server/auth"
import { getMenuOrderSummary, listMenuItems } from "@/server/queries"

export const metadata: Metadata = { title: "Menús" }

export default async function MenusPage() {
  const [menus, order, session] = await Promise.all([
    listMenuItems(),
    getMenuOrderSummary(),
    getAdminSession(),
  ])

  const canWrite = session?.profile.role !== "viewer"

  return (
    <>
      <PageHeader
        title="Menús de McDonald's"
        description="Catálogo que verán las familias al confirmar. Los menús de adultos y las Cajitas Felices se muestran por separado según la edad de cada asistente."
      />

      <div className="mb-6 flex items-start gap-2 rounded-2xl border border-mcd-yellow/50 bg-mcd-yellow/10 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
        <div>
          <p className="font-semibold text-amber-800">
            Los precios, bebidas y acompañamientos deben confirmarse con el restaurante.
          </p>
          <p className="mt-1 text-amber-900/80">
            El catálogo inicial sólo tiene los nombres de los seis menús. Si configuras precios,
            los reportes y el PDF mostrarán un costo estimado, siempre marcado como referencial.
          </p>
        </div>
      </div>

      <MenuManager menus={menus} order={order} canWrite={canWrite} />

      <p className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Si deshabilitas un menú que alguna familia ya eligió, su selección{" "}
        <span className="font-semibold text-foreground">no se reemplaza</span>: la familia queda
        marcada para revisión y podrás acordar el cambio con ellos por WhatsApp.
      </p>
    </>
  )
}
