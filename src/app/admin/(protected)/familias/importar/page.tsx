import type { Metadata } from "next"
import { ImportWizard } from "@/components/admin/import-wizard"
import { PageHeader } from "@/components/admin/page-header"

export const metadata: Metadata = { title: "Importar familias" }

export default function ImportFamiliesPage() {
  return (
    <>
      <PageHeader
        title="Importar familias desde Excel"
        description="Sube tu lista en .xlsx o .csv. Antes de guardar nada verás una previsualización con errores, advertencias y duplicados."
        backHref="/admin/familias"
        backLabel="Familias"
      />

      <div className="max-w-5xl">
        <ImportWizard />
      </div>
    </>
  )
}
