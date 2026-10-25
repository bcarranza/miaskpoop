/** Pedido final para McDonald's en PDF, listo para imprimir o enviar. */
import { buildOrderPdf } from "@/lib/pdf/order"
import { getAdminSession } from "@/server/auth"
import {
  getEventTotals,
  getMenuOrderSummary,
  listFamilies,
  requireEvent,
} from "@/server/queries"

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return new Response("No autorizado", { status: 401 })
  }

  try {
    const [event, totals, order, families] = await Promise.all([
      requireEvent(),
      getEventTotals(),
      getMenuOrderSummary(),
      listFamilies({ includeArchived: false }),
    ])

    const incompleteFamilies = families
      .filter((family) => family.menu_incomplete)
      .map((family) => ({
        name: family.name,
        missing: Math.max(family.confirmed_attendees - family.menu_selections, 0),
      }))

    const pdf = await buildOrderPdf({
      event,
      totals,
      order,
      incompleteFamilies,
      generatedBy: session.profile.full_name ?? session.email,
    })

    const fileName = `pedido-mcdonalds-mia-${event.event_date}.pdf`

    return new Response(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al generar el PDF."
    return new Response(message, { status: 500 })
  }
}
