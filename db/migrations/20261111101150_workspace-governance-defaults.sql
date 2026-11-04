-- workspace-governance-defaults: every workspace starts with its authority sheet and the default authority rules of the stable modules,
-- whichever door created it (the sign-up, the first sign-in, the seed CLI), as the API's create-workspace door already did in code. Without
-- them a stable module that is not installed yet, such as the Chatbot hand-off of a customer chat, is default-denied ("not granted").
-- Expand only. The function is the one place that writes them: the sheet first, then the rules only when this call made the sheet, so a rule
-- the owner removed later never comes back and a rule already set is never overwritten. A trigger runs it for each new workspace, and the
-- last statement runs it once for each workspace that has no sheet yet. Rerunning it adds nothing.

CREATE OR REPLACE FUNCTION public.ensure_workspace_governance(p_workspace uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  made integer;
begin
  insert into public.authority (workspace_id, updated_by) values (p_workspace, 'NIVO') on conflict (workspace_id) do nothing;
  get diagnostics made = row_count;
  if made = 0 then
    return false;
  end if;
  insert into public.authority_rules (workspace_id, department, action, mode, limit_vnd, required_fields)
  select p_workspace, a.module_key, a.action, a.default_mode, a.default_limit_vnd, a.default_required_fields
  from public.authority_actions a
  join public.modules m on m.key = a.module_key and m.status = 'stable'
  on conflict (workspace_id, department, action) do nothing;
  return true;
end;
$$;

CREATE OR REPLACE FUNCTION public.workspaces_add_governance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.ensure_workspace_governance(new.id);
  return new;
end;
$$;

CREATE TRIGGER workspaces_add_governance AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.workspaces_add_governance();

-- Only the trigger and this migration call them: no role executes them directly.
REVOKE ALL ON FUNCTION public.ensure_workspace_governance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.workspaces_add_governance() FROM PUBLIC, anon, authenticated;

SELECT public.ensure_workspace_governance(w.id) FROM public.workspaces w
WHERE NOT EXISTS (SELECT 1 FROM public.authority s WHERE s.workspace_id = w.id);
