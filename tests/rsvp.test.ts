/**
 * Confirmación de asistencia: cupos, acompañantes, menús, modificaciones
 * y rechazos, verificados contra PostgreSQL real.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  createTestDb,
  getMenuMap,
  seedFamily,
  submitRsvp,
  type MenuMap,
  type TestDb,
} from "./helpers/db"

let db: TestDb
let menus: MenuMap

beforeAll(async () => {
  db = await createTestDb()
  menus = await getMenuMap(db)
  // El evento es en noviembre de 2026; se fija la fecha límite en el futuro
  // para que los casos de prueba no dependan del día en que se ejecuten.
  await db.exec(
    "update events set rsvp_deadline = (now() + interval '30 days')::date, event_date = (now() + interval '40 days')::date",
  )
})

afterAll(async () => {
  await db?.close()
})

beforeEach(async () => {
  await db.exec("delete from families")
})

const attendee = (
  name: string,
  menuId: string,
  type: "nino" | "adulto" = "nino",
  guestId?: string,
) => ({ name, guest_type: type, menu_item_id: menuId, ...(guestId ? { guest_id: guestId } : {}) })

async function summary(familyId: string) {
  const result = await db.query<{
    rsvp_status: string
    confirmed_attendees: number
    confirmed_children: number
    confirmed_adults: number
    menu_selections: number
    remaining_slots: number
    menu_incomplete: boolean
    needs_review: boolean
  }>(
    `select rsvp_status, confirmed_attendees::int, confirmed_children::int,
            confirmed_adults::int, menu_selections::int, remaining_slots::int,
            menu_incomplete, needs_review
     from v_family_summary where id = $1`,
    [familyId],
  )
  return result.rows[0]
}

describe("token de invitación", () => {
  it("rechaza un token inexistente", async () => {
    const result = await submitRsvp(db, "token-que-no-existe", { attending: true })
    expect(result.ok).toBe(false)
    expect(result.code).toBe("token_invalido")
  })

  it("rechaza un token vacío", async () => {
    const result = await submitRsvp(db, "", { attending: true })
    expect(result.ok).toBe(false)
    expect(result.code).toBe("token_invalido")
  })

  it("rechaza una invitación deshabilitada", async () => {
    const family = await seedFamily(db, {
      name: "Deshabilitada",
      maxAttendees: 2,
      children: ["Sofía"],
      invitationEnabled: false,
    })
    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Sofía", menus.cajita_nuggets)],
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe("invitacion_deshabilitada")
  })

  it("rechaza una familia archivada", async () => {
    const family = await seedFamily(db, { name: "Archivada", maxAttendees: 3 })
    await db.query("update families set archived_at = now() where id = $1", [family.id])
    const result = await submitRsvp(db, family.token, { attending: false })
    expect(result.ok).toBe(false)
    expect(result.code).toBe("token_invalido")
  })

  it("el token regenerado invalida el anterior", async () => {
    const family = await seedFamily(db, { name: "Rotación", maxAttendees: 2 })
    const nuevo = await db.scalar<string>("select regenerate_invitation_token($1)", [family.id])

    expect(nuevo).not.toBe(family.token)

    const viejo = await submitRsvp(db, family.token, { attending: false })
    expect(viejo.code).toBe("token_invalido")

    const actual = await submitRsvp(db, nuevo, { attending: false })
    expect(actual.ok).toBe(true)

    const estado = await db.scalar<string>(
      "select delivery_status from families where id = $1",
      [family.id],
    )
    expect(estado).toBe("no_preparada")
  })
})

describe("cupos configurables por familia", () => {
  it("permite exactamente el cupo autorizado (familia López, 2 cupos)", async () => {
    const family = await seedFamily(db, {
      name: "López",
      maxAttendees: 2,
      children: ["Sofía"],
    })

    const result = await submitRsvp(db, family.token, {
      attending: true,
      responder_name: "Ana López",
      attendees: [
        attendee("Sofía", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Ana López", menus.big_mac, "adulto"),
      ],
    })

    expect(result.ok).toBe(true)
    expect(result.attendee_count).toBe(2)
    expect(result.children_count).toBe(1)
    expect(result.adults_count).toBe(1)

    const s = await summary(family.id)
    expect(s.rsvp_status).toBe("confirmado")
    expect(s.confirmed_attendees).toBe(2)
    expect(s.menu_selections).toBe(2)
    expect(s.remaining_slots).toBe(0)
    expect(s.menu_incomplete).toBe(false)
  })

  it("rechaza exceder el cupo (familia Rodríguez, 1 cupo)", async () => {
    const family = await seedFamily(db, {
      name: "Rodríguez",
      maxAttendees: 1,
      children: ["Isabella"],
    })

    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Isabella", menus.cajita_pollo, "nino", family.children[0].id),
        attendee("Pedro Rodríguez", menus.cuarto_de_libra, "adulto"),
      ],
    })

    expect(result.ok).toBe(false)
    expect(result.code).toBe("cupo_excedido")
    expect(result.max_attendees).toBe(1)
    expect(result.requested).toBe(2)

    // Nada se escribió
    const s = await summary(family.id)
    expect(s.rsvp_status).toBe("pendiente")
    expect(s.confirmed_attendees).toBe(0)
  })

  it("admite una familia grande con tres niños y acompañantes (6 cupos)", async () => {
    const family = await seedFamily(db, {
      name: "Ramírez",
      maxAttendees: 6,
      children: ["Adriana", "Fernanda", "Diego"],
    })

    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Adriana", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Fernanda", menus.cajita_pollo, "nino", family.children[1].id),
        attendee("Diego", menus.cajita_hamburguesa, "nino", family.children[2].id),
        attendee("Luis Ramírez", menus.big_mac, "adulto"),
        attendee("Marta Ramírez", menus.cuarto_de_libra, "adulto"),
        attendee("Primo Sebastián", menus.cajita_nuggets, "nino"),
      ],
    })

    expect(result.ok).toBe(true)
    const s = await summary(family.id)
    expect(s.confirmed_attendees).toBe(6)
    expect(s.confirmed_children).toBe(4)
    expect(s.confirmed_adults).toBe(2)
    expect(s.menu_selections).toBe(6)
  })

  it("permite asistencia parcial: sólo uno de dos niños invitados", async () => {
    const family = await seedFamily(db, {
      name: "Pérez",
      maxAttendees: 5,
      children: ["Mateo", "Camila"],
    })

    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Mateo", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Lucía Pérez", menus.big_mac, "adulto"),
      ],
    })

    expect(result.ok).toBe(true)

    const s = await summary(family.id)
    expect(s.confirmed_attendees).toBe(2)
    expect(s.remaining_slots).toBe(3)

    // Camila sigue registrada como niña invitada, pero no asiste
    const camila = await db.query<{ is_attending: boolean | null; is_invited_child: boolean }>(
      "select is_attending, is_invited_child from guests where id = $1",
      [family.children[1].id],
    )
    expect(camila.rows[0].is_attending).toBe(false)
    expect(camila.rows[0].is_invited_child).toBe(true)
  })

  it("rechaza una confirmación sin asistentes", async () => {
    const family = await seedFamily(db, { name: "Vacía", maxAttendees: 3 })
    const result = await submitRsvp(db, family.token, { attending: true, attendees: [] })
    expect(result.code).toBe("sin_asistentes")
  })

  it("no acepta invitados de otra familia", async () => {
    const a = await seedFamily(db, { name: "Familia A", maxAttendees: 3, children: ["Ana"] })
    const b = await seedFamily(db, { name: "Familia B", maxAttendees: 3, children: ["Beto"] })

    const result = await submitRsvp(db, b.token, {
      attending: true,
      attendees: [attendee("Ana", menus.cajita_nuggets, "nino", a.children[0].id)],
    })
    expect(result.code).toBe("invitado_ajeno")
  })

  it("rechaza nombres duplicados dentro de la familia", async () => {
    const family = await seedFamily(db, { name: "Duplicados", maxAttendees: 4 })
    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Sofía", menus.cajita_nuggets),
        attendee("sofía ", menus.cajita_pollo),
      ],
    })
    expect(result.code).toBe("nombres_duplicados")
  })

  it("la base de datos bloquea cualquier escritura que exceda el cupo", async () => {
    // Última línea de defensa: si algún camino de código intentara
    // confirmar más asistentes que el cupo, la transacción falla.
    const family = await seedFamily(db, { name: "Blindada", maxAttendees: 2 })

    await db.exec("begin")
    await db.query(
      `insert into guests (family_id, name, guest_type, is_attending)
       values ($1,'Uno','adulto',true), ($1,'Dos','adulto',true), ($1,'Tres','adulto',true)`,
      [family.id],
    )
    await expect(db.exec("commit")).rejects.toThrow(/Cupo excedido/)
    await db.exec("rollback").catch(() => {})

    const count = await db.scalar<string>(
      "select count(*) from guests where family_id = $1",
      [family.id],
    )
    expect(Number(count)).toBe(0)
  })

  it("marca para revisión si el cupo se reduce por debajo de lo confirmado", async () => {
    const family = await seedFamily(db, {
      name: "Reducción",
      maxAttendees: 4,
      children: ["Daniela", "Lucía"],
    })

    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Daniela", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Lucía", menus.cajita_pollo, "nino", family.children[1].id),
        attendee("Gabriela", menus.big_mac, "adulto"),
        attendee("Mario", menus.cuarto_de_libra, "adulto"),
      ],
    })

    await db.query("update families set max_attendees = 2 where id = $1", [family.id])

    const row = await db.query<{ needs_review: boolean; review_reason: string }>(
      "select needs_review, review_reason from families where id = $1",
      [family.id],
    )
    expect(row.rows[0].needs_review).toBe(true)
    expect(row.rows[0].review_reason).toContain("4")

    // Los registros confirmados no se destruyen: quedan marcados para revisión
    const s = await summary(family.id)
    expect(s.confirmed_attendees).toBe(4)
  })

  it("aumentar el cupo no marca para revisión", async () => {
    const family = await seedFamily(db, { name: "Aumento", maxAttendees: 2 })
    await db.query("update families set max_attendees = 5 where id = $1", [family.id])
    const needsReview = await db.scalar<boolean>(
      "select needs_review from families where id = $1",
      [family.id],
    )
    expect(needsReview).toBe(false)
  })
})

describe("acompañantes", () => {
  it("registra acompañantes adultos y niños añadidos por los padres", async () => {
    const family = await seedFamily(db, {
      name: "García",
      maxAttendees: 3,
      children: ["Valeria"],
    })

    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Valeria", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Carlos García", menus.big_mac, "adulto"),
        attendee("Hermanito Tomás", menus.cajita_pollo, "nino"),
      ],
    })

    const guests = await db.query<{
      name: string
      guest_type: string
      is_invited_child: boolean
      is_attending: boolean
    }>(
      "select name, guest_type, is_invited_child, is_attending from guests where family_id = $1 order by sort_order",
      [family.id],
    )

    expect(guests.rows).toHaveLength(3)
    expect(guests.rows[1]).toMatchObject({
      name: "Carlos García",
      guest_type: "adulto",
      is_invited_child: false,
      is_attending: true,
    })
    expect(guests.rows[2]).toMatchObject({
      name: "Hermanito Tomás",
      guest_type: "nino",
      is_invited_child: false,
    })
  })

  it("elimina los acompañantes retirados al modificar la confirmación", async () => {
    const family = await seedFamily(db, {
      name: "Castillo",
      maxAttendees: 4,
      children: ["Santiago", "Renata"],
    })

    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Santiago", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Renata", menus.cajita_pollo, "nino", family.children[1].id),
        attendee("María Castillo", menus.big_mac, "adulto"),
        attendee("Abuela Rosa", menus.hamburguesa_queso, "adulto"),
      ],
    })

    expect((await summary(family.id)).confirmed_attendees).toBe(4)

    // La abuela ya no puede asistir
    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Santiago", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Renata", menus.cajita_pollo, "nino", family.children[1].id),
        attendee("María Castillo", menus.big_mac, "adulto"),
      ],
    })

    const s = await summary(family.id)
    expect(s.confirmed_attendees).toBe(3)
    expect(s.menu_selections).toBe(3)

    const abuela = await db.scalar<string>(
      "select count(*) from guests where family_id = $1 and name = 'Abuela Rosa'",
      [family.id],
    )
    expect(Number(abuela)).toBe(0)
  })

  it("los niños invitados nunca se eliminan, sólo se marcan como no asistentes", async () => {
    const family = await seedFamily(db, {
      name: "Martínez",
      maxAttendees: 4,
      children: ["Daniela", "Lucía"],
    })

    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Daniela", menus.cajita_nuggets, "nino", family.children[0].id)],
    })

    const kids = await db.query<{ name: string; is_attending: boolean | null }>(
      "select name, is_attending from guests where family_id = $1 and is_invited_child order by name",
      [family.id],
    )
    expect(kids.rows).toHaveLength(2)
    expect(kids.rows.find((k) => k.name === "Lucía")?.is_attending).toBe(false)
  })
})

describe("selección de menú", () => {
  it("exige un menú por cada asistente", async () => {
    const family = await seedFamily(db, { name: "SinMenu", maxAttendees: 3 })
    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Papá", menus.big_mac, "adulto"),
        { name: "Mamá", guest_type: "adulto" },
      ],
    })
    expect(result.code).toBe("menu_faltante")
  })

  it("no permite un menú de adulto para un niño", async () => {
    const family = await seedFamily(db, { name: "MenuCruzado", maxAttendees: 2 })
    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Sofía", menus.big_mac, "nino")],
    })
    expect(result.code).toBe("menu_invalido")
  })

  it("no permite una Cajita Feliz para un adulto", async () => {
    const family = await seedFamily(db, { name: "MenuCruzado2", maxAttendees: 2 })
    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Papá", menus.cajita_nuggets, "adulto")],
    })
    expect(result.code).toBe("menu_invalido")
  })

  it("rechaza un menú inexistente", async () => {
    const family = await seedFamily(db, { name: "MenuFantasma", maxAttendees: 2 })
    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Sofía", "00000000-0000-0000-0000-000000000000")],
    })
    expect(result.code).toBe("menu_invalido")
  })

  it("rechaza un menú deshabilitado", async () => {
    const family = await seedFamily(db, { name: "MenuApagado", maxAttendees: 2 })
    await db.query("update menu_items set is_available = false where code = 'cajita_pollo'")

    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Sofía", menus.cajita_pollo)],
    })
    expect(result.code).toBe("menu_invalido")

    await db.query("update menu_items set is_available = true where code = 'cajita_pollo'")
  })

  it("mantiene una sola selección activa por asistente al cambiar de menú", async () => {
    const family = await seedFamily(db, {
      name: "CambioMenu",
      maxAttendees: 2,
      children: ["Ximena"],
    })

    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Ximena", menus.cajita_nuggets, "nino", family.children[0].id)],
    })
    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Ximena", menus.cajita_pollo, "nino", family.children[0].id)],
    })

    const active = await db.query<{ code: string }>(
      `select mi.code from attendee_menu_selections s
       join menu_items mi on mi.id = s.menu_item_id
       where s.guest_id = $1 and s.is_current`,
      [family.children[0].id],
    )
    expect(active.rows).toHaveLength(1)
    expect(active.rows[0].code).toBe("cajita_pollo")

    // El historial se conserva
    const total = await db.scalar<string>(
      "select count(*) from attendee_menu_selections where guest_id = $1",
      [family.children[0].id],
    )
    expect(Number(total)).toBe(2)
  })

  it("marca para revisión (sin reemplazar) cuando un menú deja de estar disponible", async () => {
    const family = await seedFamily(db, {
      name: "MenuRetirado",
      maxAttendees: 2,
      children: ["Emilia"],
    })

    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Emilia", menus.cajita_hamburguesa, "nino", family.children[0].id)],
    })

    await db.query("update menu_items set is_available = false where code = 'cajita_hamburguesa'")

    const selection = await db.query<{ needs_review: boolean; menu_item_id: string }>(
      "select needs_review, menu_item_id from attendee_menu_selections where guest_id = $1 and is_current",
      [family.children[0].id],
    )
    // La elección original se conserva, marcada para revisión
    expect(selection.rows[0].needs_review).toBe(true)
    expect(selection.rows[0].menu_item_id).toBe(menus.cajita_hamburguesa)

    const familyRow = await db.query<{ needs_review: boolean }>(
      "select needs_review from families where id = $1",
      [family.id],
    )
    expect(familyRow.rows[0].needs_review).toBe(true)

    // Al reactivar el menú, la marca se limpia
    await db.query("update menu_items set is_available = true where code = 'cajita_hamburguesa'")
    const after = await db.scalar<boolean>(
      "select needs_review from attendee_menu_selections where guest_id = $1 and is_current",
      [family.children[0].id],
    )
    expect(after).toBe(false)
  })
})

describe("rechazo de invitación", () => {
  it("un rechazo no aporta asistentes ni menús a los totales", async () => {
    const family = await seedFamily(db, {
      name: "Morales",
      maxAttendees: 2,
      children: ["Ximena"],
    })

    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Ximena", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Diana Morales", menus.big_mac, "adulto"),
      ],
    })
    expect((await summary(family.id)).confirmed_attendees).toBe(2)

    const result = await submitRsvp(db, family.token, {
      attending: false,
      responder_name: "Diana Morales",
      message: "Tenemos un viaje ese día.",
    })
    expect(result.ok).toBe(true)
    expect(result.status).toBe("rechazado")

    const s = await summary(family.id)
    expect(s.rsvp_status).toBe("rechazado")
    expect(s.confirmed_attendees).toBe(0)
    expect(s.menu_selections).toBe(0)

    const menuTotal = await db.scalar<string>(
      "select coalesce(sum(quantity),0) from v_menu_order_summary",
    )
    expect(Number(menuTotal)).toBe(0)

    // El acompañante adulto se elimina, la niña invitada permanece
    const guests = await db.query<{ name: string; is_attending: boolean | null }>(
      "select name, is_attending from guests where family_id = $1",
      [family.id],
    )
    expect(guests.rows).toHaveLength(1)
    expect(guests.rows[0].name).toBe("Ximena")
    expect(guests.rows[0].is_attending).toBe(false)
  })

  it("una familia puede rechazar y luego volver a confirmar", async () => {
    const family = await seedFamily(db, {
      name: "Reconfirma",
      maxAttendees: 2,
      children: ["Victoria"],
    })

    await submitRsvp(db, family.token, { attending: false })
    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Victoria", menus.cajita_pollo, "nino", family.children[0].id)],
    })

    expect(result.ok).toBe(true)
    expect(result.revision).toBe(2)
    const s = await summary(family.id)
    expect(s.rsvp_status).toBe("confirmado")
    expect(s.confirmed_attendees).toBe(1)
  })
})

describe("modificaciones, historial e idempotencia", () => {
  it("guarda el historial de cada revisión y sólo una vigente", async () => {
    const family = await seedFamily(db, {
      name: "Historial",
      maxAttendees: 3,
      children: ["Sofía"],
    })

    for (const menu of [menus.cajita_nuggets, menus.cajita_pollo, menus.cajita_hamburguesa]) {
      await submitRsvp(db, family.token, {
        attending: true,
        attendees: [attendee("Sofía", menu, "nino", family.children[0].id)],
      })
    }

    const responses = await db.query<{ revision: number; is_current: boolean }>(
      "select revision, is_current from rsvp_responses where family_id = $1 order by revision",
      [family.id],
    )
    expect(responses.rows.map((r) => r.revision)).toEqual([1, 2, 3])
    expect(responses.rows.filter((r) => r.is_current)).toHaveLength(1)
    expect(responses.rows[2].is_current).toBe(true)
  })

  it("registra la confirmación en la auditoría", async () => {
    const family = await seedFamily(db, { name: "Auditada", maxAttendees: 2 })
    await submitRsvp(db, family.token, {
      attending: true,
      responder_name: "Mamá",
      attendees: [attendee("Mamá", menus.big_mac, "adulto")],
    })
    await submitRsvp(db, family.token, {
      attending: true,
      responder_name: "Mamá",
      attendees: [attendee("Mamá", menus.cuarto_de_libra, "adulto")],
    })

    const logs = await db.query<{ action: string; actor_type: string }>(
      "select action, actor_type from audit_logs where entity_id = $1 order by created_at",
      [family.id],
    )
    expect(logs.rows.map((l) => l.action)).toEqual(["rsvp_creado", "rsvp_modificado"])
    expect(logs.rows[0].actor_type).toBe("invitado")
  })

  it("una misma clave de idempotencia no duplica la confirmación", async () => {
    const family = await seedFamily(db, {
      name: "DobleClic",
      maxAttendees: 2,
      children: ["Sofía"],
    })
    const payload = {
      attending: true,
      attendees: [attendee("Sofía", menus.cajita_nuggets, "nino", family.children[0].id)],
    }

    const first = await submitRsvp(db, family.token, payload, "clave-abc")
    const second = await submitRsvp(db, family.token, payload, "clave-abc")
    const third = await submitRsvp(db, family.token, payload, "clave-abc")

    expect(first.ok).toBe(true)
    expect(first.duplicate).toBe(false)
    expect(second.duplicate).toBe(true)
    expect(third.duplicate).toBe(true)

    const count = await db.scalar<string>(
      "select count(*) from rsvp_responses where family_id = $1",
      [family.id],
    )
    expect(Number(count)).toBe(1)

    const s = await summary(family.id)
    expect(s.confirmed_attendees).toBe(1)
    expect(s.menu_selections).toBe(1)
  })

  it("una clave distinta sí registra una nueva revisión", async () => {
    const family = await seedFamily(db, { name: "NuevaClave", maxAttendees: 2 })
    await submitRsvp(
      db,
      family.token,
      { attending: true, attendees: [attendee("Papá", menus.big_mac, "adulto")] },
      "clave-1",
    )
    const second = await submitRsvp(
      db,
      family.token,
      { attending: true, attendees: [attendee("Papá", menus.cuarto_de_libra, "adulto")] },
      "clave-2",
    )
    expect(second.duplicate).toBe(false)
    expect(second.revision).toBe(2)
  })

  it("respeta la fecha límite de confirmación", async () => {
    const family = await seedFamily(db, { name: "Tardía", maxAttendees: 2 })
    await db.exec("update events set rsvp_deadline = (now() - interval '1 day')::date")

    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Papá", menus.big_mac, "adulto")],
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe("fuera_de_plazo")

    await db.exec("update events set rsvp_deadline = (now() + interval '30 days')::date")
  })

  it("bloquea modificaciones cuando el evento las desactiva", async () => {
    const family = await seedFamily(db, { name: "SinEdicion", maxAttendees: 2 })
    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Papá", menus.big_mac, "adulto")],
    })

    await db.exec("update events set allow_rsvp_edits = false")

    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [attendee("Papá", menus.cuarto_de_libra, "adulto")],
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe("edicion_no_permitida")

    await db.exec("update events set allow_rsvp_edits = true")
  })

  it("una confirmación válida limpia la marca de revisión", async () => {
    const family = await seedFamily(db, {
      name: "Resuelta",
      maxAttendees: 4,
      children: ["Ana"],
    })
    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Ana", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Papá", menus.big_mac, "adulto"),
        attendee("Mamá", menus.cuarto_de_libra, "adulto"),
      ],
    })

    await db.query("update families set max_attendees = 2 where id = $1", [family.id])
    expect((await summary(family.id)).needs_review).toBe(true)

    // La familia vuelve a confirmar dentro del nuevo cupo
    const result = await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Ana", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Mamá", menus.cuarto_de_libra, "adulto"),
      ],
    })
    expect(result.ok).toBe(true)

    const s = await summary(family.id)
    expect(s.needs_review).toBe(false)
    expect(s.confirmed_attendees).toBe(2)
  })
})

describe("agregación del pedido de McDonald's", () => {
  it("suma los menús de varias familias confirmadas", async () => {
    const lopez = await seedFamily(db, { name: "López", maxAttendees: 3, children: ["Sofía"] })
    const garcia = await seedFamily(db, { name: "García", maxAttendees: 3, children: ["Valeria"] })
    const perez = await seedFamily(db, { name: "Pérez", maxAttendees: 2, children: ["Mateo"] })

    // López: Sofía (nuggets) + mamá (Big Mac) + papá (cuarto de libra)
    await submitRsvp(db, lopez.token, {
      attending: true,
      attendees: [
        attendee("Sofía", menus.cajita_nuggets, "nino", lopez.children[0].id),
        attendee("Mamá López", menus.big_mac, "adulto"),
        attendee("Papá López", menus.cuarto_de_libra, "adulto"),
      ],
    })

    // García: Valeria (nuggets) + papá (Big Mac)
    await submitRsvp(db, garcia.token, {
      attending: true,
      attendees: [
        attendee("Valeria", menus.cajita_nuggets, "nino", garcia.children[0].id),
        attendee("Carlos García", menus.big_mac, "adulto"),
      ],
    })

    // Pérez rechaza: no debe sumar nada
    await submitRsvp(db, perez.token, { attending: false })

    const order = await db.query<{ code: string; quantity: number; audience: string }>(
      "select code, quantity::int, audience from v_menu_order_summary order by sort_order",
    )
    const byCode = Object.fromEntries(order.rows.map((r) => [r.code, r.quantity]))

    expect(byCode.big_mac).toBe(2)
    expect(byCode.cuarto_de_libra).toBe(1)
    expect(byCode.hamburguesa_queso).toBe(0)
    expect(byCode.cajita_nuggets).toBe(2)
    expect(byCode.cajita_pollo).toBe(0)
    expect(byCode.cajita_hamburguesa).toBe(0)

    const totals = await db.query<{
      confirmed_attendees: number
      confirmed_children: number
      confirmed_adults: number
      total_menus_selected: number
      confirmed_families: number
      declined_families: number
      total_capacity: number
      missing_menus: number
      families_with_incomplete_menus: number
    }>(
      `select confirmed_attendees::int, confirmed_children::int, confirmed_adults::int,
              total_menus_selected::int, confirmed_families::int, declined_families::int,
              total_capacity::int, missing_menus::int, families_with_incomplete_menus::int
       from v_event_totals`,
    )
    const t = totals.rows[0]

    expect(t.confirmed_attendees).toBe(5)
    expect(t.confirmed_children).toBe(2)
    expect(t.confirmed_adults).toBe(3)
    // El número de menús debe igualar al de asistentes confirmados
    expect(t.total_menus_selected).toBe(t.confirmed_attendees)
    expect(t.missing_menus).toBe(0)
    expect(t.families_with_incomplete_menus).toBe(0)
    expect(t.confirmed_families).toBe(2)
    expect(t.declined_families).toBe(1)
    expect(t.total_capacity).toBe(8)
  })

  it("detecta familias con menús incompletos", async () => {
    const family = await seedFamily(db, {
      name: "Incompleta",
      maxAttendees: 3,
      children: ["Sofía"],
    })
    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Sofía", menus.cajita_nuggets, "nino", family.children[0].id),
        attendee("Mamá", menus.big_mac, "adulto"),
      ],
    })

    // Se simula una selección perdida (por ejemplo, limpieza manual de datos)
    await db.query(
      `update attendee_menu_selections set is_current = false
       where family_id = $1 and guest_id = (select id from guests where family_id = $1 and name = 'Mamá')`,
      [family.id],
    )

    const s = await summary(family.id)
    expect(s.confirmed_attendees).toBe(2)
    expect(s.menu_selections).toBe(1)
    expect(s.menu_incomplete).toBe(true)

    const totals = await db.scalar<string>(
      "select families_with_incomplete_menus from v_event_totals",
    )
    expect(Number(totals)).toBe(1)
  })

  it("calcula subtotales sólo cuando hay precios configurados", async () => {
    const family = await seedFamily(db, { name: "ConPrecio", maxAttendees: 2 })
    await submitRsvp(db, family.token, {
      attending: true,
      attendees: [
        attendee("Papá", menus.big_mac, "adulto"),
        attendee("Mamá", menus.big_mac, "adulto"),
      ],
    })

    const sinPrecio = await db.query<{ subtotal_cents: number | null }>(
      "select subtotal_cents from v_menu_order_summary where code = 'big_mac'",
    )
    expect(sinPrecio.rows[0].subtotal_cents).toBeNull()

    await db.query("update menu_items set price_cents = 4500 where code = 'big_mac'")
    const conPrecio = await db.scalar<number>(
      "select subtotal_cents from v_menu_order_summary where code = 'big_mac'",
    )
    expect(Number(conPrecio)).toBe(9000)

    await db.query("update menu_items set price_cents = null where code = 'big_mac'")
  })
})
