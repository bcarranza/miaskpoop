import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { FamilyForm } from "@/components/admin/family-form"
import { PageHeader } from "@/components/admin/page-header"
import { getFamilyDetail } from "@/server/queries"

export const metadata: Metadata = { title: "Editar familia" }

export default async function EditFamilyPage({
  params,
}: PageProps<"/admin/familias/[id]/editar">) {
  const { id } = await params
  const detail = await getFamilyDetail(id)

  if (!detail) notFound()

  const { family, guests } = detail

  return (
    <>
      <PageHeader
        title={`Editar familia ${family.name}`}
        description="Cambia el cupo, los datos de contacto y la lista de niños invitados."
        backHref={`/admin/familias/${family.id}`}
        backLabel="Volver al detalle"
      />

      <div className="max-w-3xl">
        <FamilyForm
          familyId={family.id}
          confirmedAttendees={family.confirmed_attendees}
          initial={{
            name: family.name,
            primary_contact_name: family.primary_contact_name,
            whatsapp_phone: family.whatsapp_phone,
            secondary_contact_name: family.secondary_contact_name ?? "",
            secondary_contact_phone: family.secondary_contact_phone ?? "",
            max_attendees: family.max_attendees,
            invitation_enabled: family.invitation_enabled,
            notes: family.notes ?? "",
            invited_children: guests
              .filter((guest) => guest.is_invited_child)
              .map((guest) => ({ id: guest.id, name: guest.name })),
          }}
        />
      </div>
    </>
  )
}
