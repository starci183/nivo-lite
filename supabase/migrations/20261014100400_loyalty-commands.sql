-- The loyalty work that only the back end can do, reached from a web app that never calls the back end.
-- A command is a row: the web app (an owner at the workbench, or a visitor of the public points page /l/<slug>) calls a definer function that proves who
-- may ask, inserts the row and puts one message on the loyalty_command queue (pgmq, through job_enqueue); the run-loyalty-command job of the back end
-- consumes it, runs the existing loyalty services (ledger, promotions, one-time codes) and writes the answer back on the row. The owner's screen reads the
-- row through row level security; a visitor reads only the row of the ticket they hold (an unguessable uuid, valid for 15 minutes).
--   staff kinds    adjust (manager) | redeem (member) | sync (manager) | preview (member) | draft (manager)
--   public kinds   request_code | verify_code (no account; the code a visitor types is cleared from the row as soon as the job has used it)

create table public.loyalty_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('adjust', 'redeem', 'sync', 'preview', 'draft', 'request_code', 'verify_code')),
  params jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'done', 'failed')),
  result jsonb,
  error_code text,
  created_by uuid references auth.users (id) on delete set null,   -- null: a visitor of the public page
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index loyalty_commands_workspace on public.loyalty_commands (workspace_id, created_at desc);
create index loyalty_commands_age on public.loyalty_commands (created_at);

alter table public.loyalty_commands enable row level security;
revoke all on public.loyalty_commands from anon, authenticated;
grant select on public.loyalty_commands to authenticated;
-- A member reads what staff asked; the rows of visitors (which hold a phone number and the points they were shown) are never listed.
create policy "loyalty_commands_member_select" on public.loyalty_commands for select to authenticated
  using (public.is_member(workspace_id) and created_by is not null);

grant select, update, delete on table public.loyalty_commands to app_be;
drop policy if exists "loyalty_commands_app_be_select" on public.loyalty_commands;
create policy "loyalty_commands_app_be_select" on public.loyalty_commands for select to app_be using (workspace_id is not null);
drop policy if exists "loyalty_commands_app_be_update" on public.loyalty_commands;
create policy "loyalty_commands_app_be_update" on public.loyalty_commands for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "loyalty_commands_app_be_delete" on public.loyalty_commands;
create policy "loyalty_commands_app_be_delete" on public.loyalty_commands for delete to app_be using (workspace_id is not null);

select pgmq.create('loyalty_command');

-- ---------------------------------------------------------------- the owner's commands
create or replace function public.loyalty_command_submit(p_workspace uuid, p_kind text, p_params jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_member(p_workspace) then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('adjust', 'redeem', 'sync', 'preview', 'draft') then
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  if p_kind in ('adjust', 'sync', 'draft') and not public.is_manager(p_workspace) then
    raise exception 'not_manager' using errcode = '42501';
  end if;
  if p_params is null or jsonb_typeof(p_params) <> 'object' or pg_column_size(p_params) > 8000 then
    raise exception 'bad_params' using errcode = '22023';
  end if;
  delete from public.loyalty_commands where created_at < now() - interval '2 days';
  insert into public.loyalty_commands (workspace_id, kind, params, created_by)
  values (p_workspace, p_kind, p_params, auth.uid())
  returning id into v_id;
  perform public.job_enqueue(
    p_workspace, 'loyalty_command', 'run-loyalty-command',
    jsonb_build_object('workspaceId', p_workspace, 'commandId', v_id), 'loyalty_command:' || v_id::text
  );
  return v_id;
end $$;

-- ---------------------------------------------------------------- the public points check
create or replace function public.public_loyalty_page(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_slug text := lower(coalesce(p_slug, ''));
  v_name text;
  v_ws uuid;
  v_shop text;
begin
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    return null;
  end if;
  select p.workspace_id, p.name into v_ws, v_name from public.loyalty_programs p where p.slug = v_slug and p.enabled;
  if v_ws is null then
    return null;
  end if;
  select w.name into v_shop from public.workspaces w where w.id = v_ws;
  return jsonb_build_object('slug', v_slug, 'name', v_name, 'shop', case when v_name = '' then coalesce(v_shop, '') else v_name end);
end $$;

-- A visitor asks for a code or types the one they received. The answer is a ticket; the job answers on the row. Null when the page is closed or the visitor is too fast.
create or replace function public.public_loyalty_submit(p_slug text, p_kind text, p_phone text, p_code text, p_visitor text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_slug text := lower(coalesce(p_slug, ''));
  v_ws uuid;
  v_id uuid;
begin
  if p_kind is null or p_kind not in ('request_code', 'verify_code') or v_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    return null;
  end if;
  select p.workspace_id into v_ws from public.loyalty_programs p where p.slug = v_slug and p.enabled;
  if v_ws is null then
    return null;
  end if;
  if not public.booking_rate_hit('loyalty:' || left(coalesce(p_visitor, 'unknown'), 64), 20, 600) then
    return null;
  end if;
  delete from public.loyalty_commands where created_at < now() - interval '2 days';
  insert into public.loyalty_commands (workspace_id, kind, params, created_by)
  values (v_ws, p_kind, jsonb_build_object('slug', v_slug, 'phone', left(coalesce(p_phone, ''), 40), 'code', left(coalesce(p_code, ''), 12)), null)
  returning id into v_id;
  perform public.job_enqueue(
    v_ws, 'loyalty_command', 'run-loyalty-command',
    jsonb_build_object('workspaceId', v_ws, 'commandId', v_id), 'loyalty_command:' || v_id::text
  );
  return v_id;
end $$;

create or replace function public.public_loyalty_result(p_ticket uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', c.status, 'result', c.result, 'error', c.error_code)
    from public.loyalty_commands c
   where c.id = p_ticket and c.created_by is null and c.created_at > now() - interval '15 minutes'
$$;

revoke all on function public.loyalty_command_submit(uuid, text, jsonb) from public, anon;
revoke all on function public.public_loyalty_page(text) from public;
revoke all on function public.public_loyalty_submit(text, text, text, text, text) from public;
revoke all on function public.public_loyalty_result(uuid) from public;
grant execute on function public.loyalty_command_submit(uuid, text, jsonb) to authenticated;
grant execute on function public.public_loyalty_page(text) to anon, authenticated;
grant execute on function public.public_loyalty_submit(text, text, text, text, text) to anon, authenticated;
grant execute on function public.public_loyalty_result(uuid) to anon, authenticated;
