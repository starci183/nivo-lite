-- The queues of the video render and the content automations, and the end of the old content tick.
--   video_render   one message per queued render; the render-video job of the back end consumes it (job_enqueue / job_read, per-workspace limit).
--   content_tick   a pg_cron scheduler of the back end (id content-tick) sends one message every quarter hour; the publish-content job consumes it.
-- The content tick used to call the web app through pg_net; the back end owns it now, so the old cron job and its function go away.
-- post_office_notice is the one writer of the Office feed for the content automations: a definer function the back end calls, so the
-- content capability never writes a table that is not its own. It moves into the Office capability when that lands.

select pgmq.create('video_render');
select pgmq.create('content_tick');

do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.unschedule('nivo-content-tick');
    end if;
exception when others then
    raise notice 'nivo-content-tick was not scheduled (%)', sqlerrm;
end
$$;

drop function if exists public.content_tick();

create or replace function public.post_office_notice(p_workspace uuid, p_body text)
returns void
language sql
security definer
set search_path = public
as $$
    insert into public.messages (workspace_id, author_kind, author_name, body)
    values (p_workspace, 'system', 'NIVO', p_body)
$$;

revoke all on function public.post_office_notice(uuid, text) from public, anon, authenticated;
grant execute on function public.post_office_notice(uuid, text) to app_be;
