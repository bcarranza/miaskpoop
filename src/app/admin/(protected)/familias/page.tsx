import { Download, FileUp, Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { FamilyTable } from "@/components/admin/family-table"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { listFamilies } from "@/server/queries"

export const metadata: Metadata = { title: "Familias" }

export default async function FamiliesPage({
  searchParams,
}: PageProps<"/admin/familias">) {
  const query = await searchParams
  const single = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value

  const families = await listFamilies({
    includeArchived: single(query.archivadas) === "1",
  })

  return (
    <>
      <PageHeader
        title="Familias"
        description="Cada familia tiene su propio cupo autorizado y su enlace único de invitación."
      >
        <Button render={<Link href="/admin/familias/nueva" />} className="rounded-xl">
          <Plus className="mr-1.5 size-4" aria-hidden />
          Nueva familia
        </Button>
        <Button
          render={<Link href="/admin/familias/importar" />}
          variant="outline"
          className="rounded-xl"
        >
          <FileUp className="mr-1.5 size-4" aria-hidden />
          Importar Excel
        </Button>
        <Button
          render={<a href="/api/admin/exportar?tipo=familias" />}
          variant="outline"
          className="rounded-xl"
        >
          <Download className="mr-1.5 size-4" aria-hidden />
          Exportar
        </Button>
      </PageHeader>

      <FamilyTable
        families={families}
        initialSearch={single(query.buscar) ?? ""}
        initialReviewOnly={single(query.revision) === "1"}
        showArchived={single(query.archivadas) === "1"}
      />
    </>
  )
}
