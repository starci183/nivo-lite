-- OpenClaw is the only text-generating AI. Every text the app needs (setup chat, owner chat, Office replies, lead classification, automation drafts...)
-- is an engine job `openclaw.generate` whose result comes back through the signed engine callback into this table; the app polls it.
-- Customer chat has its own job (chat.turn). Embeddings stay on the embedding API (not text generation).

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  purpose text not null,                                    -- setup_chat, owner_chat, relay, classify_lead, automation_draft, ...
  module text not null default 'other',                     -- usage module (setup, office, sales, accounting, chatbot, other)
  usage_kind text not null default 'engine',                -- usage kind the metering records it under
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error', 'cancelled')),
  input jsonb not null default '{}'::jsonb,                 -- { messages: [{role, content}], response_format: 'text' | 'json', timeout_ms }
  output jsonb,                                             -- { text }
  error text,
  timings jsonb not null default '{}'::jsonb,               -- { queue_ms, session_ms, model_ms, total_ms }
  usage jsonb,                                              -- { prompt_tokens, completion_tokens, cached_tokens, cost, model }
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ai_generations_workspace on public.ai_generations (workspace_id, created_at desc);
create index ai_generations_open on public.ai_generations (created_at) where status in ('queued', 'running');
alter table public.ai_generations enable row level security;
create policy ai_generations_read on public.ai_generations for select to authenticated using (public.is_member(workspace_id));
revoke all on public.ai_generations from anon, authenticated;
grant select on public.ai_generations to authenticated;
grant all on public.ai_generations to service_role;

-- The prompts in `input` are working data, not an archive: keep three days.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('ai-generations-prune', '17 3 * * *', $cron$ delete from public.ai_generations where created_at < now() - interval '3 days' $cron$);
    exception when others then
      raise notice 'could not schedule ai-generations-prune (%)', sqlerrm;
    end;
  end if;
end $$;

-- The sweeper also frees generation jobs nobody waits for any more (the caller polls for at most about a minute).
create or replace function public.engine_sweep_claim()
returns setof public.engine_jobs language plpgsql security definer set search_path = public as $$
begin
  update public.engine_jobs set status = 'cancelled', error = 'stale generation', finished_at = now(), locked_by = null, locked_until = null
   where kind = 'openclaw.generate' and status in ('queued', 'running') and created_at < now() - interval '3 minutes';
  update public.ai_generations set status = 'cancelled', error = coalesce(error, 'stale'), finished_at = now()
   where status in ('queued', 'running') and created_at < now() - interval '3 minutes';
  return query
  with due as (
    select j.id
      from public.engine_jobs j
      left join public.module_installations i on i.agent_id::text = j.payload ->> 'agent_id'
     where j.kind = 'chat.turn'
       and ((j.status = 'queued' and j.created_at < now() - interval '30 seconds')
         or (j.status = 'running' and j.created_at < now() - make_interval(secs => coalesce(nullif(i.settings ->> 'openclawTimeoutSec', '')::int, 25) + 15)))
     for update of j skip locked
  )
  update public.engine_jobs j
     set status = 'cancelled', error = 'fallback: openclaw_unavailable', finished_at = now(), locked_by = null, locked_until = null
    from due where j.id = due.id
  returning j.*;
end $$;
