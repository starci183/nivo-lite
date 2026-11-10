-- The internal nivo agent also holds the door tools ledger.append and ledger.status: the accounting job accounting.ledger-append calls the
-- NIVO MCP door as that agent, so the gateway judges the call by a grant (mcp_tool_grants). DOOR_GRANTS already names both, but the
-- workspace trigger and the existing nivo agents never held them, so the job was refused `forbidden` (not_granted) and parked. Forward-only.
-- New workspaces get the grants from the trigger function; the workspaces that exist get them here.

CREATE OR REPLACE FUNCTION public.workspaces_nivo_agent() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_agent uuid;
begin
  insert into public.agents (workspace_id, module, name, handle, role, instructions, status)
  values (new.id, 'nivo', 'Nivo', 'nivo', 'Runs the declared jobs of the modules',
          'Internal. Calls only the door tools the declared jobs of the modules name.', 'paused')
  returning id into v_agent;
  insert into public.mcp_tool_grants (workspace_id, agent_id, tool, mode)
  select new.id, v_agent, tool, 'auto'
  from unnest(array['chat.send', 'chat.profile', 'agent.turn', 'agent.history', 'ledger.append', 'ledger.status']) as tool;
  return null;
end;
$$;

INSERT INTO public.mcp_tool_grants (workspace_id, agent_id, tool, mode)
SELECT a.workspace_id, a.id, t.tool, 'auto'
FROM public.agents a
CROSS JOIN (VALUES ('ledger.append'), ('ledger.status')) AS t(tool)
WHERE a.module = 'nivo'
ON CONFLICT (agent_id, tool) DO NOTHING;
