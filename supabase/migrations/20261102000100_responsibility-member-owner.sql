-- v0.3.2 step 1: the owner of a person-owned step is a concrete workspace member, never the generic "human".
-- A responsibility owned by a person names that member (`owner_member_id`); an agent-owned one names none. Rows written before this
-- migration (and every row a SQL function writes without naming a member) belong to the workspace owner, the default of the plan:
-- the oldest active owner seat. A member removed from the workspace hands their steps back to that owner, so a person-owned step
-- never loses its owner. The decision log names the member who decided next to the name it already carries.

CREATE FUNCTION public.workspace_owner_member(p_workspace uuid) RETURNS uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select m.id from public.workspace_members m
  where m.workspace_id = p_workspace and m.role = 'owner' and m.status = 'active'
  order by m.created_at asc, m.id asc
  limit 1;
$$;
REVOKE ALL ON FUNCTION public.workspace_owner_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_owner_member(uuid) TO app_be;

ALTER TABLE public.responsibilities
    ADD COLUMN owner_member_id uuid REFERENCES public.workspace_members(id) ON DELETE SET NULL;

-- A person-owned step without a named member belongs to the workspace owner, and shows that member's name; an agent-owned step
-- names no member. Fires on insert and on update, so the member a deleted seat leaves behind (ON DELETE SET NULL) is refilled.
CREATE FUNCTION public.responsibilities_member_owner() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_member uuid;
  v_name text;
begin
  if new.owner_kind = 'agent' then
    new.owner_member_id := null;
    return new;
  end if;
  if new.owner_member_id is null then
    v_member := public.workspace_owner_member(new.workspace_id);
    if v_member is not null then
      select m.display_name into v_name from public.workspace_members m where m.id = v_member;
      new.owner_member_id := v_member;
      new.owner_name := v_name;
    end if;
  end if;
  return new;
end $$;

CREATE TRIGGER responsibilities_member_owner
    BEFORE INSERT OR UPDATE ON public.responsibilities
    FOR EACH ROW EXECUTE FUNCTION public.responsibilities_member_owner();

-- Existing "human" steps move to the workspace owner (the trigger fills the member and the name).
UPDATE public.responsibilities SET owner_kind = owner_kind WHERE owner_kind = 'human' AND owner_member_id IS NULL;

ALTER TABLE public.responsibilities
    ADD CONSTRAINT responsibilities_owner_member_check
    CHECK (((owner_kind = 'agent' AND owner_member_id IS NULL) OR owner_kind = 'human'));

CREATE INDEX responsibilities_owner_member_idx ON public.responsibilities USING btree (owner_member_id) WHERE (owner_member_id IS NOT NULL);

-- The decision log names the member who decided. Past lines keep the name they were written with; the member is linked when that
-- name belongs to exactly one member of the workspace.
ALTER TABLE public.decisions
    ADD COLUMN decided_by_member_id uuid REFERENCES public.workspace_members(id) ON DELETE SET NULL;

UPDATE public.decisions d
SET decided_by_member_id = m.id
FROM (
    SELECT workspace_id, display_name, (array_agg(id))[1] AS id
    FROM public.workspace_members
    GROUP BY workspace_id, display_name
    HAVING count(*) = 1
) m
WHERE d.decider_kind IN ('owner', 'staff') AND d.decided_by_member_id IS NULL
  AND m.workspace_id = d.workspace_id AND m.display_name = d.decided_by;

CREATE INDEX decisions_decided_by_member_idx ON public.decisions USING btree (decided_by_member_id) WHERE (decided_by_member_id IS NOT NULL);
