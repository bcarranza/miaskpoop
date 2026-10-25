/**
 * Elementos decorativos K-pop originales, hechos con SVG y CSS.
 *
 * No se usan marcas, grupos, artistas, canciones ni imágenes de
 * terceros. Todo es geometría propia.
 *
 * Son puramente ornamentales: van marcados como aria-hidden y se
 * ocultan cuando la persona pide menos movimiento (clase .kpop-decor).
 */

export function StageLights({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`kpop-decor pointer-events-none absolute inset-x-0 top-0 h-[70vh] overflow-hidden ${className}`}
    >
      <div className="kpop-beams animate-beam absolute -top-40 left-1/2 h-[120vh] w-[180vw] -translate-x-1/2" />
    </div>
  )
}

/** Fondo de manchas de color en movimiento lento. */
export function AuroraBlobs({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`kpop-decor pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="animate-aurora absolute -left-24 top-10 size-[28rem] rounded-full bg-neon/25 blur-3xl" />
      <div
        className="animate-aurora absolute -right-20 top-40 size-[32rem] rounded-full bg-grape/25 blur-3xl"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="animate-aurora absolute bottom-0 left-1/3 size-[26rem] rounded-full bg-lavender/20 blur-3xl"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  )
}

/** Bola de disco en SVG, con facetas y brillo. */
export function DiscoBall({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size * 1.25}
      viewBox="0 0 72 90"
      className={`kpop-decor ${className}`}
    >
      <defs>
        <radialGradient id="ballBody" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#c7a4ff" />
          <stop offset="100%" stopColor="#6d28d9" />
        </radialGradient>
        <radialGradient id="ballGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ff2e9a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff2e9a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Cuerda */}
      <line x1="36" y1="0" x2="36" y2="16" stroke="#c7a4ff" strokeWidth="1.5" opacity="0.7" />
      <rect x="32" y="14" width="8" height="5" rx="1.5" fill="#a855f7" />

      <circle cx="36" cy="54" r="34" fill="url(#ballGlow)" />
      <circle cx="36" cy="54" r="24" fill="url(#ballBody)" />

      {/* Facetas */}
      <g stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.7" fill="none">
        <ellipse cx="36" cy="54" rx="24" ry="8" />
        <ellipse cx="36" cy="54" rx="24" ry="16" />
        <ellipse cx="36" cy="54" rx="8" ry="24" />
        <ellipse cx="36" cy="54" rx="16" ry="24" />
        <line x1="12" y1="54" x2="60" y2="54" />
      </g>

      {/* Destellos */}
      <g fill="#ffffff">
        <circle cx="27" cy="44" r="2.4" opacity="0.95" />
        <circle cx="45" cy="60" r="1.6" opacity="0.7" />
        <circle cx="40" cy="41" r="1.2" opacity="0.6" />
      </g>
    </svg>
  )
}

/** Micrófono de mano en SVG. */
export function Microphone({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`kpop-decor ${className}`}
    >
      <defs>
        <linearGradient id="micGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff2e9a" />
          <stop offset="55%" stopColor="#c7a4ff" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {/* Rejilla */}
      <circle cx="24" cy="15" r="10" fill="url(#micGrad)" />
      <g stroke="#1a0b2e" strokeOpacity="0.35" strokeWidth="1">
        <line x1="15" y1="12" x2="33" y2="12" />
        <line x1="15" y1="15" x2="33" y2="15" />
        <line x1="16" y1="18" x2="32" y2="18" />
      </g>
      {/* Cuerpo */}
      <rect x="21" y="24" width="6" height="8" rx="2" fill="#a855f7" />
      <rect x="18" y="31" width="12" height="4" rx="2" fill="#c7a4ff" />
      <rect x="22.5" y="34" width="3" height="11" rx="1.5" fill="#6d28d9" />
      <ellipse cx="24" cy="45" rx="7" ry="2.4" fill="#4c1d95" />
      {/* Ondas de sonido */}
      <g stroke="#ffc72c" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.8">
        <path d="M37 9c2.6 3.6 2.6 8.4 0 12" />
        <path d="M11 9c-2.6 3.6-2.6 8.4 0 12" />
      </g>
    </svg>
  )
}

/** Estrella de cuatro puntas. */
export function Sparkle({
  size = 20,
  className = "",
  color = "#ffc72c",
}: {
  size?: number
  className?: string
  color?: string
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`kpop-decor ${className}`}
    >
      <path
        d="M12 0c1 7 4 10 12 12-8 2-11 5-12 12-1-7-4-10-12-12 8-2 11-5 12-12Z"
        fill={color}
      />
    </svg>
  )
}

export function HeartIcon({
  size = 20,
  className = "",
  color = "#ff2e9a",
}: {
  size?: number
  className?: string
  color?: string
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`kpop-decor ${className}`}
    >
      <path
        d="M12 21s-8-5.1-8-10.4C4 7.3 6.3 5 9.2 5c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2C19.7 5 22 7.3 22 10.6 22 15.9 12 21 12 21Z"
        fill={color}
      />
    </svg>
  )
}

/** Cielo de estrellas: posiciones fijas para que no cambien al renderizar. */
const STARS = [
  { top: "8%", left: "12%", size: 14, delay: "0s" },
  { top: "16%", left: "82%", size: 18, delay: "-0.6s" },
  { top: "28%", left: "32%", size: 10, delay: "-1.2s" },
  { top: "38%", left: "68%", size: 16, delay: "-1.8s" },
  { top: "52%", left: "8%", size: 12, delay: "-2.4s" },
  { top: "62%", left: "90%", size: 14, delay: "-0.9s" },
  { top: "72%", left: "44%", size: 10, delay: "-1.5s" },
  { top: "84%", left: "24%", size: 16, delay: "-2.1s" },
  { top: "90%", left: "74%", size: 12, delay: "-0.3s" },
  { top: "46%", left: "54%", size: 8, delay: "-2.7s" },
] as const

export function StarField({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`kpop-decor pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {STARS.map((star, index) => (
        <span
          key={index}
          className="animate-twinkle absolute"
          style={{ top: star.top, left: star.left, animationDelay: star.delay }}
        >
          <Sparkle size={star.size} color={index % 3 === 0 ? "#ffc72c" : "#ffffff"} />
        </span>
      ))}
    </div>
  )
}

