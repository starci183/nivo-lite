-- Accounts and sessions per person. Additive: a workspace stops being owned by one login and gets members.
--   workspace_members  one row per person per workspace (role owner | manager | staff, optional link to a `staff` row)
--   workspace_invites  email invitations (token stored hashed); no open sign-up
--   is_member / member_role / is_manager / my_staff_id   security-definer helpers used by every RLS policy
-- Every workspace-scoped table's RLS is rewritten from "owner only" to "active member", and from there to
-- "owner | manager" where it matters (authority, rules, staff, modules, members, invites).

-- ---------------------------------------------------------------- tables
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  staff_id uuid references public.staff (id) on delete set null,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create unique index workspace_members_one_per_staff on public.workspace_members (workspace_id, staff_id) where staff_id is not null;
create index workspace_members_user on public.workspace_members (user_id) where status = 'active';

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'staff')),
  staff_id uuid references public.staff (id) on delete set null,
  token_hash text not null unique,              -- sha256 hex of the token in the invite link; the token itself is never stored
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
create index workspace_invites_ws on public.workspace_invites (workspace_id, created_at desc);
create index workspace_invites_email on public.workspace_invites (lower(email));

-- ---------------------------------------------------------------- helpers (security definer: they read workspace_members without RLS recursion)
create or replace function public.member_role(ws uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active';
$$;

create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function public.is_manager(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role(ws) in ('owner', 'manager'), false);
$$;

create or replace function public.my_staff_id(ws uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.staff_id from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active';
$$;

-- Kept for older code paths: "owns" now means "is an active owner member".
create or replace function public.owns_workspace(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role(ws) = 'owner', false);
$$;

-- ---------------------------------------------------------------- owner member: backfill + every new workspace
create or replace function public.display_name_of(uid uuid)
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
                  nullif(split_part(u.email, '@', 1), ''), 'Owner')
  from auth.users u where u.id = uid;
$$;

insert into public.workspace_members (workspace_id, user_id, role, display_name)
select w.id, w.owner_id, 'owner', public.display_name_of(w.owner_id) from public.workspaces w
on conflict (workspace_id, user_id) do nothing;

create or replace function public.workspaces_add_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, display_name)
  values (new.id, new.owner_id, 'owner', public.display_name_of(new.owner_id))
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;
create trigger workspaces_add_owner_member after insert on public.workspaces
  for each row execute function public.workspaces_add_owner_member();

-- ---------------------------------------------------------------- integrity: never lose the last active owner; a staff link stays inside its workspace
create or replace function public.workspace_members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare remaining int;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
    select count(*) into remaining from public.workspace_members m
      where m.workspace_id = old.workspace_id and m.role = 'owner' and m.status = 'active' and m.id <> old.id;
    if remaining = 0 and exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
      raise exception 'last_owner' using errcode = 'P0001', hint = 'A workspace needs at least one active owner.';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.staff_id is not null
     and not exists (select 1 from public.staff s where s.id = new.staff_id and s.workspace_id = new.workspace_id) then
    raise exception 'staff_other_workspace' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger workspace_members_guard before insert or update or delete on public.workspace_members
  for each row execute function public.workspace_members_guard();

-- ---------------------------------------------------------------- members + invites RLS
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

-- Everyone sees their own rows (even disabled, so the app can say why); active members see their colleagues.
create policy members_read on public.workspace_members for select
  using (user_id = auth.uid() or public.is_member(workspace_id));
-- Owner | manager manage members; only an owner may touch an owner row or grant the owner role.
create policy members_insert on public.workspace_members for insert
  with check (public.is_manager(workspace_id) and (role <> 'owner' or public.member_role(workspace_id) = 'owner'));
create policy members_update on public.workspace_members for update
  using (public.is_manager(workspace_id) and (role <> 'owner' or public.member_role(workspace_id) = 'owner'))
  with check (public.is_manager(workspace_id) and (role <> 'owner' or public.member_role(workspace_id) = 'owner'));
create policy members_delete on public.workspace_members for delete
  using (public.is_manager(workspace_id) and (role <> 'owner' or public.member_role(workspace_id) = 'owner'));

create policy invites_manage on public.workspace_invites for all
  using (public.is_manager(workspace_id))
  with check (public.is_manager(workspace_id) and role in ('manager', 'staff'));

-- ---------------------------------------------------------------- RPCs
-- Own display name (the only column a non-manager may change on their own member row).
create or replace function public.update_my_profile(ws uuid, new_display_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(new_display_name, ''))) < 2 then raise exception 'display_name_required' using errcode = 'P0001'; end if;
  update public.workspace_members set display_name = trim(new_display_name)
    where workspace_id = ws and user_id = auth.uid() and status = 'active';
end;
$$;

