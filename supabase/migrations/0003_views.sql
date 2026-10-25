-- =====================================================================
-- MÍA'S K-POP PARTY
-- Migración 0003: vistas agregadas (única fuente de verdad)
--
-- Nada de contadores duplicados: todos los totales se derivan de los
-- registros reales de invitados confirmados y sus selecciones activas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Asistentes confirmados y su menú activo
-- ---------------------------------------------------------------------
drop view if exists v_event_totals;
drop view if exists v_menu_order_summary;
drop view if exists v_family_summary;
drop view if exists v_confirmed_attendee_menus;

create view v_confirmed_attendee_menus with (security_invoker = true) as
select
  f.event_id,
  f.id                as family_id,
  f.name              as family_name,
  f.primary_contact_name,
  g.id                as guest_id,
  g.name              as guest_name,
  g.guest_type,
  g.is_invited_child,
  s.id                as selection_id,
  s.menu_item_id,
  s.needs_review      as selection_needs_review,
  s.review_reason     as selection_review_reason,
  mi.code             as menu_code,
  mi.name             as menu_name,
  mi.audience         as menu_audience,
  mi.price_cents      as menu_price_cents,
  mi.is_available     as menu_is_available
from families f
join guests g
  on g.family_id = f.id
 and g.is_attending is true
left join attendee_menu_selections s
  on s.guest_id = g.id
 and s.is_current
left join menu_items mi
  on mi.id = s.menu_item_id
where f.archived_at is null
  and f.rsvp_status = 'confirmado';

-- ---------------------------------------------------------------------
-- Resumen por familia
-- ---------------------------------------------------------------------
create view v_family_summary with (security_invoker = true) as
select
  f.id,
  f.event_id,
  f.name,
  f.primary_contact_name,
  f.whatsapp_phone,
  f.whatsapp_phone_display,
  f.secondary_contact_name,
  f.secondary_contact_phone,
  f.max_attendees,
  f.invitation_token,
  f.invitation_enabled,
  f.rsvp_status,
  f.delivery_status,
  f.invitation_sent_at,
  f.invitation_opened_at,
  f.rsvp_submitted_at,
  f.reminder_count,
  f.last_reminder_at,
  f.needs_review,
  f.review_reason,
  f.notes,
  f.archived_at,
  f.created_at,
  f.updated_at,
  coalesce(inv.invited_children, 0)                                   as invited_children_count,
  coalesce(inv.invited_children_names, array[]::text[])               as invited_children_names,
  coalesce(att.confirmed_attendees, 0)                                as confirmed_attendees,
  coalesce(att.confirmed_children, 0)                                 as confirmed_children,
  coalesce(att.confirmed_adults, 0)                                   as confirmed_adults,
  coalesce(sel.menu_selections, 0)                                    as menu_selections,
  coalesce(sel.selections_needing_review, 0)                          as selections_needing_review,
  greatest(f.max_attendees - coalesce(att.confirmed_attendees, 0), 0) as remaining_slots,
  (f.rsvp_status = 'confirmado'
     and coalesce(att.confirmed_attendees, 0) > coalesce(sel.menu_selections, 0)) as menu_incomplete
from families f
left join (
  select family_id,
         count(*)                         as invited_children,
         array_agg(name order by sort_order, name) as invited_children_names
  from guests
  where is_invited_child
  group by family_id
) inv on inv.family_id = f.id
left join (
  select family_id,
         count(*)                                                as confirmed_attendees,
         count(*) filter (where guest_type = 'nino')             as confirmed_children,
         count(*) filter (where guest_type = 'adulto')           as confirmed_adults
  from guests
  where is_attending is true
  group by family_id
) att on att.family_id = f.id
left join (
  select s.family_id,
         count(*)                                      as menu_selections,
         count(*) filter (where s.needs_review)        as selections_needing_review
  from attendee_menu_selections s
  join guests g on g.id = s.guest_id and g.is_attending is true
  where s.is_current
  group by s.family_id
) sel on sel.family_id = f.id;

-- ---------------------------------------------------------------------
-- Resumen de pedido por menú
-- ---------------------------------------------------------------------
create view v_menu_order_summary with (security_invoker = true) as
select
  mi.id              as menu_item_id,
  mi.event_id,
  mi.code,
  mi.name,
  mi.description,
  mi.audience,
  mi.is_available,
  mi.price_cents,
  mi.currency,
  mi.sort_order,
  coalesce(q.quantity, 0) as quantity,
  case when mi.price_cents is null then null
       else mi.price_cents * coalesce(q.quantity, 0)
  end as subtotal_cents
from menu_items mi
left join (
  select menu_item_id, count(*) as quantity
  from v_confirmed_attendee_menus
  where menu_item_id is not null
  group by menu_item_id
) q on q.menu_item_id = mi.id;

-- ---------------------------------------------------------------------
-- Totales del evento
-- ---------------------------------------------------------------------
create view v_event_totals with (security_invoker = true) as
select
  e.id as event_id,
  -- Familias
  count(fs.id)                                                            as total_families,
  count(fs.id) filter (where fs.rsvp_status = 'confirmado')               as confirmed_families,
  count(fs.id) filter (where fs.rsvp_status = 'pendiente')                as pending_families,
  count(fs.id) filter (where fs.rsvp_status = 'rechazado')                as declined_families,
  count(fs.id) filter (where fs.needs_review)                             as families_needing_review,
  -- Invitaciones
  count(fs.id) filter (where fs.invitation_enabled)                       as invitations_generated,
  count(fs.id) filter (where fs.delivery_status = 'enviada')              as invitations_sent,
  count(fs.id) filter (where fs.delivery_status = 'lista')                as invitations_ready,
  count(fs.id) filter (where fs.delivery_status = 'abierta_whatsapp')     as invitations_opened,
  count(fs.id) filter (where fs.delivery_status = 'no_preparada')         as invitations_not_prepared,
  -- Capacidad y asistencia
  coalesce(sum(fs.max_attendees), 0)                                      as total_capacity,
  coalesce(sum(fs.confirmed_attendees), 0)                                as confirmed_attendees,
  coalesce(sum(fs.confirmed_children), 0)                                 as confirmed_children,
  coalesce(sum(fs.confirmed_adults), 0)                                   as confirmed_adults,
  coalesce(sum(fs.invited_children_count), 0)                             as invited_children,
  -- Menús
  coalesce(sum(fs.menu_selections), 0)                                    as total_menus_selected,
  coalesce(sum(fs.confirmed_attendees), 0)
    - coalesce(sum(fs.menu_selections), 0)                                as missing_menus,
  count(fs.id) filter (where fs.menu_incomplete)                          as families_with_incomplete_menus
from events e
left join v_family_summary fs
  on fs.event_id = e.id
 and fs.archived_at is null
group by e.id;
