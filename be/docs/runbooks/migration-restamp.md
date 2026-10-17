# Migration restamp map

The lite conversion renamed every `supabase/migrations` file to kebab-case and re-stamped the 24 migrations dated after 2026-10-12 to sequential stamps (20261012100100 onward, current order kept).

Prod already applied the OLD versions. At cutover, per row where the version changed, run on prod:

```
supabase migration repair --status reverted <old-version>
supabase migration repair --status applied <new-version>
```

Rows where only the name changed need no repair (the version key is the timestamp).

| Old file                                           | New file                                           | Version change                   |
| -------------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| 20260929000000_nivo_prototype.sql                  | 20260929000000_nivo-prototype.sql                  | none                             |
| 20260930120000_nivo_operating_flow.sql             | 20260930120000_nivo-operating-flow.sql             | none                             |
| 20260930180000_telegram_channel.sql                | 20260930180000_telegram-channel.sql                | none                             |
| 20260930190000_conversations_realtime.sql          | 20260930190000_conversations-realtime.sql          | none                             |
| 20260930200000_inbound_event_id.sql                | 20260930200000_inbound-event-id.sql                | none                             |
| 20260930213000_office_staff_messages.sql           | 20260930213000_office-staff-messages.sql           | none                             |
| 20261001100000_workspace_members.sql               | 20261001100000_workspace-members.sql               | none                             |
| 20261001110000_session_rpc.sql                     | 20261001110000_session-rpc.sql                     | none                             |
| 20261001120000_billing.sql                         | 20261001120000_billing.sql                         | none                             |
| 20261001120001_billing_business_type.sql           | 20261001120001_billing-business-type.sql           | none                             |
| 20261001130000_paid_workspace_creation.sql         | 20261001130000_paid-workspace-creation.sql         | none                             |
| 20261002100000_modules.sql                         | 20261002100000_modules.sql                         | none                             |
| 20261002110000_chatbot_message_meta.sql            | 20261002110000_chatbot-message-meta.sql            | none                             |
| 20261002130000_accounting_adjustments.sql          | 20261002130000_accounting-adjustments.sql          | none                             |
| 20261002140000_knowledge.sql                       | 20261002140000_knowledge.sql                       | none                             |
| 20261002141000_knowledge_topics_visibility.sql     | 20261002141000_knowledge-topics-visibility.sql     | none                             |
| 20261002150000_context_notes.sql                   | 20261002150000_context-notes.sql                   | none                             |
| 20261003100000_channel_connections.sql             | 20261003100000_channel-connections.sql             | none                             |
| 20261003110000_connection_environment.sql          | 20261003110000_connection-environment.sql          | none                             |
| 20261004100000_engine_jobs.sql                     | 20261004100000_engine-jobs.sql                     | none                             |
| 20261004110000_engine_followups.sql                | 20261004110000_engine-followups.sql                | none                             |
| 20261005100000_openclaw_agent_sync.sql             | 20261005100000_openclaw-agent-sync.sql             | none                             |
| 20261005100001_usage_metering.sql                  | 20261005100001_usage-metering.sql                  | none                             |
| 20261005110000_zalo_oa.sql                         | 20261005110000_zalo-oa.sql                         | none                             |
| 20261005120000_admin_platform.sql                  | 20261005120000_admin-platform.sql                  | none                             |
| 20261005130000_engine_sweeper_default_openclaw.sql | 20261005130000_engine-sweeper-default-openclaw.sql | none                             |
| 20261005133000_api_providers_keys.sql              | 20261005133000_api-providers-keys.sql              | none                             |
| 20261005134000_automations.sql                     | 20261005134000_automations.sql                     | none                             |
| 20261005140000_email_core.sql                      | 20261005140000_email-core.sql                      | none                             |
| 20261005141000_email_n8n_pipelines.sql             | 20261005141000_email-n8n-pipelines.sql             | none                             |
| 20261005150000_ai_generations.sql                  | 20261005150000_ai-generations.sql                  | none                             |
| 20261005151000_automations_n8n_merge.sql           | 20261005151000_automations-n8n-merge.sql           | none                             |
| 20261006100000_module_registry.sql                 | 20261006100000_module-registry.sql                 | none                             |
| 20261006200000_video_renders_and_media.sql         | 20261006200000_video-renders-and-media.sql         | none                             |
| 20261006300000_perf_session_bootstrap.sql          | 20261006300000_perf-session-bootstrap.sql          | none                             |
| 20261006300100_perf_shell_promo.sql                | 20261006300100_perf-shell-promo.sql                | none                             |
| 20261006300200_perf_api_key_auth.sql               | 20261006300200_perf-api-key-auth.sql               | none                             |
| 20261006300300_perf_page_rpcs.sql                  | 20261006300300_perf-page-rpcs.sql                  | none                             |
| 20261006300400_perf_automations_rpc.sql            | 20261006300400_perf-automations-rpc.sql            | none                             |
| 20261007100000_shifts_core.sql                     | 20261007100000_shifts-core.sql                     | none                             |
| 20261008100000_booking_core.sql                    | 20261008100000_booking-core.sql                    | none                             |
| 20261009100000_video_projects.sql                  | 20261009100000_video-projects.sql                  | none                             |
| 20261010100000_inventory_core.sql                  | 20261010100000_inventory-core.sql                  | none                             |
| 20261011100000_loyalty_core.sql                    | 20261011100000_loyalty-core.sql                    | none                             |
| 20261011100100_loyalty_api_scopes.sql              | 20261011100100_loyalty-api-scopes.sql              | none                             |
| 20261012100000_content_core.sql                    | 20261012100000_content-core.sql                    | none                             |
| 20261013100000_hiring_core.sql                     | 20261012100100_hiring-core.sql                     | 20261013100000 -> 20261012100100 |
| 20261014100000_credit_plans.sql                    | 20261012100200_credit-plans.sql                    | 20261014100000 -> 20261012100200 |
| 20261015100000_guide_usage.sql                     | 20261012100300_guide-usage.sql                     | 20261015100000 -> 20261012100300 |
| 20261016100000_credit_bonus_rollover.sql           | 20261012100400_credit-bonus-rollover.sql           | 20261016100000 -> 20261012100400 |
| 20261017100000_agent_access.sql                    | 20261012100500_agent-access.sql                    | 20261017100000 -> 20261012100500 |
| 20261018100000_data_hub.sql                        | 20261012100600_data-hub.sql                        | 20261018100000 -> 20261012100600 |
| 20261019100000_connector_interest.sql              | 20261012100700_connector-interest.sql              | 20261019100000 -> 20261012100700 |
| 20261020100000_brain.sql                           | 20261012100800_brain.sql                           | 20261020100000 -> 20261012100800 |
| 20261021100000_embedding_model.sql                 | 20261012100900_embedding-model.sql                 | 20261021100000 -> 20261012100900 |
| 20261021110000_brain_extractions.sql               | 20261012101000_brain-extractions.sql               | 20261021110000 -> 20261012101000 |
| 20261021120000_credit_topups.sql                   | 20261012101100_credit-topups.sql                   | 20261021120000 -> 20261012101100 |
| 20261021130000_google_drive_provider.sql           | 20261012101200_google-drive-provider.sql           | 20261021130000 -> 20261012101200 |
| 20261022100000_command_bus.sql                     | 20261012101300_command-bus.sql                     | 20261022100000 -> 20261012101300 |
| 20261022110000_knowledge_gaps.sql                  | 20261012101400_knowledge-gaps.sql                  | 20261022110000 -> 20261012101400 |
| 20261022120000_lead_gen_module.sql                 | 20261012101500_lead-gen-module.sql                 | 20261022120000 -> 20261012101500 |
| 20261022130000_meta_connector.sql                  | 20261012101600_meta-connector.sql                  | 20261022130000 -> 20261012101600 |
| 20261022140000_module_setup_writes.sql             | 20261012101700_module-setup-writes.sql             | 20261022140000 -> 20261012101700 |
| 20261022150000_sales_shipping_contracts.sql        | 20261012101800_sales-shipping-contracts.sql        | 20261022150000 -> 20261012101800 |
| 20261023100000_office_command_candidates.sql       | 20261012101900_office-command-candidates.sql       | 20261023100000 -> 20261012101900 |
| 20261023110000_lead_flow.sql                       | 20261012102000_lead-flow.sql                       | 20261023110000 -> 20261012102000 |
| 20261024100000_multi_instance.sql                  | 20261012102100_multi-instance.sql                  | 20261024100000 -> 20261012102100 |
| 20261025100000_job_outbox.sql                      | 20261012102200_job-outbox.sql                      | 20261025100000 -> 20261012102200 |
| 20261025110000_pgmq_transport.sql                  | 20261012102300_pgmq-transport.sql                  | 20261025110000 -> 20261012102300 |
| 20261025120000_enqueue_installation.sql            | 20261012102400_enqueue-installation.sql            | 20261025120000 -> 20261012102400 |

