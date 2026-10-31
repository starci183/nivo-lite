-- Contract (R259): the database objects no code reaches are dropped (owner ruling: a table or database function no code uses is
-- deleted). Every target was checked unreferenced by be/src, be/apps, fe, the mcp app, .starcistacks, the other database
-- functions, triggers, views and policies, and by the sources of the previous release (v0.5.6); a drop without CASCADE
-- proves nothing else depends on it.
--
-- Functions: the browser-era RPCs of the Supabase baseline (admin console, shifts, hiring, booking, lead and office doors,
-- agent chat, zalo wizard, the loyalty post, and the like). Lite has no PostgREST and no browser role door, and the api reaches
-- the database through entities and the functions hfs.json `sides.be.dbFunctions` lists, none of which is below.
-- Tables: booking_rate (counted only by the dropped booking_rate_hit; the booking limiter lives in the app), platform_flags (the
-- signup switch is the WORKSPACE_SIGNUP_ENABLED setting; the one row, false, was read only by the dropped create_free_workspace)
-- and n8n_pipelines (empty, written and read by nothing but the row count of workspace_footprint).
-- hiring_apply_hits stays until the release after the one that removed its entity (v0.5.6 still maps it); queue (the legacy outbox,
-- empty, read by nothing) stays because the contract check matches the name against the job_outbox.queue column its entity maps.
-- workspace_footprint is replaced first without the n8n_pipelines count so it never names a dropped table.

