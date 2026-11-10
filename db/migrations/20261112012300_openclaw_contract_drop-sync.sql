-- openclaw_contract_drop-sync: forward-only; immutable once on origin/main. A contract migration (BE-PERSISTENCE-19): it drops, so it
-- runs only once the release that stopped using these objects is accepted. Runs after 20261112012200_ai-usage-call-facts.sql.
-- OpenClaw is removed (owner decision 2026-11-10): NIVO runs agents only in its own engine with tools on the NIVO MCP. The agent copy
-- sync, the dormant `agent.turn` / `agent.history` door tools, the reply-timeout setting and the copied-session entity go. Owner's
-- answer on dev: OpenClaw's stored data is dropped, no copy kept (counted on dev before writing this: 6 sync rows, 0 `agent.turn`
-- records, 0 chat settings records, 4 grants of the two door tools, 584 finished `agents.sync` jobs, 9 installations with
-- `processor: openclaw` in their settings).
--
-- 1. workspace_footprint is replaced first, without the openclaw_agent_sync count, so it never names a dropped table (the body is
--    the one 20261112000700 laid down, that one line removed).
-- 2. public.openclaw_agent_sync goes with its policies, index and trigger.
-- 3. The installation_changed consumer of the sync (pgmq queue installation_changed__agent_sync and its dead-letter queue) goes; the
--    agent_wakes consumer stays.
-- 4. The `agents.sync` jobs (the five-minute tick and the per-change jobs; all finished) are deleted; the tick is gone from the code.
-- 5. The internal nivo agent no longer holds `agent.turn` / `agent.history` (the trigger of new workspaces and the existing grants).
-- 6. module_installations.settings loses `processor` and `openclawTimeoutSec`; its default becomes '{}'. agent_turns.runner defaults
--    to 'nivo' (no runner writes it any more; old rows keep their value as history).
-- 7. Entity engine (written by hand in the planner's format; the declarations and db/entities.manifest.json say the same):
--    chat.settings loses `openclawTimeoutSec` (its CHECK, then the key in stored data), and the `agent.turn` partition is dropped.

CREATE OR REPLACE FUNCTION public.workspace_footprint(p_workspace uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
  jsonb_build_object(
    'agent_access_log', (select count(*) from public.agent_access_log where workspace_id = p_workspace),
    'agent_connections', (select count(*) from public.agent_connections where workspace_id = p_workspace),
    'agents', (select count(*) from public.agents where workspace_id = p_workspace),
    'ai_generations', (select count(*) from public.ai_generations where workspace_id = p_workspace),
    'ai_quota_overrides', (select count(*) from public.ai_quota_overrides where workspace_id = p_workspace),
    'ai_usage_events', (select count(*) from public.ai_usage_events where workspace_id = p_workspace),
    'ai_usage_notices', (select count(*) from public.ai_usage_notices where workspace_id = p_workspace),
    'api_keys', (select count(*) from public.api_keys where workspace_id = p_workspace),
    'app_commands', (select count(*) from public.app_commands where workspace_id = p_workspace),
    'authority', (select count(*) from public.authority where workspace_id = p_workspace),
    'authority_rules', (select count(*) from public.authority_rules where workspace_id = p_workspace),
    'automation_pipelines', (select count(*) from public.automation_pipelines where workspace_id = p_workspace),
    'billing_events', (select count(*) from public.billing_events where workspace_id = p_workspace),
    'booking_exceptions', (select count(*) from public.booking_exceptions where workspace_id = p_workspace),
    'booking_hours', (select count(*) from public.booking_hours where workspace_id = p_workspace),
    'booking_reminders', (select count(*) from public.booking_reminders where workspace_id = p_workspace),
    'booking_resources', (select count(*) from public.booking_resources where workspace_id = p_workspace),
    'booking_services', (select count(*) from public.booking_services where workspace_id = p_workspace),
    'booking_settings', (select count(*) from public.booking_settings where workspace_id = p_workspace),
    'booking_waitlist', (select count(*) from public.booking_waitlist where workspace_id = p_workspace),
    'bookings', (select count(*) from public.bookings where workspace_id = p_workspace),
    'brain_commands', (select count(*) from public.brain_commands where workspace_id = p_workspace),
    'brain_eval_cases', (select count(*) from public.brain_eval_cases where workspace_id = p_workspace),
    'brain_extractions', (select count(*) from public.brain_extractions where workspace_id = p_workspace),
    'brain_facts', (select count(*) from public.brain_facts where workspace_id = p_workspace),
    'brain_lessons', (select count(*) from public.brain_lessons where workspace_id = p_workspace),
    'brain_source_profiles', (select count(*) from public.brain_source_profiles where workspace_id = p_workspace),
    'channel_receipts', (select count(*) from public.channel_receipts where workspace_id = p_workspace),
    'connection_commands', (select count(*) from public.connection_commands where workspace_id = p_workspace),
    'connections', (select count(*) from public.connections where workspace_id = p_workspace),
    'connector_interest', (select count(*) from public.connector_interest where workspace_id = p_workspace),
    'content_brand_proposals', (select count(*) from public.content_brand_proposals where workspace_id = p_workspace),
    'content_cadence', (select count(*) from public.content_cadence where workspace_id = p_workspace),
    'content_engagement_daily', (select count(*) from public.content_engagement_daily where workspace_id = p_workspace),
    'content_items', (select count(*) from public.content_items where workspace_id = p_workspace),
    'content_pillars', (select count(*) from public.content_pillars where workspace_id = p_workspace),
    'content_plans', (select count(*) from public.content_plans where workspace_id = p_workspace),
    'content_settings', (select count(*) from public.content_settings where workspace_id = p_workspace),
    'content_weekly_reports', (select count(*) from public.content_weekly_reports where workspace_id = p_workspace)
  )
  ||
  jsonb_build_object(
    'credit_pack_purchases', (select count(*) from public.credit_pack_purchases where workspace_id = p_workspace),
    'credit_topup_draws', (select count(*) from public.credit_topup_draws where workspace_id = p_workspace),
    'credit_topups', (select count(*) from public.credit_topups where workspace_id = p_workspace),
    'data_records', (select count(*) from public.data_records where workspace_id = p_workspace),
    'data_sync_runs', (select count(*) from public.data_sync_runs where workspace_id = p_workspace),
    'decisions', (select count(*) from public.decisions where workspace_id = p_workspace),
    'email_messages', (select count(*) from public.email_messages where workspace_id = p_workspace),
    'events', (select count(*) from public.events where workspace_id = p_workspace),
    'hiring_availability', (select count(*) from public.hiring_availability where workspace_id = p_workspace),
    'hiring_candidates', (select count(*) from public.hiring_candidates where workspace_id = p_workspace),
    'hiring_consents', (select count(*) from public.hiring_consents where workspace_id = p_workspace),
    'hiring_events', (select count(*) from public.hiring_events where workspace_id = p_workspace),
    'hiring_interviews', (select count(*) from public.hiring_interviews where workspace_id = p_workspace),
    'hiring_jobs', (select count(*) from public.hiring_jobs where workspace_id = p_workspace),
    'hiring_offers', (select count(*) from public.hiring_offers where workspace_id = p_workspace),
    'hiring_onboarding', (select count(*) from public.hiring_onboarding where workspace_id = p_workspace),
    'hiring_retention_log', (select count(*) from public.hiring_retention_log where workspace_id = p_workspace),
    'hiring_settings', (select count(*) from public.hiring_settings where workspace_id = p_workspace),
    'inbound_events', (select count(*) from public.inbound_events where workspace_id = p_workspace),
    'inventory_items', (select count(*) from public.inventory_items where workspace_id = p_workspace),
    'inventory_locations', (select count(*) from public.inventory_locations where workspace_id = p_workspace),
    'inventory_movements', (select count(*) from public.inventory_movements where workspace_id = p_workspace),
    'inventory_po_lines', (select count(*) from public.inventory_po_lines where workspace_id = p_workspace),
    'inventory_purchase_orders', (select count(*) from public.inventory_purchase_orders where workspace_id = p_workspace),
    'inventory_receipts', (select count(*) from public.inventory_receipts where workspace_id = p_workspace),
    'inventory_recipe_lines', (select count(*) from public.inventory_recipe_lines where workspace_id = p_workspace),
    'inventory_recipes', (select count(*) from public.inventory_recipes where workspace_id = p_workspace),
    'inventory_stock_levels', (select count(*) from public.inventory_stock_levels where workspace_id = p_workspace),
    'inventory_suppliers', (select count(*) from public.inventory_suppliers where workspace_id = p_workspace),
    'invoices', (select count(*) from public.invoices where workspace_id = p_workspace),
    'knowledge_chunks', (select count(*) from public.knowledge_chunks where workspace_id = p_workspace),
    'knowledge_gaps', (select count(*) from public.knowledge_gaps where workspace_id = p_workspace),
    'knowledge_sources', (select count(*) from public.knowledge_sources where workspace_id = p_workspace),
    'knowledge_suggestion_state', (select count(*) from public.knowledge_suggestion_state where workspace_id = p_workspace)
  )
  ||
  jsonb_build_object(
    'mcp_call_log', (select count(*) from public.mcp_call_log where workspace_id = p_workspace),
    'mcp_connectors', (select count(*) from public.mcp_connectors where workspace_id = p_workspace),
    'mcp_tool_grants', (select count(*) from public.mcp_tool_grants where workspace_id = p_workspace),
    'messages', (select count(*) from public.messages where workspace_id = p_workspace),
    'module_context_notes', (select count(*) from public.module_context_notes where workspace_id = p_workspace),
    'module_context_versions', (select count(*) from public.module_context_versions where workspace_id = p_workspace),
    'module_installations', (select count(*) from public.module_installations where workspace_id = p_workspace),
    'module_setup_messages', (select count(*) from public.module_setup_messages where workspace_id = p_workspace),
    'module_setup_sessions', (select count(*) from public.module_setup_sessions where workspace_id = p_workspace),
    'module_setup_writes', (select count(*) from public.module_setup_writes where workspace_id = p_workspace),
    'office_command_candidates', (select count(*) from public.office_command_candidates where workspace_id = p_workspace),
    'office_rooms', (select count(*) from public.office_rooms where workspace_id = p_workspace),
    'office_rooms_reads', (select count(*) from public.office_rooms_reads where workspace_id = p_workspace),
    'payment_order_requests', (select count(*) from public.payment_order_requests where workspace_id = p_workspace),
    'payment_orders', (select count(*) from public.payment_orders where workspace_id = p_workspace),
    'public_api', (select count(*) from public.public_api where workspace_id = p_workspace),
    'shifts_attendance', (select count(*) from public.shifts_attendance where workspace_id = p_workspace),
    'shifts_availability', (select count(*) from public.shifts_availability where workspace_id = p_workspace),
    'shifts_coverage', (select count(*) from public.shifts_coverage where workspace_id = p_workspace),
    'shifts_leave_requests', (select count(*) from public.shifts_leave_requests where workspace_id = p_workspace),
    'shifts_notifications', (select count(*) from public.shifts_notifications where workspace_id = p_workspace),
    'shifts_positions', (select count(*) from public.shifts_positions where workspace_id = p_workspace),
    'shifts_schedules', (select count(*) from public.shifts_schedules where workspace_id = p_workspace),
    'shifts_settings', (select count(*) from public.shifts_settings where workspace_id = p_workspace),
    'shifts_shifts', (select count(*) from public.shifts_shifts where workspace_id = p_workspace),
    'shifts_staff', (select count(*) from public.shifts_staff where workspace_id = p_workspace),
    'shifts_staff_pay', (select count(*) from public.shifts_staff_pay where workspace_id = p_workspace),
    'shifts_swap_requests', (select count(*) from public.shifts_swap_requests where workspace_id = p_workspace),
    'staff', (select count(*) from public.staff where workspace_id = p_workspace),
    'video_brand_kits', (select count(*) from public.video_brand_kits where workspace_id = p_workspace),
    'video_delegations', (select count(*) from public.video_delegations where workspace_id = p_workspace),
    'video_project_versions', (select count(*) from public.video_project_versions where workspace_id = p_workspace),
    'video_projects', (select count(*) from public.video_projects where workspace_id = p_workspace),
    'video_renders', (select count(*) from public.video_renders where workspace_id = p_workspace),
    'work_items', (select count(*) from public.work_items where workspace_id = p_workspace),
    'workspace_invites', (select count(*) from public.workspace_invites where workspace_id = p_workspace),
    'workspace_members', (select count(*) from public.workspace_members where workspace_id = p_workspace)
  )
$function$;

DROP TABLE public.openclaw_agent_sync;

SELECT pgmq.unbind_topic('installation_changed', 'installation_changed__agent_sync');
SELECT pgmq.drop_queue('installation_changed__agent_sync');
SELECT pgmq.drop_queue('installation_changed__agent_sync__dead');

DELETE FROM public.job_outbox WHERE queue = 'agents' AND name = 'agents.sync';

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
  from unnest(array['chat.send', 'chat.profile', 'ledger.append', 'ledger.status']) as tool;
  return null;
end;
$$;

DELETE FROM public.mcp_tool_grants g
USING public.agents a
WHERE g.agent_id = a.id AND a.module = 'nivo' AND g.tool IN ('agent.turn', 'agent.history');

ALTER TABLE public.module_installations ALTER COLUMN settings SET DEFAULT '{}'::jsonb;
UPDATE public.module_installations
SET settings = settings - 'processor' - 'openclawTimeoutSec'
WHERE settings ?| ARRAY['processor', 'openclawTimeoutSec'];

ALTER TABLE public.agent_turns ALTER COLUMN runner SET DEFAULT 'nivo';

-- drop_constraint public.records_chat_settings:constraint:records_chat_settings_openclaw_timeout_sec_chk: the declaration does not name it
ALTER TABLE public."records_chat_settings" DROP CONSTRAINT "records_chat_settings_openclaw_timeout_sec_chk";
UPDATE public.records SET data = data - 'openclawTimeoutSec' WHERE entity = 'chat.settings' AND data ? 'openclawTimeoutSec';

-- drop_partition public.records_agent_turn: the declaration does not name it
ALTER TABLE public.records DETACH PARTITION public."records_agent_turn";
DROP TABLE public."records_agent_turn";
