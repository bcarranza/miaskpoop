"use server"

/** Configuración del evento y de las plantillas de WhatsApp. */
import { revalidatePath } from "next/cache"
import {
  eventSettingsSchema,
  fieldErrors,
  firstErrorMessage,
  type EventSettingsInput,
} from "@/lib/validation"
import { assertWriteAccess } from "../auth"
import { requireEvent } from "../queries"
import { createAdminSupabase } from "../supabase/server"
import { describeError, fail, logAudit, ok, type ActionResult } from "./shared"

export async function updateEventSettings(
  input: EventSettingsInput,
): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  const parsed = eventSettingsSchema.safeParse(input)
  if (!parsed.success) return fail(firstErrorMessage(parsed.error), fieldErrors(parsed.error))
  const data = parsed.data

  try {
    const event = await requireEvent()
    const supabase = createAdminSupabase()

    const { error } = await supabase
      .from("events")
      .update({
        name: data.name,
        celebrant_name: data.celebrant_name,
        celebrant_age: data.celebrant_age,
        event_date: data.event_date,
        start_time: data.start_time,
        timezone: data.timezone,
        venue_name: data.venue_name,
        venue_address: data.venue_address,
        venue_maps_url: data.venue_maps_url || null,
        rsvp_deadline: data.rsvp_deadline,
        allow_rsvp_edits: data.allow_rsvp_edits,
        invitation_headline: data.invitation_headline,
        invitation_subheadline: data.invitation_subheadline,
        invitation_message: data.invitation_message,
        whatsapp_invitation_template: data.whatsapp_invitation_template,
        whatsapp_reminder_template: data.whatsapp_reminder_template,
        theme_primary_color: data.theme_primary_color,
        theme_secondary_color: data.theme_secondary_color,
        theme_accent_color: data.theme_accent_color,
        background_image_url: data.background_image_url || null,
        music_enabled: data.music_enabled,
        music_url: data.music_url || null,
      })
      .eq("id", event.id)

    if (error) throw new Error(error.message)

    await logAudit({
      eventId: event.id,
      entityType: "event",
      entityId: event.id,
      action: "evento_actualizado",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
      before: {
        event_date: event.event_date,
        start_time: event.start_time,
        rsvp_deadline: event.rsvp_deadline,
        venue_name: event.venue_name,
      },
      after: {
        event_date: data.event_date,
        start_time: data.start_time,
        rsvp_deadline: data.rsvp_deadline,
        venue_name: data.venue_name,
      },
    })

    revalidatePath("/", "layout")
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}

/** Guarda sólo las plantillas de WhatsApp. */
export async function updateWhatsAppTemplates(
  invitationTemplate: string,
  reminderTemplate: string,
): Promise<ActionResult> {
  const access = await assertWriteAccess()
  if (!access.ok) return fail(access.error)

  const invitation = invitationTemplate.trim()
  const reminder = reminderTemplate.trim()

  if (invitation.length < 20) return fail("La plantilla de invitación es demasiado corta.")
  if (reminder.length < 20) return fail("La plantilla de recordatorio es demasiado corta.")
  if (invitation.length > 3000 || reminder.length > 3000) {
    return fail("WhatsApp no admite mensajes tan largos. Acorta la plantilla.")
  }
  if (!invitation.includes("{{RSVP_URL}}")) {
    return fail("La plantilla de invitación debe incluir {{RSVP_URL}}.")
  }
  if (!reminder.includes("{{RSVP_URL}}")) {
    return fail("La plantilla de recordatorio debe incluir {{RSVP_URL}}.")
  }

  try {
    const event = await requireEvent()
    const supabase = createAdminSupabase()

    const { error } = await supabase
      .from("events")
      .update({
        whatsapp_invitation_template: invitation,
        whatsapp_reminder_template: reminder,
      })
      .eq("id", event.id)

    if (error) throw new Error(error.message)

    await logAudit({
      eventId: event.id,
      entityType: "event",
      entityId: event.id,
      action: "plantillas_whatsapp_actualizadas",
      actorType: "admin",
      actorId: access.session.userId,
      actorLabel: access.session.email,
    })

    revalidatePath("/admin/configuracion/whatsapp")
    revalidatePath("/admin/invitaciones")
    return ok()
  } catch (error) {
    return fail(describeError(error))
  }
}
