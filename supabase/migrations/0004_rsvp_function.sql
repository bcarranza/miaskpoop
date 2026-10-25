-- =====================================================================
-- MÍA'S K-POP PARTY
-- Migración 0004: confirmación de asistencia atómica
--
-- Toda la confirmación (asistentes + menús + estado de la familia +
-- historial + auditoría) ocurre dentro de una sola transacción con
-- bloqueo de la fila de la familia. El cupo se valida aquí, además de
-- en el cliente y en el servidor.
-- =====================================================================

do $$ begin
  create type rsvp_attendee_input as (
    guest_id         uuid,
    name             text,
    guest_type       guest_type,
    is_invited_child boolean,
    menu_item_id     uuid
  );
exception when duplicate_object then null; end $$;

create or replace function submit_rsvp(
  p_token           text,
  p_payload         jsonb,
  p_idempotency_key text default null,
  p_ip_hash         text default null,
  p_user_agent      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family        families;
  v_event         events;
  v_attending     boolean;
  v_attendees     rsvp_attendee_input[];
  v_in            rsvp_attendee_input;
  v_count         integer := 0;
  v_children      integer := 0;
  v_adults        integer := 0;
  v_response_id   uuid;
  v_revision      integer := 1;
  v_final_ids     uuid[] := array[]::uuid[];
  v_guest_id      uuid;
  v_idx           integer := 0;
  v_bad           integer;
  v_prev          rsvp_responses;
  v_status        rsvp_status;
begin
  -- ------------------------------------------------------------------
  -- 1. Localizar y bloquear la familia por su token
  -- ------------------------------------------------------------------
  select * into v_family
  from families
  where invitation_token = p_token
    and archived_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'token_invalido');
  end if;

  if not v_family.invitation_enabled then
    return jsonb_build_object('ok', false, 'code', 'invitacion_deshabilitada');
  end if;

  select * into v_event from events where id = v_family.event_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'evento_no_encontrado');
  end if;

  -- ------------------------------------------------------------------
  -- 2. Idempotencia: un reenvío con la misma clave no duplica nada
  -- ------------------------------------------------------------------
  if p_idempotency_key is not null then
    select * into v_prev
    from rsvp_responses
    where family_id = v_family.id
      and idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'family_id', v_family.id,
        'status', v_prev.status,
        'attendee_count', v_prev.attendee_count,
        'revision', v_prev.revision
      );
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- 3. Plazo y permiso de modificación
  -- ------------------------------------------------------------------
  if (now() at time zone v_event.timezone)::date > v_event.rsvp_deadline then
    return jsonb_build_object(
      'ok', false,
      'code', 'fuera_de_plazo',
      'deadline', v_event.rsvp_deadline
    );
  end if;

  if v_family.rsvp_submitted_at is not null and not v_event.allow_rsvp_edits then
    return jsonb_build_object('ok', false, 'code', 'edicion_no_permitida');
  end if;

  v_attending := coalesce((p_payload ->> 'attending')::boolean, false);

  -- ------------------------------------------------------------------
  -- 4. Validación del contenido (antes de cualquier escritura)
  -- ------------------------------------------------------------------
  if v_attending then
    -- 4.1 Normalizar la lista de asistentes
    select array_agg(
             row(a.guest_id, a.name, a.guest_type, coalesce(a.is_invited_child, false), a.menu_item_id)
             ::rsvp_attendee_input
             order by a.idx)
      into v_attendees
    from (
      select
        t.ordinality                                          as idx,
        nullif(btrim(coalesce(t.e ->> 'guest_id', '')), '')::uuid       as guest_id,
        nullif(btrim(coalesce(t.e ->> 'name', '')), '')                as name,
        case when t.e ->> 'guest_type' in ('nino', 'adulto')
             then (t.e ->> 'guest_type')::guest_type end               as guest_type,
        (t.e ->> 'is_invited_child')::boolean                          as is_invited_child,
        nullif(btrim(coalesce(t.e ->> 'menu_item_id', '')), '')::uuid  as menu_item_id
      from jsonb_array_elements(coalesce(p_payload -> 'attendees', '[]'::jsonb))
           with ordinality as t(e, ordinality)
    ) a;

    v_count := coalesce(array_length(v_attendees, 1), 0);

    if v_count = 0 then
      return jsonb_build_object('ok', false, 'code', 'sin_asistentes');
    end if;

    -- 4.2 Cupo autorizado (la validación definitiva vive en la base de datos)
    if v_count > v_family.max_attendees then
      return jsonb_build_object(
        'ok', false,
        'code', 'cupo_excedido',
        'max_attendees', v_family.max_attendees,
        'requested', v_count
      );
    end if;

    -- 4.3 Nombres y tipos válidos
    select count(*) into v_bad
    from unnest(v_attendees) a
    where a.name is null or a.guest_type is null;

    if v_bad > 0 then
      return jsonb_build_object('ok', false, 'code', 'datos_invitado_invalidos');
    end if;

    -- 4.4 Sin nombres repetidos dentro de la familia
    select count(*) into v_bad
    from (
      select lower(btrim(a.name)) as n
      from unnest(v_attendees) a
      group by lower(btrim(a.name))
      having count(*) > 1
    ) d;

    if v_bad > 0 then
      return jsonb_build_object('ok', false, 'code', 'nombres_duplicados');
    end if;

    -- 4.5 Los invitados existentes deben pertenecer a esta familia
    select count(*) into v_bad
    from unnest(v_attendees) a
    where a.guest_id is not null
      and not exists (
        select 1 from guests g
        where g.id = a.guest_id and g.family_id = v_family.id
      );

    if v_bad > 0 then
      return jsonb_build_object('ok', false, 'code', 'invitado_ajeno');
    end if;

    -- 4.6 Cada asistente necesita exactamente un menú
    select count(*) into v_bad
    from unnest(v_attendees) a
    where a.menu_item_id is null;

    if v_bad > 0 then
      return jsonb_build_object('ok', false, 'code', 'menu_faltante', 'missing', v_bad);
    end if;

    -- 4.7 El menú debe existir, pertenecer al evento, estar disponible
    --     y corresponder al tipo de invitado
    select count(*) into v_bad
    from unnest(v_attendees) a
    left join menu_items mi on mi.id = a.menu_item_id
    where mi.id is null
       or mi.event_id <> v_event.id
       or not mi.is_available
       or mi.audience <> a.guest_type;

    if v_bad > 0 then
      return jsonb_build_object('ok', false, 'code', 'menu_invalido', 'invalid', v_bad);
    end if;

    select
      count(*) filter (where a.guest_type = 'nino'),
      count(*) filter (where a.guest_type = 'adulto')
      into v_children, v_adults
    from unnest(v_attendees) a;
  end if;

  v_status := case when v_attending then 'confirmado' else 'rechazado' end::rsvp_status;

  -- ------------------------------------------------------------------
  -- 5. Escritura (todo o nada)
  -- ------------------------------------------------------------------
  select coalesce(max(revision), 0) + 1 into v_revision
  from rsvp_responses where family_id = v_family.id;

  update rsvp_responses
     set is_current = false
   where family_id = v_family.id and is_current;

  insert into rsvp_responses (
    family_id, status, attendee_count, children_count, adults_count,
    responder_name, message, payload, is_current, revision, source,
    idempotency_key, ip_hash, user_agent
  ) values (
    v_family.id, v_status,
    case when v_attending then v_count else 0 end,
    case when v_attending then v_children else 0 end,
    case when v_attending then v_adults else 0 end,
    nullif(btrim(coalesce(p_payload ->> 'responder_name', '')), ''),
    nullif(btrim(coalesce(p_payload ->> 'message', '')), ''),
    p_payload, true, v_revision, 'invitado',
    p_idempotency_key, p_ip_hash, p_user_agent
  )
  returning id into v_response_id;

  if v_attending then
    foreach v_in in array v_attendees loop
      v_idx := v_idx + 1;

      if v_in.guest_id is not null then
        update guests
           set name         = v_in.name,
               guest_type   = v_in.guest_type,
               is_attending = true,
               sort_order   = v_idx
         where id = v_in.guest_id
           and family_id = v_family.id
        returning id into v_guest_id;
      else
        -- Acompañante nuevo. Si ya existía un registro con el mismo
        -- nombre se reutiliza en lugar de duplicarlo.
        insert into guests (family_id, name, guest_type, is_invited_child, is_attending, sort_order)
        values (v_family.id, v_in.name, v_in.guest_type, false, true, v_idx)
        on conflict (family_id, lower(btrim(name))) do update
           set guest_type   = excluded.guest_type,
               is_attending = true,
               sort_order   = excluded.sort_order
        returning id into v_guest_id;
      end if;

      if v_guest_id is null then
        raise exception 'No se pudo registrar al asistente "%".', v_in.name;
      end if;

      v_final_ids := v_final_ids || v_guest_id;

      -- Una única selección activa por asistente
      update attendee_menu_selections
         set is_current = false
       where guest_id = v_guest_id and is_current;

      insert into attendee_menu_selections (
        guest_id, family_id, menu_item_id, rsvp_response_id, is_current
      ) values (
        v_guest_id, v_family.id, v_in.menu_item_id, v_response_id, true
      );
    end loop;
  end if;

  -- Quien no asiste queda marcado como tal; los acompañantes que ya no
  -- vienen se eliminan. Los niños invitados se conservan (los administra
  -- el panel), sólo se marcan como no asistentes.
  update guests
     set is_attending = false
   where family_id = v_family.id
     and not (id = any (v_final_ids))
     and is_attending is distinct from false;

  delete from guests
   where family_id = v_family.id
     and not is_invited_child
     and not (id = any (v_final_ids));

  update attendee_menu_selections
     set is_current = false
   where family_id = v_family.id
     and is_current
     and not (guest_id = any (v_final_ids));

  -- ------------------------------------------------------------------
  -- 6. Estado de la familia
  -- ------------------------------------------------------------------
  update families
     set rsvp_status       = v_status,
         rsvp_submitted_at = now(),
         needs_review      = false,
         review_reason     = null
   where id = v_family.id;

  insert into audit_logs (
    event_id, entity_type, entity_id, action, actor_type, actor_label,
    before_data, after_data, metadata
  ) values (
    v_event.id, 'family', v_family.id,
    case when v_revision = 1 then 'rsvp_creado' else 'rsvp_modificado' end,
    'invitado',
    coalesce(nullif(btrim(coalesce(p_payload ->> 'responder_name', '')), ''), v_family.primary_contact_name),
    jsonb_build_object('rsvp_status', v_family.rsvp_status),
    jsonb_build_object(
      'rsvp_status', v_status,
      'attendee_count', case when v_attending then v_count else 0 end
    ),
    jsonb_build_object('revision', v_revision, 'response_id', v_response_id, 'ip_hash', p_ip_hash)
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'family_id', v_family.id,
    'status', v_status,
    'attendee_count', case when v_attending then v_count else 0 end,
    'children_count', case when v_attending then v_children else 0 end,
    'adults_count', case when v_attending then v_adults else 0 end,
    'revision', v_revision
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Regeneración segura de token
-- ---------------------------------------------------------------------
create or replace function regenerate_invitation_token(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  update families
     set invitation_token = generate_invitation_token(),
         delivery_status  = 'no_preparada',
         invitation_sent_at = null,
         invitation_opened_at = null
   where id = p_family_id
     and archived_at is null
  returning invitation_token into v_token;

  if v_token is null then
    raise exception 'Familia % no encontrada.', p_family_id;
  end if;

  insert into invitation_delivery_logs (family_id, kind, action)
  values (p_family_id, 'invitacion', 'token_regenerado');

  return v_token;
end;
$$;

-- ---------------------------------------------------------------------
-- Al deshabilitar un menú, marcar las selecciones afectadas para
-- revisión en lugar de reemplazarlas en silencio.
-- ---------------------------------------------------------------------
create or replace function flag_selections_on_menu_disabled()
returns trigger
language plpgsql
as $$
begin
  if old.is_available and not new.is_available then
    update attendee_menu_selections s
       set needs_review  = true,
           review_reason = format('El menú "%s" ya no está disponible. Confirmar un cambio con la familia.', new.name)
     where s.menu_item_id = new.id
       and s.is_current;

    update families f
       set needs_review  = true,
           review_reason = format('Menú no disponible: %s', new.name)
     where f.id in (
       select distinct s.family_id
       from attendee_menu_selections s
       join guests g on g.id = s.guest_id and g.is_attending is true
       where s.menu_item_id = new.id and s.is_current
     );
  elsif not old.is_available and new.is_available then
    update attendee_menu_selections s
       set needs_review  = false,
           review_reason = null
     where s.menu_item_id = new.id
       and s.is_current
       and s.needs_review;
  end if;

  return new;
end;
$$;

drop trigger if exists menu_items_flag_selections on menu_items;
create trigger menu_items_flag_selections
  after update of is_available on menu_items
  for each row execute function flag_selections_on_menu_disabled();

-- Los permisos de ejecución se asignan en 0006_grants.sql.
