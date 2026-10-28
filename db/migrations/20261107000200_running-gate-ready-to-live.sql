-- Only a running agent answers customers (owner ruling, v0.3.6): the customer-turn gate now needs status `live`, live_enabled, an
-- applied context version and its required connections, where it used to accept `ready` as well. Today every `ready` installation
-- with an applied version answers on any path (channel, website chat, public API), so this forward-only data step keeps exactly that
-- set answering: every such installation becomes live and live_enabled. An agent with no bound connection is not special-cased; it
-- behaves as it does today. Idempotent and guarded: it touches only `ready` rows with an applied version, and after one run none
-- matches. No other data changes.
--
-- Count queries, to print before and after the deploy (the full count is the rows this step moves and must be 0 afterwards; the
-- channel-scoped count is the subset that has a bound channel connection, kept for comparison):
--   full:    select count(*) from public.module_installations i
--            where i.status = 'ready' and i.active_context_version_id is not null;
--   channel: select count(*) from public.module_installations i
--            where i.status = 'ready' and i.active_context_version_id is not null
--              and exists (select 1 from public.agent_connections ac join public.connections c on c.id = ac.connection_id
--                          where ac.agent_id = i.agent_id and ac.purpose in ('inbound_chat', 'outbound_chat')
--                            and c.status <> 'disconnected');

update public.module_installations i
set status = 'live', live_enabled = true
where i.status = 'ready'
  and i.active_context_version_id is not null;
