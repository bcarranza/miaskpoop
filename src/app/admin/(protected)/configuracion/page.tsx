import { MessageCircle } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { EventSettingsForm } from "@/components/admin/event-settings-form"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { requireEvent } from "@/server/queries"

export const metadata: Metadata = { title: "Configuración" }

export default async function SettingsPage() {
  const event = await requireEvent()

  return (
    <>
      <PageHeader
        title="Configuración del evento"
        description="Fecha, hora, lugar, textos de la invitación y colores. Los cambios se reflejan de inmediato en las invitaciones."
      >
        <Button
          render={<Link href="/admin/configuracion/whatsapp" />}
          variant="outline"
          className="rounded-xl"
        >
          <MessageCircle className="mr-1.5 size-4" aria-hidden />
          Plantillas de WhatsApp
        </Button>
      </PageHeader>

      <div className="max-w-4xl">
        <EventSettingsForm event={event} />
      </div>
    </>
  )
}