-- Members of a workspace with their sign-in facts. Emails are shown to owner | manager only.
create or replace function public.workspace_members_directory(ws uuid)
returns table (user_id uuid, role text, staff_id uuid, display_name text, status text, created_at timestamptz, email text, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, m.role, m.staff_id, m.display_name, m.status, m.created_at,
         case when public.is_manager(ws) then u.email::text else null end,
         u.last_sign_in_at
  from public.workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = ws and public.is_member(ws)
  order by case m.role when 'owner' then 0 when 'manager' then 1 else 2 end, m.created_at;
$$;

-- The invite behind a link, for the sign-up / sign-in screen (callable before signing in; reveals only what the link holder needs).
create or replace function public.invite_preview(token text)
returns table (workspace_name text, email text, role text, staff_name text, state text)
language sql stable security definer set search_path = public, extensions as $$
  select w.name, i.email, i.role, s.name,
         case when i.revoked_at is not null then 'revoked'
              when i.accepted_at is not null then 'accepted'
              when i.expires_at < now() then 'expired'
              else 'pending' end
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  left join public.staff s on s.id = i.staff_id
  where i.token_hash = encode(extensions.digest(token, 'sha256'), 'hex');
$$;

-- Accept an invite as the signed-in user whose email matches the invitation: creates (or reactivates) the membership.
create or replace function public.accept_invite(token text)
returns uuid language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  inv public.workspace_invites;
  uid uuid := auth.uid();
  mail text;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  select * into inv from public.workspace_invites i where i.token_hash = encode(extensions.digest(token, 'sha256'), 'hex') for update;
  if not found then raise exception 'invite_invalid' using errcode = 'P0001'; end if;
  if inv.revoked_at is not null then raise exception 'invite_revoked' using errcode = 'P0001'; end if;
  if inv.accepted_at is not null then raise exception 'invite_used' using errcode = 'P0001'; end if;
  if inv.expires_at < now() then raise exception 'invite_expired' using errcode = 'P0001'; end if;
  select u.email into mail from auth.users u where u.id = uid;
  if lower(coalesce(mail, '')) <> lower(inv.email) then raise exception 'invite_email_mismatch' using errcode = 'P0001'; end if;
  insert into public.workspace_members (workspace_id, user_id, role, staff_id, display_name)
  values (inv.workspace_id, uid, inv.role, inv.staff_id,
          coalesce((select s.name from public.staff s where s.id = inv.staff_id), public.display_name_of(uid)))
  on conflict (workspace_id, user_id) do update
    set role = case when public.workspace_members.role = 'owner' then 'owner' else excluded.role end,
        staff_id = coalesce(excluded.staff_id, public.workspace_members.staff_id), status = 'active';
  update public.workspace_invites set accepted_at = now(), accepted_by = uid where id = inv.id;
  return inv.workspace_id;
end;
$$;

revoke all on function public.member_role(uuid), public.is_member(uuid), public.is_manager(uuid), public.my_staff_id(uuid),
  public.owns_workspace(uuid), public.display_name_of(uuid), public.update_my_profile(uuid, text),
  public.workspace_members_directory(uuid), public.invite_preview(text), public.accept_invite(text) from public, anon;
grant execute on function public.member_role(uuid), public.is_member(uuid), public.is_manager(uuid), public.my_staff_id(uuid),
  public.owns_workspace(uuid), public.update_my_profile(uuid, text), public.workspace_members_directory(uuid),
  public.accept_invite(text) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------- RLS rewrite: "owner only" -> "active member" (and owner | manager for governance)
-- Operational tables: every active member reads and writes (what a staff member may DECIDE is enforced by the server and,
-- for work items, below).
do $$
declare t text;
begin
  foreach t in array array['leads', 'responsibilities', 'executions', 'messages', 'agent_conversations', 'agent_messages',
                           'inbound_events', 'orders', 'invoices', 'transactions']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format('create policy %I on public.%I for all using (public.is_member(workspace_id)) with check (public.is_member(workspace_id))',
                   t || '_member', t);
  end loop;
end $$;

-- Governance: members read, owner | manager write.
do $$
declare t text;
begin
  foreach t in array array['agents', 'authority', 'authority_rules', 'staff']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format('create policy %I on public.%I for select using (public.is_member(workspace_id))', t || '_read', t);
    execute format('create policy %I on public.%I for insert with check (public.is_manager(workspace_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete using (public.is_manager(workspace_id))', t || '_delete', t);
  end loop;
end $$;

-- Work items: members read and create; a waiting item can be changed (decided, edited, reassigned) only by owner | manager
-- or by the staff member it is assigned to. Items that are not waiting for a decision (queued chain steps, results) stay writable.
drop policy if exists work_items_owner on public.work_items;
create policy work_items_read on public.work_items for select using (public.is_member(workspace_id));
create policy work_items_insert on public.work_items for insert with check (public.is_member(workspace_id));
create policy work_items_update on public.work_items for update
  using (public.is_member(workspace_id) and (public.is_manager(workspace_id) or status <> 'waiting_decision' or assigned_staff_id = public.my_staff_id(workspace_id)))
  with check (public.is_member(workspace_id));
create policy work_items_delete on public.work_items for delete using (public.is_manager(workspace_id));

-- Append-only logs: members read and append.
drop policy if exists events_read on public.events;
drop policy if exists events_insert on public.events;
create policy events_read on public.events for select using (public.is_member(workspace_id));
create policy events_insert on public.events for insert with check (public.is_member(workspace_id));
drop policy if exists decisions_read on public.decisions;
drop policy if exists decisions_insert on public.decisions;
create policy decisions_read on public.decisions for select using (public.is_member(workspace_id));
create policy decisions_insert on public.decisions for insert with check (public.is_member(workspace_id));

-- Workspaces: members read; only an owner renames or deletes; anyone signed in may create their own (the trigger makes them its owner).
drop policy if exists workspaces_owner on public.workspaces;
create policy workspaces_read on public.workspaces for select using (owner_id = auth.uid() or public.is_member(id));
create policy workspaces_insert on public.workspaces for insert with check (owner_id = auth.uid());
create policy workspaces_update on public.workspaces for update using (public.member_role(id) = 'owner') with check (public.member_role(id) = 'owner');
create policy workspaces_delete on public.workspaces for delete using (public.member_role(id) = 'owner');
