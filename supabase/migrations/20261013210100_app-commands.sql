-- Work only the back end can do (an invitation email, a video render, the platform team's re-send) is asked for by the web app through
-- the database: a signed-in caller runs a definer function that checks who they are, writes one app_commands row and sends one pgmq
-- message; a job of the back end consumes it, calls the application service and writes the result onto the same row. The web app reads
-- that row (RLS: the requester) and never calls the back end over HTTP.
--   app_commands                     one row per ask: kind, input, state queued -> running -> done | failed, result, error_code
--   request_invite_command           a manager asks to create, resend or copy the link of an invitation of a workspace
--   request_admin_invite_resend      platform staff ask to send a pending invitation of any workspace again
--   request_video_render             an owner or manager of the workspace asks to render a video project
--   read_app_command                 the requester reads the state and result; a link in the result is shown once and then dropped
-- Queues: invite_command (issue-invite job), render_request (request-render job).

select pgmq.create('invite_command');
select pgmq.create('render_request');

create table if not exists public.app_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('invite.create', 'invite.resend', 'invite.link', 'admin.invite.resend', 'video.render')),
  input jsonb not null default '{}'::jsonb,
  state text not null default 'queued' check (state in ('queued', 'running', 'done', 'failed')),
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists app_commands_requester on public.app_commands (requested_by, created_at desc);

alter table public.app_commands enable row level security;
revoke all on public.app_commands from public, anon, authenticated;
grant select on public.app_commands to authenticated;
grant select, update on public.app_commands to app_be;

drop policy if exists "app_commands_requester_select" on public.app_commands;
create policy "app_commands_requester_select" on public.app_commands for select to authenticated using (requested_by = (select auth.uid()));
drop policy if exists "app_commands_app_be_select" on public.app_commands;
create policy "app_commands_app_be_select" on public.app_commands for select to app_be using (id is not null);
drop policy if exists "app_commands_app_be_update" on public.app_commands;
create policy "app_commands_app_be_update" on public.app_commands for update to app_be using (id is not null) with check (id is not null);

/* ------------------------------------------------------------------ requests */

-- A manager of the workspace asks the back end to create (email, role, staff), resend (invite) or copy the link of (invite) an invitation.
create or replace function public.request_invite_command(
  p_workspace uuid,
  p_action text,
  p_invite uuid default null,
  p_email text default null,
  p_role text default null,
  p_staff uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_manager(p_workspace) then
    raise exception 'WORKSPACE_MEMBERS_ROLE_FORBIDDEN' using errcode = '42501';
  end if;
  if p_action not in ('create', 'resend', 'link') then
    raise exception 'action_invalid' using errcode = '22023';
  end if;
  if p_action = 'create' and (p_email is null or btrim(p_email) = '' or p_role not in ('manager', 'staff')) then
    raise exception 'invite_input_invalid' using errcode = '22023';
  end if;
  if p_action <> 'create' and p_invite is null then
    raise exception 'invite_input_invalid' using errcode = '22023';
  end if;
  insert into public.app_commands (workspace_id, requested_by, kind, input)
  values (
    p_workspace, v_uid, 'invite.' || p_action,
    jsonb_strip_nulls(jsonb_build_object('inviteId', p_invite, 'email', btrim(p_email), 'role', p_role, 'staffId', p_staff))
  )
  returning id into v_id;
  perform public.job_enqueue(p_workspace, 'invite_command', 'invite_command', jsonb_build_object('workspaceId', p_workspace, 'commandId', v_id), 'invite_command:' || v_id::text);
  return v_id;
end;
$$;
revoke execute on function public.request_invite_command(uuid, text, uuid, text, text, uuid) from public, anon;
grant execute on function public.request_invite_command(uuid, text, uuid, text, text, uuid) to authenticated;

-- Platform staff ask the back end to send a pending invitation of any workspace again.
create or replace function public.request_admin_invite_resend(p_workspace uuid, p_invite uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  insert into public.app_commands (workspace_id, requested_by, kind, input)
  values (
    p_workspace, auth.uid(), 'admin.invite.resend',
    jsonb_build_object('inviteId', p_invite, 'actorEmail', lower(btrim(auth.jwt() ->> 'email')))
  )
  returning id into v_id;
  perform public.job_enqueue(p_workspace, 'invite_command', 'invite_command', jsonb_build_object('workspaceId', p_workspace, 'commandId', v_id), 'invite_command:' || v_id::text);
  return v_id;
end;
$$;
revoke execute on function public.request_admin_invite_resend(uuid, uuid) from public, anon;
grant execute on function public.request_admin_invite_resend(uuid, uuid) to authenticated;

-- An owner or manager asks the back end to render a video project: it builds the spec, opens the render and queues the render-video job.
create or replace function public.request_video_render(p_project uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_workspace uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select p.workspace_id into v_workspace from public.video_projects p where p.id = p_project;
  if not found then
    raise exception 'VIDEO_PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_manager(v_workspace) then
    raise exception 'WORKSPACE_MEMBERS_ROLE_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.app_commands (workspace_id, requested_by, kind, input)
  values (v_workspace, v_uid, 'video.render', jsonb_build_object('projectId', p_project))
  returning id into v_id;
  perform public.job_enqueue(v_workspace, 'render_request', 'render_request', jsonb_build_object('workspaceId', v_workspace, 'commandId', v_id), 'render_request:' || v_id::text);
  return v_id;
end;
$$;
revoke execute on function public.request_video_render(uuid) from public, anon;
grant execute on function public.request_video_render(uuid) to authenticated;

-- The requester reads one command: { state, result, errorCode }. An invitation link in the result is handed over once and dropped from the row.
create or replace function public.read_app_command(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.app_commands;
  v_result jsonb;
begin
  select * into c from public.app_commands where id = p_id and requested_by = auth.uid();
  if not found then
    raise exception 'COMMAND_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_result := c.result;
  if c.state = 'done' and c.result ? 'link' then
    update public.app_commands set result = c.result - 'link' where id = c.id;
  end if;
  return jsonb_build_object('state', c.state, 'result', v_result, 'errorCode', c.error_code);
end;
$$;
revoke execute on function public.read_app_command(uuid) from public, anon;
grant execute on function public.read_app_command(uuid) to authenticated;
