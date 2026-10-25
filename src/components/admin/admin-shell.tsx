"use client"

/** Marco del panel: navegación lateral en escritorio y menú en teléfono. */
import {
  BarChart3,
  CalendarCog,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  ShoppingBag,
  UsersRound,
  UtensilsCrossed,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useTransition } from "react"
import { signOut } from "@/server/actions/auth"
import type { AdminRole } from "@/lib/types"

const NAV = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard, exact: true },
  { href: "/admin/familias", label: "Familias", icon: UsersRound },
  { href: "/admin/invitaciones", label: "Invitaciones", icon: MessageCircle },
  { href: "/admin/confirmaciones", label: "Confirmaciones", icon: ClipboardList },
  { href: "/admin/menus", label: "Menús", icon: UtensilsCrossed },
  { href: "/admin/pedidos", label: "Pedido McDonald's", icon: ShoppingBag },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/admin/configuracion", label: "Configuración", icon: CalendarCog },
] as const

const ROLE_LABEL: Record<AdminRole, string> = {
  owner: "Propietaria",
  admin: "Administradora",
  viewer: "Sólo lectura",
}

type Props = {
  email: string
  fullName: string | null
  role: AdminRole
  eventName: string
  children: React.ReactNode
}

export function AdminShell({ email, fullName, role, eventName, children }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  const navLinks = (
    <nav className="space-y-1" aria-label="Secciones del panel">
      {NAV.map((item) => {
        const active = isActive(item.href, "exact" in item ? item.exact : false)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  const userBlock = (
    <div className="border-t border-sidebar-border pt-4">
      <p className="truncate text-sm font-semibold text-sidebar-foreground">
        {fullName ?? email}
      </p>
      <p className="truncate text-xs text-sidebar-foreground/60">{email}</p>
      <p className="mt-1 inline-block rounded-full bg-sidebar-accent px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-sidebar-accent-foreground">
        {ROLE_LABEL[role]}
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => signOut())}
        className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50"
      >
        <LogOut className="size-4" aria-hidden />
        {pending ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
    </div>
  )

  return (
    <div className="flex min-h-dvh bg-muted/40">
      {/* Navegación en escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between bg-sidebar p-4 lg:flex">
        <div>
          <Link href="/admin" className="mb-6 block">
            <p className="font-heading text-lg font-black leading-tight text-white">
              {eventName}
            </p>
            <p className="text-xs text-sidebar-foreground/60">Panel de administración</p>
          </Link>
          {navLinks}
        </div>
        {userBlock}
      </aside>

      {/* Navegación en teléfono */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col justify-between overflow-y-auto bg-sidebar p-4">
            <div>
              <div className="mb-6 flex items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-base font-black leading-tight text-white">
                    {eventName}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60">Panel</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar menú"
                  className="rounded-lg p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              {navLinks}
            </div>
            {userBlock}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior en teléfono */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg border border-border p-2 text-foreground"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <p className="truncate font-heading text-sm font-extrabold">{eventName}</p>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
