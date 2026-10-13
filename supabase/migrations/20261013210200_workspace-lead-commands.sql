-- The writes of the web app that only touch rows of the database, as definer functions that prove the caller first (no back-end call):
--   platform_flags                    switches the operator sets in SQL (workspace_signup_enabled gates the free workspace)
--   create_free_workspace             a signed-in person creates a free workspace they own (a trigger makes them its owner member)
--   revoke_workspace_invite           a manager revokes a pending invitation and the evidence line is written
--   workspace_member_contacts         the emails and last sign-ins of a workspace's members, for its managers only
--   record_lead_outcome / add_lead_responsibility / assign_lead_responsibility   the lead journey steps, with their evidence and chat lines
-- Texts that the lines carry follow p_locale ('vi' by default, 'en').

create table if not exists public.platform_flags (
  key text primary key,
  enabled boolean not null default false
);
alter table public.platform_flags enable row level security;
revoke all on public.platform_flags from public, anon, authenticated;
insert into public.platform_flags (key, enabled) values ('workspace_signup_enabled', false) on conflict (key) do nothing;

create or replace function public.create_free_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.platform_flags f where f.key = 'workspace_signup_enabled' and f.enabled) then
    raise exception 'WORKSPACES_SIGNUP_DISABLED' using errcode = 'P0001';
  end if;
  if v_name = '' or char_length(v_name) > 120 then
    raise exception 'WORKSPACES_NAME_INVALID' using errcode = '22023';
  end if;
  insert into public.workspaces (owner_id, name, status) values (v_uid, v_name, 'active') returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_free_workspace(text) from public, anon;
grant execute on function public.create_free_workspace(text) to authenticated;

