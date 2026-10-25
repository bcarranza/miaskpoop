import { SearchX } from "lucide-react"
import Link from "next/link"
import { AuroraBlobs, StarField } from "@/components/kpop/decor"
import { Button } from "@/components/ui/button"

export default function InvitationNotFound() {
  return (
    <main className="kpop-stage relative flex min-h-dvh items-center justify-center overflow-hidden p-6">
      <AuroraBlobs />
      <StarField />

      <div className="kpop-glass relative z-10 w-full max-w-md rounded-3xl p-8 text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-white/10 text-lavender">
          <SearchX className="size-7" aria-hidden />
        </span>

        <h1 className="font-heading text-2xl font-black text-white">
          No encontramos esta invitación
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-lavender">
          El enlace puede estar incompleto, haber cambiado o ya no estar disponible. Revisa el
          mensaje de WhatsApp que recibiste, o escríbenos para que te enviemos uno nuevo.
        </p>

        <Button
          render={<Link href="/" />}
          variant="secondary"
          className="mt-6 rounded-xl bg-white/15 text-white hover:bg-white/25"
        >
          Ir al inicio
        </Button>
      </div>
    </main>
  )
}