CREATE OR REPLACE FUNCTION public.workspace_footprint(p_workspace uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
  jsonb_build_object(
    'accounting_adjustments', (select count(*) from public.accounting_adjustments where workspace_id = p_workspace),
    'agent_access_log', (select count(*) from public.agent_access_log where workspace_id = p_workspace),
    'agent_connections', (select count(*) from public.agent_connections where workspace_id = p_workspace),
    'agent_conversations', (select count(*) from public.agent_conversations where workspace_id = p_workspace),
    'agent_messages', (select count(*) from public.agent_messages where workspace_id = p_workspace),
    'agents', (select count(*) from public.agents where workspace_id = p_workspace),
    'ai_generations', (select count(*) from public.ai_generations where workspace_id = p_workspace),
    'ai_quota_overrides', (select count(*) from public.ai_quota_overrides where workspace_id = p_workspace),
    'ai_usage_events', (select count(*) from public.ai_usage_events where workspace_id = p_workspace),
    'ai_usage_notices', (select count(*) from public.ai_usage_notices where workspace_id = p_workspace),
    'api_keys', (select count(*) from public.api_keys where workspace_id = p_workspace),
    'app_commands', (select count(*) from public.app_commands where workspace_id = p_workspace),
    'authority', (select count(*) from public.authority where workspace_id = p_workspace),
    'authority_rules', (select count(*) from public.authority_rules where workspace_id = p_workspace),
    'automation_commands', (select count(*) from public.automation_commands where workspace_id = p_workspace),
    'automation_pipelines', (select count(*) from public.automation_pipelines where workspace_id = p_workspace),
    'automation_runs', (select count(*) from public.automation_runs where workspace_id = p_workspace),
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
    'content_weekly_reports', (select count(*) from public.content_weekly_reports where workspace_id = p_workspace),
    'contracts', (select count(*) from public.contracts where workspace_id = p_workspace),
    'conversation_ownership_events', (select count(*) from public.conversation_ownership_events where workspace_id = p_workspace)
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
    'executions', (select count(*) from public.executions where workspace_id = p_workspace),
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
    'knowledge_suggestion_state', (select count(*) from public.knowledge_suggestion_state where workspace_id = p_workspace),
    'lead_actions', (select count(*) from public.lead_actions where workspace_id = p_workspace),
    'lead_flows', (select count(*) from public.lead_flows where workspace_id = p_workspace),
    'leads', (select count(*) from public.leads where workspace_id = p_workspace),
    'loyalty_campaigns', (select count(*) from public.loyalty_campaigns where workspace_id = p_workspace),
    'loyalty_customer_links', (select count(*) from public.loyalty_customer_links where workspace_id = p_workspace),
    'loyalty_customers', (select count(*) from public.loyalty_customers where workspace_id = p_workspace),
    'loyalty_ledger', (select count(*) from public.loyalty_ledger where workspace_id = p_workspace),
    'loyalty_otps', (select count(*) from public.loyalty_otps where workspace_id = p_workspace),
    'loyalty_programs', (select count(*) from public.loyalty_programs where workspace_id = p_workspace),
    'loyalty_rewards', (select count(*) from public.loyalty_rewards where workspace_id = p_workspace)
  )
  ||
  jsonb_build_object(
    'loyalty_sends', (select count(*) from public.loyalty_sends where workspace_id = p_workspace),
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
    'n8n_runs', (select count(*) from public.n8n_runs where workspace_id = p_workspace),
    'office_command_candidates', (select count(*) from public.office_command_candidates where workspace_id = p_workspace),
    'office_rooms', (select count(*) from public.office_rooms where workspace_id = p_workspace),
    'office_rooms_reads', (select count(*) from public.office_rooms_reads where workspace_id = p_workspace),
    'openclaw_agent_sync', (select count(*) from public.openclaw_agent_sync where workspace_id = p_workspace),
    'orders', (select count(*) from public.orders where workspace_id = p_workspace),
    'payment_order_requests', (select count(*) from public.payment_order_requests where workspace_id = p_workspace),
    'payment_orders', (select count(*) from public.payment_orders where workspace_id = p_workspace),
    'public_api', (select count(*) from public.public_api where workspace_id = p_workspace),
    'responsibilities', (select count(*) from public.responsibilities where workspace_id = p_workspace),
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
    'transactions', (select count(*) from public.transactions where workspace_id = p_workspace),
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


-- Functions, by exact signature.
DROP FUNCTION IF EXISTS public.accept_invite(text);
DROP FUNCTION IF EXISTS public.add_lead_responsibility(uuid,uuid,text,text,text,timestamp with time zone,text);
DROP FUNCTION IF EXISTS public.admin_console_audit(text,uuid,jsonb);
DROP FUNCTION IF EXISTS public.admin_console_quota(uuid);
DROP FUNCTION IF EXISTS public.admin_console_signups(integer);
DROP FUNCTION IF EXISTS public.admin_console_user_emails(uuid[]);
DROP FUNCTION IF EXISTS public.admin_console_workspace_stats();
DROP FUNCTION IF EXISTS public.admin_extend_subscription(uuid,integer);
DROP FUNCTION IF EXISTS public.admin_set_workspace_plan(uuid,text,bigint);
DROP FUNCTION IF EXISTS public.admin_set_workspace_status(uuid,text);
DROP FUNCTION IF EXISTS public.agent_chat_send(uuid,text);
DROP FUNCTION IF EXISTS public.agent_chat_start(uuid,text,text);
DROP FUNCTION IF EXISTS public.agent_chat_take_over(uuid,boolean,text);
DROP FUNCTION IF EXISTS public.api_key_create(uuid,text);
DROP FUNCTION IF EXISTS public.api_key_revoke(uuid,uuid);
DROP FUNCTION IF EXISTS public.assign_lead_responsibility(uuid,uuid,text,text,timestamp with time zone,text,text);
DROP FUNCTION IF EXISTS public.automation_command_enqueue(uuid,text,text);
DROP FUNCTION IF EXISTS public.booking_peak_load(uuid,timestamp with time zone,timestamp with time zone,uuid);
DROP FUNCTION IF EXISTS public.booking_rate_hit(text,integer,integer);
DROP FUNCTION IF EXISTS public.booking_relocate(uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,boolean);
DROP FUNCTION IF EXISTS public.booking_reserve(jsonb,boolean);
DROP FUNCTION IF EXISTS public.brain_command(uuid,text,jsonb);
DROP FUNCTION IF EXISTS public.brain_command_wait(uuid);
DROP FUNCTION IF EXISTS public.connection_command_take(uuid);
DROP FUNCTION IF EXISTS public.create_free_workspace(text);
DROP FUNCTION IF EXISTS public.dashboard_data(uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone);
DROP FUNCTION IF EXISTS public.exception_rows(uuid);
DROP FUNCTION IF EXISTS public.governance_rows(uuid,timestamp with time zone);
DROP FUNCTION IF EXISTS public.hiring_new_token();
DROP FUNCTION IF EXISTS public.hiring_ops_status();
DROP FUNCTION IF EXISTS public.invite_preview(text);
DROP FUNCTION IF EXISTS public.is_owner(uuid);
DROP FUNCTION IF EXISTS public.job_cutover_adopt(text,bigint,timestamp with time zone,jsonb,integer,timestamp with time zone,boolean);
DROP FUNCTION IF EXISTS public.job_cutover_redirect();
DROP FUNCTION IF EXISTS public.lead_actor_name(uuid);
DROP FUNCTION IF EXISTS public.lead_step_json(responsibilities);
DROP FUNCTION IF EXISTS public.lead_step_owner(uuid,text,text);
DROP FUNCTION IF EXISTS public.loyalty_post(uuid,uuid,text,integer,text,text,bigint,uuid,uuid,uuid,uuid,text,timestamp with time zone,timestamp with time zone);
DROP FUNCTION IF EXISTS public.match_knowledge(uuid,text,extensions.vector,text,integer,text,text,uuid);
DROP FUNCTION IF EXISTS public.my_sessions();
DROP FUNCTION IF EXISTS public.my_staff_id(uuid);
DROP FUNCTION IF EXISTS public.office_data(uuid,timestamp with time zone);
DROP FUNCTION IF EXISTS public.owns_workspace(uuid);
DROP FUNCTION IF EXISTS public.payment_order_request(uuid,text,text);
DROP FUNCTION IF EXISTS public.read_app_command(uuid);
DROP FUNCTION IF EXISTS public.record_lead_outcome(uuid,uuid,text,text,text);
DROP FUNCTION IF EXISTS public.request_agent_sync(uuid,uuid,boolean);
DROP FUNCTION IF EXISTS public.request_execution_decision(uuid,uuid,text,text,text);
DROP FUNCTION IF EXISTS public.request_office_confirm(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.request_office_propose(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.request_work_decision(uuid,uuid,text,jsonb,text,text,text);
DROP FUNCTION IF EXISTS public.responsibility_rows(uuid);
DROP FUNCTION IF EXISTS public.revoke_my_session(uuid);
DROP FUNCTION IF EXISTS public.revoke_workspace_invite(uuid,uuid);
DROP FUNCTION IF EXISTS public.session_bootstrap();
DROP FUNCTION IF EXISTS public.shifts_add_availability(uuid,uuid,smallint,date,time without time zone,time without time zone,boolean,text,text,text);
DROP FUNCTION IF EXISTS public.shifts_check_in(uuid,uuid,uuid);
DROP FUNCTION IF EXISTS public.shifts_decide_availability(uuid,uuid,text,text);
DROP FUNCTION IF EXISTS public.shifts_link_leave(uuid,uuid,uuid);
DROP FUNCTION IF EXISTS public.shifts_link_schedule(uuid,uuid,uuid);
DROP FUNCTION IF EXISTS public.shifts_link_swap(uuid,uuid,jsonb,uuid);
DROP FUNCTION IF EXISTS public.shifts_my_profile(uuid);
DROP FUNCTION IF EXISTS public.shifts_record_notice(uuid,uuid,uuid,uuid,text,text,text,text,text);
DROP FUNCTION IF EXISTS public.shifts_record_notification(uuid,uuid,uuid,uuid,text,text,text,text);
DROP FUNCTION IF EXISTS public.shifts_remove_availability(uuid,uuid);
DROP FUNCTION IF EXISTS public.shifts_remove_coverage(uuid,uuid);
DROP FUNCTION IF EXISTS public.shifts_remove_position(uuid,uuid);
DROP FUNCTION IF EXISTS public.shifts_remove_shift(uuid,uuid);
DROP FUNCTION IF EXISTS public.shifts_save_coverage(uuid,uuid,smallint[],time without time zone,time without time zone,uuid,integer,integer,boolean);
DROP FUNCTION IF EXISTS public.shifts_save_pay(uuid,uuid,integer);
DROP FUNCTION IF EXISTS public.shifts_save_position(uuid,uuid,text,text);
DROP FUNCTION IF EXISTS public.shifts_save_settings(uuid,jsonb,integer,integer,integer,integer,numeric);
DROP FUNCTION IF EXISTS public.shifts_save_staff(uuid,uuid,jsonb);
DROP FUNCTION IF EXISTS public.shifts_set_explanation(uuid,uuid,text,jsonb);
DROP FUNCTION IF EXISTS public.storage_ws_manager(text);
DROP FUNCTION IF EXISTS public.storage_ws_member(text);
DROP FUNCTION IF EXISTS public.update_my_profile(uuid,text);
DROP FUNCTION IF EXISTS public.usage_quota_status(uuid);
DROP FUNCTION IF EXISTS public.video_renders_reap();
DROP FUNCTION IF EXISTS public.workspace_member_contacts(uuid);
DROP FUNCTION IF EXISTS public.workspace_members_directory(uuid);
DROP FUNCTION IF EXISTS public.zalo_wizard_begin(uuid);
DROP FUNCTION IF EXISTS public.zalo_wizard_oa_secret(uuid,text);
DROP FUNCTION IF EXISTS public.zalo_wizard_start(uuid,text,text,text);

-- Tables (their policies, triggers and indexes go with them).
DROP TABLE IF EXISTS public.booking_rate;
DROP TABLE IF EXISTS public.n8n_pipelines;
DROP TABLE IF EXISTS public.platform_flags;
