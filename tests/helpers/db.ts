/**
 * Arranque de una base de datos PostgreSQL real (PGlite/WASM) con las
 * migraciones del proyecto aplicadas.
 *
 * Permite verificar el esquema, los disparadores de cupo y la función
 * transaccional `submit_rsvp` sin depender de un proyecto de Supabase.
 *
 * Supabase provee el esquema `auth`; aquí se crea un equivalente mínimo.
 */
import { PGlite } from "@electric-sql/pglite"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations")
const SEED_DIR = path.resolve(__dirname, "../../supabase/seed")

/** Equivalente mínimo del esquema `auth` de Supabase. */
const AUTH_BOOTSTRAP = /* sql */ `
  create schema if not exists auth;

  create table if not exists auth.users (
    id                 uuid primary key default gen_random_uuid(),
    email              text unique not null,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at         timestamptz not null default now()
  );

  -- Simula el JWT: el usuario activo se guarda en una variable de sesión.
  create or replace function auth.uid() returns uuid language sql stable as $fn$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $fn$;

  create or replace function auth.set_user(p_id uuid) returns void language sql as $fn$
    select set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), false);
  $fn$;
`

/** Roles que Supabase provee de serie. */
const ROLES_BOOTSTRAP = /* sql */ `
  do $boot$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin noinherit;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin noinherit bypassrls;
    end if;
  end $boot$;

  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
`

export type TestDb = PGlite & {
  /** Ejecuta un archivo SQL del directorio supabase/seed. */
  runSeed: (fileName: string) => Promise<void>
  /** Primera columna de la primera fila. */
  scalar: <T = unknown>(sql: string, params?: unknown[]) => Promise<T>
}

export async function createTestDb(): Promise<TestDb> {
  const db = await PGlite.create({ extensions: { pgcrypto } })

  await db.exec("create extension if not exists pgcrypto;")
  await db.exec(ROLES_BOOTSTRAP)
  await db.exec(AUTH_BOOTSTRAP)

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort()

  if (files.length === 0) {
    throw new Error(`No se encontraron migraciones en ${MIGRATIONS_DIR}`)
  }

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8")
    try {
      await db.exec(sql)
    } catch (error) {
      throw new Error(
        `La migración ${file} falló: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const typed = db as unknown as TestDb

  typed.runSeed = async (fileName: string) => {
    const sql = await readFile(path.join(SEED_DIR, fileName), "utf8")
    await db.exec(sql)
  }

  typed.scalar = async <T>(sql: string, params: unknown[] = []) => {
    const result = await db.query<Record<string, T>>(sql, params)
    const row = result.rows[0]
    if (!row) throw new Error(`La consulta no devolvió filas: ${sql}`)
    return Object.values(row)[0] as T
  }

  return typed
}

export async function getEventId(db: TestDb): Promise<string> {
  return db.scalar<string>("select id from events where slug = 'mia-kpop-party'")
}

export type SeedFamilyOptions = {
  name: string
  maxAttendees: number
  children?: string[]
  phone?: string
  contact?: string
  invitationEnabled?: boolean
}

export type SeededFamily = {
  id: string
  token: string
  children: { id: string; name: string }[]
}

/** Crea una familia con sus niños invitados y devuelve ids + token. */
export async function seedFamily(
  db: TestDb,
  options: SeedFamilyOptions,
): Promise<SeededFamily> {
  const eventId = await getEventId(db)
  const {
    name,
    maxAttendees,
    children = [],
    phone = `+5025555${String(Math.floor(Math.random() * 9000) + 1000)}`,
    contact = `Responsable ${name}`,
    invitationEnabled = true,
  } = options

  const inserted = await db.query<{ id: string; invitation_token: string }>(
    `insert into families (event_id, name, primary_contact_name, whatsapp_phone,
                           max_attendees, invitation_enabled)
     values ($1, $2, $3, $4, $5, $6)
     returning id, invitation_token`,
    [eventId, name, contact, phone, maxAttendees, invitationEnabled],
  )

  const family = inserted.rows[0]
  const kids: { id: string; name: string }[] = []

  for (const [index, child] of children.entries()) {
    const row = await db.query<{ id: string; name: string }>(
      `insert into guests (family_id, name, guest_type, is_invited_child, sort_order)
       values ($1, $2, 'nino', true, $3)
       returning id, name`,
      [family.id, child, index + 1],
    )
    kids.push(row.rows[0])
  }

  return { id: family.id, token: family.invitation_token, children: kids }
}

export type MenuMap = Record<string, string>

/** Mapa código de menú -> id. */
export async function getMenuMap(db: TestDb): Promise<MenuMap> {
  const result = await db.query<{ code: string; id: string }>(
    "select code, id from menu_items",
  )
  return Object.fromEntries(result.rows.map((r) => [r.code, r.id]))
}

export type RsvpResult = {
  ok: boolean
  code?: string
  duplicate?: boolean
  family_id?: string
  status?: string
  attendee_count?: number
  children_count?: number
  adults_count?: number
  revision?: number
  max_attendees?: number
  requested?: number
}

export async function submitRsvp(
  db: TestDb,
  token: string,
  payload: unknown,
  idempotencyKey: string | null = null,
): Promise<RsvpResult> {
  const result = await db.query<{ submit_rsvp: RsvpResult }>(
    "select submit_rsvp($1, $2::jsonb, $3) as submit_rsvp",
    [token, JSON.stringify(payload), idempotencyKey],
  )
  return result.rows[0].submit_rsvp
}
