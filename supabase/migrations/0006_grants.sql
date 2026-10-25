-- =====================================================================
-- MÍA'S K-POP PARTY
-- Migración 0006: permisos por rol
--
-- Se ejecuta al final para cubrir también las vistas creadas en 0003.
--
-- anon           -> sin acceso a ninguna tabla, vista o función.
--                   Los invitados nunca consultan la base directamente:
--                   todo pasa por código del servidor que valida el token.
-- authenticated  -> acceso mediado por las políticas RLS (sólo admins).
-- service_role   -> acceso completo, únicamente desde el servidor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Revocar todo al rol anónimo (tablas y vistas incluidas)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
    execute 'revoke all on all functions in schema public from anon';
    execute 'revoke usage on schema public from anon';
    -- Evita que objetos futuros queden expuestos por omisión.
    execute 'alter default privileges in schema public revoke all on tables from anon';
    execute 'alter default privileges in schema public revoke all on functions from anon';
    execute 'alter default privileges in schema public revoke all on sequences from anon';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Administradores autenticados: RLS decide qué pueden ver
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema public to authenticated';
    execute 'grant select, insert, update, delete on all tables in schema public to authenticated';
    execute 'grant usage, select on all sequences in schema public to authenticated';
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema public to service_role';
    execute 'grant all on all tables in schema public to service_role';
    execute 'grant all on all sequences in schema public to service_role';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Las funciones sensibles no son invocables por el rol anónimo
-- ---------------------------------------------------------------------
do $$
begin
  execute 'revoke all on function submit_rsvp(text, jsonb, text, text, text) from public';
  execute 'revoke all on function regenerate_invitation_token(uuid) from public';
  execute 'revoke all on function generate_invitation_token() from public';

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function submit_rsvp(text, jsonb, text, text, text) to service_role';
    execute 'grant execute on function regenerate_invitation_token(uuid) to service_role';
    execute 'grant execute on function generate_invitation_token() to service_role';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function regenerate_invitation_token(uuid) to authenticated';
    execute 'grant execute on function generate_invitation_token() to authenticated';
    execute 'grant execute on function is_admin() to authenticated';
    execute 'grant execute on function can_write() to authenticated';
    execute 'grant execute on function is_admin_owner() to authenticated';
  end if;
end $$;
