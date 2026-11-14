-- soft-delete-workspaces-connections: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the DECOUPLE lane.
-- Owner ruling R36 (2026-11-14, "xoa mem"), same law as R31: deleting a workspace and removing a provider connection are SOFT deletes. The
-- row gets a deleted mark, every read hides it, nothing cascades a hard delete.
--   1. public.connections.deleted_at timestamptz NULL (the entity's delete-date column hides the row from every find and select).
--   2. the two partial unique indexes of connections (smtp default, telegram bot) also require `deleted_at IS NULL`, so a removed account
--      frees its key (a new connection of the same bot can be made).
--   3. the five plpgsql functions that read or update a connection to ACT on it are replaced by explicit CREATE OR REPLACE FUNCTION
--      (bodies copied from the baseline, plus `deleted_at IS NULL`): agent_connections_same_workspace (a binding names a live
--      connection), connection_mark_fed, zalo_authorization_return, connection_poll_enroll, connection_poll_mark_hot (a removed connection
--      is never enrolled or made hot). Two are left on purpose: app_errors_record (only names the workspace of an error, a removed
--      connection still has one) and workspace_footprint (counts everything that stays, removed rows included). No function is
--      rewritten by text replacement. Remove also deletes the sealed secrets of the connection (connection_secrets, zalo_wizard_drafts:
--      app_be keeps DELETE on those two) in the same transaction, from the application; nothing here changes that.
--   4. every foreign key that is ON DELETE CASCADE into public.workspaces or public.connections becomes NO ACTION (explicit statements, constraint
--      names read from the catalog of this chain, not guessed): a hard delete of a workspace or a connection that still has anything under it is refused by the database.
--      SET NULL keys stay. The workspace's own delete is already soft (workspaces.deleted_at, baseline) and is unchanged.
--   5. app_be loses DELETE on public.workspaces and public.connections (and its row policies for DELETE are left, harmless).
-- Not covered: the Auth accounts, objects in storage.
DO $$
BEGIN
    ALTER TABLE public.connections ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'connections_smtp_default' AND indexdef LIKE '%deleted_at IS NULL%') THEN
        DROP INDEX IF EXISTS public.connections_smtp_default;
        CREATE UNIQUE INDEX connections_smtp_default ON public.connections USING btree (workspace_id)
            WHERE (provider = 'smtp' AND is_default AND status <> 'disconnected' AND deleted_at IS NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'connections_telegram_bot' AND indexdef LIKE '%deleted_at IS NULL%') THEN
        DROP INDEX IF EXISTS public.connections_telegram_bot;
        CREATE UNIQUE INDEX connections_telegram_bot ON public.connections USING btree ((public_meta ->> 'bot_id'))
            WHERE (provider = 'telegram' AND status <> 'disconnected' AND deleted_at IS NULL);
    END IF;

    REVOKE DELETE ON public.workspaces FROM app_be;
    REVOKE DELETE ON public.connections FROM app_be;
END
$$;

