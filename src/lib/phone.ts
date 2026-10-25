/**
 * Normalización y validación de números de teléfono para WhatsApp.
 *
 * Guatemala (+502) es el país por omisión: los números locales de ocho
 * dígitos se completan automáticamente. También se admiten números
 * internacionales escritos con prefijo (+, 00) o con el código de país.
 */

export const DEFAULT_COUNTRY_CODE = "502"

/** Longitud nacional esperada por código de país (los que faltan no se validan por longitud). */
const NATIONAL_LENGTHS: Record<string, number[]> = {
  "502": [8], // Guatemala
  "503": [8], // El Salvador
  "504": [8], // Honduras
  "505": [8], // Nicaragua
  "506": [8], // Costa Rica
  "507": [8], // Panamá
  "52": [10], // México
  "1": [10], // EE. UU. / Canadá
  "34": [9], // España
}

/** Códigos de país reconocidos, ordenados para una detección sin ambigüedad. */
const KNOWN_COUNTRY_CODES = ["502", "503", "504", "505", "506", "507", "52", "34", "1"]

export type PhoneNormalizationResult =
  | {
      ok: true
      /** Formato E.164, p. ej. "+50255550101". */
      e164: string
      /** Sólo dígitos, listo para wa.me, p. ej. "50255550101". */
      digits: string
      /** Para mostrar en pantalla, p. ej. "+502 5555 0101". */
      display: string
      countryCode: string
      nationalNumber: string
      /** true si se asumió el código de país por omisión. */
      assumedCountry: boolean
    }
  | { ok: false; error: string }

/** Quita espacios, guiones, paréntesis y puntos. */
export function stripFormatting(input: string): string {
  return input.replace(/[\s\-().]/g, "")
}

/**
 * Separa código de país y número nacional.
 *
 * `allowUnknownCountry` sólo se habilita cuando la persona escribió un
 * prefijo internacional explícito (+ o 00). Sin prefijo, adivinar un
 * código de país desconocido convertiría números locales incompletos
 * en números "válidos" por accidente.
 */
function splitCountryCode(
  digits: string,
  allowUnknownCountry: boolean,
): { countryCode: string; nationalNumber: string } | null {
  for (const code of KNOWN_COUNTRY_CODES) {
    if (!digits.startsWith(code)) continue
    const national = digits.slice(code.length)
    const lengths = NATIONAL_LENGTHS[code]
    if (!lengths || lengths.includes(national.length)) {
      return { countryCode: code, nationalNumber: national }
    }
  }

  if (!allowUnknownCountry) return null

  // Código de país no listado (p. ej. +44, +49): se asume de 1 a 3 dígitos.
  for (const size of [1, 2, 3]) {
    const national = digits.slice(size)
    if (national.length >= 6 && national.length <= 12) {
      return { countryCode: digits.slice(0, size), nationalNumber: national }
    }
  }
  return null
}

/** Agrupa el número nacional para lectura humana. */
function formatNational(countryCode: string, nationalNumber: string): string {
  if (nationalNumber.length === 8) {
    return `${nationalNumber.slice(0, 4)} ${nationalNumber.slice(4)}`
  }
  if (nationalNumber.length === 10) {
    return `${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`
  }
  if (nationalNumber.length === 9) {
    return `${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`
  }
  return nationalNumber
}

/**
 * Convierte cualquier forma razonable de escribir un teléfono a E.164.
 *
 * @param input         Número tal como lo escribió la persona.
 * @param defaultCountry Código de país a asumir si no viene explícito.
 */
