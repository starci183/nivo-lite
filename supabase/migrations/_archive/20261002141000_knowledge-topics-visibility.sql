-- Knowledge sources are not tied to business-specific categories (not every workspace sells services or keeps a price list):
--   kind        is only the FORMAT: text | faq | file | url
--   topic       free-form name the owner gives ("Dịch vụ", "Quy trình duyệt chi")
--   tags        optional free-form labels
--   visibility  public (customer-facing agents may answer from it) | internal (internal agents and staff only)
-- match_knowledge() takes an audience; for 'customer' it returns ONLY public business passages (enforced here, not in TypeScript).
-- knowledge_suggestion_state remembers which "Nên bổ sung" suggestions a workspace dismissed or marked not applicable.

alter table public.knowledge_sources drop constraint if exists knowledge_sources_kind_check;
update public.knowledge_sources set kind = 'text' where kind in ('pricing', 'policy');
alter table public.knowledge_sources add constraint knowledge_sources_kind_check check (kind in ('text', 'faq', 'file', 'url'));
alter table public.knowledge_sources add column topic text;
alter table public.knowledge_sources add column tags text[] not null default '{}';
alter table public.knowledge_sources add column visibility text not null default 'internal' check (visibility in ('public', 'internal'));

alter table public.knowledge_chunks add column visibility text not null default 'internal' check (visibility in ('public', 'internal'));
create index knowledge_chunks_visibility on public.knowledge_chunks (workspace_id, visibility);

-- Chunks always carry their source's visibility (changing the source updates its chunks).
create or replace function public.knowledge_chunk_visibility_sync()
returns trigger language plpgsql as $$
begin
  if new.visibility is distinct from old.visibility then
    update public.knowledge_chunks set visibility = new.visibility where source_id = new.id;
  end if;
  return new;
end;
$$;
create trigger knowledge_sources_visibility_sync after update of visibility on public.knowledge_sources
  for each row execute function public.knowledge_chunk_visibility_sync();

create table public.knowledge_suggestion_state (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  suggestion_key text not null,
  state text not null check (state in ('dismissed', 'not_applicable')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz not null default now(),
  primary key (workspace_id, suggestion_key)
);
alter table public.knowledge_suggestion_state enable row level security;
create policy knowledge_suggestion_state_read on public.knowledge_suggestion_state for select to authenticated using (public.is_member(workspace_id));
create policy knowledge_suggestion_state_write on public.knowledge_suggestion_state for all to authenticated
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

-- ---------------------------------------------------------------- retrieval with an audience
drop function if exists public.match_knowledge(uuid, text, extensions.vector, text, int);
create or replace function public.match_knowledge(
  p_workspace uuid, p_module text, p_query_embedding extensions.vector default null, p_query text default '', p_limit int default 8,
  p_audience text default 'internal'
)
returns table (layer text, id uuid, source_id uuid, module text, kind text, title text, content text, score real, visibility text, topic text)
language plpgsql stable security invoker set search_path = public, extensions as $$
declare
  q tsquery;
  words text;
begin
  if not (public.is_member(p_workspace) or coalesce(auth.role(), '') = 'service_role') then
    return;
  end if;
  words := trim(regexp_replace(public.knowledge_fold(p_query), '[^a-z0-9]+', ' ', 'g'));
  if words <> '' then
    q := to_tsquery('simple', array_to_string(regexp_split_to_array(words, '\s+'), ' | '));
  end if;

  return query
  with business as (
    select 'business'::text as layer, c.id, c.source_id, c.module, s.kind, s.title, c.content,
           (case when p_query_embedding is not null and c.embedding is not null then greatest(0, 1 - (c.embedding <=> p_query_embedding)) * 0.7 else 0 end
            + case when q is not null then least(1, ts_rank(c.fts, q)) * 0.3 else 0 end)::real as score,
           c.visibility, s.topic,
           (p_query_embedding is not null and c.embedding is not null and (c.embedding <=> p_query_embedding) < 0.8)
             or (q is not null and c.fts @@ q) as hit
    from public.knowledge_chunks c
    join public.knowledge_sources s on s.id = c.source_id
    where c.workspace_id = p_workspace and (c.module is null or c.module = p_module)
      and (p_audience <> 'customer' or c.visibility = 'public')
  ),
  nivo as (
    select 'nivo'::text as layer, k.id, null::uuid as source_id, k.module, k.kind, k.title, k.body as content,
           (case when p_query_embedding is not null and k.embedding is not null then greatest(0, 1 - (k.embedding <=> p_query_embedding)) * 0.7 else 0 end
            + case when q is not null then least(1, ts_rank(k.fts, q)) * 0.3 else 0 end)::real as score,
           'internal'::text as visibility, null::text as topic,
           (p_query_embedding is not null and k.embedding is not null and (k.embedding <=> p_query_embedding) < 0.8)
             or (q is not null and k.fts @@ q) as hit
    from public.nivo_knowledge k
    where k.module in (p_module, 'core')
  ),
  merged as (
    select * from business union all select * from nivo
  )
  select m.layer, m.id, m.source_id, m.module, m.kind, m.title, m.content, m.score, m.visibility, m.topic
  from merged m where m.hit
  order by m.score desc
  limit greatest(1, least(coalesce(p_limit, 8), 40));
end;
$$;
grant execute on function public.match_knowledge(uuid, text, extensions.vector, text, int, text) to authenticated, service_role;
