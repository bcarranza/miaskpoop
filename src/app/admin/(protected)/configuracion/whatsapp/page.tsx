import { Info } from "lucide-react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/admin/page-header"
import { WhatsAppTemplateForm } from "@/components/admin/whatsapp-template-form"
import { listFamilies, requireEvent } from "@/server/queries"

export const metadata: Metadata = { title: "Plantillas de WhatsApp" }

export default async function WhatsAppSettingsPage() {
  const [event, families] = await Promise.all([requireEvent(), listFamilies()])

  // Se usa una familia real para la vista previa; si no hay ninguna, un ejemplo.
  const sample = families[0]
  const sampleFamily = sample
    ? {
        name: sample.name,
        primary_contact_name: sample.primary_contact_name,
        whatsapp_phone: sample.whatsapp_phone,
        max_attendees: sample.max_attendees,
        invited_children_names: sample.invited_children_names ?? [],
      }
    : {
        name: "López",
        primary_contact_name: "Ana López",
        whatsapp_phone: "+50255550101",
        max_attendees: 3,
        invited_children_names: ["Sofía"],
      }

  return (
    <>
      <PageHeader
        title="Plantillas de WhatsApp"
        description="El texto que se abre en WhatsApp al enviar invitaciones y recordatorios."
        backHref="/admin/configuracion"
        backLabel="Configuración"
      />

      <div className="mb-6 flex items-start gap-2 rounded-2xl border border-grape/25 bg-accent/60 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-grape" aria-hidden />
        <div>
          <p className="font-semibold text-accent-foreground">
            Cada familia recibe su propio enlace.
          </p>
          <p className="mt-1 text-muted-foreground">
            El marcador <code className="font-mono">{"{{RSVP_URL}}"}</code> es obligatorio: se
            sustituye por la URL única de confirmación de cada familia. El mensaje se codifica con{" "}
            <code className="font-mono">encodeURIComponent</code>, así que los emojis y las
            tildes se conservan.
          </p>
        </div>
      </div>

      <div className="max-w-5xl">
        <WhatsAppTemplateForm
          event={event}
          sampleFamily={sampleFamily}
          sampleIsReal={Boolean(sample)}
        />
      </div>
    </>
  )
}
