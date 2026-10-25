-- =====================================================================
-- MÍA'S K-POP PARTY
-- Migración 0002: Row Level Security
--
-- Modelo de seguridad:
--   * anon (navegador público) NO tiene acceso directo a ninguna tabla.
--     Los invitados leen y escriben únicamente a través de código del
--     servidor que valida el token de invitación.
--   * authenticated sólo puede operar si existe un admin_profiles activo.
--   * service_role (sólo en el servidor) opera sin restricciones.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from admin_profiles p
    where p.id = auth.uid() and p.is_active
  );
$$;

create or replace function is_admin_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from admin_profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'owner'
  );
$$;

create or replace function can_write()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from admin_profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------
-- Activar RLS en todas las tablas
-- ---------------------------------------------------------------------
alter table events                   enable row level security;
alter table admin_profiles           enable row level security;
alter table families                 enable row level security;
alter table guests                   enable row level security;
alter table menu_items               enable row level security;
alter table rsvp_responses           enable row level security;
alter table attendee_menu_selections enable row level security;
alter table invitation_delivery_logs enable row level security;
alter table audit_logs               enable row level security;

-- Forzar RLS también para el dueño de las tablas (defensa en profundidad).
alter table families                 force row level security;
alter table guests                   force row level security;
alter table rsvp_responses           force row level security;
alter table attendee_menu_selections force row level security;

-- Los permisos del rol anónimo se revocan en la migración 0006_grants.sql,
-- que se ejecuta al final para cubrir también las vistas.

-- ---------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------
drop policy if exists events_admin_select on events;
create policy events_admin_select on events
  for select to authenticated using (is_admin());

drop policy if exists events_admin_write on events;
create policy events_admin_write on events
  for all to authenticated using (can_write()) with check (can_write());

-- ---------------------------------------------------------------------
-- admin_profiles
-- ---------------------------------------------------------------------
drop policy if exists admin_profiles_self_select on admin_profiles;
create policy admin_profiles_self_select on admin_profiles
  for select to authenticated using (id = auth.uid() or is_admin());

drop policy if exists admin_profiles_self_update on admin_profiles;
create policy admin_profiles_self_update on admin_profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and is_active);

drop policy if exists admin_profiles_owner_manage on admin_profiles;
create policy admin_profiles_owner_manage on admin_profiles
  for all to authenticated using (is_admin_owner()) with check (is_admin_owner());

-- ---------------------------------------------------------------------
-- families / guests / menu_items / rsvp / selecciones
-- ---------------------------------------------------------------------
drop policy if exists families_admin_select on families;
create policy families_admin_select on families
  for select to authenticated using (is_admin());
drop policy if exists families_admin_write on families;
create policy families_admin_write on families
  for all to authenticated using (can_write()) with check (can_write());

drop policy if exists guests_admin_select on guests;
create policy guests_admin_select on guests
  for select to authenticated using (is_admin());
drop policy if exists guests_admin_write on guests;
create policy guests_admin_write on guests
  for all to authenticated using (can_write()) with check (can_write());

drop policy if exists menu_items_admin_select on menu_items;
create policy menu_items_admin_select on menu_items
  for select to authenticated using (is_admin());
drop policy if exists menu_items_admin_write on menu_items;
create policy menu_items_admin_write on menu_items
  for all to authenticated using (can_write()) with check (can_write());

drop policy if exists rsvp_admin_select on rsvp_responses;
create policy rsvp_admin_select on rsvp_responses
  for select to authenticated using (is_admin());
drop policy if exists rsvp_admin_write on rsvp_responses;
create policy rsvp_admin_write on rsvp_responses
  for all to authenticated using (can_write()) with check (can_write());

drop policy if exists selections_admin_select on attendee_menu_selections;
create policy selections_admin_select on attendee_menu_selections
  for select to authenticated using (is_admin());
drop policy if exists selections_admin_write on attendee_menu_selections;
create policy selections_admin_write on attendee_menu_selections
  for all to authenticated using (can_write()) with check (can_write());

drop policy if exists delivery_logs_admin_select on invitation_delivery_logs;
create policy delivery_logs_admin_select on invitation_delivery_logs
  for select to authenticated using (is_admin());
drop policy if exists delivery_logs_admin_write on invitation_delivery_logs;
create policy delivery_logs_admin_write on invitation_delivery_logs
  for all to authenticated using (can_write()) with check (can_write());

-- Los registros de auditoría son de sólo lectura para administradores:
-- se escriben desde funciones del servidor / service_role.
drop policy if exists audit_logs_admin_select on audit_logs;
create policy audit_logs_admin_select on audit_logs
  for select to authenticated using (is_admin());

-- ---------------------------------------------------------------------
-- Alta automática del primer administrador
-- El primer usuario creado en Supabase Auth se convierte en 'owner'.
-- Los siguientes quedan inactivos hasta que un owner los habilite.
-- ---------------------------------------------------------------------
create or replace function handle_new_admin_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_is_first boolean;
begin
  select not exists (select 1 from admin_profiles) into v_is_first;

  insert into admin_profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when v_is_first then 'owner'::admin_role else 'admin'::admin_role end,
    v_is_first
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_admin_user();
