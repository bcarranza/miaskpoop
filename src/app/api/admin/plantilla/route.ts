/** Descarga de la plantilla de importación de familias. */
import { buildImportTemplate } from "@/lib/excel/workbook"
import { getAdminSession } from "@/server/auth"

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return new Response("No autorizado", { status: 401 })
  }

  const buffer = await buildImportTemplate()

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-familias-mia-kpop.xlsx"',
      "Cache-Control": "no-store",
    },
  })
}
