import { describe, expect, it } from "vitest"
import {
  buildInvitationUrl,
  buildInvitedChildrenLabel,
  buildTemplateTokens,
  buildWhatsAppInvitationLink,
  buildWhatsAppReminderLink,
  joinNames,
  renderTemplate,
  type WhatsAppEventInput,
  type WhatsAppFamilyInput,
} from "@/lib/whatsapp"

const INVITATION_TEMPLATE = [
  "🎤💜 ¡{{CELEBRANT_NAME_UPPER}} CUMPLE {{CELEBRANT_AGE}} AÑOS! 💜🎤",
  "",
  "¡Hola, familia {{FAMILY_NAME}}!",
  "",
  "Con mucha alegría queremos invitar a {{INVITED_CHILDREN_NAMES}} a celebrar los {{CELEBRANT_AGE}} años de {{CELEBRANT_NAME}}.",
  "",
  "🎶 ¡Una fiesta K-pop llena de música, diversión y sorpresas!",
  "",
  "📅 {{EVENT_DATE}}",
  "🕑 {{EVENT_TIME}}",
  "📍 {{VENUE}}",
  "",
  "👨‍👩‍👧 Esta invitación es válida para un máximo de {{MAX_ATTENDEES}} {{PERSONAS}} en total, {{INVITED_CHILDREN_LABEL}}.",
  "",
  "💌 Confirmen su asistencia y seleccionen sus menús aquí:",
  "",
  "{{RSVP_URL}}",
  "",
  "¡Los esperamos! 🎉💖",
].join("\n")

const event: WhatsAppEventInput = {
  celebrant_name: "Mía",
  celebrant_age: 10,
  event_date: "2026-11-12",
  start_time: "14:00",
  timezone: "America/Guatemala",
  venue_name: "McDonald's Metro Plaza",
  venue_address: "Metro Plaza, Jalapa, Guatemala",
  rsvp_deadline: "2026-11-07",
  whatsapp_invitation_template: INVITATION_TEMPLATE,
  whatsapp_reminder_template:
    "Recordatorio para la familia {{FAMILY_NAME}}: confirmen antes del {{RSVP_DEADLINE}} en {{RSVP_URL}}",
}

const lopez: WhatsAppFamilyInput = {
  name: "López",
  primary_contact_name: "Ana López",
  whatsapp_phone: "+50255550101",
  max_attendees: 3,
  invited_children_names: ["Sofía", "Mateo"],
}

const URL_BASE = "https://fiesta-mia.vercel.app"
const INVITATION_URL = `${URL_BASE}/invitacion/tok3n-seguro_ABC`

describe("joinNames", () => {
  it.each([
    [[], ""],
    [["Sofía"], "Sofía"],
    [["Sofía", "Mateo"], "Sofía y Mateo"],
    [["Sofía", "Mateo", "Camila"], "Sofía, Mateo y Camila"],
    [["Sofía", "Mateo", "Camila", "Diego"], "Sofía, Mateo, Camila y Diego"],
  ])("une %j como %s", (names, expected) => {
    expect(joinNames(names)).toBe(expected)
  })

  it("ignora nombres vacíos", () => {
    expect(joinNames(["Sofía", "  ", ""])).toBe("Sofía")
  })
})

describe("buildInvitedChildrenLabel", () => {
  it("usa el nombre cuando hay un solo niño invitado", () => {
    expect(buildInvitedChildrenLabel(["Sofía"])).toBe("incluyendo a Sofía")
  })

  it("usa el plural con dos o más", () => {
    expect(buildInvitedChildrenLabel(["Sofía", "Mateo"])).toBe(
      "incluyendo a los niños invitados",
    )
  })

  it("tiene un texto neutro sin niños precargados", () => {
    expect(buildInvitedChildrenLabel([])).toBe("incluyendo a las personas invitadas")
  })
})

describe("renderTemplate", () => {
  it("sustituye los marcadores conocidos", () => {
    expect(renderTemplate("Hola {{FAMILY_NAME}}", { FAMILY_NAME: "López" })).toBe("Hola López")
  })

  it("admite espacios dentro de los marcadores", () => {
    expect(renderTemplate("Hola {{ FAMILY_NAME }}", { FAMILY_NAME: "López" })).toBe("Hola López")
  })

  it("deja intactos los marcadores desconocidos", () => {
    expect(renderTemplate("Hola {{NO_EXISTE}}", { FAMILY_NAME: "López" })).toBe(
      "Hola {{NO_EXISTE}}",
    )
  })
})

describe("buildTemplateTokens", () => {
  it("resuelve concordancia de número", () => {
    const uno = buildTemplateTokens({ ...lopez, max_attendees: 1 }, event, INVITATION_URL)
    expect(uno.PERSONAS).toBe("persona")
    const varios = buildTemplateTokens({ ...lopez, max_attendees: 4 }, event, INVITATION_URL)
    expect(varios.PERSONAS).toBe("personas")
  })

  it("formatea la fecha y la hora en español de Guatemala", () => {
    const tokens = buildTemplateTokens(lopez, event, INVITATION_URL)
    expect(tokens.EVENT_DATE).toBe("jueves 12 de noviembre de 2026")
    expect(tokens.EVENT_TIME).toBe("2:00 p. m.")
    expect(tokens.VENUE).toBe("McDonald's Metro Plaza, Metro Plaza, Jalapa, Guatemala")
  })

  it("usa un texto alternativo si la familia no tiene niños precargados", () => {
    const tokens = buildTemplateTokens(
      { ...lopez, invited_children_names: [] },
      event,
      INVITATION_URL,
    )
    expect(tokens.INVITED_CHILDREN_NAMES).toBe("su familia")
  })

  it("descarta valores nulos dentro de la lista de niños", () => {
    const tokens = buildTemplateTokens(
      { ...lopez, invited_children_names: null },
      event,
      INVITATION_URL,
    )
    expect(tokens.INVITED_CHILDREN_NAMES).toBe("su familia")
  })
})

