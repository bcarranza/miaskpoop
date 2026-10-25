import { describe, expect, it } from "vitest"
import {
  mapHeaderIndexes,
  normalizeHeader,
  parseChildrenSheet,
  parseCsv,
  splitChildrenNames,
  tableToRawRows,
  validateImportRows,
  ImportFormatError,
  type RawImportRow,
} from "@/lib/excel/import"
import { buildImportTemplate, buildWorkbook, parseImportFile } from "@/lib/excel/workbook"
import {
  buildExportFileName,
  buildExportSheets,
  buildFamiliesSheet,
  buildOrderSheet,
} from "@/lib/excel/export"
import type {
  ConfirmedAttendeeMenu,
  EventRecord,
  EventTotals,
  FamilySummary,
  MenuOrderRow,
} from "@/lib/types"
import ExcelJS from "exceljs"

const HEADER = "Familia,Responsable,WhatsApp,Cupos máximos,Niños invitados,Notas"

/** ExcelJS declara su propio tipo Buffer; se copia a un ArrayBuffer limpio. */
function toArrayBuffer(source: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(source.byteLength)
  copy.set(source)
  return copy.buffer
}

function csvRows(lines: string[]): RawImportRow[] {
  return tableToRawRows(parseCsv([HEADER, ...lines].join("\n")))
}

describe("normalizeHeader", () => {
  it("quita acentos, signos y mayúsculas", () => {
    expect(normalizeHeader("Cupos máximos")).toBe("cupos maximos")
    expect(normalizeHeader("  Niños  invitados ")).toBe("ninos invitados")
    expect(normalizeHeader("WhatsApp #")).toBe("whatsapp")
  })
})

describe("mapHeaderIndexes", () => {
  it("reconoce los encabezados de la plantilla", () => {
    const indexes = mapHeaderIndexes([
      "Familia",
      "Responsable",
      "WhatsApp",
      "Cupos máximos",
      "Niños invitados",
      "Notas",
    ])
    expect(indexes).toEqual({
      familia: 0,
      responsable: 1,
      whatsapp: 2,
      cupos: 3,
      ninos: 4,
      notas: 5,
    })
  })

  it("acepta alias y orden distinto", () => {
    const indexes = mapHeaderIndexes(["Teléfono", "Apellido", "Cupo", "Hijos"])
    expect(indexes.whatsapp).toBe(0)
    expect(indexes.familia).toBe(1)
    expect(indexes.cupos).toBe(2)
    expect(indexes.ninos).toBe(3)
  })
})

describe("parseCsv", () => {
  it("lee comas, comillas y saltos de línea internos", () => {
    const rows = parseCsv('a,b,c\n"uno, dos",tres,"con ""comillas"""')
    expect(rows[0]).toEqual(["a", "b", "c"])
    expect(rows[1]).toEqual(["uno, dos", "tres", 'con "comillas"'])
  })

  it("detecta punto y coma como separador", () => {
    const rows = parseCsv("a;b;c\n1;2;3")
    expect(rows[1]).toEqual(["1", "2", "3"])
  })

  it("ignora el BOM y las filas vacías", () => {
    const rows = parseCsv("\uFEFFa,b\n\n1,2\n")
    expect(rows).toHaveLength(2)
    expect(rows[0][0]).toBe("a")
  })
})

describe("splitChildrenNames", () => {
  it.each([
    ["Sofía", ["Sofía"]],
    ["Mateo, Camila", ["Mateo", "Camila"]],
    ["Mateo; Camila", ["Mateo", "Camila"]],
    ["Mateo / Camila", ["Mateo", "Camila"]],
    ["Mateo y Camila", ["Mateo", "Camila"]],
    ["Adriana, Fernanda y Diego", ["Adriana", "Fernanda", "Diego"]],
    ["", []],
    ["  ,  ", []],
  ])("separa %s", (input, expected) => {
    expect(splitChildrenNames(input)).toEqual(expected)
  })
})

