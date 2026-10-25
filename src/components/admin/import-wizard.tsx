"use client"

/**
 * Importación de familias desde Excel o CSV.
 *
 * Primero se previsualiza y se muestran errores y advertencias. Nada se
 * guarda hasta que la persona administradora confirma, y el servidor
 * vuelve a validar todo antes de escribir.
 */
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import type { RawImportRow } from "@/lib/excel/import"
import {
  confirmFamilyImport,
  previewFamilyImport,
  type ConfirmImportResult,
  type ImportPreviewResult,
} from "@/server/actions/import"

export function ImportWizard() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)
  const [result, setResult] = useState<ConfirmImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError("Selecciona un archivo .xlsx o .csv.")
      return
    }

    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append("file", file)

    startTransition(async () => {
      const response = await previewFamilyImport(formData)
      if (!response.ok) {
        setError(response.error)
        setPreview(null)
        return
      }
      setPreview(response.data)
    })
  }

  const confirm = () => {
    if (!preview) return

    // Se reenvían las filas crudas: el servidor decide qué es válido.
    const rows: RawImportRow[] = preview.rows
      .filter((row) => row.valid)
      .map((row) => ({
        rowNumber: row.rowNumber,
        familia: row.familia,
        responsable: row.responsable,
        whatsapp: row.whatsappE164 ?? row.whatsappOriginal,
        cupos: String(row.cupos),
        ninos: row.ninos.join(", "),
        notas: row.notas ?? "",
      }))

    startTransition(async () => {
      const response = await confirmFamilyImport(rows)
      if (!response.ok) {
        setError(response.error)
        return
      }
      setResult(response.data)
      setPreview(null)
      toast.success(`${response.data.created} familia(s) importada(s)`)
      router.refresh()
    })
  }

  // ------------------------------------------------------------------
  // Resultado final
  // ------------------------------------------------------------------
  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
          <p className="flex items-center gap-2 font-heading text-lg font-black text-emerald-700">
            <CheckCircle2 className="size-5" aria-hidden />
            Importación terminada
          </p>
          <ul className="mt-2 space-y-1 text-sm text-emerald-900">
            <li>
              <span className="font-bold">{result.created}</span> familia(s) creada(s)
            </li>
            <li>
              <span className="font-bold">{result.childrenCreated}</span> niño(s) invitado(s)
              registrado(s)
            </li>
            {result.skipped > 0 && (
              <li>
                <span className="font-bold">{result.skipped}</span> fila(s) no se importaron
              </li>
            )}
          </ul>
        </div>

        {result.errors.length > 0 && (
          <div className="rounded-2xl border border-mcd-red/40 bg-mcd-red/10 p-4">
            <p className="font-bold text-mcd-red">Algunas filas tuvieron problemas</p>
            <ul className="mt-2 space-y-1 text-sm text-mcd-red/90">
              {result.errors.map((item, index) => (
                <li key={index}>
                  <span className="font-semibold">{item.familia}</span>: {item.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin/familias")}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            Ver familias
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null)
              if (inputRef.current) inputRef.current.value = ""
            }}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
          >
            Importar otro archivo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Plantilla */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-extrabold">1. Descarga la plantilla</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Trae las columnas correctas, instrucciones y tres ejemplos.
        </p>
        <a
          href="/api/admin/plantilla"
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
        >
          <Download className="size-4" aria-hidden />
          Descargar plantilla .xlsx
        </a>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-muted/60 text-left">
              <tr>
                {["Familia", "Responsable", "WhatsApp", "Cupos máximos", "Niños invitados", "Notas"].map(
                  (column) => (
                    <th key={column} scope="col" className="px-3 py-2 font-bold">
                      {column}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-3 py-2">López</td>
                <td className="px-3 py-2">Ana López</td>
                <td className="px-3 py-2">5555 0101</td>
                <td className="px-3 py-2">2</td>
                <td className="px-3 py-2">Sofía</td>
                <td className="px-3 py-2">Vecina del colegio</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Pérez</td>
                <td className="px-3 py-2">Lucía Pérez</td>
                <td className="px-3 py-2">+502 5555 0103</td>
                <td className="px-3 py-2">5</td>
                <td className="px-3 py-2">Mateo, Camila</td>
                <td className="px-3 py-2" />
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Los <span className="font-semibold">cupos máximos</span> incluyen a los niños
          invitados. Para varios niños, sepáralos con coma, o usa una segunda hoja llamada
          «Niños» con las columnas Familia y Niño.
        </p>
      </section>

      {/* Subida */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-extrabold">2. Sube tu archivo</h2>

        <form onSubmit={handleFile} className="mt-3 space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center transition hover:border-primary">
            <FileSpreadsheet className="size-8 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold">
              Selecciona un archivo .xlsx o .csv
            </span>
            <span className="text-xs text-muted-foreground">Máximo 4 MB y 500 filas</span>
            <input
              ref={inputRef}
              type="file"
              name="file"
              accept=".xlsx,.csv,.txt,.tsv"
              className="sr-only"
              onChange={() => setError(null)}
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Analizando…
              </>
            ) : (
              <>
                <Upload className="size-4" aria-hidden />
                Previsualizar
              </>
            )}
          </button>
        </form>

        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl border border-mcd-red/40 bg-mcd-red/10 px-3 py-2.5 text-sm font-medium text-mcd-red"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Previsualización */}
      {preview && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-extrabold">3. Revisa antes de importar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Archivo: {preview.fileName} · hoja «{preview.sheetName}»
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Listas para importar" value={preview.validCount} tone="green" />
            <Metric label="Con errores" value={preview.errorCount} tone="red" />
            <Metric label="Con advertencias" value={preview.warningCount} tone="yellow" />
            <Metric label="Cupos totales" value={preview.totalCapacity} tone="neutral" />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/60 text-left text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Fila
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Familia
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Responsable
                  </th>
                  <th scope="col" className="px-3 py-2">
                    WhatsApp
                  </th>
                  <th scope="col" className="px-3 py-2 text-center">
                    Cupo
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Niños
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={row.valid ? "" : "bg-mcd-red/5"}
                  >
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                      {row.rowNumber}
                    </td>
                    <td className="px-3 py-2 font-semibold">{row.familia || "—"}</td>
                    <td className="px-3 py-2">{row.responsable || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.whatsappDisplay ?? (row.whatsappOriginal || "—")}
                    </td>
                    <td className="px-3 py-2 text-center font-bold tabular-nums">
                      {row.cupos || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.ninos.length > 0 ? row.ninos.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.issues.length === 0 ? (
                        <span className="chip bg-emerald-500/15 text-emerald-700">
                          <CheckCircle2 className="size-3" aria-hidden />
                          Lista
                        </span>
                      ) : (
                        <ul className="space-y-1">
                          {row.issues.map((issue, index) => (
                            <li
                              key={index}
                              className={`flex items-start gap-1 text-xs ${
                                issue.level === "error"
                                  ? "font-semibold text-mcd-red"
                                  : "text-amber-700"
                              }`}
                            >
                              {issue.level === "error" ? (
                                <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden />
                              ) : (
                                <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                              )}
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={confirm}
              disabled={pending || preview.validCount === 0}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Importando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" aria-hidden />
                  Importar {preview.validCount} familia(s)
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
            >
              Cancelar
            </button>

            {preview.errorCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Las {preview.errorCount} fila(s) con errores no se importarán. Corrígelas en el
                archivo y súbelo de nuevo.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "green" | "red" | "yellow" | "neutral"
}) {
  const colors = {
    green: "text-emerald-600",
    red: "text-mcd-red",
    yellow: "text-amber-600",
    neutral: "text-foreground",
  }[tone]

  return (
    <div className="rounded-xl bg-muted/60 p-3 text-center">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`font-heading text-2xl font-black tabular-nums ${colors}`}>{value}</p>
    </div>
  )
}
