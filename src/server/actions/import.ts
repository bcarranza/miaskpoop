"use server"

/**
 * Importación de familias desde Excel o CSV.
 *
 * Dos pasos: primero una previsualización que no escribe nada, y luego
 * la confirmación. En la confirmación se vuelve a validar todo contra
 * el estado actual de la base de datos, porque entre un paso y otro
 * pudieron crearse familias.
 */
import { revalidatePath } from "next/cache"
import {
  ImportFormatError,
  validateImportRows,
  type ImportPreview,
  type RawImportRow,
} from "@/lib/excel/import"
import { parseImportFile } from "@/lib/excel/workbook"
import type { GuestType } from "@/lib/types"
import { assertWriteAccess } from "../auth"
import { requireEvent } from "../queries"
import { createAdminSupabase } from "../supabase/server"
import {
  describeError,
  fail,
  generateInvitationToken,
  logAudit,
  ok,
  type ActionResult,
} from "./shared"

const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4 MB
const MAX_ROWS = 500

async function loadExisting() {
  const event = await requireEvent()
  const supabase = createAdminSupabase()

  const { data, error } = await supabase
    .from("families")
    .select("name, whatsapp_phone")
    .eq("event_id", event.id)
    .is("archived_at", null)

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as { name: string; whatsapp_phone: string }[]
  return {
    eventId: event.id,
    names: rows.map((r) => r.name),
    phones: rows.map((r) => r.whatsapp_phone),
  }
}

export type ImportPreviewResult = ImportPreview & { fileName: string; sheetName: string }

export async function previewFamilyImport(
  formData: FormData,
): Promise<ActionResult<ImportPreviewResult>> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return fail("Selecciona un archivo .xlsx o .csv.")
  }
  if (file.size === 0) {
    return fail("El archivo está vacío.")
  }
  if (file.size > MAX_FILE_BYTES) {
    return fail("El archivo es demasiado grande (máximo 4 MB).")
  }
  if (!/\.(xlsx|csv|txt|tsv)$/i.test(file.name)) {
    return fail("Formato no admitido. Usa .xlsx o .csv.")
  }

  try {
    const buffer = await file.arrayBuffer()
    const parsed = await parseImportFile(buffer, file.name)

    if (parsed.rows.length === 0) {
      return fail("No encontramos filas con datos debajo de los encabezados.")
    }
    if (parsed.rows.length > MAX_ROWS) {
      return fail(`El archivo tiene ${parsed.rows.length} filas. El máximo es ${MAX_ROWS}.`)
    }

    const existing = await loadExisting()
    const preview = validateImportRows(parsed.rows, existing, parsed.extraChildren)

    return ok({ ...preview, fileName: file.name, sheetName: parsed.sheetName })
  } catch (error) {
    if (error instanceof ImportFormatError) return fail(error.message)
    return fail(describeError(error))
  }
}

export type ConfirmImportResult = {
  created: number
  skipped: number
  childrenCreated: number
  errors: { familia: string; message: string }[]
}

/**
 * Inserta las familias de la previsualización.
 *
 * Se reciben las filas crudas (no el resultado ya validado) para que el
 * servidor sea la única autoridad sobre qué es válido.
 */
export async function confirmFamilyImport(
  rows: RawImportRow[],
): Promise<ActionResult<ConfirmImportResult>> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  if (!Array.isArray(rows) || rows.length === 0) {
    return fail("No hay filas para importar.")
  }
  if (rows.length > MAX_ROWS) {
    return fail(`Demasiadas filas (máximo ${MAX_ROWS}).`)
  }

  try {
    const existing = await loadExisting()
    const preview = validateImportRows(rows, existing)
    const valid = preview.rows.filter((row) => row.valid)

    if (valid.length === 0) {
      return fail("Ninguna fila es válida. Corrige los errores e inténtalo de nuevo.")
    }

    const supabase = createAdminSupabase()
    const errors: ConfirmImportResult["errors"] = []
    let created = 0
    let childrenCreated = 0

    for (const row of valid) {
      if (!row.whatsappE164) continue

      const { data: family, error } = await supabase
        .from("families")
        .insert({
          event_id: existing.eventId,
          name: row.familia,
          primary_contact_name: row.responsable || row.familia,
          whatsapp_phone: row.whatsappE164,
          whatsapp_phone_display: row.whatsappDisplay,
          max_attendees: row.cupos,
          notes: row.notas,
          invitation_token: generateInvitationToken(),
        })
        .select("id")
        .single<{ id: string }>()

      if (error || !family) {
        errors.push({
          familia: row.familia,
          message: error ? describeError(new Error(error.message)) : "No se pudo crear.",
        })
        continue
      }

      created += 1

      if (row.ninos.length > 0) {
        const { error: guestError } = await supabase.from("guests").insert(
          row.ninos.map((name, index) => ({
            family_id: family.id,
            name,
            guest_type: "nino" as GuestType,
            is_invited_child: true,
            sort_order: index + 1,
          })),
        )
        if (guestError) {
          errors.push({
            familia: row.familia,
            message: `Familia creada, pero algunos niños no se guardaron: ${guestError.message}`,
          })
        } else {
          childrenCreated += row.ninos.length
        }
      }
    }

    await logAudit({
      eventId: existing.eventId,
      entityType: "import",
      action: "familias_importadas",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      metadata: {
        filas_recibidas: rows.length,
        creadas: created,
        ninos: childrenCreated,
        errores: errors.length,
      },
    })

    revalidatePath("/admin")
    revalidatePath("/admin/familias")
    revalidatePath("/admin/invitaciones")

    return ok({
      created,
      skipped: rows.length - created,
      childrenCreated,
      errors,
    })
  } catch (error) {
    return fail(describeError(error))
  }
}
