"use server"

/**
 * Administración del catálogo de menús de McDonald's.
 *
 * Al deshabilitar un menú, las selecciones existentes NO se reemplazan:
 * un disparador de la base de datos las marca para revisión (ver
 * supabase/migrations/0004_rsvp_function.sql).
 */
import { revalidatePath } from "next/cache"
import { fieldErrors, firstErrorMessage, menuItemFormSchema, type MenuItemFormInput } from "@/lib/validation"
import { assertWriteAccess } from "../auth"
import { requireEvent } from "../queries"
import { createAdminSupabase } from "../supabase/server"
import { describeError, fail, logAudit, ok, type ActionResult } from "./shared"

function revalidateMenuViews() {
  revalidatePath("/admin/menus")
  revalidatePath("/admin/pedidos")
  revalidatePath("/admin")
  revalidatePath("/admin/reportes")
}

function toPriceCents(price: number | string | null | undefined): number | null {
  if (price === null || price === undefined || price === "") return null
  const value = typeof price === "string" ? Number(price) : price
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

export async function createMenuItem(input: MenuItemFormInput): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  const parsed = menuItemFormSchema.safeParse(input)
  if (!parsed.success) return fail(firstErrorMessage(parsed.error), fieldErrors(parsed.error))
  const data = parsed.data

  try {
    const event = await requireEvent()
    const supabase = createAdminSupabase()

    const { error } = await supabase.from("menu_items").insert({
      event_id: event.id,
      code: data.code,
      name: data.name,
      description: data.description || null,
      audience: data.audience,
      image_url: data.image_url || null,
      price_cents: toPriceCents(data.price),
      is_available: data.is_available,
      sort_order: data.sort_order,
    })
    if (error) throw new Error(error.message)

    await logAudit({
      eventId: event.id,
      entityType: "menu_item",
      action: "menu_creado",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      after: { code: data.code, name: data.name, audience: data.audience },
    })

    revalidateMenuViews()
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}

export async function updateMenuItem(
  id: string,
  input: MenuItemFormInput,
): Promise<ActionResult<{ flaggedSelections: number }>> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  const parsed = menuItemFormSchema.safeParse(input)
  if (!parsed.success) return fail(firstErrorMessage(parsed.error), fieldErrors(parsed.error))
  const data = parsed.data

  try {
    const supabase = createAdminSupabase()

    const { data: before } = await supabase
      .from("menu_items")
      .select("code, name, is_available, price_cents")
      .eq("id", id)
      .maybeSingle<{
        code: string
        name: string
        is_available: boolean
        price_cents: number | null
      }>()
    if (!before) return fail("No encontramos ese menú.")

    const { error } = await supabase
      .from("menu_items")
      .update({
        code: data.code,
        name: data.name,
        description: data.description || null,
        audience: data.audience,
        image_url: data.image_url || null,
        price_cents: toPriceCents(data.price),
        is_available: data.is_available,
        sort_order: data.sort_order,
      })
      .eq("id", id)
    if (error) throw new Error(error.message)

    // Cuántas selecciones quedaron marcadas para revisión
    let flagged = 0
    if (before.is_available && !data.is_available) {
      const { count } = await supabase
        .from("attendee_menu_selections")
        .select("id", { count: "exact", head: true })
        .eq("menu_item_id", id)
        .eq("is_current", true)
        .eq("needs_review", true)
      flagged = count ?? 0
    }

    await logAudit({
      entityType: "menu_item",
      entityId: id,
      action: "menu_actualizado",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      before,
      after: { code: data.code, name: data.name, is_available: data.is_available },
      metadata: { flagged_selections: flagged },
    })

    revalidateMenuViews()
    revalidatePath("/admin/familias")
    return ok({ flaggedSelections: flagged })
  } catch (error) {
    return fail(describeError(error))
  }
}

export async function setMenuAvailability(
  id: string,
  isAvailable: boolean,
): Promise<ActionResult<{ flaggedSelections: number }>> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  try {
    const supabase = createAdminSupabase()
    const { error } = await supabase
      .from("menu_items")
      .update({ is_available: isAvailable })
      .eq("id", id)
    if (error) throw new Error(error.message)

    let flagged = 0
    if (!isAvailable) {
      const { count } = await supabase
        .from("attendee_menu_selections")
        .select("id", { count: "exact", head: true })
        .eq("menu_item_id", id)
        .eq("is_current", true)
        .eq("needs_review", true)
      flagged = count ?? 0
    }

    await logAudit({
      entityType: "menu_item",
      entityId: id,
      action: isAvailable ? "menu_habilitado" : "menu_deshabilitado",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      metadata: { flagged_selections: flagged },
    })

    revalidateMenuViews()
    revalidatePath("/admin/familias")
    return ok({ flaggedSelections: flagged })
  } catch (error) {
    return fail(describeError(error))
  }
}

export async function deleteMenuItem(id: string): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  try {
    const supabase = createAdminSupabase()

    // No se borra un menú que alguien ya eligió: se perdería el pedido.
    const { count } = await supabase
      .from("attendee_menu_selections")
      .select("id", { count: "exact", head: true })
      .eq("menu_item_id", id)

    if ((count ?? 0) > 0) {
      return fail(
        "Este menú ya fue elegido por alguna familia. Deshabilítalo en lugar de eliminarlo para no perder el historial.",
      )
    }

    const { error } = await supabase.from("menu_items").delete().eq("id", id)
    if (error) throw new Error(error.message)

    await logAudit({
      entityType: "menu_item",
      entityId: id,
      action: "menu_eliminado",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
    })

    revalidateMenuViews()
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}
