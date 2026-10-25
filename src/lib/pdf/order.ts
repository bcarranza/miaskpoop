/**
 * Pedido final para McDonald's en PDF.
 *
 * Documento de una página, pensado para imprimir o enviar al
 * restaurante. Las cantidades provienen de las confirmaciones reales
 * guardadas en la base de datos.
 *
 * Los precios sólo aparecen si fueron configurados en /admin/menus:
 * el sistema nunca inventa precios, bebidas ni acompañamientos.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib"
import { formatLongDate, formatTime } from "../date"
import type { EventRecord, EventTotals, MenuOrderRow } from "../types"

const PINK = rgb(1, 0.18, 0.6)
const PURPLE = rgb(0.66, 0.33, 0.97)
const DARK = rgb(0.13, 0.08, 0.2)
const GRAY = rgb(0.42, 0.42, 0.48)
const LIGHT = rgb(0.96, 0.94, 0.99)
const WHITE = rgb(1, 1, 1)

const PAGE_WIDTH = 595.28 // A4
const PAGE_HEIGHT = 841.89
const MARGIN = 48

/**
 * Helvetica usa WinAnsi, que no cubre todos los caracteres Unicode.
 * Se sustituyen los que podrían aparecer en los textos de la fiesta.
 */
function toWinAnsi(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    // Emojis y otros símbolos fuera de Latin-1
    .replace(/[^\u0000-\u00FF]/g, "")
}

type DrawTextOptions = {
  x: number
  y: number
  size?: number
  font?: PDFFont
  color?: ReturnType<typeof rgb>
}

export type OrderPdfInput = {
  event: EventRecord
  totals: EventTotals
  order: MenuOrderRow[]
  /** Familias con asistentes sin menú, para advertir en el documento. */
  incompleteFamilies?: { name: string; missing: number }[]
  generatedBy?: string | null
}