-- Step 4 as explicit statements: every ON DELETE CASCADE foreign key into public.workspaces or public.connections declared on its own
-- table at 20261114000800 (123; a partition inherits its parent's key and follows it, so inherited keys are not named: the catalog loop
-- this replaces named them and failed with "cannot drop inherited constraint" on the account_data partitions; the migrate verb also
-- refuses a dynamic EXECUTE). Rendered by RESTART-R2 on 2026-11-14 from a copy of dev at 20261114000800.
ALTER TABLE public.account_data DROP CONSTRAINT account_data_connection_id_fkey, ADD CONSTRAINT account_data_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.account_data DROP CONSTRAINT account_data_workspace_id_fkey, ADD CONSTRAINT account_data_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_access_log DROP CONSTRAINT agent_access_log_workspace_id_fkey, ADD CONSTRAINT agent_access_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_checkpoint_blobs DROP CONSTRAINT agent_checkpoint_blobs_workspace_id_fkey, ADD CONSTRAINT agent_checkpoint_blobs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_checkpoint_writes DROP CONSTRAINT agent_checkpoint_writes_workspace_id_fkey, ADD CONSTRAINT agent_checkpoint_writes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_checkpoints DROP CONSTRAINT agent_checkpoints_workspace_id_fkey, ADD CONSTRAINT agent_checkpoints_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_connections DROP CONSTRAINT agent_connections_connection_id_fkey, ADD CONSTRAINT agent_connections_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.agent_connections DROP CONSTRAINT agent_connections_workspace_id_fkey, ADD CONSTRAINT agent_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_door_presses DROP CONSTRAINT agent_door_presses_workspace_id_fkey, ADD CONSTRAINT agent_door_presses_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_goals DROP CONSTRAINT agent_goals_workspace_id_fkey, ADD CONSTRAINT agent_goals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_graph_proposals DROP CONSTRAINT agent_graph_proposals_workspace_id_fkey, ADD CONSTRAINT agent_graph_proposals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_graph_sources DROP CONSTRAINT agent_graph_sources_workspace_id_fkey, ADD CONSTRAINT agent_graph_sources_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_graph_versions DROP CONSTRAINT agent_graph_versions_workspace_id_fkey, ADD CONSTRAINT agent_graph_versions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_graphs DROP CONSTRAINT agent_graphs_workspace_id_fkey, ADD CONSTRAINT agent_graphs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_node_effects DROP CONSTRAINT agent_node_effects_workspace_id_fkey, ADD CONSTRAINT agent_node_effects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_run_steps DROP CONSTRAINT agent_run_steps_workspace_id_fkey, ADD CONSTRAINT agent_run_steps_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_runs DROP CONSTRAINT agent_runs_workspace_id_fkey, ADD CONSTRAINT agent_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_tasks DROP CONSTRAINT agent_tasks_workspace_id_fkey, ADD CONSTRAINT agent_tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_triggers DROP CONSTRAINT agent_triggers_workspace_id_fkey, ADD CONSTRAINT agent_triggers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_turns DROP CONSTRAINT agent_turns_workspace_id_fkey, ADD CONSTRAINT agent_turns_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_wakes DROP CONSTRAINT agent_wakes_workspace_id_fkey, ADD CONSTRAINT agent_wakes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_work_leases DROP CONSTRAINT agent_work_leases_workspace_id_fkey, ADD CONSTRAINT agent_work_leases_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_work_settings DROP CONSTRAINT agent_work_settings_workspace_id_fkey, ADD CONSTRAINT agent_work_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_work_state DROP CONSTRAINT agent_work_state_workspace_id_fkey, ADD CONSTRAINT agent_work_state_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_workflow_versions DROP CONSTRAINT agent_workflow_versions_workspace_id_fkey, ADD CONSTRAINT agent_workflow_versions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agent_workflows DROP CONSTRAINT agent_workflows_workspace_id_fkey, ADD CONSTRAINT agent_workflows_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.agents DROP CONSTRAINT agents_workspace_id_fkey, ADD CONSTRAINT agents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.ai_generations DROP CONSTRAINT ai_generations_workspace_id_fkey, ADD CONSTRAINT ai_generations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.ai_quota_overrides DROP CONSTRAINT ai_quota_overrides_workspace_id_fkey, ADD CONSTRAINT ai_quota_overrides_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.ai_usage_events DROP CONSTRAINT ai_usage_events_workspace_id_fkey, ADD CONSTRAINT ai_usage_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.api_keys DROP CONSTRAINT workspace_api_keys_workspace_id_fkey, ADD CONSTRAINT workspace_api_keys_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.app_commands DROP CONSTRAINT app_commands_workspace_id_fkey, ADD CONSTRAINT app_commands_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.billing_events DROP CONSTRAINT billing_events_workspace_id_fkey, ADD CONSTRAINT billing_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_commands DROP CONSTRAINT brain_commands_workspace_id_fkey, ADD CONSTRAINT brain_commands_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_eval_cases DROP CONSTRAINT brain_eval_cases_workspace_id_fkey, ADD CONSTRAINT brain_eval_cases_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_extractions DROP CONSTRAINT brain_extractions_workspace_id_fkey, ADD CONSTRAINT brain_extractions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_fact_relations DROP CONSTRAINT brain_fact_relations_workspace_id_fkey, ADD CONSTRAINT brain_fact_relations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_facts DROP CONSTRAINT brain_facts_workspace_id_fkey, ADD CONSTRAINT brain_facts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_lesson_candidates DROP CONSTRAINT brain_lesson_candidates_workspace_id_fkey, ADD CONSTRAINT brain_lesson_candidates_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_lessons DROP CONSTRAINT brain_lessons_workspace_id_fkey, ADD CONSTRAINT brain_lessons_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_policies DROP CONSTRAINT brain_policies_workspace_id_fkey, ADD CONSTRAINT brain_policies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_policy_derivations DROP CONSTRAINT brain_policy_derivations_workspace_id_fkey, ADD CONSTRAINT brain_policy_derivations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_source_critiques DROP CONSTRAINT brain_source_critiques_workspace_id_fkey, ADD CONSTRAINT brain_source_critiques_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.brain_source_profiles DROP CONSTRAINT brain_source_profiles_connection_id_fkey, ADD CONSTRAINT brain_source_profiles_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.brain_source_profiles DROP CONSTRAINT brain_source_profiles_workspace_id_fkey, ADD CONSTRAINT brain_source_profiles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.channel_connections_sepay_events DROP CONSTRAINT channel_connections_sepay_events_connection_id_fkey, ADD CONSTRAINT channel_connections_sepay_events_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.chat_room_members DROP CONSTRAINT chat_room_members_workspace_id_fkey, ADD CONSTRAINT chat_room_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.chat_room_message_reactions DROP CONSTRAINT chat_room_message_reactions_workspace_id_fkey, ADD CONSTRAINT chat_room_message_reactions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.chat_room_messages DROP CONSTRAINT chat_room_messages_workspace_id_fkey, ADD CONSTRAINT chat_room_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.chat_room_pins DROP CONSTRAINT chat_room_pins_workspace_id_fkey, ADD CONSTRAINT chat_room_pins_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.chat_rooms DROP CONSTRAINT chat_rooms_workspace_id_fkey, ADD CONSTRAINT chat_rooms_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.connection_commands DROP CONSTRAINT connection_commands_workspace_id_fkey, ADD CONSTRAINT connection_commands_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.connection_poll_schedule DROP CONSTRAINT connection_poll_schedule_connection_id_fkey, ADD CONSTRAINT connection_poll_schedule_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.connection_secrets DROP CONSTRAINT connection_secrets_connection_id_fkey, ADD CONSTRAINT connection_secrets_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.connections DROP CONSTRAINT connections_workspace_id_fkey, ADD CONSTRAINT connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.connector_interest DROP CONSTRAINT connector_interest_workspace_id_fkey, ADD CONSTRAINT connector_interest_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.contact_events DROP CONSTRAINT contact_events_workspace_id_fkey, ADD CONSTRAINT contact_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.contact_freezes DROP CONSTRAINT contact_freezes_workspace_id_fkey, ADD CONSTRAINT contact_freezes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.contact_identities DROP CONSTRAINT contact_identities_workspace_id_fkey, ADD CONSTRAINT contact_identities_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.contact_link_tokens DROP CONSTRAINT contact_link_tokens_workspace_id_fkey, ADD CONSTRAINT contact_link_tokens_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.contact_memory DROP CONSTRAINT contact_memory_workspace_id_fkey, ADD CONSTRAINT contact_memory_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.contact_merges DROP CONSTRAINT contact_merges_workspace_id_fkey, ADD CONSTRAINT contact_merges_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.contacts DROP CONSTRAINT contacts_workspace_id_fkey, ADD CONSTRAINT contacts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.credit_pack_purchases DROP CONSTRAINT credit_pack_purchases_workspace_id_fkey, ADD CONSTRAINT credit_pack_purchases_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.credit_topup_draws DROP CONSTRAINT credit_topup_draws_workspace_id_fkey, ADD CONSTRAINT credit_topup_draws_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.credit_topups DROP CONSTRAINT credit_topups_workspace_id_fkey, ADD CONSTRAINT credit_topups_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.customer_messages DROP CONSTRAINT customer_messages_workspace_id_fkey, ADD CONSTRAINT customer_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.customer_routes DROP CONSTRAINT customer_routes_workspace_id_fkey, ADD CONSTRAINT customer_routes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.data_records DROP CONSTRAINT data_records_connection_id_fkey, ADD CONSTRAINT data_records_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.data_records DROP CONSTRAINT data_records_workspace_id_fkey, ADD CONSTRAINT data_records_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.data_sync_runs DROP CONSTRAINT data_sync_runs_connection_id_fkey, ADD CONSTRAINT data_sync_runs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.data_sync_runs DROP CONSTRAINT data_sync_runs_workspace_id_fkey, ADD CONSTRAINT data_sync_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.dossier_findings DROP CONSTRAINT dossier_findings_workspace_id_fkey, ADD CONSTRAINT dossier_findings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.dossier_review_runs DROP CONSTRAINT dossier_review_runs_workspace_id_fkey, ADD CONSTRAINT dossier_review_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.email_messages DROP CONSTRAINT email_messages_workspace_id_fkey, ADD CONSTRAINT email_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.entity_sequences DROP CONSTRAINT entity_sequences_workspace_id_fkey, ADD CONSTRAINT entity_sequences_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.events DROP CONSTRAINT events_workspace_id_fkey, ADD CONSTRAINT events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.inbound_events DROP CONSTRAINT inbound_events_workspace_id_fkey, ADD CONSTRAINT inbound_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.job_outbox DROP CONSTRAINT job_outbox_workspace_id_fkey, ADD CONSTRAINT job_outbox_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.knowledge_chunks DROP CONSTRAINT knowledge_chunks_workspace_id_fkey, ADD CONSTRAINT knowledge_chunks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.knowledge_gaps DROP CONSTRAINT knowledge_gaps_workspace_id_fkey, ADD CONSTRAINT knowledge_gaps_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.knowledge_sources DROP CONSTRAINT knowledge_sources_workspace_id_fkey, ADD CONSTRAINT knowledge_sources_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.knowledge_suggestion_state DROP CONSTRAINT knowledge_suggestion_state_workspace_id_fkey, ADD CONSTRAINT knowledge_suggestion_state_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.mcp_call_log DROP CONSTRAINT mcp_call_log_workspace_id_fkey, ADD CONSTRAINT mcp_call_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.mcp_connector_access DROP CONSTRAINT mcp_connector_access_connection_id_fkey, ADD CONSTRAINT mcp_connector_access_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.mcp_connector_access DROP CONSTRAINT mcp_connector_access_workspace_id_fkey, ADD CONSTRAINT mcp_connector_access_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.mcp_gateway_receipts DROP CONSTRAINT mcp_gateway_receipts_workspace_id_fkey, ADD CONSTRAINT mcp_gateway_receipts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.mcp_tool_grants DROP CONSTRAINT mcp_tool_grants_workspace_id_fkey, ADD CONSTRAINT mcp_tool_grants_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.meta_comments DROP CONSTRAINT meta_comments_connection_id_fkey, ADD CONSTRAINT meta_comments_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.meta_threads DROP CONSTRAINT meta_threads_connection_id_fkey, ADD CONSTRAINT meta_threads_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.module_context_notes DROP CONSTRAINT module_context_notes_workspace_id_fkey, ADD CONSTRAINT module_context_notes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.module_context_versions DROP CONSTRAINT module_context_versions_workspace_id_fkey, ADD CONSTRAINT module_context_versions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.module_installations DROP CONSTRAINT module_installations_workspace_id_fkey, ADD CONSTRAINT module_installations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.module_setup_messages DROP CONSTRAINT module_setup_messages_workspace_id_fkey, ADD CONSTRAINT module_setup_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.module_setup_sessions DROP CONSTRAINT module_setup_sessions_workspace_id_fkey, ADD CONSTRAINT module_setup_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.module_setup_writes DROP CONSTRAINT module_setup_writes_workspace_id_fkey, ADD CONSTRAINT module_setup_writes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.node_account_policies DROP CONSTRAINT node_account_policies_connection_id_fkey, ADD CONSTRAINT node_account_policies_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.node_account_policies DROP CONSTRAINT node_account_policies_workspace_id_fkey, ADD CONSTRAINT node_account_policies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.node_policy_shadow_tallies DROP CONSTRAINT node_policy_shadow_tallies_workspace_id_fkey, ADD CONSTRAINT node_policy_shadow_tallies_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.node_rights_switches DROP CONSTRAINT node_rights_switches_workspace_id_fkey, ADD CONSTRAINT node_rights_switches_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.payment_order_requests DROP CONSTRAINT payment_order_requests_workspace_id_fkey, ADD CONSTRAINT payment_order_requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.payment_orders DROP CONSTRAINT payment_orders_workspace_id_fkey, ADD CONSTRAINT payment_orders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.provider_trigger_dead_events DROP CONSTRAINT provider_trigger_dead_events_connection_id_fkey, ADD CONSTRAINT provider_trigger_dead_events_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.provider_trigger_dead_events DROP CONSTRAINT provider_trigger_dead_events_workspace_id_fkey, ADD CONSTRAINT provider_trigger_dead_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.provider_trigger_switches DROP CONSTRAINT provider_trigger_switches_connection_id_fkey, ADD CONSTRAINT provider_trigger_switches_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.provider_trigger_switches DROP CONSTRAINT provider_trigger_switches_workspace_id_fkey, ADD CONSTRAINT provider_trigger_switches_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.public_api DROP CONSTRAINT public_api_workspace_id_fkey, ADD CONSTRAINT public_api_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.public_document_approvals DROP CONSTRAINT public_document_approvals_workspace_id_fkey, ADD CONSTRAINT public_document_approvals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.public_document_sources DROP CONSTRAINT public_document_sources_workspace_id_fkey, ADD CONSTRAINT public_document_sources_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.public_documents DROP CONSTRAINT public_documents_workspace_id_fkey, ADD CONSTRAINT public_documents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.record_links DROP CONSTRAINT record_links_workspace_id_fkey, ADD CONSTRAINT record_links_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.records DROP CONSTRAINT records_workspace_id_fkey, ADD CONSTRAINT records_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.run_stops DROP CONSTRAINT run_stops_workspace_id_fkey, ADD CONSTRAINT run_stops_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.staff DROP CONSTRAINT staff_workspace_id_fkey, ADD CONSTRAINT staff_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.template_installs DROP CONSTRAINT template_installs_workspace_id_fkey, ADD CONSTRAINT template_installs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.template_licenses DROP CONSTRAINT template_licenses_workspace_id_fkey, ADD CONSTRAINT template_licenses_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.website_sites DROP CONSTRAINT website_sites_workspace_id_fkey, ADD CONSTRAINT website_sites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.work_items DROP CONSTRAINT work_items_workspace_id_fkey, ADD CONSTRAINT work_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.workflow_trigger_picks DROP CONSTRAINT workflow_trigger_picks_connection_id_fkey, ADD CONSTRAINT workflow_trigger_picks_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);
ALTER TABLE public.workflow_trigger_picks DROP CONSTRAINT workflow_trigger_picks_workspace_id_fkey, ADD CONSTRAINT workflow_trigger_picks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.workspace_invites DROP CONSTRAINT workspace_invites_workspace_id_fkey, ADD CONSTRAINT workspace_invites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.workspace_members DROP CONSTRAINT workspace_members_workspace_id_fkey, ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);
ALTER TABLE public.zalo_wizard_drafts DROP CONSTRAINT zalo_wizard_drafts_connection_id_fkey, ADD CONSTRAINT zalo_wizard_drafts_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id);

