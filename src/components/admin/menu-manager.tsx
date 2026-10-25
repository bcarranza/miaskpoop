"use client"

/**
 * Administración del catálogo de menús.
 *
 * Al deshabilitar un menú, las familias que ya lo eligieron quedan
 * marcadas para revisión: su elección no se reemplaza en silencio.
 */
import {
  AlertCircle,
  Baby,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import type { GuestType, MenuItemRecord, MenuOrderRow } from "@/lib/types"
import {
  createMenuItem,
  deleteMenuItem,
  setMenuAvailability,
  updateMenuItem,
} from "@/server/actions/menus"

type Props = {
  menus: MenuItemRecord[]
  order: MenuOrderRow[]
  canWrite: boolean
}

type DraftValues = {
  code: string
  name: string
  description: string
  audience: GuestType
  image_url: string
  price: string
  is_available: boolean
  sort_order: number
}

const emptyDraft = (audience: GuestType, sortOrder: number): DraftValues => ({
  code: "",
  name: "",
  description: "",
  audience,
  image_url: "",
  price: "",
  is_available: true,
  sort_order: sortOrder,
})

export function MenuManager({ menus, order, canWrite }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState<GuestType | null>(null)
  const [draft, setDraft] = useState<DraftValues | null>(null)
  const [error, setError] = useState<string | null>(null)

  const quantities = new Map(order.map((row) => [row.menu_item_id, row.quantity]))

  const startEdit = (menu: MenuItemRecord) => {
    setCreating(null)
    setEditingId(menu.id)
    setError(null)
    setDraft({
      code: menu.code,
      name: menu.name,
      description: menu.description ?? "",
      audience: menu.audience,
      image_url: menu.image_url ?? "",
      price: menu.price_cents === null ? "" : (menu.price_cents / 100).toFixed(2),
      is_available: menu.is_available,
      sort_order: menu.sort_order,
    })
  }

  const startCreate = (audience: GuestType) => {
    setEditingId(null)
    setError(null)
    setCreating(audience)
    setDraft(emptyDraft(audience, menus.length + 1))
  }

  const cancel = () => {
    setEditingId(null)
    setCreating(null)
    setDraft(null)
    setError(null)
  }

  const save = () => {
    if (!draft) return
    setError(null)

    const payload = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      audience: draft.audience,
      image_url: draft.image_url.trim() || null,
      price: draft.price.trim() === "" ? null : Number(draft.price),
      is_available: draft.is_available,
      sort_order: draft.sort_order,
    }

    startTransition(async () => {
      if (editingId) {
        const result = await updateMenuItem(editingId, payload)
        if (!result.ok) {
          setError(result.error)
          return
        }
        if (result.data.flaggedSelections > 0) {
          toast.warning(
            `${result.data.flaggedSelections} selección(es) quedaron marcadas para revisión`,
            { duration: 8000 },
          )
        } else {
          toast.success("Menú actualizado")
        }
      } else {
        const result = await createMenuItem(payload)
        if (!result.ok) {
          setError(result.error)
          return
        }
        toast.success("Menú creado")
      }

      cancel()
      router.refresh()
    })
  }

  const toggleAvailability = (menu: MenuItemRecord) => {
    startTransition(async () => {
      const result = await setMenuAvailability(menu.id, !menu.is_available)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (!menu.is_available) {
        toast.success(`${menu.name} está disponible de nuevo`)
      } else if (result.data.flaggedSelections > 0) {
        toast.warning(
          `${menu.name} se deshabilitó. ${result.data.flaggedSelections} familia(s) por revisar.`,
          { duration: 8000 },
        )
      } else {
        toast.success(`${menu.name} se deshabilitó`)
      }
      router.refresh()
    })
  }

  const remove = (menu: MenuItemRecord) => {
    startTransition(async () => {
      const result = await deleteMenuItem(menu.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Menú eliminado")
      router.refresh()
    })
  }

  const DraftForm = () => {
    if (!draft) return null

    return (
      <div className="rounded-2xl border-2 border-primary/40 bg-accent/30 p-4">
        {error && (
          <p
            role="alert"
            className="mb-3 flex items-start gap-2 rounded-xl border border-mcd-red/40 bg-mcd-red/10 px-3 py-2 text-sm font-semibold text-mcd-red"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Nombre del menú</span>
            <input
              type="text"
              value={draft.name}
              onChange={(changeEvent) =>
                setDraft({ ...draft, name: changeEvent.target.value })
              }
              placeholder="Cajita Feliz de Nuggets"
              className="input-base"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold">
              Código interno (sin espacios)
            </span>
            <input
              type="text"
              value={draft.code}
              onChange={(changeEvent) =>
                setDraft({
                  ...draft,
                  code: changeEvent.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "_"),
                })
              }
              placeholder="cajita_nuggets"
              className="input-base font-mono text-sm"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold">Descripción</span>
            <input
              type="text"
              value={draft.description}
              onChange={(changeEvent) =>
                setDraft({ ...draft, description: changeEvent.target.value })
              }
              placeholder="Cajita Feliz para niños."
              className="input-base"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Para</span>
            <select
              value={draft.audience}
              onChange={(changeEvent) =>
                setDraft({ ...draft, audience: changeEvent.target.value as GuestType })
              }
              className="input-base"
            >
              <option value="nino">Niños (Cajita Feliz)</option>
              <option value="adulto">Adultos</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold">
              Precio en quetzales (opcional)
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft.price}
              onChange={(changeEvent) =>
                setDraft({ ...draft, price: changeEvent.target.value })
              }
              placeholder="Déjalo vacío si no lo sabes"
              className="input-base"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Imagen (URL, opcional)</span>
            <input
              type="url"
              value={draft.image_url}
              onChange={(changeEvent) =>
                setDraft({ ...draft, image_url: changeEvent.target.value })
              }
              placeholder="https://…"
              className="input-base"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold">Orden</span>
            <input
              type="number"
              min={0}
              max={999}
              value={draft.sort_order}
              onChange={(changeEvent) =>
                setDraft({ ...draft, sort_order: Number(changeEvent.target.value) || 0 })
              }
              className="input-base"
            />
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.is_available}
            onChange={(changeEvent) =>
              setDraft({ ...draft, is_available: changeEvent.target.checked })
            }
            className="size-4 accent-[#ff2e9a]"
          />
          Disponible para elegir
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Guardar
          </button>
          <button
            type="button"
            onClick={cancel}
            className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
          >
            <X className="size-4" aria-hidden />
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const renderGroup = (audience: GuestType, title: string, note: string) => {
    const group = menus.filter((menu) => menu.audience === audience)

    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-lg font-extrabold">
              {audience === "nino" ? (
                <Baby className="size-5 text-primary" aria-hidden />
              ) : (
                <UserRound className="size-5 text-grape" aria-hidden />
              )}
              {title}
            </h2>
            <p className="text-sm text-muted-foreground">{note}</p>
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() => startCreate(audience)}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold transition hover:bg-muted"
            >
              <Plus className="size-4" aria-hidden />
              Agregar
            </button>
          )}
        </div>

        {creating === audience && <div className="mt-4">{DraftForm()}</div>}

        <ul className="mt-4 space-y-3">
          {group.map((menu) => {
            const quantity = quantities.get(menu.id) ?? 0

            if (editingId === menu.id) {
              return <li key={menu.id}>{DraftForm()}</li>
            }

            return (
              <li
                key={menu.id}
                className={`rounded-xl border p-4 ${
                  menu.is_available ? "border-border" : "border-dashed border-border bg-muted/40"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {menu.name}
                      {!menu.is_available && (
                        <span className="chip ml-2 bg-muted text-muted-foreground">
                          No disponible
                        </span>
                      )}
                    </p>
                    {menu.description && (
                      <p className="text-sm text-muted-foreground">{menu.description}</p>
                    )}
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{menu.code}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-heading text-2xl font-black tabular-nums">{quantity}</p>
                    <p className="text-[0.65rem] uppercase text-muted-foreground">
                      {quantity === 1 ? "pedido" : "pedidos"}
                    </p>
                    {menu.price_cents !== null && (
                      <p className="mt-1 text-sm font-semibold">
                        Q {(menu.price_cents / 100).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {canWrite && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => startEdit(menu)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-muted"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Editar
                    </button>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleAvailability(menu)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
                    >
                      {menu.is_available ? "Deshabilitar" : "Habilitar"}
                    </button>

                    {quantity === 0 && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => remove(menu)}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-mcd-red transition hover:bg-mcd-red/10 disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}

          {group.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No hay menús en esta categoría.
            </li>
          )}
        </ul>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      {renderGroup(
        "adulto",
        "Menús para adultos",
        "Sólo se muestran a los acompañantes adultos.",
      )}
      {renderGroup(
        "nino",
        "Cajita Feliz (niños)",
        "Sólo se muestran a los niños y niñas.",
      )}
    </div>
  )
}
