"use server"

/**
 * Gestión de familias, niños invitados, cupos y estado de envío.
 *
 * Toda acción exige sesión administrativa con permisos de escritura y
 * vuelve a validar los datos en el servidor.
 */
import { revalidatePath } from "next/cache"
import type { DeliveryLogAction, DeliveryStatus, GuestType } from "@/lib/types"
import {
  familyFormSchema,
  fieldErrors,
  firstErrorMessage,
  maxAttendeesSchema,
  type FamilyFormInput,
} from "@/lib/validation"
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

function revalidateFamilyViews(familyId?: string) {
  revalidatePath("/admin")
  revalidatePath("/admin/familias")
  revalidatePath("/admin/invitaciones")
  revalidatePath("/admin/confirmaciones")
  revalidatePath("/admin/pedidos")
  revalidatePath("/admin/reportes")
  if (familyId) revalidatePath(`/admin/familias/${familyId}`)
}

// ---------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------
export async function createFamily(
  input: FamilyFormInput,
): Promise<ActionResult<{ id: string; token: string }>> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  const parsed = familyFormSchema.safeParse(input)
  if (!parsed.success) {
    return fail(firstErrorMessage(parsed.error), fieldErrors(parsed.error))
  }
  const data = parsed.data

  try {
    const event = await requireEvent()
    const supabase = createAdminSupabase()
    const token = generateInvitationToken()

    const { data: family, error } = await supabase
      .from("families")
      .insert({
        event_id: event.id,
        name: data.name,
        primary_contact_name: data.primary_contact_name,
        whatsapp_phone: data.whatsapp_phone.e164,
        whatsapp_phone_display: data.whatsapp_phone.display,
        secondary_contact_name: data.secondary_contact_name || null,
        secondary_contact_phone: data.secondary_contact_phone || null,
        max_attendees: data.max_attendees,
        invitation_enabled: data.invitation_enabled,
        notes: data.notes || null,
        invitation_token: token,
      })
      .select("id, invitation_token")
      .single<{ id: string; invitation_token: string }>()

    if (error) throw new Error(error.message)

    if (data.invited_children.length > 0) {
      const { error: guestError } = await supabase.from("guests").insert(
        data.invited_children.map((child, index) => ({
          family_id: family.id,
          name: child.name,
          guest_type: "nino" as GuestType,
          is_invited_child: true,
          sort_order: index + 1,
        })),
      )
      if (guestError) throw new Error(guestError.message)
    }

    await logAudit({
      eventId: event.id,
      entityType: "family",
      entityId: family.id,
      action: "familia_creada",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      after: { name: data.name, max_attendees: data.max_attendees },
    })

    revalidateFamilyViews()
    return ok({ id: family.id, token: family.invitation_token })
  } catch (error) {
    return fail(describeError(error))
  }
}