-- The functions that act on a connection see live rows only. Same signature, language, security and search_path as the baseline, so the
-- existing grants stay.
CREATE OR REPLACE FUNCTION public.agent_connections_same_workspace() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if not exists (select 1 from public.agents a where a.id = new.agent_id and a.workspace_id = new.workspace_id)
     or not exists (select 1 from public.connections c where c.id = new.connection_id and c.workspace_id = new.workspace_id and c.deleted_at is null) then
    raise exception 'agent and connection must belong to the same workspace';
  end if;
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.connection_mark_fed(p_connection uuid, p_at timestamp with time zone, p_first_event jsonb) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
    update public.connections
    set last_event_at = p_at,
        last_error = null,
        updated_at = p_at,
        status = case when status in ('pending', 'error') then 'connected' else status end,
        first_event = coalesce(first_event, p_first_event)
    where id = p_connection and deleted_at is null;
$$;

CREATE OR REPLACE FUNCTION public.zalo_authorization_return(p_state text, p_code text, p_oa_id text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    v_connection uuid;
    v_workspace uuid;
begin
    begin
        v_connection := split_part(p_state, '.', 1)::uuid;
    exception when invalid_text_representation then
        raise exception 'the Zalo authorization state is not valid' using errcode = '23514';
    end;
    select workspace_id into v_workspace from public.connections where id = v_connection and provider = 'zalo_oa' and deleted_at is null;
    if v_workspace is null or not public.is_manager(v_workspace) then
        raise exception 'only an owner or manager of the workspace connects a channel' using errcode = '42501';
    end if;
    perform public.job_enqueue(
        v_workspace,
        'zalo_authorization',
        'complete-zalo-authorization',
        jsonb_build_object('workspaceId', v_workspace, 'state', p_state, 'code', p_code, 'oaId', p_oa_id),
        'zalo-authorization:' || v_connection || ':' || md5(p_state)
    );
    return v_connection;
end $$;

CREATE OR REPLACE FUNCTION public.connection_poll_enroll(p_providers text[], p_interval_ms integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  enrolled integer;
BEGIN
  INSERT INTO public.connection_poll_schedule (connection_id, workspace_id, provider, next_poll_at, interval_ms)
    SELECT c.id, c.workspace_id, c.provider, now() + make_interval(secs => random() * p_interval_ms::double precision / 1000), p_interval_ms
      FROM public.connections c
     WHERE c.provider = ANY(p_providers) AND c.status <> 'disconnected' AND c.deleted_at IS NULL
    ON CONFLICT (connection_id) DO NOTHING;
  GET DIAGNOSTICS enrolled = ROW_COUNT;
  RETURN enrolled;
END;
$$;

CREATE OR REPLACE FUNCTION public.connection_poll_mark_hot(p_connection uuid, p_interval_ms integer, p_ttl_ms double precision, p_reason text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  INSERT INTO public.connection_poll_schedule (connection_id, workspace_id, provider, next_poll_at, interval_ms, hot_until, hot_reason)
    SELECT c.id, c.workspace_id, c.provider, now(), p_interval_ms, now() + make_interval(secs => p_ttl_ms / 1000), p_reason
      FROM public.connections c
     WHERE c.id = p_connection AND c.status <> 'disconnected' AND c.deleted_at IS NULL
    ON CONFLICT (connection_id) DO UPDATE SET
      hot_until = GREATEST(connection_poll_schedule.hot_until, EXCLUDED.hot_until),
      hot_reason = EXCLUDED.hot_reason,
      next_poll_at = CASE
        WHEN connection_poll_schedule.needs_reauth THEN connection_poll_schedule.next_poll_at
        ELSE LEAST(connection_poll_schedule.next_poll_at, now() + make_interval(secs => p_interval_ms::double precision / 1000))
      END;
$$;
