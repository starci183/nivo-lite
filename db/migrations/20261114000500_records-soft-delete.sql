-- records-soft-delete: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the DECOUPLE lane: RESTART-R applies it.
-- Owner order 2026-11-14 ("chi co xoa mem, khong xoa cung"): a record is never hard-deleted by the engine. The entity engine's `delete`
-- now sets `public.records.deleted_at` and bumps `version`; every read leaves a deleted record out; a deleted record holds no unique key
-- and no exclusion range, so its key can be used again. Expand-compatible: the column is nullable, no row changes.
--   1. the column `deleted_at timestamptz NULL` on the partitioned parent (every partition gets it). Who deleted / why: the engine's scope
--      carries no actor of a mutation (only the stamped agent), so no `deleted_by` / `deleted_reason` is invented.
--   2. every UNIQUE index of a record partition (declared uniques and unique constraints; never the primary key) becomes partial on
--      `deleted_at IS NULL`: its predicate, if it had one, is kept and ANDed. These are exactly the statements the entity planner now renders
--      into db/entities.ddl.sql (`LIVE_ONLY` in packages/agent-sdk/src/entity/render-ddl.ts). Written as the explicit statements for the
--      partitions this chain really has (types dropped by earlier migrations included).
--   3. every EXCLUDE constraint of a record partition gets the same predicate.
--   4. the per-type views `v_records_*` read live records only, and so does the one function that reads `public.records` itself
--      (`admin_workspace_stats`: its body is the baseline's with `deleted_at IS NULL` added to its two record reads).
-- The indexes of reads (non-unique) stay as they are: they still serve every read, deleted rows are a small minority. No transaction control.
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- Steps 2-4 as the explicit statements the catalog loop ran on this chain (baseline + every file up to 20261114000400): the migrate
-- verb refuses a dynamic EXECUTE (hfs: "dynamic migration blocks cannot prove database inventory"). Rendered by RESTART-R2 on 2026-11-14 from a
-- copy of dev at 20261114000400: 28 unique indexes, 0 exclusion constraints, 1 view.
DROP INDEX public.records_blocks_core_booking_hours_scope_key;
CREATE UNIQUE INDEX records_blocks_core_booking_hours_scope_key ON public.records_blocks_core_booking_hours USING btree (workspace_id, agent_id, ((data ->> 'scope'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_booking_settings_booking_key;
CREATE UNIQUE INDEX records_blocks_core_booking_settings_booking_key ON public.records_blocks_core_booking_settings USING btree (workspace_id, agent_id, ((data ->> 'key'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_chatbot_chat_channel_external_key;
CREATE UNIQUE INDEX records_blocks_core_chatbot_chat_channel_external_key ON public.records_blocks_core_chatbot_chat USING btree (workspace_id, agent_id, ((data ->> 'channel'::text)), (((data ->> 'connectionId'::text))::uuid), ((data ->> 'externalId'::text))) WHERE ((data ->> 'externalId'::text) IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_chatbot_chat_route_key;
CREATE UNIQUE INDEX records_blocks_core_chatbot_chat_route_key ON public.records_blocks_core_chatbot_chat USING btree (workspace_id, agent_id, (((data ->> 'routeId'::text))::uuid)) WHERE (((data ->> 'routeId'::text))::uuid IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_chatbot_message_channel_ref_key;
CREATE UNIQUE INDEX records_blocks_core_chatbot_message_channel_ref_key ON public.records_blocks_core_chatbot_message USING btree (workspace_id, agent_id, ((data ->> 'channelRef'::text))) WHERE ((data ->> 'channelRef'::text) IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_chatbot_message_one_proposal_key;
CREATE UNIQUE INDEX records_blocks_core_chatbot_message_one_proposal_key ON public.records_blocks_core_chatbot_message USING btree (workspace_id, agent_id, (((data ->> 'conversationId'::text))::uuid)) WHERE ((data ->> 'status'::text) = 'proposed'::text) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_chatbot_message_reply_once_key;
CREATE UNIQUE INDEX records_blocks_core_chatbot_message_reply_once_key ON public.records_blocks_core_chatbot_message USING btree (workspace_id, agent_id, (((data ->> 'conversationId'::text))::uuid), (((data ->> 'inReplyTo'::text))::uuid)) WHERE (((data ->> 'role'::text) = 'agent'::text) AND (((data ->> 'inReplyTo'::text))::uuid IS NOT NULL)) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_chatbot_settings_scope_key;
CREATE UNIQUE INDEX records_blocks_core_chatbot_settings_scope_key ON public.records_blocks_core_chatbot_settings USING btree (workspace_id, agent_id, ((data ->> 'scope'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_content_brand_brand_key;
CREATE UNIQUE INDEX records_blocks_core_content_brand_brand_key ON public.records_blocks_core_content_brand USING btree (workspace_id, agent_id, ((data ->> 'key'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_claim_dedupe_key;
CREATE UNIQUE INDEX records_blocks_core_sales_claim_dedupe_key ON public.records_blocks_core_sales_claim USING btree (workspace_id, agent_id, ((data ->> 'dedupeKey'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_claim_settled_transaction_key;
CREATE UNIQUE INDEX records_blocks_core_sales_claim_settled_transaction_key ON public.records_blocks_core_sales_claim USING btree (workspace_id, agent_id, (((data ->> 'settledTransactionId'::text))::uuid)) WHERE (((data ->> 'settledTransactionId'::text))::uuid IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_invoice_contract_period_key;
CREATE UNIQUE INDEX records_blocks_core_sales_invoice_contract_period_key ON public.records_blocks_core_sales_invoice USING btree (workspace_id, agent_id, (((data ->> 'contractId'::text))::uuid), ((data ->> 'periodEndsOn'::text))) WHERE (((data ->> 'contractId'::text))::uuid IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_invoice_invoice_no_key;
CREATE UNIQUE INDEX records_blocks_core_sales_invoice_invoice_no_key ON public.records_blocks_core_sales_invoice USING btree (workspace_id, agent_id, ((data ->> 'invoiceNo'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_invoice_order_key;
CREATE UNIQUE INDEX records_blocks_core_sales_invoice_order_key ON public.records_blocks_core_sales_invoice USING btree (workspace_id, agent_id, (((data ->> 'orderId'::text))::uuid)) WHERE (((data ->> 'orderId'::text))::uuid IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_lead_contact_key;
CREATE UNIQUE INDEX records_blocks_core_sales_lead_contact_key ON public.records_blocks_core_sales_lead USING btree (workspace_id, agent_id, (((data ->> 'contactId'::text))::uuid)) WHERE (((data ->> 'contactId'::text))::uuid IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_lead_email_key;
CREATE UNIQUE INDEX records_blocks_core_sales_lead_email_key ON public.records_blocks_core_sales_lead USING btree (workspace_id, agent_id, ((data ->> 'email'::text))) WHERE ((data ->> 'email'::text) IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_lead_phone_key;
CREATE UNIQUE INDEX records_blocks_core_sales_lead_phone_key ON public.records_blocks_core_sales_lead USING btree (workspace_id, agent_id, ((data ->> 'phone'::text))) WHERE ((data ->> 'phone'::text) IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_ledger_entry_source_key;
CREATE UNIQUE INDEX records_blocks_core_sales_ledger_entry_source_key ON public.records_blocks_core_sales_ledger_entry USING btree (workspace_id, agent_id, ((data ->> 'sourceEntity'::text)), (((data ->> 'sourceId'::text))::uuid), ((data ->> 'kind'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_ledger_settings_scope_key;
CREATE UNIQUE INDEX records_blocks_core_sales_ledger_settings_scope_key ON public.records_blocks_core_sales_ledger_settings USING btree (workspace_id, agent_id, ((data ->> 'scope'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_loyalty_ledger_entry_ref_key;
CREATE UNIQUE INDEX records_blocks_core_sales_loyalty_ledger_entry_ref_key ON public.records_blocks_core_sales_loyalty_ledger_entry USING btree (workspace_id, agent_id, ((data ->> 'ref'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_loyalty_member_email_key;
CREATE UNIQUE INDEX records_blocks_core_sales_loyalty_member_email_key ON public.records_blocks_core_sales_loyalty_member USING btree (workspace_id, agent_id, ((data ->> 'email'::text))) WHERE ((data ->> 'email'::text) IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_loyalty_member_phone_key;
CREATE UNIQUE INDEX records_blocks_core_sales_loyalty_member_phone_key ON public.records_blocks_core_sales_loyalty_member USING btree (workspace_id, agent_id, ((data ->> 'phone'::text))) WHERE ((data ->> 'phone'::text) IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_loyalty_program_scope_key;
CREATE UNIQUE INDEX records_blocks_core_sales_loyalty_program_scope_key ON public.records_blocks_core_sales_loyalty_program USING btree (workspace_id, agent_id, ((data ->> 'scope'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_loyalty_reward_key_key;
CREATE UNIQUE INDEX records_blocks_core_sales_loyalty_reward_key_key ON public.records_blocks_core_sales_loyalty_reward USING btree (workspace_id, agent_id, ((data ->> 'key'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_order_order_no_key;
CREATE UNIQUE INDEX records_blocks_core_sales_order_order_no_key ON public.records_blocks_core_sales_order USING btree (workspace_id, agent_id, ((data ->> 'orderNo'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_settings_key_key;
CREATE UNIQUE INDEX records_blocks_core_sales_settings_key_key ON public.records_blocks_core_sales_settings USING btree (workspace_id, agent_id, ((data ->> 'key'::text))) WHERE deleted_at IS NULL;
DROP INDEX public.records_blocks_core_sales_transaction_external_ref_key;
CREATE UNIQUE INDEX records_blocks_core_sales_transaction_external_ref_key ON public.records_blocks_core_sales_transaction USING btree (workspace_id, agent_id, ((data ->> 'externalRef'::text))) WHERE ((data ->> 'externalRef'::text) IS NOT NULL) AND deleted_at IS NULL;
DROP INDEX public.records_blocks_core_video_brand_kit_brand_key;
CREATE UNIQUE INDEX records_blocks_core_video_brand_kit_brand_key ON public.records_blocks_core_video_brand_kit USING btree (workspace_id, agent_id, ((data ->> 'key'::text))) WHERE deleted_at IS NULL;
CREATE OR REPLACE VIEW public.v_records_blocks_core_sales_ledger_entry WITH (security_invoker = true) AS  SELECT id,
    workspace_id,
    version,
    created_at,
    updated_at,
    (data ->> 'kind'::text) AS kind,
    (data ->> 'sourceEntity'::text) AS source_entity,
    ((data ->> 'sourceId'::text))::uuid AS source_id,
    ((data ->> 'entryDate'::text))::date AS entry_date,
    ((data ->> 'amountVnd'::text))::bigint AS amount_vnd,
    (data ->> 'note'::text) AS note,
    (data ->> 'counterparty'::text) AS counterparty,
    (data ->> 'status'::text) AS status
   FROM records
  WHERE (entity = 'blocks-core.sales.ledger-entry'::text) AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.admin_workspace_stats() RETURNS TABLE(workspace_id uuid, members integer, last_customer_message_at timestamp with time zone, messages_7d integer, open_decisions integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return query
  select
    w.id,
    (select count(*)::int from public.workspace_members m where m.workspace_id = w.id and m.status = 'active'),
    (select max((r.data ->> 'sentAt')::timestamptz) from public.records r
       where r.entity = 'chat.message' and r.workspace_id = w.id and r.deleted_at is null and r.data ->> 'role' = 'user'),
    (select count(*)::int from public.records r
       where r.entity = 'chat.message' and r.workspace_id = w.id and r.deleted_at is null and r.data ->> 'role' = 'user'
         and (r.data ->> 'sentAt')::timestamptz > now() - interval '7 days'),
    (select count(*)::int from public.work_items wi where wi.workspace_id = w.id and wi.status = 'waiting_decision')
  from public.workspaces w;
end;
$$;
