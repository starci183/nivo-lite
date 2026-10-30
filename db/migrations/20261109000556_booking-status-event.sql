-- A booking change reaches the back end as a `booking_status_changed` event on the pgmq event bus, not as a job.
--
-- The AFTER trigger `bookings_notify` (INSERT, and UPDATE OF status, start_at, resource_id on public.bookings) used to enqueue the
-- BullMQ job `apply-booking-status` through public.job_enqueue. It now sends the typed envelope with public.event_bus_send, in the
-- transaction that writes the booking: a commit sends it, a rollback sends nothing. Nothing changes in the trigger itself (same
-- table, same columns, same kinds of change), so no `create trigger` is repeated; only the body of the function is replaced.
--
-- The dedupe key is the business identity of one change: `<booking>:<kind>:<status>:<transaction id>`. It is deterministic, so two
-- changes of one booking in one transaction with the same kind and status are one fact (the reactor reads the booking as it is
-- now, so nothing is lost), while the same change in another transaction is a new fact. The same text is the event id and the
-- correlation id of the envelope; it uses only the characters of a safe correlation id.
--
-- The function is SECURITY DEFINER and runs as the migration owner, which can execute public.event_bus_send (the application role
-- holds that grant too), so the trigger fires for any role that writes a booking. The consumer queue
-- booking_status_changed__booking_effects and its binding to the topic are declared by 20261109000554_event-bus.sql.

create or replace function public.bookings_notify() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_kind text;
  v_key text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'created';
  elsif new.status is distinct from old.status then
    v_kind := 'status';
  elsif new.start_at is distinct from old.start_at or new.resource_id is distinct from old.resource_id then
    v_kind := 'moved';
  else
    return new;
  end if;
  v_key := new.id::text || ':' || v_kind || ':' || new.status || ':' || txid_current()::text;
  perform public.event_bus_send(
    'booking_status_changed',
    jsonb_build_object(
      'metadata', jsonb_build_object('correlationId', v_key),
      'eventId', v_key,
      'eventName', 'booking_status_changed',
      'payload', jsonb_build_object(
        'dedupeKey', v_key,
        'workspaceId', new.workspace_id,
        'bookingId', new.id,
        'kind', v_kind,
        'status', new.status,
        'previous', case when tg_op = 'UPDATE' then old.status else null end
      )
    )
  );
  return new;
end $$;

revoke execute on function public.bookings_notify() from public, anon;
