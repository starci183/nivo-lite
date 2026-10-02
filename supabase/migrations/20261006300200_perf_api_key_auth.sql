-- Perf: /api/v1 authentication in ONE round trip (key lookup + per-minute rate hit + last_used_at) instead of two sequential
-- requests plus a fire-and-forget write. Service role only, like api_rate_hit. Returns null for an unknown key,
-- {"revoked": true} for a revoked one (no hit is counted for either), otherwise the principal and this minute's hit count.
create or replace function public.api_key_auth(p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k public.workspace_api_keys; v_hits int;
begin
  select * into k from public.workspace_api_keys where key_hash = p_hash;
  if not found then return null; end if;
  if k.revoked_at is not null then return jsonb_build_object('revoked', true); end if;
  v_hits := public.api_rate_hit(k.id);
  -- informational, so at most one write a minute per key
  if k.last_used_at is null or k.last_used_at < now() - interval '1 minute' then
    update public.workspace_api_keys set last_used_at = now() where id = k.id;
  end if;
  return jsonb_build_object('id', k.id, 'workspace_id', k.workspace_id, 'name', k.name, 'scopes', to_jsonb(k.scopes), 'hits', v_hits);
end $$;
revoke all on function public.api_key_auth(text) from public, anon, authenticated;
grant execute on function public.api_key_auth(text) to service_role;
