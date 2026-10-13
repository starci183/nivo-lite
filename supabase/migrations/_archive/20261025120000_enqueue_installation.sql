-- knowledge_enqueue_source keeps the instance restriction of multi-instance (20261024100000) through the job queue (20261025100000/110000).
--   p_meta->>'installationId'  the one agent instance that reads the document; absent or empty = shared by every instance of the type.
--   It must be an installation of p_workspace (else the call fails); the document's module is then the instance's type.
-- Same signature, security and queue send as the pgmq version; only the installation handling is new. The worker copies the restriction
-- onto the brain facts it proposes from the document (engine/src/features/knowledge-jobs).

create or replace function public.knowledge_enqueue_source(p_workspace uuid, p_kind text, p_title text, p_storage_path text, p_url text, p_meta jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_id uuid;
  v_title text := left(btrim(coalesce(p_title, '')), 160);
  v_content text := '';
  v_tags text[];
  v_module text := nullif(btrim(coalesce(v_meta->>'module', '')), '');
  v_inst uuid;
  v_inst_raw text := nullif(btrim(coalesce(v_meta->>'installationId', '')), '');
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_manager(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind not in ('file', 'url', 'text', 'faq') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;
  if p_kind = 'file' then
    if p_storage_path is null or split_part(p_storage_path, '/', 1) <> p_workspace::text or p_storage_path like '%..%' then
      raise exception 'storage path must start with the workspace id' using errcode = '22023';
    end if;
    if v_title = '' then v_title := left(regexp_replace(regexp_replace(p_storage_path, '^.*/', ''), '\.[^.]+$', ''), 160); end if;
  elsif p_kind = 'url' then
    if p_url is null or p_url !~* '^https?://' then
      raise exception 'url must be http(s)' using errcode = '22023';
    end if;
    v_content := p_url;
    if v_title = '' then v_title := left(regexp_replace(p_url, '^https?://', ''), 160); end if;
  else
    v_content := btrim(coalesce(v_meta->>'content', ''));
    if v_content = '' then raise exception 'content is empty' using errcode = '22023'; end if;
    if v_title = '' then raise exception 'title is required' using errcode = '22023'; end if;
  end if;
  if v_module is not null and not exists (select 1 from public.modules where key = v_module) then v_module := null; end if;
  -- One agent instance may be the only reader of the document (null = shared by every instance of the type). It must belong to this workspace.
  if v_inst_raw is not null then
    begin
      v_inst := v_inst_raw::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid installation' using errcode = '22023';
    end;
    if not exists (select 1 from public.module_installations i where i.id = v_inst and i.workspace_id = p_workspace) then
      raise exception 'installation does not belong to the workspace' using errcode = '22023';
    end if;
    select i.module_key into v_module from public.module_installations i where i.id = v_inst; -- the document's module is the instance's type
  end if;
  select coalesce(array_agg(distinct left(btrim(t), 40)) filter (where btrim(t) <> ''), '{}')
    into v_tags
    from jsonb_array_elements_text(case when jsonb_typeof(v_meta->'tags') = 'array' then v_meta->'tags' else '[]'::jsonb end) t;

  insert into public.knowledge_sources (workspace_id, module, kind, title, content, status, progress, topic, tags, visibility, storage_path, source_url, origin, created_by, installation_id)
  values (
    p_workspace, v_module, p_kind, v_title, v_content, 'queued', 0,
    nullif(left(btrim(coalesce(v_meta->>'topic', '')), 80), ''), v_tags[1:12],
    case when v_meta->>'visibility' = 'public' then 'public' else 'internal' end,
    case when p_kind = 'file' then p_storage_path end,
    case when p_kind = 'url' then p_url end,
    nullif(left(btrim(coalesce(v_meta->>'origin', '')), 300), ''),
    auth.uid(),
    v_inst
  )
  returning id into v_id;

  perform public.job_enqueue(p_workspace, 'knowledge', 'knowledge.index', jsonb_build_object('sourceId', v_id, 'workspaceId', p_workspace), 'knowledge.index:' || v_id);
  return v_id;
end $$;

revoke all on function public.knowledge_enqueue_source(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.knowledge_enqueue_source(uuid, text, text, text, text, jsonb) to authenticated, service_role;
