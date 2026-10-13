-- The lite back end (role app_be) takes over AI usage metering and the credit allowance. The tables it reads and writes are
-- granted by 20261012130100_app-be-grants.sql; this migration adds what is specific to usage:
--   * select on the daily rollup view (security invoker: the row policies of ai_usage_events apply to app_be);
--   * usage_notice_post, the one statement that tells a workspace owner "80% used" or "limit reached" once per month and level.
--     The notices table and the Office messages belong to other capabilities, so usage reaches them through this function
--     (invoker rights: the row policies of app_be apply).
grant select on table public.ai_usage_daily to app_be;

create or replace function public.usage_notice_post(p_workspace uuid, p_period date, p_level text, p_body text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
    insert into public.ai_usage_notices (workspace_id, period, level)
    values (p_workspace, p_period, p_level)
    on conflict (workspace_id, period, level) do nothing;
    if not found then
        return false;
    end if;
    insert into public.messages (workspace_id, author_kind, author_name, body)
    values (p_workspace, 'system', 'NIVO', p_body);
    return true;
end;
$$;

revoke all on function public.usage_notice_post(uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.usage_notice_post(uuid, date, text, text) to app_be;
