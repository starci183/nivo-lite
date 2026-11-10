-- workspace-lobby: forward-only; immutable once on origin/main.
-- The workspaces lobby: when each member last opened a workspace, and the owner's deletion of a workspace as a soft delete.

-- When the member last opened the workspace (the console frame's read stamps it); null until the first open.
ALTER TABLE public.workspace_members ADD COLUMN last_opened_at timestamp with time zone;

-- When the owner deleted the workspace; null while it lives. A deleted workspace keeps its rows, its seats are disabled and its
-- pending invitations revoked, so nobody reaches it and the operator's prune removes it later.
ALTER TABLE public.workspaces ADD COLUMN deleted_at timestamp with time zone;

-- The last-owner guard holds for a living workspace only: deleting a workspace disables every seat, the owners' included.
CREATE OR REPLACE FUNCTION public.workspace_members_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare remaining int;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
    select count(*) into remaining from public.workspace_members m
      where m.workspace_id = old.workspace_id and m.role = 'owner' and m.status = 'active' and m.id <> old.id;
    if remaining = 0 and exists (select 1 from public.workspaces w where w.id = old.workspace_id and w.deleted_at is null) then
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
