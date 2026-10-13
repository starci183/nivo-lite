-- Knowledge layers so agents can work:
--   nivo_knowledge       NIVO base knowledge (global, per module + "core"), seeded by NIVO, read-only for every client
--   knowledge_sources    what a workspace teaches its agents (text, FAQ, price list, policy, file, url); shared by every agent
--   knowledge_chunks     the sources cut into ~800 character passages, embedded (pgvector) and full-text indexed
--   match_knowledge()    hybrid retrieval over both layers, tagged 'nivo' | 'business'
-- The third layer (module context) already exists as module_context_versions.

create extension if not exists vector with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() is only STABLE; generated columns need an immutable expression. "đ" folds to "d" in the unaccent rules.
create or replace function public.knowledge_fold(t text)
returns text language sql immutable parallel safe set search_path = public, extensions as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')));
$$;

-- ---------------------------------------------------------------- NIVO base knowledge
create table public.nivo_knowledge (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('core', 'chatbot', 'sales', 'accounting')),
  slug text not null unique,
  title text not null,
  body text not null,
  kind text not null check (kind in ('playbook', 'authority', 'escalation', 'setup_checklist', 'tone')),
  version int not null default 1,
  embedding extensions.vector(1536),
  fts tsvector generated always as (to_tsvector('simple', public.knowledge_fold(title || ' ' || body))) stored,
  updated_at timestamptz not null default now()
);
create index nivo_knowledge_module on public.nivo_knowledge (module, kind);
create index nivo_knowledge_fts on public.nivo_knowledge using gin (fts);
create index nivo_knowledge_embedding on public.nivo_knowledge using hnsw (embedding extensions.vector_cosine_ops);
alter table public.nivo_knowledge enable row level security;
create policy nivo_knowledge_read on public.nivo_knowledge for select to authenticated using (true);

-- ---------------------------------------------------------------- workspace business knowledge
create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module text check (module in ('chatbot', 'sales', 'accounting')),   -- null (default) = shared by every module
  kind text not null check (kind in ('text', 'faq', 'pricing', 'policy', 'file', 'url')),
  title text not null,
  content text not null default '',
  status text not null default 'pending' check (status in ('pending', 'indexing', 'ready', 'failed')),
  error text,
  chunk_count int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index knowledge_sources_ws on public.knowledge_sources (workspace_id, created_at desc);
alter table public.knowledge_sources enable row level security;
create policy knowledge_sources_read on public.knowledge_sources for select to authenticated using (public.is_member(workspace_id));
create policy knowledge_sources_write on public.knowledge_sources for all to authenticated
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  module text check (module in ('chatbot', 'sales', 'accounting')),
  ord int not null,
  content text not null,
  embedding extensions.vector(1536),
  fts tsvector generated always as (to_tsvector('simple', public.knowledge_fold(content))) stored,
  created_at timestamptz not null default now()
);
create index knowledge_chunks_source on public.knowledge_chunks (source_id, ord);
create index knowledge_chunks_ws on public.knowledge_chunks (workspace_id, module);
create index knowledge_chunks_fts on public.knowledge_chunks using gin (fts);
create index knowledge_chunks_embedding on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);
alter table public.knowledge_chunks enable row level security;
create policy knowledge_chunks_read on public.knowledge_chunks for select to authenticated using (public.is_member(workspace_id));
create policy knowledge_chunks_write on public.knowledge_chunks for all to authenticated
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

-- ---------------------------------------------------------------- hybrid retrieval
-- Vector cosine similarity when the query embedding is present (and the passage has one), blended with full-text rank.
-- Without an embedding it is pure full-text. Members only (the service role, used by webhooks, is allowed too).
create or replace function public.match_knowledge(
  p_workspace uuid, p_module text, p_query_embedding extensions.vector default null, p_query text default '', p_limit int default 8
)
returns table (layer text, id uuid, source_id uuid, module text, kind text, title text, content text, score real)
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
           (p_query_embedding is not null and c.embedding is not null and (c.embedding <=> p_query_embedding) < 0.8)
             or (q is not null and c.fts @@ q) as hit
    from public.knowledge_chunks c
    join public.knowledge_sources s on s.id = c.source_id
    where c.workspace_id = p_workspace and (c.module is null or c.module = p_module)
  ),
  nivo as (
    select 'nivo'::text as layer, k.id, null::uuid as source_id, k.module, k.kind, k.title, k.body as content,
           (case when p_query_embedding is not null and k.embedding is not null then greatest(0, 1 - (k.embedding <=> p_query_embedding)) * 0.7 else 0 end
            + case when q is not null then least(1, ts_rank(k.fts, q)) * 0.3 else 0 end)::real as score,
           (p_query_embedding is not null and k.embedding is not null and (k.embedding <=> p_query_embedding) < 0.8)
             or (q is not null and k.fts @@ q) as hit
    from public.nivo_knowledge k
    where k.module in (p_module, 'core')
  ),
  merged as (
    select * from business union all select * from nivo
  )
  select m.layer, m.id, m.source_id, m.module, m.kind, m.title, m.content, m.score
  from merged m where m.hit
  order by m.score desc
  limit greatest(1, least(coalesce(p_limit, 8), 40));
end;
$$;
grant execute on function public.match_knowledge(uuid, text, extensions.vector, text, int) to authenticated, service_role;
