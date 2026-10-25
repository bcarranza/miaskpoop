"use client"

/** Acciones sobre el enlace de invitación y el estado de la familia. */
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  Power,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  archiveFamily,
  clearReviewFlag,
  deleteFamily,
  regenerateToken,
  restoreFamily,
  setInvitationEnabled,
} from "@/server/actions/families"

type Props = {
  familyId: string
  invitationUrl: string
  invitationEnabled: boolean
  archived: boolean
  needsReview: boolean
}

export function FamilyActions({
  familyId,
  invitationUrl,
  invitationEnabled,
  archived,
  needsReview,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState(invitationUrl)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const run = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) => {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo completar la acción.")
        return
      }
      toast.success(successMessage)
      router.refresh()
    })
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Enlace copiado")
    } catch {
      toast.error("No pudimos copiar el enlace.")
    }
  }

  const handleRegenerate = () => {
    startTransition(async () => {
      const result = await regenerateToken(familyId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const base = url.replace(/\/invitacion\/.*$/, "")
      setUrl(`${base}/invitacion/${result.data.token}`)
      toast.success("Enlace regenerado", {
        description: "El enlace anterior dejó de funcionar. Vuelve a enviar la invitación.",
        duration: 7000,
      })
      router.refresh()
    })
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading text-lg font-extrabold">Enlace de invitación</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Quien tenga este enlace puede confirmar por esta familia. Trátalo como una contraseña.
      </p>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/60 p-3">
        <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <code className="min-w-0 flex-1 break-all text-xs">{url}</code>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyUrl}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted"
        >
          <Copy className="size-4" aria-hidden />
          Copiar
        </button>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted"
        >
          Ver invitación
        </a>

        <button
          type="button"
          onClick={handleRegenerate}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          Regenerar
        </button>
      </div>

      <hr className="my-5 border-border" />

      <h3 className="font-heading text-base font-extrabold">Estado</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              () => setInvitationEnabled(familyId, !invitationEnabled),
              invitationEnabled ? "Invitación desactivada" : "Invitación activada",
            )
          }
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
        >
          <Power className="size-4" aria-hidden />
          {invitationEnabled ? "Desactivar invitación" : "Activar invitación"}
        </button>

        {needsReview && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => clearReviewFlag(familyId), "Revisión marcada como resuelta")}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <CheckCircle2 className="size-4" aria-hidden />
            Marcar revisión como resuelta
          </button>
        )}

        {archived ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => restoreFamily(familyId), "Familia restaurada")}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <ArchiveRestore className="size-4" aria-hidden />
            Restaurar familia
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => archiveFamily(familyId), "Familia archivada")}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
          >
            <Archive className="size-4" aria-hidden />
            Archivar
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Archivar conserva el historial y saca a la familia de los totales. Es lo recomendado.
      </p>

      <hr className="my-5 border-border" />

      {confirmDelete ? (
        <div className="rounded-xl border border-mcd-red/40 bg-mcd-red/10 p-3">
          <p className="text-sm font-bold text-mcd-red">
            ¿Eliminar esta familia de forma definitiva?
          </p>
          <p className="mt-1 text-xs text-mcd-red/90">
            Se borrarán sus invitados, confirmaciones y menús elegidos. Esto no se puede
            deshacer.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteFamily(familyId)
                  if (!result.ok) {
                    toast.error(result.error)
                    setConfirmDelete(false)
                    return
                  }
                  toast.success("Familia eliminada")
                  router.push("/admin/familias")
                  router.refresh()
                })
              }
              className="flex items-center gap-1.5 rounded-xl bg-mcd-red px-3 py-2 text-sm font-bold text-white transition hover:brightness-90 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              Sí, eliminar
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-background"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 text-sm font-semibold text-mcd-red underline-offset-2 hover:underline"
        >
          <Trash2 className="size-4" aria-hidden />
          Eliminar definitivamente
        </button>
      )}
    </section>
  )
}
