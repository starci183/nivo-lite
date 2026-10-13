-- Inventory commands: the web app never calls the back end. A workspace member submits a command (inventory_submit, one definer function that
-- proves the membership); the command is a row plus a job on the inventory_command queue; the back end job runs the domain service as that
-- member and writes the answer (done or failed, with the result or the refusal sentence) back on the row, which the member reads through RLS.

select pgmq.create('inventory_command');

create table if not exists public.inventory_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null,
  input jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'done', 'failed')),
  result jsonb,
  error_code text,
  error_message text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists inventory_commands_workspace_idx on public.inventory_commands (workspace_id, created_at desc);

alter table public.inventory_commands enable row level security;

-- Members read the commands of their workspace; nobody inserts or updates a row but the functions below.
revoke all on table public.inventory_commands from public, anon, authenticated;
grant select on table public.inventory_commands to authenticated;
grant select, update on table public.inventory_commands to app_be;

drop policy if exists "inventory_commands_authenticated_select" on public.inventory_commands;
create policy "inventory_commands_authenticated_select" on public.inventory_commands for select to authenticated using (public.is_member(workspace_id) and created_by = auth.uid());
drop policy if exists "inventory_commands_app_be_select" on public.inventory_commands;
create policy "inventory_commands_app_be_select" on public.inventory_commands for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_commands_app_be_update" on public.inventory_commands;
create policy "inventory_commands_app_be_update" on public.inventory_commands for update to app_be using (workspace_id is not null) with check (workspace_id is not null);

-- The one door of the web app: proves the caller is an active member, stores the command and starts its job in the same transaction.
create or replace function public.inventory_submit(p_workspace uuid, p_kind text, p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_member(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind not in (
    'save-item', 'set-item-active', 'save-supplier', 'save-recipe', 'delete-recipe', 'save-location', 'import-paste', 'apply-starter',
    'adjust-stock', 'stock-take', 'transfer-stock', 'draft-low-stock', 'create-po', 'update-po-draft', 'request-send', 'cancel-po', 'receive-po'
  ) then
    raise exception 'unknown command %', p_kind using errcode = '22023';
  end if;
  insert into public.inventory_commands (workspace_id, kind, input, created_by)
  values (p_workspace, p_kind, coalesce(p_input, '{}'::jsonb), auth.uid())
  returning id into v_id;
  perform public.job_enqueue(p_workspace, 'inventory_command', 'inventory_command', jsonb_build_object('workspaceId', p_workspace, 'commandId', v_id), 'inventory_command:' || v_id::text);
  return v_id;
end $$;

revoke all on function public.inventory_submit(uuid, text, jsonb) from public, anon;
grant execute on function public.inventory_submit(uuid, text, jsonb) to authenticated;

-- The back end settles a command once: the first answer stays.
create or replace function public.inventory_command_finish(p_id uuid, p_status text, p_result jsonb, p_code text, p_message text)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.inventory_commands
  set status = p_status, result = p_result, error_code = p_code, error_message = p_message, finished_at = now()
  where id = p_id and status = 'queued';
end $$;

revoke all on function public.inventory_command_finish(uuid, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.inventory_command_finish(uuid, text, jsonb, text, text) to app_be;
