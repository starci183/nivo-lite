-- v0.3.2 "Van phong so": every agent has a person who answers for it. owner_member_id is the workspace member (workspace_members.id)
-- that gets the agent's stuck, rejected or expired work and edits its rules; fallback_member_id answers when the owner left or is
-- disabled. Both default to the workspace owner, so existing agents migrate to the owner and a new agent needs no extra input.
-- assignable_roles and assignable_rooms say who may hand the agent work (a member qualifies by role OR by a seat in a room);
-- can_tag_agent_ids is the set of agents it may pass work to. Additive: nothing existing reads these columns yet.
-- The member columns carry no foreign key on purpose: removing a member must not be blocked or silently null an agent's owner.
-- The release trigger below repoints them to the workspace owner when the member row is deleted, and a disabled member is
-- resolved at read time by AgentsService.ownerOf.

ALTER TABLE public.agents
    ADD COLUMN owner_member_id uuid,
    ADD COLUMN fallback_member_id uuid,
    ADD COLUMN assignable_roles text[] DEFAULT ARRAY['owner', 'manager']::text[] NOT NULL,
    ADD COLUMN assignable_rooms text[] DEFAULT '{}'::text[] NOT NULL,
    ADD COLUMN can_tag_agent_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    ADD CONSTRAINT agents_assignable_roles_check CHECK (assignable_roles <@ ARRAY['owner', 'manager', 'staff']::text[]),
    ADD CONSTRAINT agents_assignable_rooms_check
        CHECK (assignable_rooms <@ ARRAY['executive', 'frontdesk', 'sales', 'marketing', 'care', 'accounting']::text[]),
    ADD CONSTRAINT agents_cannot_tag_itself_check CHECK (NOT (id = ANY (can_tag_agent_ids)));

-- The first active owner of a workspace: the default person in charge of its agents.
CREATE FUNCTION public.workspace_owner_member(p_workspace uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
    select m.id from public.workspace_members m
    where m.workspace_id = p_workspace and m.role = 'owner' and m.status = 'active'
    order by m.created_at, m.id
    limit 1
$$;
REVOKE ALL ON FUNCTION public.workspace_owner_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_owner_member(uuid) TO app_be;

-- Fills an absent owner or fallback with the workspace owner, on insert and on update.
CREATE FUNCTION public.agents_default_ownership() RETURNS trigger
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
begin
  new.owner_member_id := coalesce(new.owner_member_id, public.workspace_owner_member(new.workspace_id));
  new.fallback_member_id := coalesce(new.fallback_member_id, public.workspace_owner_member(new.workspace_id));
  return new;
end;
$$;

CREATE TRIGGER agents_default_ownership BEFORE INSERT OR UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.agents_default_ownership();

-- Existing agents belong to their workspace owner.
UPDATE public.agents a
SET owner_member_id = public.workspace_owner_member(a.workspace_id),
    fallback_member_id = public.workspace_owner_member(a.workspace_id)
WHERE a.owner_member_id IS NULL OR a.fallback_member_id IS NULL;

-- Required from now on. NOT VALID keeps a legacy agent of an ownerless workspace readable until a person is named for it.
ALTER TABLE public.agents
    ADD CONSTRAINT agents_ownership_required_check
    CHECK (owner_member_id IS NOT NULL AND fallback_member_id IS NOT NULL) NOT VALID;

CREATE INDEX agents_owner_member_idx ON public.agents USING btree (owner_member_id);

-- When a member row is deleted, the agents it answered for move to the workspace owner (when there is one).
CREATE FUNCTION public.workspace_members_release_agents() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_owner uuid;
begin
  select m.id into v_owner from public.workspace_members m
    where m.workspace_id = old.workspace_id and m.role = 'owner' and m.status = 'active' and m.id <> old.id
    order by m.created_at, m.id limit 1;
  if v_owner is null then return old; end if;
  update public.agents set owner_member_id = v_owner where workspace_id = old.workspace_id and owner_member_id = old.id;
  update public.agents set fallback_member_id = v_owner where workspace_id = old.workspace_id and fallback_member_id = old.id;
  return old;
end;
$$;

REVOKE ALL ON FUNCTION public.workspace_members_release_agents() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER workspace_members_release_agents AFTER DELETE ON public.workspace_members
    FOR EACH ROW EXECUTE FUNCTION public.workspace_members_release_agents();
