-- Only a running agent answers customers (owner ruling, v0.3.6): the customer-turn gate now needs status `live`, live_enabled, an
-- applied context version and its required connections, where it used to accept `ready` as well. This forward-only data step keeps
-- production behaviour: every installation that answers today (ready, an applied version, at least one bound channel connection)
-- becomes live. Idempotent and guarded: it touches only `ready` rows, and after one run none matches. No other data changes.
--
-- Count query, to print before and after the deploy (before = the rows this step will move, after must be 0):
--   select count(*) from public.module_installations i
--   where i.status = 'ready' and i.active_context_version_id is not null
--     and exists (select 1 from public.agent_connections ac join public.connections c on c.id = ac.connection_id
--                 where ac.agent_id = i.agent_id and ac.purpose in ('inbound_chat', 'outbound_chat') and c.status <> 'disconnected');

update public.module_installations i
set status = 'live', live_enabled = true
where i.status = 'ready'
  and i.active_context_version_id is not null
  and exists (
      select 1
      from public.agent_connections ac
      join public.connections c on c.id = ac.connection_id
      where ac.agent_id = i.agent_id
        and ac.purpose in ('inbound_chat', 'outbound_chat')
        and c.status <> 'disconnected'
  );
