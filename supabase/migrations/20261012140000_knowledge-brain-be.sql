-- The back end side of knowledge and brain (lane L06).
--
-- app_be already holds the table grants and policies of 20261012130100_app-be-grants.sql. A back end capability writes only its own table
-- (BE_SQL_TABLE_OWNER), so the writes that cross tables live in security definer functions the capability calls:
--   record_ai_usage        the usage ledger (ai_usage_events), written by the knowledge metering
--   post_ai_usage_notice   the once-a-month owner notice (ai_usage_notices + a system line in messages)
-- and the database keeps the passages of a source in step with the source itself (module as well as visibility).

-- ---------------------------------------------------------------- usage ledger
create or replace function public.record_ai_usage(
  p_workspace uuid, p_kind text, p_module text, p_model text, p_prompt int, p_completion int, p_cost numeric, p_estimated boolean
) returns void
language sql security definer set search_path = public as $$
  insert into public.ai_usage_events (workspace_id, kind, module, model, prompt_tokens, completion_tokens, cost_usd, estimated)
  values (p_workspace, p_kind, p_module, p_model, greatest(p_prompt, 0), greatest(p_completion, 0), greatest(p_cost, 0), p_estimated);
$$;
revoke all on function public.record_ai_usage(uuid, text, text, text, int, int, numeric, boolean) from public, anon, authenticated;
grant execute on function public.record_ai_usage(uuid, text, text, text, int, int, numeric, boolean) to app_be, service_role;

-- ---------------------------------------------------------------- owner notice, once per month and level
create or replace function public.post_ai_usage_notice(p_workspace uuid, p_period date, p_level text, p_body text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_claimed int;
begin
  insert into public.ai_usage_notices (workspace_id, period, level) values (p_workspace, p_period, p_level)
  on conflict do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    return false;
  end if;
  insert into public.messages (workspace_id, author_kind, author_name, body) values (p_workspace, 'system', 'NIVO', p_body);
  return true;
end;
$$;
revoke all on function public.post_ai_usage_notice(uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.post_ai_usage_notice(uuid, date, text, text) to app_be, service_role;

-- ---------------------------------------------------------------- allowance read by the back end role
grant execute on function public.ai_quota_status(uuid) to app_be;

-- ---------------------------------------------------------------- passages follow their source
create or replace function public.knowledge_chunk_visibility_sync()
returns trigger language plpgsql as $$
begin
  if new.visibility is distinct from old.visibility or new.module is distinct from old.module then
    update public.knowledge_chunks set visibility = new.visibility, module = new.module where source_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists knowledge_sources_visibility_sync on public.knowledge_sources;
create trigger knowledge_sources_visibility_sync after update of visibility, module on public.knowledge_sources
  for each row execute function public.knowledge_chunk_visibility_sync();