describe("tableToRawRows", () => {
  it("exige la columna Familia", () => {
    expect(() => tableToRawRows([["Responsable", "WhatsApp"], ["Ana", "55550101"]])).toThrow(
      ImportFormatError,
    )
  })

  it("exige la columna WhatsApp", () => {
    expect(() => tableToRawRows([["Familia", "Responsable"], ["López", "Ana"]])).toThrow(
      ImportFormatError,
    )
  })

  it("rechaza un archivo vacío", () => {
    expect(() => tableToRawRows([])).toThrow(ImportFormatError)
  })

  it("numera las filas como en Excel (la 1 es el encabezado)", () => {
    const rows = csvRows(["López,Ana López,55550101,2,Sofía,"])
    expect(rows[0].rowNumber).toBe(2)
  })
})

describe("validateImportRows", () => {
  it("acepta una fila correcta", () => {
    const preview = validateImportRows(csvRows(["López,Ana López,5555 0101,2,Sofía,Vecina"]))
    expect(preview.validCount).toBe(1)
    expect(preview.errorCount).toBe(0)

    const row = preview.rows[0]
    expect(row.familia).toBe("López")
    expect(row.whatsappE164).toBe("+50255550101")
    expect(row.whatsappDisplay).toBe("+502 5555 0101")
    expect(row.cupos).toBe(2)
    expect(row.ninos).toEqual(["Sofía"])
    expect(row.notas).toBe("Vecina")
  })

  it("calcula los totales de la previsualización", () => {
    const preview = validateImportRows(
      csvRows([
        "López,Ana López,55550101,2,Sofía,",
        "Pérez,Lucía Pérez,55550103,5,\"Mateo, Camila\",",
        "Rodríguez,Pedro Rodríguez,55550104,1,Isabella,",
      ]),
    )
    expect(preview.validCount).toBe(3)
    expect(preview.totalCapacity).toBe(8)
    expect(preview.totalChildren).toBe(4)
  })

  it("marca como error un teléfono inválido", () => {
    const preview = validateImportRows(csvRows(["López,Ana López,123,2,Sofía,"]))
    expect(preview.validCount).toBe(0)
    expect(preview.rows[0].issues.some((i) => i.level === "error")).toBe(true)
  })

  it("marca como error una familia sin nombre", () => {
    const preview = validateImportRows(csvRows([",Ana López,55550101,2,Sofía,"]))
    expect(preview.rows[0].valid).toBe(false)
    expect(preview.rows[0].issues[0].message).toContain("Falta el nombre de la familia")
  })

  it("marca como error un cupo menor al número de niños", () => {
    const preview = validateImportRows(
      csvRows(['Pérez,Lucía Pérez,55550103,1,"Mateo, Camila",']),
    )
    expect(preview.rows[0].valid).toBe(false)
    expect(preview.rows[0].issues.some((i) => i.message.includes("no alcanza"))).toBe(true)
  })

  it("rechaza cupos no numéricos o fuera de rango", () => {
    const preview = validateImportRows(
      csvRows([
        "A,Ana,55550101,muchos,Sofía,",
        "B,Beto,55550102,0,Luis,",
        "C,Carla,55550103,99,Ana,",
      ]),
    )
    expect(preview.validCount).toBe(0)
  })

  it("asume un cupo y avisa cuando la columna viene vacía", () => {
    const preview = validateImportRows(csvRows(['Pérez,Lucía,55550103,,"Mateo, Camila",']))
    expect(preview.rows[0].valid).toBe(true)
    expect(preview.rows[0].cupos).toBe(3)
    expect(preview.rows[0].issues.some((i) => i.level === "warning")).toBe(true)
  })

  it("avisa cuando se asume el código de Guatemala", () => {
    const preview = validateImportRows(csvRows(["López,Ana,55550101,2,Sofía,"]))
    expect(
      preview.rows[0].issues.some((i) => i.level === "warning" && i.message.includes("+502")),
    ).toBe(true)
  })

  it("detecta familias duplicadas dentro del archivo", () => {
    const preview = validateImportRows(
      csvRows(["López,Ana,55550101,2,Sofía,", "lópez ,Otra,55550199,2,Luis,"]),
    )
    expect(preview.rows[0].valid).toBe(true)
    expect(preview.rows[1].valid).toBe(false)
    expect(preview.rows[1].issues.some((i) => i.message.includes("fila 2"))).toBe(true)
  })

  it("detecta familias que ya existen en el sistema", () => {
    const preview = validateImportRows(csvRows(["López,Ana,55550101,2,Sofía,"]), {
      names: ["López"],
      phones: [],
    })
    expect(preview.rows[0].valid).toBe(false)
    expect(preview.rows[0].issues.some((i) => i.message.includes("Ya existe"))).toBe(true)
  })

  it("avisa (sin bloquear) cuando el teléfono se repite", () => {
    const preview = validateImportRows(
      csvRows(["López,Ana,55550101,2,Sofía,", "García,Carlos,5555 0101,2,Valeria,"]),
    )
    expect(preview.rows[1].valid).toBe(true)
    expect(
      preview.rows[1].issues.some(
        (i) => i.level === "warning" && i.message.includes("fila 2"),
      ),
    ).toBe(true)
  })

  it("avisa cuando el teléfono ya existe en otra familia", () => {
    const preview = validateImportRows(csvRows(["López,Ana,55550101,2,Sofía,"]), {
      names: [],
      phones: ["+50255550101"],
    })
    expect(preview.rows[0].valid).toBe(true)
    expect(
      preview.rows[0].issues.some((i) => i.message.includes("ya está registrado")),
    ).toBe(true)
  })

  it("suma los niños de la hoja adicional", () => {
    const extra = new Map([["lopez", ["Mateo"]]])
    const preview = validateImportRows(
      csvRows(["López,Ana,55550101,3,Sofía,"]),
      { names: [], phones: [] },
      extra,
    )
    expect(preview.rows[0].ninos).toEqual(["Sofía", "Mateo"])
  })

  it("no duplica un niño que aparece en la celda y en la hoja", () => {
    const extra = new Map([["lopez", ["Sofía"]]])
    const preview = validateImportRows(
      csvRows(["López,Ana,55550101,2,Sofía,"]),
      { names: [], phones: [] },
      extra,
    )
    expect(preview.rows[0].ninos).toEqual(["Sofía"])
  })
})