/** Lluvia de confeti con posiciones fijas (sin aleatoriedad en el render). */
const CONFETTI = [
  { left: "4%", delay: "0s", duration: "7.5s", color: "#ff2e9a", shape: "rect" },
  { left: "12%", delay: "-1.4s", duration: "8.5s", color: "#ffc72c", shape: "circle" },
  { left: "21%", delay: "-2.8s", duration: "6.8s", color: "#c7a4ff", shape: "rect" },
  { left: "29%", delay: "-0.7s", duration: "9.2s", color: "#a855f7", shape: "circle" },
  { left: "37%", delay: "-3.5s", duration: "7.1s", color: "#da291c", shape: "rect" },
  { left: "46%", delay: "-1.9s", duration: "8.1s", color: "#ffffff", shape: "circle" },
  { left: "54%", delay: "-4.2s", duration: "6.5s", color: "#ff2e9a", shape: "rect" },
  { left: "63%", delay: "-2.3s", duration: "9.6s", color: "#ffc72c", shape: "circle" },
  { left: "71%", delay: "-0.4s", duration: "7.8s", color: "#c7a4ff", shape: "rect" },
  { left: "79%", delay: "-3.1s", duration: "8.8s", color: "#a855f7", shape: "circle" },
  { left: "88%", delay: "-1.1s", duration: "6.9s", color: "#ff2e9a", shape: "rect" },
  { left: "95%", delay: "-2.6s", duration: "9.4s", color: "#ffc72c", shape: "rect" },
] as const

export function ConfettiRain({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`kpop-decor pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
    >
      {CONFETTI.map((piece, index) => (
        <span
          key={index}
          className="animate-confetti absolute top-0 block"
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            width: piece.shape === "circle" ? 8 : 6,
            height: piece.shape === "circle" ? 8 : 12,
            backgroundColor: piece.color,
            borderRadius: piece.shape === "circle" ? "9999px" : "2px",
            opacity: 0.75,
          }}
        />
      ))}
    </div>
  )
}

/** Tira decorativa con corazones, estrellas y micrófonos. */
export function DecorStrip({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`kpop-decor flex items-center justify-center gap-3 opacity-80 ${className}`}
    >
      <HeartIcon size={16} />
      <Sparkle size={14} color="#ffffff" />
      <Microphone size={22} className="animate-float" />
      <Sparkle size={14} color="#ffc72c" />
      <HeartIcon size={16} color="#c7a4ff" />
    </div>
  )
}
