/**
 * Importación de familias desde Excel (XLSX) o CSV.
 *
 * El flujo es: leer -> validar -> previsualizar -> confirmar.
 * Nada se escribe en la base de datos hasta que la persona
 * administradora revisa el resultado.
 *
 * Columnas esperadas:
 *   Familia | Responsable | WhatsApp | Cupos máximos | Niños invitados | Notas
 *
 * Los niños invitados pueden ir en una sola celda separados por coma,
 * punto y coma o barra; también se admite una segunda hoja llamada
 * "Niños" con las columnas Familia y Niño.
 */
import { normalizePhone } from "../phone"
import { MAX_ATTENDEES_LIMIT } from "../validation"

export const IMPORT_COLUMNS = [
  "Familia",
  "Responsable",
  "WhatsApp",
  "Cupos máximos",
  "Niños invitados",
  "Notas",
] as const

export const CHILDREN_SHEET_NAME = "Niños"

/** Alias aceptados por columna, ya normalizados. */
const COLUMN_ALIASES: Record<string, string[]> = {
  familia: ["familia", "apellido", "nombre de la familia", "family"],
  responsable: [
    "responsable",
    "contacto",
    "nombre del responsable",
    "papa o mama",
    "contacto principal",
  ],
  whatsapp: ["whatsapp", "telefono", "celular", "numero", "whatsapp phone", "phone"],
  cupos: [
    "cupos maximos",
    "cupos",
    "cupo",
    "maximo de personas",
    "max attendees",
    "cupos autorizados",
    "personas",
  ],
  ninos: [
    "ninos invitados",
    "ninos",
    "ninas invitadas",
    "hijos",
    "invitados",
    "children",
    "nino invitado",
  ],
  notas: ["notas", "observaciones", "comentarios", "notes"],
}

/** minúsculas, sin acentos y sin signos: para comparar encabezados. */
export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export type RawImportRow = {
  rowNumber: number
  familia: string
  responsable: string
  whatsapp: string
  cupos: string
  ninos: string
  notas: string
}

export type ImportIssue = { level: "error" | "warning"; message: string }

export type ValidatedImportRow = {
  rowNumber: number
  familia: string
  responsable: string
  whatsappE164: string | null
  whatsappDisplay: string | null
  whatsappOriginal: string
  cupos: number
  ninos: string[]
  notas: string | null
  issues: ImportIssue[]
  valid: boolean
}

export type ImportPreview = {
  rows: ValidatedImportRow[]
  validCount: number
  errorCount: number
  warningCount: number
  totalCapacity: number
  totalChildren: number
}

/** Datos existentes para detectar duplicados. */
export type ExistingFamilies = {
  names: string[]
  phones: string[]
}

export function splitChildrenNames(value: string): string[] {
  if (!value) return []
  return value
    .split(/[,;/\n|]+/)
    .flatMap((part) => part.split(/\s+y\s+/i))
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
}

function keyOf(value: string): string {
  return normalizeHeader(value)
}

/**
 * Valida las filas leídas y arma la previsualización.
 * No escribe nada: sólo informa.
 */