## Added by the conversion

`supabase/migrations/_archive/20261012102500_be-platform.sql` is new (the app_be role, public.queue, public.jobs). It is idempotent, so a database that already holds those objects accepts it. Apply it on prod with `supabase db push` after the repair above; set the `app_be` password once with `alter role app_be password ...` (never in a migration).

A local dev stack started before the conversion holds the OLD versions in `supabase_migrations.schema_migrations`; run the same repair there or `supabase db reset`.

## Order of the baseline pair and the forward migrations

The cutover branch carries four migrations: `supabase/migrations/_archive/20261013142504_lite-baseline.sql`, `supabase/migrations/_archive/20261013142505_lite-baseline-standard.sql`, `supabase/migrations/_archive/20261020110000_drop-engine-schema.sql` and `supabase/migrations/_archive/20261020110100_job-ops-functions.sql`. The forward pair was re-stamped to 2026-10-15, with `drop-engine-schema` still sorting before `job-ops-functions`. The cutover push applies `baseline-standard` and `job-ops-functions`; `drop-engine-schema` stays held back until 48 h after a green smoke or the owner's confirmation that the old app is gone, then the post-cutover script applies it with `--include-all`. The drop is idempotent and a no-op on a database that never had the engine schema.

The baseline pair remains unchanged; its failure to sort after every migration on `origin/main` is an outstanding integration issue. The prescribed October 15 forward stamps also precede the current `origin/main` maximum (`20261020100000`), so all four active migrations still need an integration decision on base ordering. The previous proposed baseline range after `20261020100000` cannot precede the current drop stamp `20261020110000`. Any later baseline re-stamp must coordinate the forward stamps as well, keep all stamps no later than their commit times, and preserve **baseline < baseline-standard < drop-engine-schema < job-ops-functions**. Otherwise the drop could run before the baseline on a fresh database and the baseline would recreate the engine tables. Regenerate the types with `npm run contract:emit` after any baseline re-stamp so the stamp digest follows.
