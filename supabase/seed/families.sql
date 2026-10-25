-- =====================================================================
-- MÍA'S K-POP PARTY — Datos de ejemplo
-- Diez familias ficticias con cupos distintos.
--
-- Ejecutar DESPUÉS de las migraciones. Los números de teléfono son
-- ficticios; reemplazarlos antes de enviar invitaciones reales.
--
--   psql "$DATABASE_URL" -f supabase/seed/families.sql
-- =====================================================================

do $$
declare
  v_event_id uuid;
  v_family_id uuid;
  r record;
  child text;
  i integer;
begin
  select id into v_event_id from events where slug = 'mia-kpop-party';
  if v_event_id is null then
    raise exception 'El evento mia-kpop-party no existe. Ejecute primero las migraciones.';
  end if;

  for r in
    select * from (values
      ('López',     'Ana López',       '+50255550101', 2, array['Sofía'],                        'Vecina del colegio.'),
      ('García',    'Carlos García',   '+50255550102', 3, array['Valeria'],                      'Confirmar transporte.'),
      ('Pérez',     'Lucía Pérez',     '+50255550103', 5, array['Mateo', 'Camila'],              'Dos niños invitados.'),
      ('Rodríguez', 'Pedro Rodríguez', '+50255550104', 1, array['Isabella'],                     'Asiste sola, sin acompañantes.'),
      ('Martínez',  'Gabriela Martínez','+50255550105', 4, array['Daniela', 'Lucía'],            'Primas de Mía.'),
      ('Hernández', 'Jorge Hernández', '+50255550106', 3, array['Emilia'],                       null),
      ('Castillo',  'María Castillo',  '+50255550107', 4, array['Santiago', 'Renata'],           'Hermanos.'),
      ('Morales',   'Diana Morales',   '+50255550108', 2, array['Ximena'],                       'Alergia alimentaria: confirmar menú.'),
      ('Ramírez',   'Luis Ramírez',    '+50255550109', 6, array['Adriana', 'Fernanda', 'Diego'], 'Familia grande, tres niños invitados.'),
      ('Gómez',     'Silvia Gómez',    '+50255550110', 3, array['Victoria'],                     null)
    ) as t(name, contact, phone, max_attendees, children, notes)
  loop
    insert into families (
      event_id, name, primary_contact_name, whatsapp_phone, whatsapp_phone_display,
      max_attendees, notes
    ) values (
      v_event_id, r.name, r.contact, r.phone,
      '+502 ' || substr(r.phone, 5, 4) || ' ' || substr(r.phone, 9, 4),
      r.max_attendees, r.notes
    )
    on conflict do nothing
    returning id into v_family_id;

    if v_family_id is null then
      continue; -- la familia ya existía
    end if;

    i := 0;
    foreach child in array r.children loop
      i := i + 1;
      insert into guests (family_id, name, guest_type, is_invited_child, sort_order)
      values (v_family_id, child, 'nino', true, i)
      on conflict do nothing;
    end loop;
  end loop;
end $$;

select
  f.name                  as familia,
  f.primary_contact_name  as responsable,
  f.whatsapp_phone        as whatsapp,
  f.max_attendees         as cupos,
  (select string_agg(g.name, ', ' order by g.sort_order)
     from guests g where g.family_id = f.id and g.is_invited_child) as ninos_invitados,
  f.invitation_token      as token
from families f
join events e on e.id = f.event_id and e.slug = 'mia-kpop-party'
order by f.name;