export function validateImportRows(
  rows: RawImportRow[],
  existing: ExistingFamilies = { names: [], phones: [] },
  extraChildren: Map<string, string[]> = new Map(),
): ImportPreview {
  const existingNames = new Set(existing.names.map(keyOf))
  const existingPhones = new Set(existing.phones)

  const seenNames = new Map<string, number>()
  const seenPhones = new Map<string, number>()

  const validated: ValidatedImportRow[] = rows.map((row) => {
    const issues: ImportIssue[] = []

    const familia = row.familia.trim()
    const responsable = row.responsable.trim()
    const notas = row.notas.trim()

    if (familia === "") {
      issues.push({ level: "error", message: "Falta el nombre de la familia." })
    } else if (familia.length < 2) {
      issues.push({ level: "error", message: "El nombre de la familia es demasiado corto." })
    } else if (familia.length > 120) {
      issues.push({ level: "error", message: "El nombre de la familia es demasiado largo." })
    }

    if (responsable === "") {
      issues.push({ level: "error", message: "Falta la persona responsable." })
    } else if (responsable.length > 120) {
      issues.push({ level: "error", message: "El nombre del responsable es demasiado largo." })
    }

    // Teléfono
    const phone = normalizePhone(row.whatsapp)
    let whatsappE164: string | null = null
    let whatsappDisplay: string | null = null
    if (phone.ok) {
      whatsappE164 = phone.e164
      whatsappDisplay = phone.display
      if (phone.assumedCountry) {
        issues.push({
          level: "warning",
          message: "Se asumió el código de Guatemala (+502).",
        })
      }
    } else {
      issues.push({ level: "error", message: `WhatsApp: ${phone.error}` })
    }

    // Niños invitados (celda + hoja adicional)
    const fromCell = splitChildrenNames(row.ninos)
    const fromSheet = extraChildren.get(keyOf(familia)) ?? []
    const ninos = [...new Set([...fromCell, ...fromSheet].map((n) => n.trim()))].filter(Boolean)

    if (ninos.some((n) => n.length > 80)) {
      issues.push({ level: "error", message: "Algún nombre de niño es demasiado largo." })
    }

    // Cupos
    const cuposRaw = row.cupos.trim()
    let cupos = 0
    if (cuposRaw === "") {
      // Sin dato explícito: se asume el número de niños invitados más un adulto.
      cupos = Math.max(ninos.length + 1, 1)
      issues.push({
        level: "warning",
        message: `No se indicó el cupo; se asignó ${cupos}. Revísalo antes de enviar la invitación.`,
      })
    } else {
      const parsedCupos = Number(cuposRaw.replace(/[^\d-]/g, ""))
      if (!Number.isFinite(parsedCupos) || !Number.isInteger(parsedCupos)) {
        issues.push({ level: "error", message: "El cupo debe ser un número entero." })
      } else if (parsedCupos < 1) {
        issues.push({ level: "error", message: "El cupo debe ser al menos 1." })
      } else if (parsedCupos > MAX_ATTENDEES_LIMIT) {
        issues.push({
          level: "error",
          message: `El cupo no puede pasar de ${MAX_ATTENDEES_LIMIT} personas.`,
        })
      } else {
        cupos = parsedCupos
      }
    }

    if (cupos > 0 && ninos.length > cupos) {
      issues.push({
        level: "error",
        message: `El cupo (${cupos}) no alcanza para los ${ninos.length} niños invitados.`,
      })
    }

    // Duplicados dentro del archivo
    const nameKey = keyOf(familia)
    if (familia !== "") {
      const previous = seenNames.get(nameKey)
      if (previous !== undefined) {
        issues.push({
          level: "error",
          message: `La familia "${familia}" ya aparece en la fila ${previous}.`,
        })
      } else {
        seenNames.set(nameKey, row.rowNumber)
      }

      if (existingNames.has(nameKey)) {
        issues.push({
          level: "error",
          message: `Ya existe una familia "${familia}" registrada en el sistema.`,
        })
      }
    }

    if (whatsappE164) {
      const previousPhone = seenPhones.get(whatsappE164)
      if (previousPhone !== undefined) {
        issues.push({
          level: "warning",
          message: `Este número también aparece en la fila ${previousPhone}.`,
        })
      } else {
        seenPhones.set(whatsappE164, row.rowNumber)
      }

      if (existingPhones.has(whatsappE164)) {
        issues.push({
          level: "warning",
          message: "Este número ya está registrado en otra familia.",
        })
      }
    }

    const hasErrors = issues.some((issue) => issue.level === "error")

    return {
      rowNumber: row.rowNumber,
      familia,
      responsable,
      whatsappE164,
      whatsappDisplay,
      whatsappOriginal: row.whatsapp.trim(),
      cupos,
      ninos,
      notas: notas === "" ? null : notas,
      issues,
      valid: !hasErrors,
    }
  })

  const validRows = validated.filter((row) => row.valid)

  return {
    rows: validated,
    validCount: validRows.length,
    errorCount: validated.length - validRows.length,
    warningCount: validated.filter((row) => row.issues.some((i) => i.level === "warning")).length,
    totalCapacity: validRows.reduce((sum, row) => sum + row.cupos, 0),
    totalChildren: validRows.reduce((sum, row) => sum + row.ninos.length, 0),
  }
}