describe("buildWhatsAppInvitationLink", () => {
  it("arma el mensaje completo y personalizado", () => {
    const result = buildWhatsAppInvitationLink(lopez, event, INVITATION_URL)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.message).toContain("¡MÍA CUMPLE 10 AÑOS!")
    expect(result.message).toContain("¡Hola, familia López!")
    expect(result.message).toContain("invitar a Sofía y Mateo")
    expect(result.message).toContain("jueves 12 de noviembre de 2026")
    expect(result.message).toContain("2:00 p. m.")
    expect(result.message).toContain("McDonald's Metro Plaza")
    expect(result.message).toContain("máximo de 3 personas")
    expect(result.message).toContain("incluyendo a los niños invitados")
    expect(result.message).toContain(INVITATION_URL)
    // Ningún marcador queda sin resolver
    expect(result.message).not.toMatch(/\{\{/)
  })

  it("usa el formato oficial de wa.me con el número sin signos", () => {
    const result = buildWhatsAppInvitationLink(lopez, event, INVITATION_URL)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.href.startsWith("https://wa.me/50255550101?text=")).toBe(true)
    expect(result.phoneDigits).toBe("50255550101")
    expect(result.phoneE164).toBe("+50255550101")
  })

  it("ofrece además el esquema de la app de escritorio", () => {
    const result = buildWhatsAppInvitationLink(lopez, event, INVITATION_URL)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.desktopHref.startsWith("whatsapp://send?phone=50255550101&text=")).toBe(true)
  })

  it("codifica emojis, tildes y signos con encodeURIComponent", () => {
    const result = buildWhatsAppInvitationLink(lopez, event, INVITATION_URL)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const encoded = result.href.split("?text=")[1]
    expect(decodeURIComponent(encoded)).toBe(result.message)
    // Los caracteres problemáticos quedan escapados
    expect(encoded).not.toContain(" ")
    expect(encoded).not.toContain("#")
    expect(encoded).not.toContain("&")
    expect(encoded).toContain("%F0%9F%8E%A4") // 🎤
  })

  it("normaliza números locales antes de armar el enlace", () => {
    const result = buildWhatsAppInvitationLink(
      { ...lopez, whatsapp_phone: "5555-0101" },
      event,
      INVITATION_URL,
    )
    expect(result.ok && result.phoneDigits).toBe("50255550101")
  })

  it("rechaza teléfonos inválidos con un mensaje claro", () => {
    const result = buildWhatsAppInvitationLink(
      { ...lopez, whatsapp_phone: "123" },
      event,
      INVITATION_URL,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.length).toBeGreaterThan(0)
  })

  it("rechaza una URL de invitación que no sea absoluta", () => {
    const result = buildWhatsAppInvitationLink(lopez, event, "/invitacion/abc")
    expect(result.ok).toBe(false)
  })

  it("incluye el enlace único de cada familia", () => {
    const a = buildWhatsAppInvitationLink(lopez, event, `${URL_BASE}/invitacion/token-a`)
    const b = buildWhatsAppInvitationLink(
      { ...lopez, name: "García" },
      event,
      `${URL_BASE}/invitacion/token-b`,
    )
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.message).toContain("token-a")
    expect(b.message).toContain("token-b")
    expect(a.message).not.toContain("token-b")
  })

  it("respeta el singular en familias de un solo cupo", () => {
    const result = buildWhatsAppInvitationLink(
      {
        name: "Rodríguez",
        primary_contact_name: "Pedro Rodríguez",
        whatsapp_phone: "55550104",
        max_attendees: 1,
        invited_children_names: ["Isabella"],
      },
      event,
      INVITATION_URL,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.message).toContain("máximo de 1 persona en total")
    expect(result.message).toContain("incluyendo a Isabella")
    expect(result.message).toContain("invitar a Isabella")
  })
})

describe("buildWhatsAppReminderLink", () => {
  it("usa la plantilla de recordatorio", () => {
    const result = buildWhatsAppReminderLink(lopez, event, INVITATION_URL)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.message).toContain("Recordatorio para la familia López")
    // El 7 de noviembre de 2026 es sábado
    expect(result.message).toContain("sábado 7 de noviembre de 2026")
    expect(result.message).toContain(INVITATION_URL)
  })
})

describe("buildInvitationUrl", () => {
  it("construye la URL pública de la familia", () => {
    expect(buildInvitationUrl("https://ejemplo.com", "abc123")).toBe(
      "https://ejemplo.com/invitacion/abc123",
    )
  })

  it("tolera barras finales en la URL base", () => {
    expect(buildInvitationUrl("https://ejemplo.com///", "abc123")).toBe(
      "https://ejemplo.com/invitacion/abc123",
    )
  })
})