// ---------------------------------------------------------------------
// Actualizar
// ---------------------------------------------------------------------
export async function updateFamily(
  id: string,
  input: FamilyFormInput,
): Promise<ActionResult<{ needsReview: boolean; reviewReason: string | null }>> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  const parsed = familyFormSchema.safeParse(input)
  if (!parsed.success) {
    return fail(firstErrorMessage(parsed.error), fieldErrors(parsed.error))
  }
  const data = parsed.data

  try {
    const event = await requireEvent()
    const supabase = createAdminSupabase()

    const { data: before } = await supabase
      .from("families")
      .select("name, max_attendees, whatsapp_phone, invitation_enabled")
      .eq("id", id)
      .maybeSingle<{
        name: string
        max_attendees: number
        whatsapp_phone: string
        invitation_enabled: boolean
      }>()

    if (!before) return fail("No encontramos esa familia.")

    const { error } = await supabase
      .from("families")
      .update({
        name: data.name,
        primary_contact_name: data.primary_contact_name,
        whatsapp_phone: data.whatsapp_phone.e164,
        whatsapp_phone_display: data.whatsapp_phone.display,
        secondary_contact_name: data.secondary_contact_name || null,
        secondary_contact_phone: data.secondary_contact_phone || null,
        max_attendees: data.max_attendees,
        invitation_enabled: data.invitation_enabled,
        notes: data.notes || null,
      })
      .eq("id", id)

    if (error) throw new Error(error.message)

    // Sincroniza los niños invitados declarados en el formulario.
    const { data: existing } = await supabase
      .from("guests")
      .select("id, name, is_attending")
      .eq("family_id", id)
      .eq("is_invited_child", true)

    const existingChildren = (existing ?? []) as {
      id: string
      name: string
      is_attending: boolean | null
    }[]
    const keptIds = new Set(
      data.invited_children.map((c) => c.id).filter((v): v is string => Boolean(v)),
    )

    const toRemove = existingChildren.filter((child) => !keptIds.has(child.id))
    if (toRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from("guests")
        .delete()
        .in(
          "id",
          toRemove.map((c) => c.id),
        )
      if (deleteError) throw new Error(deleteError.message)
    }

    for (const [index, child] of data.invited_children.entries()) {
      if (child.id) {
        const { error: updateError } = await supabase
          .from("guests")
          .update({ name: child.name, sort_order: index + 1 })
          .eq("id", child.id)
          .eq("family_id", id)
        if (updateError) throw new Error(updateError.message)
      } else {
        const { error: insertError } = await supabase.from("guests").insert({
          family_id: id,
          name: child.name,
          guest_type: "nino" as GuestType,
          is_invited_child: true,
          sort_order: index + 1,
        })
        if (insertError) throw new Error(insertError.message)
      }
    }

    const { data: after } = await supabase
      .from("families")
      .select("needs_review, review_reason")
      .eq("id", id)
      .maybeSingle<{ needs_review: boolean; review_reason: string | null }>()

    await logAudit({
      eventId: event.id,
      entityType: "family",
      entityId: id,
      action: "familia_actualizada",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      before,
      after: { name: data.name, max_attendees: data.max_attendees },
    })

    revalidateFamilyViews(id)
    return ok({
      needsReview: after?.needs_review ?? false,
      reviewReason: after?.review_reason ?? null,
    })
  } catch (error) {
    return fail(describeError(error))
  }
}

// ---------------------------------------------------------------------
// Cupo
// ---------------------------------------------------------------------
export async function updateFamilyQuota(
  id: string,
  maxAttendees: number,
): Promise<ActionResult<{ needsReview: boolean; reviewReason: string | null }>> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  const parsed = maxAttendeesSchema.safeParse(maxAttendees)
  if (!parsed.success) return fail(firstErrorMessage(parsed.error))

  try {
    const supabase = createAdminSupabase()

    const { data: before } = await supabase
      .from("families")
      .select("max_attendees")
      .eq("id", id)
      .maybeSingle<{ max_attendees: number }>()

    if (!before) return fail("No encontramos esa familia.")

    const { error } = await supabase
      .from("families")
      .update({ max_attendees: parsed.data })
      .eq("id", id)
    if (error) throw new Error(error.message)

    const { data: after } = await supabase
      .from("families")
      .select("needs_review, review_reason")
      .eq("id", id)
      .maybeSingle<{ needs_review: boolean; review_reason: string | null }>()

    await logAudit({
      entityType: "family",
      entityId: id,
      action: "cupo_actualizado",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      before,
      after: { max_attendees: parsed.data },
    })

    revalidateFamilyViews(id)
    return ok({
      needsReview: after?.needs_review ?? false,
      reviewReason: after?.review_reason ?? null,
    })
  } catch (error) {
    return fail(describeError(error))
  }
}

// ---------------------------------------------------------------------
// Archivar / restaurar / eliminar
// ---------------------------------------------------------------------
export async function archiveFamily(id: string): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  try {
    const supabase = createAdminSupabase()
    const { error } = await supabase
      .from("families")
      .update({ archived_at: new Date().toISOString(), invitation_enabled: false })
      .eq("id", id)
    if (error) throw new Error(error.message)

    await logAudit({
      entityType: "family",
      entityId: id,
      action: "familia_archivada",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
    })

    revalidateFamilyViews(id)
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}

export async function restoreFamily(id: string): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  try {
    const supabase = createAdminSupabase()
    const { error } = await supabase
      .from("families")
      .update({ archived_at: null, invitation_enabled: true })
      .eq("id", id)
    if (error) throw new Error(error.message)

    await logAudit({
      entityType: "family",
      entityId: id,
      action: "familia_restaurada",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
    })

    revalidateFamilyViews(id)
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}

/** Borrado definitivo. Archivar es lo recomendado; esto no se puede revertir. */
export async function deleteFamily(id: string): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)
  if (access.session.profile.role !== "owner") {
    return fail("Sólo la cuenta propietaria puede eliminar familias de forma definitiva.")
  }

  try {
    const supabase = createAdminSupabase()

    const { data: before } = await supabase
      .from("families")
      .select("name, max_attendees, rsvp_status")
      .eq("id", id)
      .maybeSingle()

    const { error } = await supabase.from("families").delete().eq("id", id)
    if (error) throw new Error(error.message)

    await logAudit({
      entityType: "family",
      entityId: id,
      action: "familia_eliminada",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      before,
    })

    revalidateFamilyViews()
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}