describe("parseChildrenSheet", () => {
  it("agrupa los niños por familia", () => {
    const result = parseChildrenSheet([
      ["Familia", "Niño"],
      ["Pérez", "Mateo"],
      ["Pérez", "Camila"],
      ["López", "Sofía"],
      ["", ""],
    ])
    expect(result.get("perez")).toEqual(["Mateo", "Camila"])
    expect(result.get("lopez")).toEqual(["Sofía"])
  })

  it("acepta varios nombres en una celda", () => {
    const result = parseChildrenSheet([
      ["Familia", "Niño"],
      ["Ramírez", "Adriana, Fernanda y Diego"],
    ])
    expect(result.get("ramirez")).toEqual(["Adriana", "Fernanda", "Diego"])
  })
})

// ---------------------------------------------------------------------
// Ida y vuelta por archivos XLSX reales
// ---------------------------------------------------------------------

describe("archivos XLSX", () => {
  it("la plantilla se puede volver a leer e importar", async () => {
    const template = await buildImportTemplate()
    const parsed = await parseImportFile(template, "plantilla.xlsx")

    expect(parsed.rows.length).toBe(3)
    const preview = validateImportRows(parsed.rows)
    expect(preview.validCount).toBe(3)
    expect(preview.errorCount).toBe(0)

    const lopez = preview.rows.find((r) => r.familia === "López")
    expect(lopez?.whatsappE164).toBe("+50255550101")
    const perez = preview.rows.find((r) => r.familia === "Pérez")
    expect(perez?.ninos).toEqual(["Mateo", "Camila"])
    expect(perez?.cupos).toBe(5)
  })

  it("lee un XLSX con la hoja adicional de niños", async () => {
    const workbook = new ExcelJS.Workbook()
    const main = workbook.addWorksheet("Familias")
    main.addRow(["Familia", "Responsable", "WhatsApp", "Cupos máximos", "Niños invitados", "Notas"])
    main.addRow(["Castillo", "María Castillo", "55550107", 4, "", "Hermanos"])
    const kids = workbook.addWorksheet("Niños")
    kids.addRow(["Familia", "Niño"])
    kids.addRow(["Castillo", "Santiago"])
    kids.addRow(["Castillo", "Renata"])

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
    const parsed = await parseImportFile(buffer, "familias.xlsx")

    expect(parsed.rows).toHaveLength(1)
    const preview = validateImportRows(parsed.rows, { names: [], phones: [] }, parsed.extraChildren)
    expect(preview.rows[0].ninos).toEqual(["Santiago", "Renata"])
    expect(preview.validCount).toBe(1)
  })

  it("lee un CSV", async () => {
    const csv = `${HEADER}\nMorales,Diana Morales,5555 0108,2,Ximena,Alergia`
    const parsed = await parseImportFile(Buffer.from(csv, "utf8"), "familias.csv")
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0].familia).toBe("Morales")
  })

  it("rechaza un archivo que no es un XLSX válido", async () => {
    await expect(
      parseImportFile(Buffer.from("esto no es un xlsx", "utf8"), "roto.xlsx"),
    ).rejects.toThrow(ImportFormatError)
  })
})

