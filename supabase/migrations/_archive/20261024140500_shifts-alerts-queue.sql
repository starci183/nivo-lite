-- Shift reminders and no-show alerts run in the back end: a minute tick (pg_cron scheduler registered by the be) finds the published
-- shifts whose reminder or no-show check is due and queues one job each on `shifts_alerts`. The tick asks, per shift, whether the person
-- was reminded or reported already (shifts_notifications), so that lookup gets an index.
select pgmq.create('shifts_alerts');

create index if not exists shifts_notifications_shift_kind
  on public.shifts_notifications (shift_id, kind) where shift_id is not null;

-- One message of the shifts module as evidence (sent, failed or skipped) with why it did not go out.
create or replace function public.shifts_record_notice(p_ws uuid, p_staff uuid, p_schedule uuid, p_shift uuid, p_kind text, p_channel text, p_status text, p_body text, p_error text)
returns void language plpgsql set search_path = public as $fn$
begin
  insert into public.shifts_notifications (workspace_id, staff_id, schedule_id, shift_id, kind, channel, status, body, error)
  values (p_ws, p_staff, p_schedule, p_shift, p_kind, p_channel, p_status, left(coalesce(p_body, ''), 4000), left(p_error, 500));
end
$fn$;
revoke all on function public.shifts_record_notice(uuid, uuid, uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.shifts_record_notice(uuid, uuid, uuid, uuid, text, text, text, text, text) to app_be;
