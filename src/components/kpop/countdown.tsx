"use client"

/**
 * Cuenta regresiva hasta la fiesta.
 *
 * Recibe el instante exacto en ISO para que el servidor y el navegador
 * coincidan, y arranca mostrando el valor calculado en el servidor
 * (así no hay salto visual ni desajuste de hidratación).
 */
import { useEffect, useState } from "react"
import { getCountdown, type Countdown } from "@/lib/date"

type Props = {
  /** Instante de inicio en ISO 8601 (UTC). */
  targetIso: string
  /** Valor inicial calculado en el servidor. */
  initial: Countdown
  className?: string
}

const UNITS = [
  { key: "days", singular: "día", plural: "días" },
  { key: "hours", singular: "hora", plural: "horas" },
  { key: "minutes", singular: "minuto", plural: "minutos" },
  { key: "seconds", singular: "segundo", plural: "segundos" },
] as const

export function CountdownTimer({ targetIso, initial, className = "" }: Props) {
  const [countdown, setCountdown] = useState<Countdown>(initial)

  useEffect(() => {
    const target = new Date(targetIso)
    const tick = () => setCountdown(getCountdown(target))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [targetIso])

  if (countdown.isPast) {
    return (
      <p className={`text-center text-lg font-semibold text-lavender ${className}`}>
        ¡La fiesta ya comenzó! 🎉
      </p>
    )
  }

  return (
    <div className={className}>
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
        Faltan
      </p>
      <div
        className="grid grid-cols-4 gap-2 sm:gap-3"
        role="timer"
        aria-live="off"
        aria-label={`Faltan ${countdown.days} días, ${countdown.hours} horas, ${countdown.minutes} minutos`}
      >
        {UNITS.map((unit) => {
          const value = countdown[unit.key]
          return (
            <div
              key={unit.key}
              className="kpop-glass rounded-2xl px-1 py-3 text-center sm:px-2 sm:py-4"
            >
              <span className="block font-heading text-2xl font-black tabular-nums text-white sm:text-4xl">
                {String(value).padStart(2, "0")}
              </span>
              <span className="mt-1 block text-[0.6rem] uppercase tracking-wide text-lavender sm:text-xs">
                {value === 1 ? unit.singular : unit.plural}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
