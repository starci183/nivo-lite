-- Embedding model per vector. Vectors from different models live in different spaces and must never be compared, so every stored vector
-- says which model made it, and match_knowledge() only compares a query vector with vectors of the SAME model (everything else still
-- matches by full-text until it is re-embedded; see src/lib/knowledge/reembed.ts).
-- The default model moves from openai/text-embedding-3-small to qwen/qwen3-embedding-8b (1536 dimensions requested explicitly: same column size).
-- Additive: no data is dropped.

alter table public.knowledge_chunks add column if not exists embedding_model text;
alter table public.nivo_knowledge add column if not exists embedding_model text;

-- Everything embedded so far was made with text-embedding-3-small. Rows without a vector (embedding unavailable at the time) stay without a model.
update public.knowledge_chunks set embedding_model = 'openai/text-embedding-3-small' where embedding is not null and embedding_model is null;
update public.nivo_knowledge set embedding_model = 'openai/text-embedding-3-small' where embedding is not null and embedding_model is null;

-- A vector without its model could be mixed by mistake: refuse it.
alter table public.knowledge_chunks drop constraint if exists knowledge_chunks_embedding_model_check;
alter table public.knowledge_chunks add constraint knowledge_chunks_embedding_model_check check (embedding is null or embedding_model is not null);
alter table public.nivo_knowledge drop constraint if exists nivo_knowledge_embedding_model_check;
alter table public.nivo_knowledge add constraint nivo_knowledge_embedding_model_check check (embedding is null or embedding_model is not null);

-- The re-embed path looks for a workspace's chunks whose model differs from the current one (or that have no vector yet).
create index if not exists knowledge_chunks_model on public.knowledge_chunks (workspace_id, embedding_model);

-- ---------------------------------------------------------------- retrieval: same-model vectors only
drop function if exists public.match_knowledge(uuid, text, extensions.vector, text, int, text);
create or replace function public.match_knowledge(
  p_workspace uuid, p_module text, p_query_embedding extensions.vector default null, p_query text default '', p_limit int default 8,
  p_audience text default 'internal', p_query_model text default null
)
returns table (layer text, id uuid, source_id uuid, module text, kind text, title text, content text, score real, visibility text, topic text)
language plpgsql stable security invoker set search_path = public, extensions as $$
declare
  q tsquery;
  words text;
  use_vec boolean := p_query_embedding is not null and p_query_model is not null;
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
           (case when use_vec and c.embedding is not null and c.embedding_model = p_query_model then greatest(0, 1 - (c.embedding <=> p_query_embedding)) * 0.7 else 0 end
            + case when q is not null then least(1, ts_rank(c.fts, q)) * 0.3 else 0 end)::real as score,
           c.visibility, s.topic,
           (use_vec and c.embedding is not null and c.embedding_model = p_query_model and (c.embedding <=> p_query_embedding) < 0.8)
             or (q is not null and c.fts @@ q) as hit
    from public.knowledge_chunks c
    join public.knowledge_sources s on s.id = c.source_id
    where c.workspace_id = p_workspace and (c.module is null or c.module = p_module)
      and (p_audience <> 'customer' or c.visibility = 'public')
  ),
  nivo as (
    select 'nivo'::text as layer, k.id, null::uuid as source_id, k.module, k.kind, k.title, k.body as content,
           (case when use_vec and k.embedding is not null and k.embedding_model = p_query_model then greatest(0, 1 - (k.embedding <=> p_query_embedding)) * 0.7 else 0 end
            + case when q is not null then least(1, ts_rank(k.fts, q)) * 0.3 else 0 end)::real as score,
           'internal'::text as visibility, null::text as topic,
           (use_vec and k.embedding is not null and k.embedding_model = p_query_model and (k.embedding <=> p_query_embedding) < 0.8)
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
grant execute on function public.match_knowledge(uuid, text, extensions.vector, text, int, text, text) to authenticated, service_role;
