-- The connection console commands: work only the back end can do (provider calls, sealing secrets, signing OAuth states) for a signed-in
-- member. The browser never calls the back end. A fe Server Action calls connection_command_submit, which proves the membership,
-- stores the command and queues it on the connection_commands pgmq queue; the be job runs it as that user and writes the outcome back to
-- the row; the action then takes the outcome with connection_command_take, which hands it over once and deletes the row (an outcome can
-- hold a one-time secret, so it is never left lying in a table).
create extension if not exists pgmq;

select pgmq.create('connection_commands');

create table if not exists public.connection_commands (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    user_id uuid not null,
    kind text not null check (char_length(kind) between 1 and 64),
    input jsonb not null default '{}'::jsonb,
    status text not null default 'pending' check (status in ('pending', 'done')),
    outcome jsonb,
    created_at timestamptz not null default now(),
    finished_at timestamptz
);

create index if not exists connection_commands_created_idx on public.connection_commands (created_at);

alter table public.connection_commands enable row level security;

-- No policy for the browser roles: they reach the table only through the two functions below. The back end role reads and settles it.
drop policy if exists "connection_commands_app_be_select" on public.connection_commands;
create policy "connection_commands_app_be_select" on public.connection_commands for select to app_be using (user_id is not null);

drop policy if exists "connection_commands_app_be_update" on public.connection_commands;
create policy "connection_commands_app_be_update" on public.connection_commands for update to app_be using (user_id is not null) with check (user_id is not null);

revoke all on table public.connection_commands from public, anon, authenticated;
grant select on table public.connection_commands to app_be;
grant update (status, outcome, finished_at) on table public.connection_commands to app_be;

grant select, insert, update, delete on table pgmq.q_connection_commands to app_be;
grant select, insert, update, delete on table pgmq.a_connection_commands to app_be;

/**
 * Stores a command of the signed-in member and queues it. The membership is proven here; the role the command needs (owner or manager)
 * is proven by the back end capability that runs it. Returns the id the caller takes the outcome with.
 */
create or replace function public.connection_command_submit(p_workspace uuid, p_kind text, p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_member(p_workspace) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  delete from public.connection_commands where created_at < now() - interval '1 hour';
  insert into public.connection_commands (workspace_id, user_id, kind, input)
  values (p_workspace, auth.uid(), p_kind, coalesce(p_input, '{}'::jsonb))
  returning id into v_id;
  perform public.job_enqueue(
    p_workspace,
    'connection_commands',
    'connection.command',
    jsonb_build_object('commandId', v_id, 'workspaceId', p_workspace),
    'connection.command:' || v_id::text
  );
  return v_id;
end $$;

/**
 * The outcome of a command of the signed-in user: {status: 'pending'} while the back end works, {status: 'done', outcome} once, then the
 * row is deleted; {status: 'missing'} for an unknown id.
 */
create or replace function public.connection_command_take(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.connection_commands;
begin
  select * into r from public.connection_commands where id = p_id and user_id = auth.uid();
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  if r.status = 'pending' then
    return jsonb_build_object('status', 'pending');
  end if;
  delete from public.connection_commands where id = p_id;
  return jsonb_build_object('status', 'done', 'outcome', r.outcome);
end $$;

revoke all on function public.connection_command_submit(uuid, text, jsonb) from public, anon;
revoke all on function public.connection_command_take(uuid) from public, anon;
grant execute on function public.connection_command_submit(uuid, text, jsonb) to authenticated;
grant execute on function public.connection_command_take(uuid) to authenticated;
