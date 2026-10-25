import type { Metadata } from "next"
import { FamilyForm } from "@/components/admin/family-form"
import { PageHeader } from "@/components/admin/page-header"

export const metadata: Metadata = { title: "Nueva familia" }

export default function NewFamilyPage() {
  return (
    <>
      <PageHeader
        title="Nueva familia"
        description="Define el cupo autorizado y agrega a los niños invitados. El enlace de invitación se genera automáticamente."
        backHref="/admin/familias"
        backLabel="Familias"
      />

      <div className="max-w-3xl">
        <FamilyForm />
      </div>
    </>
  )
}