// ---------------------------------------------------------------------
// Niños invitados y acompañantes
// ---------------------------------------------------------------------
export async function addGuest(
  familyId: string,
  name: string,
  guestType: GuestType,
  isInvitedChild: boolean,
): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  const clean = name.trim()
  if (clean.length < 2) return fail("El nombre debe tener al menos 2 caracteres.")
  if (clean.length > 80) return fail("El nombre es demasiado largo.")
  if (isInvitedChild && guestType !== "nino") {
    return fail("Sólo un niño o niña puede marcarse como invitado especial.")
  }

  try {
    const supabase = createAdminSupabase()

    const { data: family } = await supabase
      .from("families")
      .select("max_attendees")
      .eq("id", familyId)
      .maybeSingle<{ max_attendees: number }>()
    if (!family) return fail("No encontramos esa familia.")

    const { count } = await supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId)
      .eq("is_invited_child", true)

    if (isInvitedChild && (count ?? 0) + 1 > family.max_attendees) {
      return fail(
        `El cupo de la familia es ${family.max_attendees}. Aumenta el cupo antes de agregar más niños invitados.`,
      )
    }

    const { error } = await supabase.from("guests").insert({
      family_id: familyId,
      name: clean,
      guest_type: guestType,
      is_invited_child: isInvitedChild,
      sort_order: 99,
    })
    if (error) throw new Error(error.message)

    await logAudit({
      entityType: "guest",
      entityId: familyId,
      action: isInvitedChild ? "nino_invitado_agregado" : "acompanante_agregado",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      after: { name: clean, guest_type: guestType },
    })

    revalidateFamilyViews(familyId)
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}

export async function removeGuest(guestId: string): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  try {
    const supabase = createAdminSupabase()

    const { data: guest } = await supabase
      .from("guests")
      .select("family_id, name")
      .eq("id", guestId)
      .maybeSingle<{ family_id: string; name: string }>()
    if (!guest) return fail("No encontramos a esa persona.")

    const { error } = await supabase.from("guests").delete().eq("id", guestId)
    if (error) throw new Error(error.message)

    await logAudit({
      entityType: "guest",
      entityId: guest.family_id,
      action: "invitado_eliminado",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      before: { name: guest.name },
    })

    revalidateFamilyViews(guest.family_id)
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}

/** Alta manual de acompañantes por parte del administrador. */
export async function setGuestAttendance(
  guestId: string,
  isAttending: boolean,
): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  try {
    const supabase = createAdminSupabase()

    const { data: guest } = await supabase
      .from("guests")
      .select("family_id")
      .eq("id", guestId)
      .maybeSingle<{ family_id: string }>()
    if (!guest) return fail("No encontramos a esa persona.")

    const { error } = await supabase
      .from("guests")
      .update({ is_attending: isAttending })
      .eq("id", guestId)

    if (error) throw new Error(error.message)

    if (!isAttending) {
      await supabase
        .from("attendee_menu_selections")
        .update({ is_current: false })
        .eq("guest_id", guestId)
        .eq("is_current", true)
    }

    revalidateFamilyViews(guest.family_id)
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}

// ---------------------------------------------------------------------
// Token e invitación
// ---------------------------------------------------------------------
export async function regenerateToken(
  familyId: string,
): Promise<ActionResult<{ token: string }>> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  try {
    const supabase = createAdminSupabase()
    const token = generateInvitationToken()

    const { data, error } = await supabase
      .from("families")
      .update({
        invitation_token: token,
        delivery_status: "no_preparada" as DeliveryStatus,
        invitation_sent_at: null,
        invitation_opened_at: null,
      })
      .eq("id", familyId)
      .is("archived_at", null)
      .select("invitation_token")
      .maybeSingle<{ invitation_token: string }>()

    if (error) throw new Error(error.message)
    if (!data) return fail("No encontramos esa familia.")

    await supabase.from("invitation_delivery_logs").insert({
      family_id: familyId,
      kind: "invitacion",
      action: "token_regenerado",
      performed_by: access.session.userId,
    })

    await logAudit({
      entityType: "family",
      entityId: familyId,
      action: "token_regenerado",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
    })

    revalidateFamilyViews(familyId)
    return ok({ token: data.invitation_token })
  } catch (error) {
    return fail(describeError(error))
  }
}

