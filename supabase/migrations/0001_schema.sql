-- =====================================================================
-- MÍA'S K-POP PARTY — Esquema base
-- Migración 0001: extensiones, tipos, tablas, índices y restricciones
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
do $$ begin
  create type rsvp_status as enum ('pendiente', 'confirmado', 'rechazado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_status as enum ('no_preparada', 'lista', 'abierta_whatsapp', 'enviada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type guest_type as enum ('nino', 'adulto');
exception when duplicate_object then null; end $$;

do $$ begin
  create type admin_role as enum ('owner', 'admin', 'viewer');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------

-- Token de invitación base64url (24 bytes = 192 bits de entropía)
create or replace function generate_invitation_token()
returns text
language sql
volatile
-- En Supabase hospedado pgcrypto vive en el esquema "extensions".
set search_path = public, extensions
as $$
  select replace(
           replace(
             rtrim(replace(encode(gen_random_bytes(24), 'base64'), E'\n', ''), '='),
             '+', '-'),
           '/', '_');
$$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
create table if not exists events (
  id                           uuid primary key default gen_random_uuid(),
  slug                         text not null unique,
  name                         text not null,
  celebrant_name               text not null,
  celebrant_age                integer not null check (celebrant_age between 1 and 120),
  event_date                   date not null,
  start_time                   time not null,
  timezone                     text not null default 'America/Guatemala',
  venue_name                   text not null,
  venue_address                text not null,
  venue_maps_url               text,
  theme                        text not null default 'K-pop',
  rsvp_deadline                date not null,
  allow_rsvp_edits             boolean not null default true,
  invitation_headline          text not null default '¡MÍA CUMPLE 10 AÑOS!',
  invitation_subheadline       text not null default 'YOU''RE INVITED!',
  invitation_message           text not null default 'Prepárate para una fiesta K-pop llena de música, juegos y sorpresas.',
  whatsapp_invitation_template text not null,
  whatsapp_reminder_template   text not null,
  theme_primary_color          text not null default '#FF2E9A',
  theme_secondary_color        text not null default '#A855F7',
  theme_accent_color           text not null default '#FFC72C',
  background_image_url         text,
  music_enabled                boolean not null default false,
  music_url                    text,
  is_active                    boolean not null default true,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  constraint events_deadline_before_event check (rsvp_deadline <= event_date)
);

create index if not exists events_active_idx on events (is_active) where is_active;

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at before update on events
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- admin_profiles
-- ---------------------------------------------------------------------
create table if not exists admin_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       admin_role not null default 'admin',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_profiles_email_key on admin_profiles (lower(email));

drop trigger if exists admin_profiles_set_updated_at on admin_profiles;
create trigger admin_profiles_set_updated_at before update on admin_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------
create table if not exists families (
  id                      uuid primary key default gen_random_uuid(),
  event_id                uuid not null references events (id) on delete cascade,
  name                    text not null check (length(btrim(name)) > 0),
  primary_contact_name    text not null check (length(btrim(primary_contact_name)) > 0),
  whatsapp_phone          text not null,
  whatsapp_phone_display  text,
  secondary_contact_name  text,
  secondary_contact_phone text,
  max_attendees           integer not null default 1 check (max_attendees >= 0 and max_attendees <= 50),
  invitation_token        text not null unique default generate_invitation_token(),
  invitation_enabled      boolean not null default true,
  rsvp_status             rsvp_status not null default 'pendiente',
  delivery_status         delivery_status not null default 'no_preparada',
  invitation_sent_at      timestamptz,
  invitation_opened_at    timestamptz,
  rsvp_submitted_at       timestamptz,
  reminder_count          integer not null default 0 check (reminder_count >= 0),
  last_reminder_at        timestamptz,
  needs_review            boolean not null default false,
  review_reason           text,
  notes                   text,
  archived_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint families_phone_e164 check (whatsapp_phone ~ '^\+[1-9][0-9]{6,17}$')
);

create index if not exists families_event_idx         on families (event_id);
create index if not exists families_token_idx         on families (invitation_token);
create index if not exists families_rsvp_status_idx   on families (event_id, rsvp_status);
create index if not exists families_delivery_idx      on families (event_id, delivery_status);
create index if not exists families_needs_review_idx  on families (event_id) where needs_review;
create index if not exists families_active_idx        on families (event_id) where archived_at is null;
create unique index if not exists families_event_name_key on families (event_id, lower(btrim(name)))
  where archived_at is null;

drop trigger if exists families_set_updated_at on families;
create trigger families_set_updated_at before update on families
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- guests
-- ---------------------------------------------------------------------
create table if not exists guests (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references families (id) on delete cascade,
  name             text not null check (length(btrim(name)) > 0),
  guest_type       guest_type not null,
  is_invited_child boolean not null default false,
  is_attending     boolean,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Un "niño invitado" sólo puede ser de tipo niño
  constraint guests_invited_child_is_child check (not is_invited_child or guest_type = 'nino')
);

create index if not exists guests_family_idx    on guests (family_id);
create index if not exists guests_attending_idx on guests (family_id) where is_attending;
create unique index if not exists guests_family_name_key on guests (family_id, lower(btrim(name)));

drop trigger if exists guests_set_updated_at on guests;
create trigger guests_set_updated_at before update on guests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- menu_items
-- ---------------------------------------------------------------------
create table if not exists menu_items (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events (id) on delete cascade,
  code         text not null check (code ~ '^[a-z0-9_]+$'),
  name         text not null,
  description  text,
  audience     guest_type not null,
  image_url    text,
  -- Precio opcional: se desconoce hasta confirmarlo con el restaurante.
  price_cents  integer check (price_cents is null or price_cents >= 0),
  currency     text not null default 'GTQ',
  is_available boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (event_id, code)
);

create index if not exists menu_items_event_audience_idx on menu_items (event_id, audience, sort_order);

drop trigger if exists menu_items_set_updated_at on menu_items;
create trigger menu_items_set_updated_at before update on menu_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- rsvp_responses  (historial de confirmaciones)
-- ---------------------------------------------------------------------
create table if not exists rsvp_responses (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families (id) on delete cascade,
  status         rsvp_status not null,
  attendee_count integer not null default 0 check (attendee_count >= 0),
  children_count integer not null default 0 check (children_count >= 0),
  adults_count   integer not null default 0 check (adults_count >= 0),
  responder_name text,
  message        text,
  payload        jsonb not null default '{}'::jsonb,
  is_current     boolean not null default true,
  revision       integer not null default 1 check (revision >= 1),
  source         text not null default 'invitado' check (source in ('invitado', 'admin')),
  -- Evita confirmaciones duplicadas por doble clic o reintentos de red.
  idempotency_key text,
  ip_hash        text,
  user_agent     text,
  submitted_at   timestamptz not null default now(),
  constraint rsvp_counts_match check (attendee_count = children_count + adults_count)
);

create index if not exists rsvp_responses_family_idx on rsvp_responses (family_id, submitted_at desc);
create unique index if not exists rsvp_responses_one_current_per_family
  on rsvp_responses (family_id) where is_current;
create unique index if not exists rsvp_responses_idempotency_key
  on rsvp_responses (family_id, idempotency_key) where idempotency_key is not null;

-- ---------------------------------------------------------------------
-- attendee_menu_selections
-- ---------------------------------------------------------------------
create table if not exists attendee_menu_selections (
  id               uuid primary key default gen_random_uuid(),
  guest_id         uuid not null references guests (id) on delete cascade,
  family_id        uuid not null references families (id) on delete cascade,
  menu_item_id     uuid not null references menu_items (id) on delete restrict,
  rsvp_response_id uuid references rsvp_responses (id) on delete set null,
  is_current       boolean not null default true,
  needs_review     boolean not null default false,
  review_reason    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Exactamente una selección activa por invitado: fuente única de verdad.
create unique index if not exists menu_selection_one_current_per_guest
  on attendee_menu_selections (guest_id) where is_current;
create index if not exists menu_selection_family_idx  on attendee_menu_selections (family_id) where is_current;
create index if not exists menu_selection_menu_idx    on attendee_menu_selections (menu_item_id) where is_current;
create index if not exists menu_selection_review_idx  on attendee_menu_selections (family_id) where needs_review;

drop trigger if exists menu_selections_set_updated_at on attendee_menu_selections;
create trigger menu_selections_set_updated_at before update on attendee_menu_selections
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- invitation_delivery_logs
-- ---------------------------------------------------------------------
create table if not exists invitation_delivery_logs (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families (id) on delete cascade,
  kind            text not null check (kind in ('invitacion', 'recordatorio')),
  action          text not null check (action in (
                    'preparada', 'mensaje_copiado', 'enlace_copiado', 'abierta_whatsapp',
                    'marcada_enviada', 'omitida', 'token_regenerado',
                    'invitacion_deshabilitada', 'invitacion_habilitada')),
  channel         text not null default 'whatsapp',
  message_preview text,
  performed_by    uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists delivery_logs_family_idx on invitation_delivery_logs (family_id, created_at desc);
create index if not exists delivery_logs_kind_idx   on invitation_delivery_logs (kind, created_at desc);

-- ---------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references events (id) on delete set null,
  entity_type text not null,
  entity_id   uuid,
  action      text not null,
  actor_type  text not null check (actor_type in ('admin', 'invitado', 'sistema')),
  actor_id    uuid,
  actor_label text,
  before_data jsonb,
  after_data  jsonb,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_event_idx  on audit_logs (event_id, created_at desc);

-- ---------------------------------------------------------------------
-- Cumplimiento de cupos a nivel de base de datos
-- Última línea de defensa: ningún camino de escritura puede exceder el cupo.
-- ---------------------------------------------------------------------
create or replace function enforce_family_quota()
returns trigger
language plpgsql
as $$
declare
  v_max       integer;
  v_attending integer;
  v_family    uuid;
begin
  v_family := coalesce(new.family_id, old.family_id);

  select max_attendees into v_max
  from families
  where id = v_family
  for update;

  if v_max is null then
    return new;
  end if;

  select count(*) into v_attending
  from guests
  where family_id = v_family and is_attending is true;

  if v_attending > v_max then
    raise exception
      'Cupo excedido: la familia autoriza % persona(s) y se intentó confirmar %.', v_max, v_attending
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists guests_enforce_quota on guests;
create constraint trigger guests_enforce_quota
  after insert or update on guests
  deferrable initially deferred
  for each row execute function enforce_family_quota();

-- Al reducir el cupo por debajo de lo ya confirmado, marcar para revisión
-- en lugar de permitir registros inconsistentes.
create or replace function flag_family_quota_review()
returns trigger
language plpgsql
as $$
declare
  v_attending integer;
begin
  if new.max_attendees >= old.max_attendees then
    return new;
  end if;

  select count(*) into v_attending
  from guests
  where family_id = new.id and is_attending is true;

  if v_attending > new.max_attendees then
    new.needs_review  := true;
    new.review_reason := format(
      'El cupo se redujo a %s pero ya hay %s asistente(s) confirmado(s). Revisar con la familia.',
      new.max_attendees, v_attending);
  end if;

  return new;
end;
$$;

drop trigger if exists families_flag_quota_review on families;
create trigger families_flag_quota_review before update of max_attendees on families
  for each row execute function flag_family_quota_review();

-- La selección de menú debe corresponder al tipo de invitado y estar disponible.
create or replace function enforce_menu_audience()
returns trigger
language plpgsql
as $$
declare
  v_guest_type   guest_type;
  v_audience     guest_type;
  v_available    boolean;
  v_guest_family uuid;
begin
  if new.is_current is not true then
    return new;
  end if;

  select guest_type, family_id into v_guest_type, v_guest_family
  from guests where id = new.guest_id;

  if v_guest_family is distinct from new.family_id then
    raise exception 'El invitado % no pertenece a la familia %.', new.guest_id, new.family_id
      using errcode = 'foreign_key_violation';
  end if;

  select audience, is_available into v_audience, v_available
  from menu_items where id = new.menu_item_id;

  if v_audience is distinct from v_guest_type then
    raise exception 'El menú seleccionado no corresponde al tipo de invitado (% vs %).', v_audience, v_guest_type
      using errcode = 'check_violation';
  end if;

  if v_available is not true and new.needs_review is not true then
    raise exception 'El menú seleccionado no está disponible.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists menu_selections_enforce_audience on attendee_menu_selections;
create trigger menu_selections_enforce_audience
  before insert or update on attendee_menu_selections
  for each row execute function enforce_menu_audience();