// ---------------------------------------------------------------------
// Lectura de CSV
// ---------------------------------------------------------------------

/** Parser de CSV que respeta comillas dobles y saltos de línea internos. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const content = text.replace(/^\uFEFF/, "")
  const sep = delimiter ?? detectDelimiter(content)

  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === sep) {
      row.push(field)
      field = ""
      continue
    }
    if (char === "\r") continue
    if (char === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      continue
    }
    field += char
  }

  if (field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""))
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? ""
  const counts = [
    { sep: ",", count: (firstLine.match(/,/g) ?? []).length },
    { sep: ";", count: (firstLine.match(/;/g) ?? []).length },
    { sep: "\t", count: (firstLine.match(/\t/g) ?? []).length },
  ]
  counts.sort((a, b) => b.count - a.count)
  return counts[0].count > 0 ? counts[0].sep : ","
}

export type SheetTable = { name: string; rows: string[][] }

/** Asocia los encabezados con las columnas esperadas. */
export function mapHeaderIndexes(header: string[]): Record<string, number> {
  const indexes: Record<string, number> = {}

  header.forEach((cell, index) => {
    const normalized = normalizeHeader(cell ?? "")
    if (normalized === "") return

    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (field in indexes) continue
      if (aliases.includes(normalized)) {
        indexes[field] = index
        return
      }
    }
    // Coincidencia parcial como respaldo
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (field in indexes) continue
      if (aliases.some((alias) => normalized.startsWith(alias) || alias.startsWith(normalized))) {
        indexes[field] = index
        return
      }
    }
  })

  return indexes
}

export class ImportFormatError extends Error {}

/** Convierte una tabla de celdas en filas crudas listas para validar. */
export function tableToRawRows(rows: string[][]): RawImportRow[] {
  if (rows.length === 0) {
    throw new ImportFormatError("El archivo está vacío.")
  }

  const header = rows[0].map((cell) => String(cell ?? ""))
  const indexes = mapHeaderIndexes(header)

  if (indexes.familia === undefined) {
    throw new ImportFormatError(
      'No encontramos la columna "Familia". Descarga la plantilla y usa esos encabezados.',
    )
  }
  if (indexes.whatsapp === undefined) {
    throw new ImportFormatError('No encontramos la columna "WhatsApp".')
  }

  const pick = (row: string[], field: string): string => {
    const index = indexes[field]
    if (index === undefined) return ""
    return String(row[index] ?? "").trim()
  }

  return rows.slice(1).map((row, offset) => ({
    rowNumber: offset + 2, // fila 1 = encabezados
    familia: pick(row, "familia"),
    responsable: pick(row, "responsable"),
    whatsapp: pick(row, "whatsapp"),
    cupos: pick(row, "cupos"),
    ninos: pick(row, "ninos"),
    notas: pick(row, "notas"),
  }))
}

/** Lee la hoja opcional de niños: Familia | Niño. */
export function parseChildrenSheet(rows: string[][]): Map<string, string[]> {
  const result = new Map<string, string[]>()
  if (rows.length < 2) return result

  const header = rows[0].map((cell) => normalizeHeader(String(cell ?? "")))
  let familyIndex = header.findIndex((h) => COLUMN_ALIASES.familia.includes(h))
  let childIndex = header.findIndex(
    (h) => COLUMN_ALIASES.ninos.includes(h) || h === "nino" || h === "nombre",
  )

  if (familyIndex === -1) familyIndex = 0
  if (childIndex === -1) childIndex = 1

  for (const row of rows.slice(1)) {
    const family = String(row[familyIndex] ?? "").trim()
    const child = String(row[childIndex] ?? "").trim()
    if (family === "" || child === "") continue

    const key = keyOf(family)
    const current = result.get(key) ?? []
    for (const name of splitChildrenNames(child)) {
      if (!current.includes(name)) current.push(name)
    }
    result.set(key, current)
  }

  return result
}
