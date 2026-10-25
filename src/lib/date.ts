/**
 * Fechas y horas en español de Guatemala, siempre en la zona del evento.
 */
import { fromZonedTime, toZonedTime } from "date-fns-tz"

const DIAS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const

/** Parsea 'YYYY-MM-DD' sin que la zona local desplace el día. */
function parseDateOnly(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number)
  return { year, month, day }
}

/** Parsea 'HH:MM' o 'HH:MM:SS'. */
function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map(Number)
  return { hours, minutes: minutes || 0 }
}

/** "jueves 12 de noviembre de 2026" */
export function formatLongDate(date: string): string {
  const { year, month, day } = parseDateOnly(date)
  // Se usa UTC para obtener el día de la semana sin interferencia de la zona local.
  const weekday = DIAS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${weekday} ${day} de ${MESES[month - 1]} de ${year}`
}

/** "12 de noviembre de 2026" */
export function formatDateWithoutWeekday(date: string): string {
  const { year, month, day } = parseDateOnly(date)
  return `${day} de ${MESES[month - 1]} de ${year}`
}

/** "12/11/2026" */
export function formatShortDate(date: string): string {
  const { year, month, day } = parseDateOnly(date)
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`
}

/** "2:00 p. m." (convención usada en Guatemala) */
export function formatTime(time: string): string {
  const { hours, minutes } = parseTime(time)
  const suffix = hours < 12 ? "a. m." : "p. m."
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`
}

/** Instante exacto de inicio del evento, respetando su zona horaria. */
export function getEventStart(event: {
  event_date: string
  start_time: string
  timezone: string
}): Date {
  const { year, month, day } = parseDateOnly(event.event_date)
  const { hours, minutes } = parseTime(event.start_time)
  const naive = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(
    hours,
  ).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`
  return fromZonedTime(naive, event.timezone)
}

/** Final del día de la fecha límite, en la zona del evento. */
export function getDeadlineEnd(event: { rsvp_deadline: string; timezone: string }): Date {
  const { year, month, day } = parseDateOnly(event.rsvp_deadline)
  const naive = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T23:59:59`
  return fromZonedTime(naive, event.timezone)
}

/** ¿Ya pasó la fecha límite para confirmar? */
export function isDeadlinePassed(
  event: { rsvp_deadline: string; timezone: string },
  now: Date = new Date(),
): boolean {
  return now.getTime() > getDeadlineEnd(event).getTime()
}

/** Fecha de "hoy" en la zona del evento, como 'YYYY-MM-DD'. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  const zoned = toZonedTime(now, timezone)
  return `${zoned.getFullYear()}-${String(zoned.getMonth() + 1).padStart(2, "0")}-${String(
    zoned.getDate(),
  ).padStart(2, "0")}`
}

export type Countdown = {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
  isPast: boolean
}

/** Cuenta regresiva hasta el inicio de la fiesta. */
export function getCountdown(target: Date, now: Date = new Date()): Countdown {
  const totalMs = target.getTime() - now.getTime()
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isPast: true }
  }
  const seconds = Math.floor(totalMs / 1000)
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    totalMs,
    isPast: false,
  }
}

/** Fecha y hora completas para pantallas administrativas. */
export function formatDateTime(iso: string | null | undefined, timezone = "America/Guatemala"): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  const zoned = toZonedTime(date, timezone)
  const day = String(zoned.getDate()).padStart(2, "0")
  const month = String(zoned.getMonth() + 1).padStart(2, "0")
  const hours = zoned.getHours()
  const suffix = hours < 12 ? "a. m." : "p. m."
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${day}/${month}/${zoned.getFullYear()} ${hour12}:${String(zoned.getMinutes()).padStart(2, "0")} ${suffix}`
}
