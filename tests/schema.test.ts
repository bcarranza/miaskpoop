/**
 * Verifica que las migraciones se apliquen sobre PostgreSQL real y que
 * el esquema quede con las restricciones esperadas.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createTestDb, getEventId, type TestDb } from "./helpers/db"

let db: TestDb

beforeAll(async () => {
  db = await createTestDb()
})

afterAll(async () => {
  await db?.close()
})

describe("migraciones", () => {
  it("crea todas las tablas requeridas", async () => {
    const result = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
       order by table_name`,
    )
    const tables = result.rows.map((r) => r.table_name)

    for (const expected of [
      "admin_profiles",
      "attendee_menu_selections",
      "audit_logs",
      "events",
      "families",
      "guests",
      "invitation_delivery_logs",
      "menu_items",
      "rsvp_responses",
    ]) {
      expect(tables, `falta la tabla ${expected}`).toContain(expected)
    }
  })

  it("crea las vistas agregadas", async () => {
    const result = await db.query<{ table_name: string }>(
      `select table_name from information_schema.views
       where table_schema = 'public' order by table_name`,
    )
    const views = result.rows.map((r) => r.table_name)
    expect(views).toContain("v_confirmed_attendee_menus")
    expect(views).toContain("v_event_totals")
    expect(views).toContain("v_family_summary")
    expect(views).toContain("v_menu_order_summary")
  })

  it("habilita RLS en todas las tablas de datos", async () => {
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
       order by c.relname`,
    )
    expect(result.rows.length).toBeGreaterThan(0)
    for (const row of result.rows) {
      expect(row.relrowsecurity, `RLS desactivado en ${row.relname}`).toBe(true)
    }
  })

  it("no concede permisos de tabla al rol anónimo", async () => {
    const granted = await db.query<{ table_name: string }>(
      `select table_name from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'`,
    )
    expect(granted.rows).toHaveLength(0)
  })

  it("carga el evento con los datos de la fiesta", async () => {
    const event = await db.query<{
      celebrant_name: string
      celebrant_age: number
      event_date: string
      venue_name: string
      timezone: string
      rsvp_deadline: string
    }>(
      `select celebrant_name, celebrant_age, to_char(event_date,'YYYY-MM-DD') as event_date,
              venue_name, timezone, to_char(rsvp_deadline,'YYYY-MM-DD') as rsvp_deadline
       from events where slug = 'mia-kpop-party'`,
    )
    expect(event.rows).toHaveLength(1)
    expect(event.rows[0].celebrant_name).toBe("Mía")
    expect(event.rows[0].celebrant_age).toBe(10)
    expect(event.rows[0].event_date).toBe("2026-11-12")
    expect(event.rows[0].rsvp_deadline).toBe("2026-11-07")
    expect(event.rows[0].timezone).toBe("America/Guatemala")
    expect(event.rows[0].venue_name).toBe("McDonald's Metro Plaza")
  })

  it("carga los seis menús separados por tipo de comensal", async () => {
    const menus = await db.query<{ code: string; audience: string; name: string }>(
      "select code, audience, name from menu_items order by sort_order",
    )
    expect(menus.rows.map((m) => m.code)).toEqual([
      "big_mac",
      "hamburguesa_queso",
      "cuarto_de_libra",
      "cajita_nuggets",
      "cajita_pollo",
      "cajita_hamburguesa",
    ])
    expect(menus.rows.filter((m) => m.audience === "adulto")).toHaveLength(3)
    expect(menus.rows.filter((m) => m.audience === "nino")).toHaveLength(3)
  })

  it("no inventa precios para los menús", async () => {
    const withPrice = await db.scalar<string>(
      "select count(*) from menu_items where price_cents is not null",
    )
    expect(Number(withPrice)).toBe(0)
  })

  it("genera tokens de invitación únicos y seguros para URL", async () => {
    const tokens = await db.query<{ token: string }>(
      "select generate_invitation_token() as token from generate_series(1, 50)",
    )
    const values = tokens.rows.map((r) => r.token)
    expect(new Set(values).size).toBe(50)
    for (const token of values) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{30,}$/)
      expect(encodeURIComponent(token)).toBe(token)
    }
  })

  it("rechaza teléfonos que no estén en formato E.164", async () => {
    const eventId = await getEventId(db)
    await expect(
      db.query(
        `insert into families (event_id, name, primary_contact_name, whatsapp_phone, max_attendees)
         values ($1, 'Teléfono malo', 'X', '5555-0101', 2)`,
        [eventId],
      ),
    ).rejects.toThrow()
  })

  it("no permite que la fecha límite sea posterior al evento", async () => {
    await expect(
      db.query(
        `insert into events (slug, name, celebrant_name, celebrant_age, event_date, start_time,
                             venue_name, venue_address, rsvp_deadline,
                             whatsapp_invitation_template, whatsapp_reminder_template)
         values ('malo', 'x', 'y', 10, '2026-01-01', '14:00', 'v', 'a', '2026-02-01', 't', 'r')`,
      ),
    ).rejects.toThrow()
  })

  it("carga las diez familias de ejemplo con cupos distintos", async () => {
    await db.runSeed("families.sql")

    const families = await db.query<{
      name: string
      max_attendees: number
      invited: number
    }>(
      `select f.name, f.max_attendees,
              (select count(*) from guests g where g.family_id = f.id and g.is_invited_child)::int as invited
       from families f
       join events e on e.id = f.event_id and e.slug = 'mia-kpop-party'
       where f.name in ('López','García','Pérez','Rodríguez','Martínez',
                        'Hernández','Castillo','Morales','Ramírez','Gómez')
       order by f.name`,
    )

    expect(families.rows).toHaveLength(10)

    const byName = Object.fromEntries(families.rows.map((f) => [f.name, f]))
    expect(byName["López"].max_attendees).toBe(2)
    expect(byName["López"].invited).toBe(1)
    expect(byName["García"].max_attendees).toBe(3)
    expect(byName["Pérez"].max_attendees).toBe(5)
    expect(byName["Pérez"].invited).toBe(2)
    expect(byName["Rodríguez"].max_attendees).toBe(1)
    expect(byName["Martínez"].max_attendees).toBe(4)
    expect(byName["Martínez"].invited).toBe(2)
    expect(byName["Ramírez"].invited).toBe(3)

    // Cada familia recibe un token único
    const distinct = await db.scalar<string>(
      "select count(distinct invitation_token) from families",
    )
    const total = await db.scalar<string>("select count(*) from families")
    expect(distinct).toBe(total)
  })
})
