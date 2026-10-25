import { describe, expect, it } from "vitest"
import {
  formatPhoneForDisplay,
  isValidPhone,
  normalizePhone,
  stripFormatting,
  toE164,
} from "@/lib/phone"

describe("normalizePhone — Guatemala por omisión", () => {
  it("completa +502 en un número local de ocho dígitos", () => {
    const result = normalizePhone("55550101")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.e164).toBe("+50255550101")
    expect(result.digits).toBe("50255550101")
    expect(result.display).toBe("+502 5555 0101")
    expect(result.countryCode).toBe("502")
    expect(result.assumedCountry).toBe(true)
  })

  it.each([
    ["5555-0101", "+50255550101"],
    ["5555 0101", "+50255550101"],
    ["(5555) 0101", "+50255550101"],
    ["5555.0101", "+50255550101"],
    ["  55550101  ", "+50255550101"],
    ["+502 5555 0101", "+50255550101"],
    ["+502-5555-0101", "+50255550101"],
    ["50255550101", "+50255550101"],
    ["0050255550101", "+50255550101"],
  ])("normaliza %s a %s", (input, expected) => {
    expect(toE164(input)).toBe(expected)
  })

  it("reconoce un número con código de país conocido escrito sin +", () => {
    const result = normalizePhone("12345678901")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.e164).toBe("+12345678901")
    expect(result.countryCode).toBe("1")
  })

  it("no marca assumedCountry cuando el país viene explícito", () => {
    const result = normalizePhone("+50255550101")
    expect(result.ok && result.assumedCountry).toBe(false)
  })
})

describe("normalizePhone — números internacionales", () => {
  it.each([
    ["+1 305 555 0199", "+13055550199", "1"],
    ["+52 55 1234 5678", "+525512345678", "52"],
    ["+34 612 345 678", "+34612345678", "34"],
    ["+503 7555 0101", "+50375550101", "503"],
    ["+506 8555 0101", "+50685550101", "506"],
  ])("acepta %s", (input, expectedE164, expectedCountry) => {
    const result = normalizePhone(input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.e164).toBe(expectedE164)
    expect(result.countryCode).toBe(expectedCountry)
  })

  it("agrupa números de diez dígitos para lectura", () => {
    const result = normalizePhone("+13055550199")
    expect(result.ok && result.display).toBe("+1 305 555 0199")
  })
})

describe("normalizePhone — rechazos", () => {
  it.each([
    [""],
    ["   "],
    [null],
    [undefined],
    ["abc"],
    ["5555010"], // siete dígitos: corto para Guatemala
    ["555501012"], // nueve dígitos
    ["+502 5555"], // nacional incompleto
    ["+1 305 555"], // nacional incompleto
    ["++50255550101"],
    ["5555+0101"],
    ["+0 123456789"],
    ["00000000"],
  ])("rechaza %s", (input) => {
    expect(isValidPhone(input as string)).toBe(false)
  })

  it("explica el problema en español", () => {
    const result = normalizePhone("5555010")
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("8 dígitos")
  })

  it("no convierte números locales incompletos en internacionales", () => {
    // Sin prefijo +, nunca se adivina un código de país desconocido.
    // (Un número que sí coincide con un país conocido, como 1 + 10 dígitos
    //  de EE. UU., sigue siendo válido: eso se prueba más abajo.)
    for (const input of ["5555010", "555501012", "1234567", "4455667788"]) {
      expect(isValidPhone(input), `${input} no debería ser válido`).toBe(false)
    }
  })

  it("rechaza números excesivamente largos", () => {
    expect(isValidPhone("+502555501010101010")).toBe(false)
  })
})

describe("utilidades", () => {
  it("stripFormatting quita separadores pero conserva dígitos y +", () => {
    expect(stripFormatting("+502 (5555) 01-01.")).toBe("+50255550101")
  })

  it("formatPhoneForDisplay devuelve el original si no se puede normalizar", () => {
    expect(formatPhoneForDisplay("no-es-un-numero")).toBe("no-es-un-numero")
    expect(formatPhoneForDisplay("55550101")).toBe("+502 5555 0101")
  })

  it("toE164 devuelve null en lugar de lanzar", () => {
    expect(toE164("basura")).toBeNull()
  })
})
