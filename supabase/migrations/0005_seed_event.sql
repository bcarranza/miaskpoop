-- =====================================================================
-- MÍA'S K-POP PARTY
-- Migración 0005: datos iniciales del evento y catálogo de menús
--
-- El catálogo contiene las seis opciones solicitadas. Los precios, las
-- bebidas incluidas y los acompañamientos quedan sin definir: deben
-- confirmarse con el restaurante antes del evento.
-- =====================================================================

insert into events (
  slug, name, celebrant_name, celebrant_age,
  event_date, start_time, timezone,
  venue_name, venue_address, theme,
  rsvp_deadline, allow_rsvp_edits,
  invitation_headline, invitation_subheadline, invitation_message,
  whatsapp_invitation_template, whatsapp_reminder_template,
  theme_primary_color, theme_secondary_color, theme_accent_color,
  music_enabled, is_active
) values (
  'mia-kpop-party',
  'Mía''s K-pop Party',
  'Mía',
  10,
  '2026-11-12',
  '14:00',
  'America/Guatemala',
  'McDonald''s Metro Plaza',
  'Metro Plaza, Jalapa, Guatemala',
  'K-pop',
  '2026-11-07',
  true,
  '¡MÍA CUMPLE 10 AÑOS!',
  'YOU''RE INVITED!',
  'Prepárate para una fiesta K-pop llena de música, juegos y sorpresas.',
  -- Plantilla de invitación por WhatsApp
     E'🎤💜 ¡{{CELEBRANT_NAME_UPPER}} CUMPLE {{CELEBRANT_AGE}} AÑOS! 💜🎤\n\n'
  || E'¡Hola, familia {{FAMILY_NAME}}!\n\n'
  || E'Con mucha alegría queremos invitar a {{INVITED_CHILDREN_NAMES}} a celebrar los {{CELEBRANT_AGE}} años de {{CELEBRANT_NAME}}.\n\n'
  || E'🎶 ¡Una fiesta K-pop llena de música, diversión y sorpresas!\n\n'
  || E'📅 {{EVENT_DATE}}\n'
  || E'🕑 {{EVENT_TIME}}\n'
  || E'📍 {{VENUE}}\n\n'
  || E'👨‍👩‍👧 Esta invitación es válida para un máximo de {{MAX_ATTENDEES}} {{PERSONAS}} en total, {{INVITED_CHILDREN_LABEL}}.\n\n'
  || E'💌 Confirmen su asistencia y seleccionen sus menús aquí:\n\n'
  || E'{{RSVP_URL}}\n\n'
  || E'¡Los esperamos! 🎉💖',
  -- Plantilla de recordatorio por WhatsApp
     E'🎤💜 Recordatorio: ¡{{CELEBRANT_NAME}} cumple {{CELEBRANT_AGE}} años! 💜🎤\n\n'
  || E'¡Hola, familia {{FAMILY_NAME}}!\n\n'
  || E'Todavía no hemos recibido su confirmación para la fiesta K-pop de {{CELEBRANT_NAME}}.\n\n'
  || E'📅 {{EVENT_DATE}}\n'
  || E'🕑 {{EVENT_TIME}}\n'
  || E'📍 {{VENUE}}\n\n'
  || E'🗓️ Pueden confirmar hasta el {{RSVP_DEADLINE}}. La invitación es válida para un máximo de {{MAX_ATTENDEES}} {{PERSONAS}}.\n\n'
  || E'💌 Confirmar aquí:\n\n'
  || E'{{RSVP_URL}}\n\n'
  || E'¡Gracias! 🎉💖',
  '#FF2E9A',
  '#A855F7',
  '#FFC72C',
  false,
  true
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Catálogo inicial de menús
-- ---------------------------------------------------------------------
insert into menu_items (event_id, code, name, description, audience, sort_order)
select e.id, m.code, m.name, m.description, m.audience::guest_type, m.sort_order
from events e
cross join (values
  ('big_mac',          'Big Mac',                              'Menú para adultos.',  'adulto', 1),
  ('hamburguesa_queso','Hamburguesa con queso',                'Menú para adultos.',  'adulto', 2),
  ('cuarto_de_libra',  'Cuarto de libra',                      'Menú para adultos.',  'adulto', 3),
  ('cajita_nuggets',   'Cajita Feliz de Nuggets',              'Cajita Feliz para niños.', 'nino', 4),
  ('cajita_pollo',     'Cajita Feliz de Pollo',                'Cajita Feliz para niños.', 'nino', 5),
  ('cajita_hamburguesa','Cajita Feliz de Hamburguesa con queso','Cajita Feliz para niños.', 'nino', 6)
) as m(code, name, description, audience, sort_order)
where e.slug = 'mia-kpop-party'
on conflict (event_id, code) do nothing;
