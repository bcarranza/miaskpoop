"use client"

import { AlertCircle, Loader2, LogIn } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { signInWithPassword } from "@/server/actions/auth"

export function LoginForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await signInWithPassword(email, password)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.replace(result.data.redirectTo)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-lavender"
        >
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(changeEvent) => setEmail(changeEvent.target.value)}
          className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-base text-white placeholder:text-lavender/50 focus:outline-none focus:ring-2 focus:ring-neon"
          placeholder="tucorreo@ejemplo.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-lavender"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          minLength={8}
          value={password}
          onChange={(changeEvent) => setPassword(changeEvent.target.value)}
          className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-base text-white placeholder:text-lavender/50 focus:outline-none focus:ring-2 focus:ring-neon"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-mcd-red/50 bg-mcd-red/15 px-3 py-2.5 text-sm text-white"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-mcd-red" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="kpop-neon-glow flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon to-grape px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white transition hover:from-magenta disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Entrando…
          </>
        ) : (
          <>
            <LogIn className="size-4" aria-hidden />
            Iniciar sesión
          </>
        )}
      </button>
    </form>
  )
}