export async function setInvitationEnabled(
  familyId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  try {
    const supabase = createAdminSupabase()
    const { error } = await supabase
      .from("families")
      .update({ invitation_enabled: enabled })
      .eq("id", familyId)
    if (error) throw new Error(error.message)

    await supabase.from("invitation_delivery_logs").insert({
      family_id: familyId,
      kind: "invitacion",
      action: enabled ? "invitacion_habilitada" : "invitacion_deshabilitada",
      performed_by: access.session.userId,
    })

    revalidateFamilyViews(familyId)
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}

// ---------------------------------------------------------------------
// Estado de envío por WhatsApp
// ---------------------------------------------------------------------

/**
 * Registra una acción de envío.
 *
 * Abrir WhatsApp nunca marca el mensaje como enviado: el estado de
 * "enviada" sólo lo fija la persona administradora de forma explícita.
 */
export async function logDeliveryAction(
  familyId: string,
  action: DeliveryLogAction,
  kind: "invitacion" | "recordatorio" = "invitacion",
  messagePreview?: string,
): Promise<ActionResult<{ deliveryStatus: DeliveryStatus | null }>> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  try {
    const supabase = createAdminSupabase()
    const now = new Date().toISOString()

    const { data: family } = await supabase
      .from("families")
      .select("delivery_status, reminder_count")
      .eq("id", familyId)
      .maybeSingle<{ delivery_status: DeliveryStatus; reminder_count: number }>()

    if (!family) return fail("No encontramos esa familia.")

    const update: Record<string, unknown> = {}

    if (kind === "invitacion") {
      if (action === "preparada" && family.delivery_status === "no_preparada") {
        update.delivery_status = "lista"
      }
      if (action === "abierta_whatsapp" && family.delivery_status !== "enviada") {
        // Se registra la apertura, pero NO se marca como enviada.
        update.delivery_status = "abierta_whatsapp"
        update.invitation_opened_at = now
      }
      if (action === "marcada_enviada") {
        update.delivery_status = "enviada"
        update.invitation_sent_at = now
      }
    } else if (action === "marcada_enviada") {
      // Los recordatorios se cuentan por separado de la invitación inicial.
      update.reminder_count = (family.reminder_count ?? 0) + 1
      update.last_reminder_at = now
    }

    if (Object.keys(update).length > 0) {
      const { error } = await supabase.from("families").update(update).eq("id", familyId)
      if (error) throw new Error(error.message)
    }

    const { error: logError } = await supabase.from("invitation_delivery_logs").insert({
      family_id: familyId,
      kind,
      action,
      message_preview: messagePreview?.slice(0, 500) ?? null,
      performed_by: access.session.userId,
    })
    if (logError) throw new Error(logError.message)

    revalidateFamilyViews(familyId)
    return ok({ deliveryStatus: (update.delivery_status as DeliveryStatus) ?? null })
  } catch (error) {
    return fail(describeError(error))
  }
}

/** Marca varias invitaciones como enviadas de una vez. */
export async function markManySent(
  familyIds: string[],
  kind: "invitacion" | "recordatorio" = "invitacion",
): Promise<ActionResult<{ updated: number }>> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)
  if (familyIds.length === 0) return fail("Selecciona al menos una familia.")
  if (familyIds.length > 200) return fail("Demasiadas familias en una sola operación.")

  try {
    let updated = 0
    for (const id of familyIds) {
      const result = await logDeliveryAction(id, "marcada_enviada", kind)
      if (result.ok) updated += 1
    }
    revalidateFamilyViews()
    return ok({ updated })
  } catch (error) {
    return fail(describeError(error))
  }
}

/** Limpia la marca de revisión después de hablar con la familia. */
export async function clearReviewFlag(familyId: string): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  try {
    const supabase = createAdminSupabase()
    const { error } = await supabase
      .from("families")
      .update({ needs_review: false, review_reason: null })
      .eq("id", familyId)
    if (error) throw new Error(error.message)

    await supabase
      .from("attendee_menu_selections")
      .update({ needs_review: false, review_reason: null })
      .eq("family_id", familyId)
      .eq("is_current", true)

    await logAudit({
      entityType: "family",
      entityId: familyId,
      action: "revision_resuelta",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
    })

    revalidateFamilyViews(familyId)
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}
