-- The side effects of a booking that only the back end can do: reminders to plan, the cancellation and no-show fees, the hand-off of a finished booking to
-- the order chain, the notice to the customer. The web app changes a booking through row level security or the desk functions and never calls the back
-- end, so the change itself sends the work: an AFTER trigger puts one message per event on the booking_status queue (pgmq, through job_enqueue so the
-- outbox row keeps the audit trail), and the apply-booking-status job of the back end consumes it.
--   created  a new booking (the public page, the desk, a chat)
--   status   the status changed (confirm, done, no-show, cancel from the desk are plain updates)
--   moved    the time or the resource changed (reminders are planned again)
-- The job is idempotent: each effect keeps a mark on the booking, so a repeated message changes nothing twice.

select pgmq.create('booking_status');

create or replace function public.bookings_notify()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text;
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
  perform public.job_enqueue(
    new.workspace_id, 'booking_status', 'apply-booking-status',
    jsonb_build_object('workspaceId', new.workspace_id, 'bookingId', new.id, 'kind', v_kind, 'status', new.status,
                       'previous', case when tg_op = 'UPDATE' then old.status else null end),
    'booking_status:' || new.id::text || ':' || v_kind || ':' || new.status || ':' || (extract(epoch from clock_timestamp()) * 1000000)::bigint::text
  );
  return new;
end $$;

revoke all on function public.bookings_notify() from public, anon, authenticated;

drop trigger if exists bookings_notify on public.bookings;
create trigger bookings_notify
  after insert or update of status, start_at, resource_id on public.bookings
  for each row execute function public.bookings_notify();

-- The effects the job records on the booking, so a message delivered twice is harmless: the fee is written once, the hand-off once.
alter table public.bookings add column if not exists effects jsonb not null default '{}'::jsonb;
