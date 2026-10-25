/**
 * Lectura y escritura de archivos XLSX con ExcelJS.
 *
 * La lógica de validación vive en ./import.ts (sin dependencias), de
 * modo que puede probarse por separado.
 */
import ExcelJS from "exceljs"
import {
  CHILDREN_SHEET_NAME,
  IMPORT_COLUMNS,
  ImportFormatError,
  normalizeHeader,
  parseChildrenSheet,
  parseCsv,
  tableToRawRows,
  type RawImportRow,
} from "./import"

/** Convierte el valor de una celda a texto plano. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue)
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("")
    }
    if ("hyperlink" in value && "text" in value) return String(value.text ?? "")
  }

  return String(value)
}

function sheetToTable(sheet: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = []
    // row.values es 1-indexado en ExcelJS
    const raw = row.values as ExcelJS.CellValue[]
    for (let i = 1; i < raw.length; i += 1) {
      values.push(cellToString(raw[i]))
    }
    if (values.some((v) => v.trim() !== "")) rows.push(values)
  })
  return rows
}

export type ParsedImportFile = {
  rows: RawImportRow[]
  extraChildren: Map<string, string[]>
  sheetName: string
}

/** Lee un XLSX o CSV y devuelve las filas crudas más la hoja de niños. */
export async function parseImportFile(
  data: ArrayBuffer | Uint8Array,
  fileName: string,
): Promise<ParsedImportFile> {
  const isCsv = /\.(csv|txt|tsv)$/i.test(fileName)
  const buffer: ArrayBuffer =
    data instanceof Uint8Array
      ? (data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer)
      : data

  if (isCsv) {
    const text = Buffer.from(buffer).toString("utf8")
    const table = parseCsv(text)
    return {
      rows: tableToRawRows(table),
      extraChildren: new Map(),
      sheetName: "CSV",
    }
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    throw new ImportFormatError(
      "No pudimos leer el archivo. Asegúrate de que sea un .xlsx o .csv válido.",
    )
  }

  if (workbook.worksheets.length === 0) {
    throw new ImportFormatError("El archivo no tiene hojas.")
  }

  const childrenSheet = workbook.worksheets.find(
    (sheet) => normalizeHeader(sheet.name) === normalizeHeader(CHILDREN_SHEET_NAME),
  )
  const mainSheet =
    workbook.worksheets.find((sheet) => sheet !== childrenSheet) ?? workbook.worksheets[0]

  const extraChildren = childrenSheet
    ? parseChildrenSheet(sheetToTable(childrenSheet))
    : new Map<string, string[]>()

  return {
    rows: tableToRawRows(sheetToTable(mainSheet)),
    extraChildren,
    sheetName: mainSheet.name,
  }
}

// ---------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFF2E9A" },
}

export type SheetSpec = {
  name: string
  columns: { header: string; key: string; width?: number }[]
  rows: Record<string, string | number | null>[]
  /** Fila de totales al final, en negrita. */
  totals?: Record<string, string | number | null>
}

/** Construye un XLSX con una o varias hojas y encabezados con estilo. */
export async function buildWorkbook(sheets: SheetSpec[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Mía's K-pop Party"
  workbook.created = new Date()

  for (const spec of sheets) {
    // Excel no admite más de 31 caracteres ni algunos signos en el nombre.
    const safeName = spec.name.replace(/[*?:/\\[\]]/g, " ").slice(0, 31)
    const sheet = workbook.addWorksheet(safeName, {
      views: [{ state: "frozen", ySplit: 1 }],
    })

    sheet.columns = spec.columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width ?? Math.max(14, column.header.length + 4),
    }))

    const header = sheet.getRow(1)
    header.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
    header.fill = HEADER_FILL
    header.alignment = { vertical: "middle", horizontal: "left" }
    header.height = 22

    for (const row of spec.rows) {
      sheet.addRow(row)
    }

    if (spec.totals) {
      const totalRow = sheet.addRow(spec.totals)
      totalRow.font = { bold: true }
      totalRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3E8FF" },
      }
    }

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: Math.max(spec.columns.length, 1) },
    }
  }

  const output = await workbook.xlsx.writeBuffer()
  return Buffer.from(output)
}

/** Plantilla de importación con instrucciones y un ejemplo. */
export async function buildImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Mía's K-pop Party"

  const sheet = workbook.addWorksheet("Familias", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  sheet.columns = [
    { header: IMPORT_COLUMNS[0], key: "familia", width: 24 },
    { header: IMPORT_COLUMNS[1], key: "responsable", width: 26 },
    { header: IMPORT_COLUMNS[2], key: "whatsapp", width: 20 },
    { header: IMPORT_COLUMNS[3], key: "cupos", width: 16 },
    { header: IMPORT_COLUMNS[4], key: "ninos", width: 34 },
    { header: IMPORT_COLUMNS[5], key: "notas", width: 36 },
  ]

  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: "FFFFFFFF" } }
  header.fill = HEADER_FILL
  header.height = 22

  const examples = [
    {
      familia: "López",
      responsable: "Ana López",
      whatsapp: "5555 0101",
      cupos: 2,
      ninos: "Sofía",
      notas: "Vecina del colegio.",
    },
    {
      familia: "Pérez",
      responsable: "Lucía Pérez",
      whatsapp: "+502 5555 0103",
      cupos: 5,
      ninos: "Mateo, Camila",
      notas: "Dos niños invitados.",
    },
    {
      familia: "Rodríguez",
      responsable: "Pedro Rodríguez",
      whatsapp: "55550104",
      cupos: 1,
      ninos: "Isabella",
      notas: "Asiste sola, sin acompañantes.",
    },
  ]

  for (const row of examples) sheet.addRow(row)

  sheet.getColumn("whatsapp").numFmt = "@" // texto, para no perder el 0 inicial

  // Hoja de instrucciones
  const help = workbook.addWorksheet("Instrucciones")
  help.columns = [{ width: 110 }]
  const lines = [
    "CÓMO LLENAR ESTA PLANTILLA",
    "",
    "1. Familia: apellido o nombre con el que identificas a la familia. No se puede repetir.",
    "2. Responsable: nombre de la persona a la que le escribirás por WhatsApp.",
    "3. WhatsApp: puedes escribirlo como 5555 0101 (se asume +502) o con código de país: +1 305 555 0199.",
    "4. Cupos máximos: total de personas autorizadas, INCLUYENDO a los niños invitados.",
    "   Ejemplo: si invitas a Sofía y sus papás pueden acompañarla, el cupo es 3.",
    "5. Niños invitados: nombres separados por coma. Ejemplo: Mateo, Camila",
    "6. Notas: cualquier detalle interno (no se muestra a la familia).",
    "",
    'Si prefieres, puedes agregar una hoja llamada "Niños" con dos columnas (Familia y Niño),',
    "una fila por cada niño. Esos nombres se suman a los de la columna «Niños invitados».",
    "",
    "Antes de guardar nada, el sistema te muestra una previsualización con errores y advertencias.",
    "Las filas con errores no se importan; puedes corregirlas y volver a subir el archivo.",
  ]
  lines.forEach((line, index) => {
    const row = help.addRow([line])
    if (index === 0) row.font = { bold: true, size: 13 }
  })

  const output = await workbook.xlsx.writeBuffer()
  return Buffer.from(output)
}
