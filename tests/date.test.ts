import { describe, expect, it } from "vitest"
import {
  formatDateTime,
  formatLongDate,
  formatShortDate,
  formatTime,
  getCountdown,
  getDeadlineEnd,
  getEventStart,
  isDeadlinePassed,
  todayInTimezone,
} from "@/lib/date"

const event = {
  event_date: "2026-11-12",
  start_time: "14:00",
  timezone: "America/Guatemala",
  rsvp_deadline: "2026-11-07",
}

describe("formatos en español de Guatemala", () => {
  it("la fecha de la fiesta es jueves 12 de noviembre de 2026", () => {
    expect(formatLongDate("2026-11-12")).toBe("jueves 12 de noviembre de 2026")
  })

  it("no desplaza el día según la zona local", () => {
    expect(formatLongDate("2026-01-01")).toBe("jueves 1 de enero de 2026")
    expect(formatLongDate("2026-12-31")).toBe("jueves 31 de diciembre de 2026")
  })

  it("formatea la fecha corta", () => {
    expect(formatShortDate("2026-11-12")).toBe("12/11/2026")
    expect(formatShortDate("2026-01-05")).toBe("05/01/2026")
  })

  it.each([
    ["14:00", "2:00 p. m."],
    ["14:00:00", "2:00 p. m."],
    ["09:30", "9:30 a. m."],
    ["00:00", "12:00 a. m."],
    ["12:00", "12:00 p. m."],
    ["23:45", "11:45 p. m."],
  ])("formatea la hora %s como %s", (input, expected) => {
    expect(formatTime(input)).toBe(expected)
  })
})

describe("instantes del evento", () => {
  it("resuelve el inicio en la zona de Guatemala (UTC-6)", () => {
    // 2:00 p. m. en Guatemala = 20:00 UTC
    expect(getEventStart(event).toISOString()).toBe("2026-11-12T20:00:00.000Z")
  })

  it("la fecha límite termina al final del día local", () => {
    expect(getDeadlineEnd(event).toISOString()).toBe("2026-11-08T05:59:59.000Z")
  })

  it("detecta si el plazo ya venció", () => {
    expect(isDeadlinePassed(event, new Date("2026-11-07T12:00:00Z"))).toBe(false)
    // 7 de noviembre, 11:00 p. m. en Guatemala: aún dentro del plazo
    expect(isDeadlinePassed(event, new Date("2026-11-08T05:00:00Z"))).toBe(false)
    // 8 de noviembre en Guatemala: fuera de plazo
    expect(isDeadlinePassed(event, new Date("2026-11-08T07:00:00Z"))).toBe(true)
  })

  it("calcula el día actual en la zona del evento", () => {
    // 03:00 UTC del 13 de noviembre siguen siendo las 21:00 del 12 en Guatemala
    expect(todayInTimezone("America/Guatemala", new Date("2026-11-13T03:00:00Z"))).toBe(
      "2026-11-12",
    )
  })
})

describe("cuenta regresiva", () => {
  it("descompone el tiempo restante", () => {
    const target = new Date("2026-11-12T20:00:00Z")
    const now = new Date("2026-11-10T18:30:30Z")
    const countdown = getCountdown(target, now)
    expect(countdown.days).toBe(2)
    expect(countdown.hours).toBe(1)
    expect(countdown.minutes).toBe(29)
    expect(countdown.seconds).toBe(30)
    expect(countdown.isPast).toBe(false)
  })

  it("marca el evento como pasado", () => {
    const countdown = getCountdown(
      new Date("2026-11-12T20:00:00Z"),
      new Date("2026-11-13T00:00:00Z"),
    )
    expect(countdown.isPast).toBe(true)
    expect(countdown.totalMs).toBe(0)
    expect(countdown.days).toBe(0)
  })
})

describe("formatDateTime", () => {
  it("muestra fecha y hora en la zona de Guatemala", () => {
    expect(formatDateTime("2026-11-12T20:00:00Z")).toBe("12/11/2026 2:00 p. m.")
  })

  it("devuelve un guion cuando no hay dato", () => {
    expect(formatDateTime(null)).toBe("—")
    expect(formatDateTime(undefined)).toBe("—")
    expect(formatDateTime("no-es-fecha")).toBe("—")
  })
})
