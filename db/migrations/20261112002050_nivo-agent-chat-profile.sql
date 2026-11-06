-- The internal nivo agent also holds the door tool chat.profile: the round that reads a Zalo customer's name and picture calls the NIVO MCP
-- door as that agent, so the gateway judges the call by a grant (mcp_tool_grants) and records it (mcp_call_log). Forward-only.
-- New workspaces get the grant from the trigger function; the workspaces that exist get it here.

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
  from unnest(array['chat.send', 'chat.profile', 'agent.turn', 'agent.history']) as tool;
  return null;
end;
$$;

INSERT INTO public.mcp_tool_grants (workspace_id, agent_id, tool, mode)
SELECT a.workspace_id, a.id, 'chat.profile', 'auto'
FROM public.agents a
WHERE a.module = 'nivo'
ON CONFLICT (agent_id, tool) DO NOTHING;