create or replace function public.revoke_workspace_invite(p_workspace uuid, p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text;
  v_email text;
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    raise exception 'WORKSPACE_MEMBERS_ROLE_FORBIDDEN' using errcode = '42501';
  end if;
  update public.workspace_invites
     set revoked_at = now()
   where id = p_invite and workspace_id = p_workspace and accepted_at is null and revoked_at is null
  returning email into v_email;
  if not found then
    raise exception 'WORKSPACE_INVITES_NOT_FOUND' using errcode = 'P0002';
  end if;
  select m.display_name into v_actor from public.workspace_members m
   where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active';
  insert into public.events (workspace_id, kind, actor, summary)
  values (p_workspace, 'member.invite_revoked', coalesce(v_actor, ''), v_email);
end;
$$;
revoke all on function public.revoke_workspace_invite(uuid, uuid) from public, anon;
grant execute on function public.revoke_workspace_invite(uuid, uuid) to authenticated;

create or replace function public.workspace_member_contacts(p_workspace uuid)
returns table (user_id uuid, email text, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    return;
  end if;
  return query
    select m.user_id, u.email::text, u.last_sign_in_at
      from public.workspace_members m
      join auth.users u on u.id = m.user_id
     where m.workspace_id = p_workspace;
end;
$$;
revoke all on function public.workspace_member_contacts(uuid) from public, anon;
grant execute on function public.workspace_member_contacts(uuid) to authenticated;

/* ------------------------------------------------------------------ the lead journey */

-- The active seat of the caller in the workspace, or a refusal.
create or replace function public.lead_actor_name(p_workspace uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select m.display_name into v_name from public.workspace_members m
   where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active';
  if not found then
    raise exception 'WORKSPACE_MEMBERS_NOT_MEMBER' using errcode = '42501';
  end if;
  return v_name;
end;
$$;
revoke all on function public.lead_actor_name(uuid) from public, anon, authenticated;

-- Resolves who owns a step: 'human' is the caller, any other value must be the id of an agent of the workspace.
create or replace function public.lead_step_owner(p_workspace uuid, p_owner text, p_actor text, out o_kind text, out o_agent uuid, out o_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_owner = 'human' then
    o_kind := 'human';
    o_agent := null;
    o_name := p_actor;
    return;
  end if;
  if p_owner !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'RESPONSIBILITIES_AGENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  select a.id, a.name into o_agent, o_name from public.agents a where a.workspace_id = p_workspace and a.id = p_owner::uuid;
  if not found then
    raise exception 'RESPONSIBILITIES_AGENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  o_kind := 'agent';
end;
$$;
revoke all on function public.lead_step_owner(uuid, text, text) from public, anon, authenticated;

create or replace function public.lead_step_json(r public.responsibilities)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id, 'leadId', r.lead_id, 'title', r.title, 'ownerKind', r.owner_kind, 'ownerAgentId', r.owner_agent_id,
    'ownerName', r.owner_name, 'nextAction', r.next_action,
    'dueAt', to_char(r.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'status', r.status
  );
$$;
revoke all on function public.lead_step_json(public.responsibilities) from public, anon, authenticated;

create or replace function public.record_lead_outcome(p_workspace uuid, p_lead uuid, p_stage text, p_evidence text, p_locale text default 'vi')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := public.lead_actor_name(p_workspace);
  v_en boolean := coalesce(p_locale, 'vi') = 'en';
  v_lead record;
  v_label text;
  v_agent record;
  v_handed boolean := false;
begin
  if p_stage not in ('new', 'qualified', 'proposal', 'won', 'lost') then
    raise exception 'stage_invalid' using errcode = '22023';
  end if;
  update public.leads set stage = p_stage where workspace_id = p_workspace and id = p_lead
  returning id, contact_name, company, channel, need, stage into v_lead;
  if not found then
    raise exception 'LEADS_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_label := case p_stage
    when 'new' then case when v_en then 'new' else 'mới' end
    when 'qualified' then case when v_en then 'qualified' else 'đủ điều kiện' end
    when 'proposal' then case when v_en then 'proposal' else 'đề xuất' end
    when 'won' then case when v_en then 'won' else 'chốt được' end
    else case when v_en then 'lost' else 'không chốt' end
  end;
  insert into public.events (workspace_id, lead_id, kind, actor, summary, evidence)
  values (p_workspace, p_lead, 'outcome.recorded', v_actor,
          case when v_en then 'Stage → ' else 'Giai đoạn → ' end || v_label, nullif(p_evidence, ''));
  insert into public.messages (workspace_id, lead_id, author_kind, author_name, body)
  values (p_workspace, p_lead, 'system', 'NIVO',
          case when v_en then v_lead.contact_name || ' moved to ' || v_label || '.' else v_lead.contact_name || ' chuyển sang ' || v_label || '.' end);
  if p_stage = 'won' then
    select a.id, a.name into v_agent from public.agents a
     where a.workspace_id = p_workspace and a.module = 'accounting' and a.status = 'active'
     order by a.created_at limit 1;
    if found then
      insert into public.responsibilities (workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, due_at)
      values (p_workspace, p_lead,
              case when v_en then 'Prepare invoice for ' || v_lead.contact_name else 'Chuẩn bị hóa đơn cho ' || v_lead.contact_name end,
              'agent', v_agent.id, v_agent.name,
              case when v_en then 'Draft the invoice from the agreed scope for owner approval'
                   else 'Soạn hóa đơn theo phạm vi đã thống nhất để chủ doanh nghiệp duyệt' end,
              now() + interval '1 day');
      insert into public.events (workspace_id, lead_id, kind, actor, summary)
      values (p_workspace, p_lead, 'responsibility.assigned', 'Sales Agent',
              case when v_en then 'Handed to ' || v_agent.name || ' · Next action: Draft the invoice from the agreed scope'
                   else 'Đã bàn giao cho ' || v_agent.name || ' · Bước tiếp theo: Soạn hóa đơn theo phạm vi đã thống nhất' end);
      v_handed := true;
    end if;
  end if;
  return jsonb_build_object(
    'leadId', v_lead.id, 'stage', v_lead.stage, 'contactName', v_lead.contact_name, 'company', v_lead.company,
    'channel', v_lead.channel, 'need', v_lead.need,
    'origin', (select l.origin from public.leads l where l.id = p_lead), 'handedToAccounting', v_handed
  );
end;
$$;
revoke all on function public.record_lead_outcome(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.record_lead_outcome(uuid, uuid, text, text, text) to authenticated;

create or replace function public.add_lead_responsibility(
  p_workspace uuid, p_lead uuid, p_title text, p_owner text, p_next_action text, p_due timestamptz default null, p_locale text default 'vi'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := public.lead_actor_name(p_workspace);
  v_en boolean := coalesce(p_locale, 'vi') = 'en';
  v_owner record;
  v_row public.responsibilities;
begin
  if not exists (select 1 from public.leads l where l.workspace_id = p_workspace and l.id = p_lead) then
    raise exception 'RESPONSIBILITIES_LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_owner from public.lead_step_owner(p_workspace, p_owner, v_actor);
  insert into public.responsibilities (workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, due_at)
  values (p_workspace, p_lead, p_title, v_owner.o_kind, v_owner.o_agent, v_owner.o_name, p_next_action, p_due)
  returning * into v_row;
  insert into public.events (workspace_id, lead_id, kind, actor, summary)
  values (p_workspace, p_lead, 'responsibility.assigned', v_actor,
          case when v_en then 'Owner: ' || v_row.owner_name || ' · Next action: ' || v_row.next_action
               else 'Người phụ trách: ' || v_row.owner_name || ' · Bước tiếp theo: ' || v_row.next_action end);
  return public.lead_step_json(v_row);
end;
$$;
revoke all on function public.add_lead_responsibility(uuid, uuid, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.add_lead_responsibility(uuid, uuid, text, text, text, timestamptz, text) to authenticated;

create or replace function public.assign_lead_responsibility(
  p_workspace uuid, p_responsibility uuid, p_owner text, p_next_action text, p_due timestamptz default null, p_title text default null, p_locale text default 'vi'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := public.lead_actor_name(p_workspace);
  v_en boolean := coalesce(p_locale, 'vi') = 'en';
  v_owner record;
  v_row public.responsibilities;
begin
  select * into v_owner from public.lead_step_owner(p_workspace, p_owner, v_actor);
  update public.responsibilities
     set owner_kind = v_owner.o_kind, owner_agent_id = v_owner.o_agent, owner_name = v_owner.o_name,
         next_action = p_next_action, due_at = p_due, title = coalesce(p_title, title)
   where workspace_id = p_workspace and id = p_responsibility
  returning * into v_row;
  if not found then
    raise exception 'RESPONSIBILITIES_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.events (workspace_id, lead_id, kind, actor, summary)
  values (p_workspace, v_row.lead_id, 'responsibility.assigned', v_actor,
          case when v_en then 'Owner: ' || v_row.owner_name || ' · Next action: ' || v_row.next_action
               else 'Người phụ trách: ' || v_row.owner_name || ' · Bước tiếp theo: ' || v_row.next_action end);
  return public.lead_step_json(v_row);
end;
$$;
revoke all on function public.assign_lead_responsibility(uuid, uuid, text, text, timestamptz, text, text) from public, anon;
grant execute on function public.assign_lead_responsibility(uuid, uuid, text, text, timestamptz, text, text) to authenticated;
