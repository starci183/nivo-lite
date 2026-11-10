-- rights-one-model: forward-only; immutable once on origin/main.
-- Two data steps that make public.mcp_connector_access (an agent attached to a connected account, with its ticked abilities) the one
-- place a right is held, ahead of dropping the older level public.agent_connections.access (read, ask, auto per connection).
--
-- 1. A removed agent holds no right. Removing an agent now deletes its attachments; the agents removed before that still held theirs.
--    An agent with no installation that is still in use loses every attachment.
-- 2. "Ask first" is carried over. Where the owner set an agent's chat binding on a connection to `ask`, the agent's "send to
--    customer" ability on that very account is set to `ask` too, unless the shop already chose a mode other than the default `auto`
--    there (an unticked ability stays unticked: nothing is granted). The workflow engine reads the ability only, so until now such
--    a binding asked nobody.

DELETE FROM public.mcp_connector_access x
 WHERE EXISTS (SELECT 1 FROM public.module_installations i WHERE i.agent_id = x.agent_id AND i.status = 'removed')
   AND NOT EXISTS (SELECT 1 FROM public.module_installations i WHERE i.agent_id = x.agent_id AND i.status <> 'removed');

UPDATE public.mcp_connector_access x
   SET abilities = jsonb_set(x.abilities, '{customer.send}', '"ask"'::jsonb)
  FROM public.agent_connections ac
 WHERE ac.agent_id = x.agent_id
   AND ac.connection_id = x.connection_id
   AND ac.purpose IN ('inbound_chat', 'outbound_chat')
   AND ac.access = 'ask'
   AND x.abilities->>'customer.send' = 'auto';
