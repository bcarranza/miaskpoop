/**
 * Video de YouTube visible al final de la página. La persona decide
 * cuándo reproducirlo, así que no depende de las reglas de autoplay.
 */
import { Music } from "lucide-react"

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)
  if (match) return match[1]
  return /^[A-Za-z0-9_-]{11}$/.test(url) ? url : null
}

export function VideoEmbed({ url, className = "" }: { url: string; className?: string }) {
  const videoId = extractVideoId(url.trim())
  if (!videoId) return null

  return (
    <section aria-label="Video de la fiesta" className={`kpop-glass w-full rounded-3xl p-3 sm:p-4 ${className}`}>
      <p className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-lavender">
        <Music className="size-3.5" aria-hidden />
        ¡Dale play!
      </p>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black/40">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
          title="Video de la fiesta"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      </div>
    </section>
  )
}