export function normalizePhone(
  input: string | null | undefined,
  defaultCountry: string = DEFAULT_COUNTRY_CODE,
): PhoneNormalizationResult {
  if (input === null || input === undefined) {
    return { ok: false, error: "El número de WhatsApp es obligatorio." }
  }

  const trimmed = String(input).trim()
  if (trimmed === "") {
    return { ok: false, error: "El número de WhatsApp es obligatorio." }
  }

  const cleaned = stripFormatting(trimmed)

  if (/[^+0-9]/.test(cleaned)) {
    return { ok: false, error: "El número sólo puede contener dígitos y el prefijo +." }
  }

  const plusCount = (cleaned.match(/\+/g) ?? []).length
  if (plusCount > 1) {
    return { ok: false, error: "El número tiene más de un signo +." }
  }
  if (plusCount === 1 && !cleaned.startsWith("+")) {
    return { ok: false, error: "El signo + sólo puede ir al inicio del número." }
  }

  let hadExplicitPrefix = cleaned.startsWith("+")
  let digits = cleaned.replace(/\+/g, "")

  // Prefijo internacional marcado con 00
  if (!hadExplicitPrefix && digits.startsWith("00")) {
    digits = digits.slice(2)
    hadExplicitPrefix = true
  }

  if (digits === "") {
    return { ok: false, error: "Escribe el número de WhatsApp." }
  }
  if (/^0+$/.test(digits)) {
    return { ok: false, error: "El número no es válido." }
  }

  // Número local: se completa con el código de país por omisión.
  if (!hadExplicitPrefix) {
    const expected = NATIONAL_LENGTHS[defaultCountry]
    const isNationalLength = expected ? expected.includes(digits.length) : false

    if (isNationalLength) {
      const national = digits
      return buildResult(defaultCountry, national, true)
    }

    // Puede venir con el código de país pero sin el +
    const split = splitCountryCode(digits, false)
    if (split) {
      return buildResult(split.countryCode, split.nationalNumber, false)
    }

    if (expected) {
      const country = defaultCountry === DEFAULT_COUNTRY_CODE ? "de Guatemala" : `de +${defaultCountry}`
      return {
        ok: false,
        error: `Un número ${country} debe tener ${expected.join(" o ")} dígitos (ejemplo: 5555 0101). Para otro país, escribe el número con +.`,
      }
    }
    return { ok: false, error: "El número no es válido. Escríbelo con el prefijo +." }
  }

  const split = splitCountryCode(digits, true)
  if (!split) {
    return { ok: false, error: "No reconocemos el código de país de este número." }
  }
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, error: "El número internacional debe tener entre 8 y 15 dígitos." }
  }

  return buildResult(split.countryCode, split.nationalNumber, false)
}

function buildResult(
  countryCode: string,
  nationalNumber: string,
  assumedCountry: boolean,
): PhoneNormalizationResult {
  if (countryCode.startsWith("0")) {
    return { ok: false, error: "El código de país no puede empezar con 0." }
  }

  const expected = NATIONAL_LENGTHS[countryCode]
  if (expected && !expected.includes(nationalNumber.length)) {
    return {
      ok: false,
      error: `Para +${countryCode} el número debe tener ${expected.join(" o ")} dígitos.`,
    }
  }
  if (nationalNumber.length < 6) {
    return { ok: false, error: "El número es demasiado corto." }
  }

  const digits = `${countryCode}${nationalNumber}`
  if (digits.length > 15) {
    return { ok: false, error: "El número es demasiado largo." }
  }

  return {
    ok: true,
    e164: `+${digits}`,
    digits,
    display: `+${countryCode} ${formatNational(countryCode, nationalNumber)}`,
    countryCode,
    nationalNumber,
    assumedCountry,
  }
}

/** Atajo para validaciones rápidas. */
export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input).ok
}

/** Devuelve el E.164 o null, sin lanzar excepciones. */
export function toE164(input: string | null | undefined): string | null {
  const result = normalizePhone(input)
  return result.ok ? result.e164 : null
}

/** Formato legible, o el valor original si no se puede normalizar. */
export function formatPhoneForDisplay(input: string | null | undefined): string {
  const result = normalizePhone(input)
  return result.ok ? result.display : String(input ?? "")
}
