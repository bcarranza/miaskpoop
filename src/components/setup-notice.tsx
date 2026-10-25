/**
 * Aviso de configuración pendiente.
 *
 * Se muestra cuando faltan las credenciales de Supabase, en lugar de
 * fallar con un error opaco. Así la aplicación compila y se despliega
 * antes de tener la base de datos lista.
 */
import { AlertTriangle, Database, Terminal } from "lucide-react"

export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="kpop-stage flex min-h-dvh items-center justify-center p-6">
      <div className="kpop-glass w-full max-w-2xl rounded-3xl p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-mcd-yellow/20 text-mcd-yellow">
            <AlertTriangle className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-black text-white">
              Falta conectar la base de datos
            </h1>
            <p className="text-sm text-lavender">
              La aplicación está lista, pero todavía no sabe a qué proyecto de Supabase hablarle.
            </p>
          </div>
        </div>

        {missing.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white">
              <Database className="size-4" aria-hidden />
              Variables de entorno pendientes
            </h2>
            <ul className="space-y-1.5">
              {missing.map((name) => (
                <li
                  key={name}
                  className="rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-mcd-yellow"
                >
                  {name}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white">
            <Terminal className="size-4" aria-hidden />
            Pasos
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-lavender">
            <li>
              Crea un proyecto en Supabase y copia la URL, la clave <code>anon</code> y la clave{" "}
              <code>service_role</code>.
            </li>
            <li>
              Copia <code className="text-white">.env.example</code> a{" "}
              <code className="text-white">.env.local</code> y pega los valores.
            </li>
            <li>
              Aplica en orden los archivos de{" "}
              <code className="text-white">supabase/migrations/</code> desde el editor SQL de
              Supabase.
            </li>
            <li>
              Opcional: ejecuta <code className="text-white">supabase/seed/families.sql</code> para
              cargar diez familias de ejemplo.
            </li>
            <li>Reinicia el servidor de desarrollo y vuelve a cargar esta página.</li>
          </ol>
        </section>

        <p className="mt-6 text-xs text-lavender/70">
          El archivo README.md tiene las instrucciones completas, incluyendo el despliegue en
          Vercel.
        </p>
      </div>
    </main>
  )
}