// ---------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------

const event: EventRecord = {
  id: "e1",
  slug: "mia-kpop-party",
  name: "Mía's K-pop Party",
  celebrant_name: "Mía",
  celebrant_age: 10,
  event_date: "2026-11-12",
  start_time: "14:00",
  timezone: "America/Guatemala",
  venue_name: "McDonald's Metro Plaza",
  venue_address: "Metro Plaza, Jalapa, Guatemala",
  venue_maps_url: null,
  theme: "K-pop",
  rsvp_deadline: "2026-11-07",
  allow_rsvp_edits: true,
  invitation_headline: "¡MÍA CUMPLE 10 AÑOS!",
  invitation_subheadline: "YOU'RE INVITED!",
  invitation_message: "Fiesta K-pop",
  whatsapp_invitation_template: "{{RSVP_URL}}",
  whatsapp_reminder_template: "{{RSVP_URL}}",
  theme_primary_color: "#FF2E9A",
  theme_secondary_color: "#A855F7",
  theme_accent_color: "#FFC72C",
  background_image_url: null,
  music_enabled: false,
  music_url: null,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

function family(overrides: Partial<FamilySummary>): FamilySummary {
  return {
    id: "f1",
    event_id: "e1",
    name: "López",
    primary_contact_name: "Ana López",
    whatsapp_phone: "+50255550101",
    whatsapp_phone_display: "+502 5555 0101",
    secondary_contact_name: null,
    secondary_contact_phone: null,
    max_attendees: 3,
    invitation_token: "tok",
    invitation_enabled: true,
    rsvp_status: "confirmado",
    delivery_status: "enviada",
    invitation_sent_at: "2026-10-20T15:00:00Z",
    invitation_opened_at: null,
    rsvp_submitted_at: "2026-10-21T15:00:00Z",
    reminder_count: 0,
    last_reminder_at: null,
    needs_review: false,
    review_reason: null,
    notes: null,
    archived_at: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    invited_children_count: 1,
    invited_children_names: ["Sofía"],
    confirmed_attendees: 3,
    confirmed_children: 1,
    confirmed_adults: 2,
    menu_selections: 3,
    selections_needing_review: 0,
    remaining_slots: 0,
    menu_incomplete: false,
    ...overrides,
  }
}

const totals: EventTotals = {
  event_id: "e1",
  total_families: 2,
  confirmed_families: 1,
  pending_families: 1,
  declined_families: 0,
  families_needing_review: 0,
  invitations_generated: 2,
  invitations_sent: 1,
  invitations_ready: 1,
  invitations_opened: 0,
  invitations_not_prepared: 0,
  total_capacity: 6,
  confirmed_attendees: 3,
  confirmed_children: 1,
  confirmed_adults: 2,
  invited_children: 2,
  total_menus_selected: 3,
  missing_menus: 0,
  families_with_incomplete_menus: 0,
}

const order: MenuOrderRow[] = [
  {
    menu_item_id: "m1",
    event_id: "e1",
    code: "big_mac",
    name: "Big Mac",
    description: null,
    audience: "adulto",
    is_available: true,
    price_cents: null,
    currency: "GTQ",
    sort_order: 1,
    quantity: 2,
    subtotal_cents: null,
  },
  {
    menu_item_id: "m2",
    event_id: "e1",
    code: "cajita_nuggets",
    name: "Cajita Feliz de Nuggets",
    description: null,
    audience: "nino",
    is_available: true,
    price_cents: null,
    currency: "GTQ",
    sort_order: 4,
    quantity: 1,
    subtotal_cents: null,
  },
]

const attendees: ConfirmedAttendeeMenu[] = [
  {
    event_id: "e1",
    family_id: "f1",
    family_name: "López",
    primary_contact_name: "Ana López",
    guest_id: "g1",
    guest_name: "Sofía",
    guest_type: "nino",
    is_invited_child: true,
    selection_id: "s1",
    menu_item_id: "m2",
    selection_needs_review: false,
    selection_review_reason: null,
    menu_code: "cajita_nuggets",
    menu_name: "Cajita Feliz de Nuggets",
    menu_audience: "nino",
    menu_price_cents: null,
    menu_is_available: true,
  },
]

describe("exportación a Excel", () => {
  it("la hoja de familias lleva totales reales", () => {
    const sheet = buildFamiliesSheet([family({}), family({ id: "f2", name: "García" })])
    expect(sheet.rows).toHaveLength(2)
    expect(sheet.totals?.asistentes).toBe(6)
    expect(sheet.totals?.cupos).toBe(6)
    expect(sheet.rows[0].ninos).toBe("Sofía")
    expect(sheet.rows[0].estado).toBe("Confirmada")
  })

  it("la hoja de pedido separa adultos y niños", () => {
    const sheet = buildOrderSheet(order, totals)
    expect(sheet.rows[0].para).toBe("Adultos")
    expect(sheet.rows[1].para).toBe("Niños")
    expect(sheet.totals?.cantidad).toBe(3)
    // Sin precios configurados, no hay columna de subtotal
    expect(sheet.columns.some((c) => c.key === "subtotal")).toBe(false)
  })

  it("agrega columnas de precio sólo si hay precios", () => {
    const withPrice = order.map((row) =>
      row.code === "big_mac"
        ? { ...row, price_cents: 4500, subtotal_cents: 9000 }
        : row,
    )
    const sheet = buildOrderSheet(withPrice, totals)
    expect(sheet.columns.some((c) => c.key === "precio")).toBe(true)
    expect(sheet.rows[0].precio).toBe(45)
    expect(sheet.rows[0].subtotal).toBe(90)
  })

  it("el reporte completo incluye todas las hojas", () => {
    const sheets = buildExportSheets("completo", {
      event,
      totals,
      families: [family({}), family({ id: "f2", name: "García", rsvp_status: "pendiente" })],
      attendees,
      order,
    })
    expect(sheets.map((s) => s.name)).toEqual([
      "Resumen",
      "Familias",
      "Asistentes",
      "Pedido McDonald's",
      "Menús incompletos",
      "Requieren revisión",
    ])
  })

  it("filtra por estado de confirmación", () => {
    const data = {
      event,
      totals,
      families: [
        family({}),
        family({ id: "f2", name: "García", rsvp_status: "pendiente" }),
        family({ id: "f3", name: "Pérez", rsvp_status: "rechazado" }),
      ],
      attendees,
      order,
    }
    expect(buildExportSheets("confirmadas", data)[0].rows).toHaveLength(1)
    expect(buildExportSheets("pendientes", data)[0].rows).toHaveLength(1)
    expect(buildExportSheets("rechazadas", data)[0].rows).toHaveLength(1)
  })

  it("genera un XLSX legible con los datos esperados", async () => {
    const sheets = buildExportSheets("pedido", {
      event,
      totals,
      families: [family({})],
      attendees,
      order,
    })
    const buffer = await buildWorkbook(sheets)

    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(toArrayBuffer(buffer))

    const sheet = reopened.getWorksheet("Pedido McDonald's")
    expect(sheet).toBeDefined()
    expect(sheet?.getRow(1).getCell(1).value).toBe("Menú")
    expect(sheet?.getRow(2).getCell(1).value).toBe("Big Mac")
    expect(sheet?.getRow(2).getCell(3).value).toBe(2)

    expect(reopened.getWorksheet("Resumen")).toBeDefined()
  })

  it("recorta nombres de hoja demasiado largos", async () => {
    const buffer = await buildWorkbook([
      {
        name: "Un nombre de hoja larguísimo que Excel no acepta nunca",
        columns: [{ header: "A", key: "a" }],
        rows: [{ a: "1" }],
      },
    ])
    const reopened = new ExcelJS.Workbook()
    await reopened.xlsx.load(toArrayBuffer(buffer))
    expect(reopened.worksheets[0].name.length).toBeLessThanOrEqual(31)
  })

  it("nombra los archivos con la fecha", () => {
    const name = buildExportFileName("pedido")
    expect(name).toMatch(/^mia-kpop-pedido-\d{4}-\d{2}-\d{2}\.xlsx$/)
  })
})
