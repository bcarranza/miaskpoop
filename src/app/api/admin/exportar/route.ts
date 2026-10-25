/**
 * Exportación a Excel de familias, asistentes, menús y pedido.
 *
 * Los datos se leen con la sesión del administrador, así que RLS sigue
 * aplicando y una persona sin permisos no obtiene nada.
 */
import {
  buildExportFileName,
  buildExportSheets,
  EXPORT_LABELS,
  type ExportKind,
} from "@/lib/excel/export"
import { buildWorkbook } from "@/lib/excel/workbook"
import { getAdminSession } from "@/server/auth"
import {
  getEventTotals,
  getMenuOrderSummary,
  listConfirmedAttendees,
  listFamilies,
  requireEvent,
} from "@/server/queries"

const VALID_KINDS = Object.keys(EXPORT_LABELS) as ExportKind[]

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return new Response("No autorizado", { status: 401 })
  }

  const url = new URL(request.url)
  const requested = url.searchParams.get("tipo") ?? "familias"

  if (!VALID_KINDS.includes(requested as ExportKind)) {
    return new Response(
      `Tipo de exportación no válido. Opciones: ${VALID_KINDS.join(", ")}`,
      { status: 400 },
    )
  }
  const kind = requested as ExportKind

  try {
    const [event, totals, families, attendees, order] = await Promise.all([
      requireEvent(),
      getEventTotals(),
      listFamilies({ includeArchived: false }),
      listConfirmedAttendees(),
      getMenuOrderSummary(),
    ])

    const sheets = buildExportSheets(kind, { event, totals, families, attendees, order })
    const buffer = await buildWorkbook(sheets)

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${buildExportFileName(kind)}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al exportar."
    return new Response(message, { status: 500 })
  }
}