export async function buildOrderPdf(input: OrderPdfInput): Promise<Uint8Array> {
  const { event, totals, order, incompleteFamilies = [], generatedBy } = input

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Pedido McDonald's — ${event.name}`)
  pdf.setSubject("Pedido de menús para fiesta infantil")
  pdf.setCreator("Mía's K-pop Party")

  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let cursorY = PAGE_HEIGHT

  const text = (value: string, options: DrawTextOptions) => {
    page.drawText(toWinAnsi(value), {
      x: options.x,
      y: options.y,
      size: options.size ?? 10,
      font: options.font ?? regular,
      color: options.color ?? DARK,
    })
  }

  const widthOf = (value: string, size: number, font: PDFFont) =>
    font.widthOfTextAtSize(toWinAnsi(value), size)

  const newPageIfNeeded = (needed: number) => {
    if (cursorY - needed > MARGIN) return
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    cursorY = PAGE_HEIGHT - MARGIN
  }

  // ------------------------------------------------------------------
  // Encabezado
  // ------------------------------------------------------------------
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 110,
    width: PAGE_WIDTH,
    height: 110,
    color: PINK,
  })
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 116,
    width: PAGE_WIDTH,
    height: 6,
    color: PURPLE,
  })

  text("PEDIDO PARA MCDONALD'S", {
    x: MARGIN,
    y: PAGE_HEIGHT - 48,
    size: 20,
    font: bold,
    color: WHITE,
  })
  text(event.name, {
    x: MARGIN,
    y: PAGE_HEIGHT - 70,
    size: 12,
    font: regular,
    color: WHITE,
  })
  text(
    `${event.celebrant_name} cumple ${event.celebrant_age} anos`,
    { x: MARGIN, y: PAGE_HEIGHT - 88, size: 10, color: WHITE },
  )

  cursorY = PAGE_HEIGHT - 150

  // ------------------------------------------------------------------
  // Datos del evento
  // ------------------------------------------------------------------
  const details: [string, string][] = [
    ["Fecha", formatLongDate(event.event_date)],
    ["Hora", formatTime(event.start_time)],
    ["Lugar", `${event.venue_name}, ${event.venue_address}`],
  ]

  for (const [label, value] of details) {
    text(`${label}:`, { x: MARGIN, y: cursorY, size: 10, font: bold, color: GRAY })
    text(value, { x: MARGIN + 52, y: cursorY, size: 10 })
    cursorY -= 16
  }

  cursorY -= 10

  // ------------------------------------------------------------------
  // Totales de asistencia
  // ------------------------------------------------------------------
  const boxHeight = 56
  const boxWidth = (PAGE_WIDTH - MARGIN * 2 - 16) / 3
  const summaryBoxes: [string, number][] = [
    ["Asistentes totales", totals.confirmed_attendees],
    ["Adultos", totals.confirmed_adults],
    ["Ninos", totals.confirmed_children],
  ]

  summaryBoxes.forEach(([label, value], index) => {
    const x = MARGIN + index * (boxWidth + 8)
    page.drawRectangle({
      x,
      y: cursorY - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: LIGHT,
    })
    text(String(value), {
      x: x + 12,
      y: cursorY - 30,
      size: 22,
      font: bold,
      color: PINK,
    })
    text(label, { x: x + 12, y: cursorY - 46, size: 9, color: GRAY })
  })

  cursorY -= boxHeight + 28

  // ------------------------------------------------------------------
  // Tabla de menús
  // ------------------------------------------------------------------
  const hasPrices = order.some((row) => row.price_cents !== null)
  const colMenuX = MARGIN
  const colQtyX = hasPrices ? PAGE_WIDTH - MARGIN - 190 : PAGE_WIDTH - MARGIN - 70
  const colPriceX = PAGE_WIDTH - MARGIN - 130
  const colSubtotalX = PAGE_WIDTH - MARGIN - 60

  const drawTableHeader = (title: string) => {
    newPageIfNeeded(80)
    text(title, { x: MARGIN, y: cursorY, size: 12, font: bold, color: PURPLE })
    cursorY -= 18

    page.drawRectangle({
      x: MARGIN,
      y: cursorY - 4,
      width: PAGE_WIDTH - MARGIN * 2,
      height: 20,
      color: LIGHT,
    })
    text("Menu", { x: colMenuX + 6, y: cursorY + 2, size: 9, font: bold, color: GRAY })
    text("Cantidad", { x: colQtyX, y: cursorY + 2, size: 9, font: bold, color: GRAY })
    if (hasPrices) {
      text("Precio", { x: colPriceX, y: cursorY + 2, size: 9, font: bold, color: GRAY })
      text("Subtotal", { x: colSubtotalX, y: cursorY + 2, size: 9, font: bold, color: GRAY })
    }
    cursorY -= 22
  }

  const drawMenuRow = (row: MenuOrderRow) => {
    newPageIfNeeded(26)
    const name = row.is_available ? row.name : `${row.name} (no disponible)`
    text(name, { x: colMenuX + 6, y: cursorY, size: 10 })
    text(String(row.quantity), { x: colQtyX, y: cursorY, size: 10, font: bold })
    if (hasPrices) {
      text(row.price_cents === null ? "-" : `Q ${(row.price_cents / 100).toFixed(2)}`, {
        x: colPriceX,
        y: cursorY,
        size: 9,
        color: GRAY,
      })
      text(
        row.subtotal_cents === null ? "-" : `Q ${(row.subtotal_cents / 100).toFixed(2)}`,
        { x: colSubtotalX, y: cursorY, size: 9 },
      )
    }
    cursorY -= 18
  }

  const drawSubtotal = (label: string, quantity: number, cents: number | null) => {
    page.drawLine({
      start: { x: MARGIN, y: cursorY + 12 },
      end: { x: PAGE_WIDTH - MARGIN, y: cursorY + 12 },
      thickness: 0.5,
      color: GRAY,
    })
    text(label, { x: colMenuX + 6, y: cursorY, size: 10, font: bold })
    text(String(quantity), { x: colQtyX, y: cursorY, size: 10, font: bold })
    if (hasPrices && cents !== null) {
      text(`Q ${(cents / 100).toFixed(2)}`, {
        x: colSubtotalX,
        y: cursorY,
        size: 10,
        font: bold,
      })
    }
    cursorY -= 26
  }

  const adults = order.filter((row) => row.audience === "adulto")
  const children = order.filter((row) => row.audience === "nino")

  const sumQuantity = (rows: MenuOrderRow[]) => rows.reduce((sum, r) => sum + r.quantity, 0)
  const sumCents = (rows: MenuOrderRow[]) =>
    rows.some((r) => r.price_cents !== null)
      ? rows.reduce((sum, r) => sum + (r.subtotal_cents ?? 0), 0)
      : null

  drawTableHeader("MENUS PARA ADULTOS")
  for (const row of adults) drawMenuRow(row)
  drawSubtotal("Total menus de adultos", sumQuantity(adults), sumCents(adults))

  drawTableHeader("CAJITA FELIZ (NINOS)")
  for (const row of children) drawMenuRow(row)
  drawSubtotal("Total Cajitas Felices", sumQuantity(children), sumCents(children))

  // ------------------------------------------------------------------
  // Gran total
  // ------------------------------------------------------------------
  newPageIfNeeded(70)
  page.drawRectangle({
    x: MARGIN,
    y: cursorY - 34,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 40,
    color: PINK,
  })
  text("TOTAL DE MENUS", {
    x: MARGIN + 12,
    y: cursorY - 20,
    size: 13,
    font: bold,
    color: WHITE,
  })

  const totalLabel = String(totals.total_menus_selected)
  text(totalLabel, {
    x: PAGE_WIDTH - MARGIN - 16 - widthOf(totalLabel, 18, bold),
    y: cursorY - 24,
    size: 18,
    font: bold,
    color: WHITE,
  })
  cursorY -= 56

  if (hasPrices) {
    const grandTotal = order.reduce((sum, row) => sum + (row.subtotal_cents ?? 0), 0)
    text(
      `Estimado de costo con los precios configurados: Q ${(grandTotal / 100).toFixed(2)}`,
      { x: MARGIN, y: cursorY, size: 10, font: bold },
    )
    cursorY -= 14
    text("Este monto es referencial y debe confirmarse con el restaurante.", {
      x: MARGIN,
      y: cursorY,
      size: 8,
      color: GRAY,
    })
    cursorY -= 20
  }

  // ------------------------------------------------------------------
  // Advertencias
  // ------------------------------------------------------------------
  if (totals.missing_menus > 0 || incompleteFamilies.length > 0) {
    newPageIfNeeded(80)
    text("PENDIENTES ANTES DE CERRAR EL PEDIDO", {
      x: MARGIN,
      y: cursorY,
      size: 11,
      font: bold,
      color: PURPLE,
    })
    cursorY -= 16

    if (totals.missing_menus > 0) {
      text(
        `Faltan ${totals.missing_menus} menu(s) por elegir entre los asistentes confirmados.`,
        { x: MARGIN, y: cursorY, size: 9, color: GRAY },
      )
      cursorY -= 14
    }

    for (const family of incompleteFamilies.slice(0, 12)) {
      text(`- Familia ${family.name}: ${family.missing} menu(s) sin elegir.`, {
        x: MARGIN + 8,
        y: cursorY,
        size: 9,
        color: GRAY,
      })
      cursorY -= 12
      newPageIfNeeded(30)
    }

    if (incompleteFamilies.length > 12) {
      text(`... y ${incompleteFamilies.length - 12} familia(s) mas.`, {
        x: MARGIN + 8,
        y: cursorY,
        size: 9,
        color: GRAY,
      })
      cursorY -= 12
    }
    cursorY -= 10
  }

  // ------------------------------------------------------------------
  // Nota al pie
  // ------------------------------------------------------------------
  newPageIfNeeded(60)
  const footerNotes = [
    "Nota: las bebidas, los acompanamientos y los precios deben confirmarse directamente",
    "con el restaurante. Este documento solo refleja la cantidad de menus solicitados.",
  ]
  for (const note of footerNotes) {
    text(note, { x: MARGIN, y: cursorY, size: 8, color: GRAY })
    cursorY -= 11
  }

  const stamp = `Generado el ${new Date().toLocaleString("es-GT", {
    timeZone: event.timezone,
  })}${generatedBy ? ` por ${generatedBy}` : ""}`
  text(stamp, { x: MARGIN, y: MARGIN - 14, size: 7, color: GRAY })

  return pdf.save()
}
