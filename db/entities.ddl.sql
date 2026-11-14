-- GENERATED from the record type declarations (packages' defineRecordType / defineEntity) by `npm run records:ddl`; do not edit.
-- The DDL a fresh database gets for the partitions of public.records: the planner's steps against a fresh catalog, entities in
-- name order. Checked by `npm run records:check` (project check `record-ddl`). Not a migration: the build window's baseline carries it.
-- Record types: 32.

-- create_extension extension:pg_trgm: trigram indexes on searchable text (allowlisted, R259)
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;

-- create_partition public.records_blocks_core_booking_booking: records for values in ('blocks-core.booking.booking')
CREATE TABLE public."records_blocks_core_booking_booking" PARTITION OF public.records FOR VALUES IN ('blocks-core.booking.booking');

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_customer_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_customer_name_chk" CHECK ((data->>'customerName') IS NOT NULL AND (jsonb_typeof(data->'customerName') = 'string' AND char_length((data->>'customerName')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_customer_name_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_customer_phone_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_customer_phone_chk" CHECK ((data->>'customerPhone') IS NULL OR (jsonb_typeof(data->'customerPhone') = 'string' AND char_length((data->>'customerPhone')) <= 40)) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_customer_phone_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_customer_email_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_customer_email_chk" CHECK ((data->>'customerEmail') IS NULL OR (jsonb_typeof(data->'customerEmail') = 'string' AND char_length((data->>'customerEmail')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_customer_email_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_contact_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_contact_id_chk" CHECK ((data->>'contactId') IS NULL OR ((data->>'contactId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_contact_id_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_conversation_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_conversation_id_chk" CHECK ((data->>'conversationId') IS NULL OR (jsonb_typeof(data->'conversationId') = 'string' AND char_length((data->>'conversationId')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_conversation_id_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_service_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_service_id_chk" CHECK ((data->>'serviceId') IS NOT NULL AND ((data->>'serviceId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_service_id_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_resource_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_resource_id_chk" CHECK ((data->>'resourceId') IS NOT NULL AND ((data->>'resourceId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_resource_id_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_start_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_start_at_chk" CHECK ((data->>'startAt') IS NOT NULL AND ((data->>'startAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_start_at_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_end_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_end_at_chk" CHECK ((data->>'endAt') IS NOT NULL AND ((data->>'endAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_end_at_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_block_end_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_block_end_at_chk" CHECK ((data->>'blockEndAt') IS NOT NULL AND ((data->>'blockEndAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_block_end_at_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_party_size_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_party_size_chk" CHECK ((data->>'partySize') IS NOT NULL AND (jsonb_typeof(data->'partySize') = 'number' AND (data->>'partySize') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_party_size_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('requested', 'confirmed', 'cancelled', 'done'))) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_status_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_note_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_note_chk" CHECK ((data->>'note') IS NOT NULL AND (jsonb_typeof(data->'note') = 'string' AND char_length((data->>'note')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_note_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_reminded_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_reminded_at_chk" CHECK ((data->>'remindedAt') IS NULL OR ((data->>'remindedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_reminded_at_chk";

-- add_check public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_booking_booking:constraint:records_blocks_core_booking_booking_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_booking" ADD CONSTRAINT "records_blocks_core_booking_booking_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_booking_booking" VALIDATE CONSTRAINT "records_blocks_core_booking_booking_agent_fk";

-- create_index public.records_blocks_core_booking_booking:index:records_blocks_core_booking_booking_start: on workspace_id, data->>'startat', id using btree
CREATE INDEX "records_blocks_core_booking_booking_start" ON public."records_blocks_core_booking_booking" USING btree (workspace_id, (data->>'startAt'), id);

-- create_index public.records_blocks_core_booking_booking:index:records_blocks_core_booking_booking_status_start: on workspace_id, data->>'status', data->>'startat', id using btree
CREATE INDEX "records_blocks_core_booking_booking_status_start" ON public."records_blocks_core_booking_booking" USING btree (workspace_id, (data->>'status'), (data->>'startAt'), id);

-- create_index public.records_blocks_core_booking_booking:index:records_blocks_core_booking_booking_contact_start: on workspace_id, data->>'contactid', data->>'startat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_booking_booking_contact_start" ON public."records_blocks_core_booking_booking" USING btree (workspace_id, ((data->>'contactId')::uuid), (data->>'startAt') DESC, id DESC);

-- create_index public.records_blocks_core_booking_booking:index:records_blocks_core_booking_booking_customer_name_trgm_idx: on knowledge_folddata->>'customername' using gin
CREATE INDEX "records_blocks_core_booking_booking_customer_name_trgm_idx" ON public."records_blocks_core_booking_booking" USING gin (public.knowledge_fold((data->>'customerName')) extensions.gin_trgm_ops);

-- create_index public.records_blocks_core_booking_booking:index:records_blocks_core_booking_booking_contact_id_contact_idx: on workspace_id, data->>'contactid' using btree
CREATE INDEX "records_blocks_core_booking_booking_contact_id_contact_idx" ON public."records_blocks_core_booking_booking" USING btree (workspace_id, ((data->>'contactId')::uuid));

-- create_partition public.records_blocks_core_booking_hours: records for values in ('blocks-core.booking.hours')
CREATE TABLE public."records_blocks_core_booking_hours" PARTITION OF public.records FOR VALUES IN ('blocks-core.booking.hours');

-- add_check public.records_blocks_core_booking_hours:constraint:records_blocks_core_booking_hours_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_hours" ADD CONSTRAINT "records_blocks_core_booking_hours_scope_chk" CHECK ((data->>'scope') IS NOT NULL AND (jsonb_typeof(data->'scope') = 'string' AND char_length((data->>'scope')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_hours" VALIDATE CONSTRAINT "records_blocks_core_booking_hours_scope_chk";

-- add_check public.records_blocks_core_booking_hours:constraint:records_blocks_core_booking_hours_resource_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_hours" ADD CONSTRAINT "records_blocks_core_booking_hours_resource_id_chk" CHECK ((data->>'resourceId') IS NULL OR ((data->>'resourceId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_hours" VALIDATE CONSTRAINT "records_blocks_core_booking_hours_resource_id_chk";

-- add_check public.records_blocks_core_booking_hours:constraint:records_blocks_core_booking_hours_calendar_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_hours" ADD CONSTRAINT "records_blocks_core_booking_hours_calendar_chk" CHECK ((data->>'calendar') IS NOT NULL AND (jsonb_typeof(data->'calendar') = 'object')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_hours" VALIDATE CONSTRAINT "records_blocks_core_booking_hours_calendar_chk";

-- add_check public.records_blocks_core_booking_hours:constraint:records_blocks_core_booking_hours_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_hours" ADD CONSTRAINT "records_blocks_core_booking_hours_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_hours" VALIDATE CONSTRAINT "records_blocks_core_booking_hours_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_booking_hours:constraint:records_blocks_core_booking_hours_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_hours" ADD CONSTRAINT "records_blocks_core_booking_hours_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_booking_hours" VALIDATE CONSTRAINT "records_blocks_core_booking_hours_agent_fk";

-- create_index public.records_blocks_core_booking_hours:index:records_blocks_core_booking_hours_scope: on workspace_id, data->>'scope', id using btree
CREATE INDEX "records_blocks_core_booking_hours_scope" ON public."records_blocks_core_booking_hours" USING btree (workspace_id, (data->>'scope'), id);

-- add_unique public.records_blocks_core_booking_hours:index:records_blocks_core_booking_hours_scope_key: on workspace_id, agent_id, data->>'scope' using btree
CREATE UNIQUE INDEX "records_blocks_core_booking_hours_scope_key" ON public."records_blocks_core_booking_hours" USING btree (workspace_id, agent_id, (data->>'scope')) WHERE deleted_at IS NULL;

-- create_partition public.records_blocks_core_booking_resource: records for values in ('blocks-core.booking.resource')
CREATE TABLE public."records_blocks_core_booking_resource" PARTITION OF public.records FOR VALUES IN ('blocks-core.booking.resource');

-- add_check public.records_blocks_core_booking_resource:constraint:records_blocks_core_booking_resource_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_resource" ADD CONSTRAINT "records_blocks_core_booking_resource_name_chk" CHECK ((data->>'name') IS NOT NULL AND (jsonb_typeof(data->'name') = 'string' AND char_length((data->>'name')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_resource" VALIDATE CONSTRAINT "records_blocks_core_booking_resource_name_chk";

-- add_check public.records_blocks_core_booking_resource:constraint:records_blocks_core_booking_resource_kind_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_resource" ADD CONSTRAINT "records_blocks_core_booking_resource_kind_chk" CHECK ((data->>'kind') IS NOT NULL AND ((data->>'kind') IN ('person', 'room'))) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_resource" VALIDATE CONSTRAINT "records_blocks_core_booking_resource_kind_chk";

-- add_check public.records_blocks_core_booking_resource:constraint:records_blocks_core_booking_resource_staff_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_resource" ADD CONSTRAINT "records_blocks_core_booking_resource_staff_id_chk" CHECK ((data->>'staffId') IS NULL OR ((data->>'staffId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_resource" VALIDATE CONSTRAINT "records_blocks_core_booking_resource_staff_id_chk";

-- add_check public.records_blocks_core_booking_resource:constraint:records_blocks_core_booking_resource_capacity_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_resource" ADD CONSTRAINT "records_blocks_core_booking_resource_capacity_chk" CHECK ((data->>'capacity') IS NOT NULL AND (jsonb_typeof(data->'capacity') = 'number' AND (data->>'capacity') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_resource" VALIDATE CONSTRAINT "records_blocks_core_booking_resource_capacity_chk";

-- add_check public.records_blocks_core_booking_resource:constraint:records_blocks_core_booking_resource_active_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_resource" ADD CONSTRAINT "records_blocks_core_booking_resource_active_chk" CHECK ((data->>'active') IS NOT NULL AND (jsonb_typeof(data->'active') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_resource" VALIDATE CONSTRAINT "records_blocks_core_booking_resource_active_chk";

-- add_check public.records_blocks_core_booking_resource:constraint:records_blocks_core_booking_resource_sort_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_resource" ADD CONSTRAINT "records_blocks_core_booking_resource_sort_chk" CHECK ((data->>'sort') IS NOT NULL AND (jsonb_typeof(data->'sort') = 'number' AND (data->>'sort') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_resource" VALIDATE CONSTRAINT "records_blocks_core_booking_resource_sort_chk";

-- add_check public.records_blocks_core_booking_resource:constraint:records_blocks_core_booking_resource_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_resource" ADD CONSTRAINT "records_blocks_core_booking_resource_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_resource" VALIDATE CONSTRAINT "records_blocks_core_booking_resource_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_booking_resource:constraint:records_blocks_core_booking_resource_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_resource" ADD CONSTRAINT "records_blocks_core_booking_resource_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_booking_resource" VALIDATE CONSTRAINT "records_blocks_core_booking_resource_agent_fk";

-- create_index public.records_blocks_core_booking_resource:index:records_blocks_core_booking_resource_sort: on workspace_id, data->>'sort', id using btree
CREATE INDEX "records_blocks_core_booking_resource_sort" ON public."records_blocks_core_booking_resource" USING btree (workspace_id, ((data->>'sort')::integer), id);

-- create_index public.records_blocks_core_booking_resource:index:records_blocks_core_booking_resource_active_sort: on workspace_id, data->>'active', data->>'sort', id using btree
CREATE INDEX "records_blocks_core_booking_resource_active_sort" ON public."records_blocks_core_booking_resource" USING btree (workspace_id, ((data->>'active')::boolean), ((data->>'sort')::integer), id);

-- create_index public.records_blocks_core_booking_resource:index:records_blocks_core_booking_resource_name_trgm_idx: on knowledge_folddata->>'name' using gin
CREATE INDEX "records_blocks_core_booking_resource_name_trgm_idx" ON public."records_blocks_core_booking_resource" USING gin (public.knowledge_fold((data->>'name')) extensions.gin_trgm_ops);

-- create_partition public.records_blocks_core_booking_service: records for values in ('blocks-core.booking.service')
CREATE TABLE public."records_blocks_core_booking_service" PARTITION OF public.records FOR VALUES IN ('blocks-core.booking.service');

-- add_check public.records_blocks_core_booking_service:constraint:records_blocks_core_booking_service_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_service" ADD CONSTRAINT "records_blocks_core_booking_service_name_chk" CHECK ((data->>'name') IS NOT NULL AND (jsonb_typeof(data->'name') = 'string' AND char_length((data->>'name')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_service" VALIDATE CONSTRAINT "records_blocks_core_booking_service_name_chk";

-- add_check public.records_blocks_core_booking_service:constraint:records_blocks_core_booking_service_duration_min_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_service" ADD CONSTRAINT "records_blocks_core_booking_service_duration_min_chk" CHECK ((data->>'durationMin') IS NOT NULL AND (jsonb_typeof(data->'durationMin') = 'number' AND (data->>'durationMin') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_service" VALIDATE CONSTRAINT "records_blocks_core_booking_service_duration_min_chk";

-- add_check public.records_blocks_core_booking_service:constraint:records_blocks_core_booking_service_buffer_min_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_service" ADD CONSTRAINT "records_blocks_core_booking_service_buffer_min_chk" CHECK ((data->>'bufferMin') IS NOT NULL AND (jsonb_typeof(data->'bufferMin') = 'number' AND (data->>'bufferMin') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_service" VALIDATE CONSTRAINT "records_blocks_core_booking_service_buffer_min_chk";

-- add_check public.records_blocks_core_booking_service:constraint:records_blocks_core_booking_service_price_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_service" ADD CONSTRAINT "records_blocks_core_booking_service_price_vnd_chk" CHECK ((data->>'priceVnd') IS NOT NULL AND (jsonb_typeof(data->'priceVnd') = 'number' AND (data->>'priceVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_service" VALIDATE CONSTRAINT "records_blocks_core_booking_service_price_vnd_chk";

-- add_check public.records_blocks_core_booking_service:constraint:records_blocks_core_booking_service_resource_kind_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_service" ADD CONSTRAINT "records_blocks_core_booking_service_resource_kind_chk" CHECK ((data->>'resourceKind') IS NULL OR ((data->>'resourceKind') IN ('person', 'room'))) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_service" VALIDATE CONSTRAINT "records_blocks_core_booking_service_resource_kind_chk";

-- add_check public.records_blocks_core_booking_service:constraint:records_blocks_core_booking_service_active_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_service" ADD CONSTRAINT "records_blocks_core_booking_service_active_chk" CHECK ((data->>'active') IS NOT NULL AND (jsonb_typeof(data->'active') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_service" VALIDATE CONSTRAINT "records_blocks_core_booking_service_active_chk";

-- add_check public.records_blocks_core_booking_service:constraint:records_blocks_core_booking_service_note_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_service" ADD CONSTRAINT "records_blocks_core_booking_service_note_chk" CHECK ((data->>'note') IS NOT NULL AND (jsonb_typeof(data->'note') = 'string' AND char_length((data->>'note')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_service" VALIDATE CONSTRAINT "records_blocks_core_booking_service_note_chk";

-- add_check public.records_blocks_core_booking_service:constraint:records_blocks_core_booking_service_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_service" ADD CONSTRAINT "records_blocks_core_booking_service_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_service" VALIDATE CONSTRAINT "records_blocks_core_booking_service_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_booking_service:constraint:records_blocks_core_booking_service_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_service" ADD CONSTRAINT "records_blocks_core_booking_service_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_booking_service" VALIDATE CONSTRAINT "records_blocks_core_booking_service_agent_fk";

-- create_index public.records_blocks_core_booking_service:index:records_blocks_core_booking_service_name: on workspace_id, data->>'name', id using btree
CREATE INDEX "records_blocks_core_booking_service_name" ON public."records_blocks_core_booking_service" USING btree (workspace_id, (data->>'name'), id);

-- create_index public.records_blocks_core_booking_service:index:records_blocks_core_booking_service_active_name: on workspace_id, data->>'active', data->>'name', id using btree
CREATE INDEX "records_blocks_core_booking_service_active_name" ON public."records_blocks_core_booking_service" USING btree (workspace_id, ((data->>'active')::boolean), (data->>'name'), id);

-- create_index public.records_blocks_core_booking_service:index:records_blocks_core_booking_service_name_trgm_idx: on knowledge_folddata->>'name' using gin
CREATE INDEX "records_blocks_core_booking_service_name_trgm_idx" ON public."records_blocks_core_booking_service" USING gin (public.knowledge_fold((data->>'name')) extensions.gin_trgm_ops);

-- create_partition public.records_blocks_core_booking_settings: records for values in ('blocks-core.booking.settings')
CREATE TABLE public."records_blocks_core_booking_settings" PARTITION OF public.records FOR VALUES IN ('blocks-core.booking.settings');

-- add_check public.records_blocks_core_booking_settings:constraint:records_blocks_core_booking_settings_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_settings" ADD CONSTRAINT "records_blocks_core_booking_settings_key_chk" CHECK ((data->>'key') IS NOT NULL AND ((data->>'key') IN ('booking'))) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_settings" VALIDATE CONSTRAINT "records_blocks_core_booking_settings_key_chk";

-- add_check public.records_blocks_core_booking_settings:constraint:records_blocks_core_booking_settings_slot_step_min_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_settings" ADD CONSTRAINT "records_blocks_core_booking_settings_slot_step_min_chk" CHECK ((data->>'slotStepMin') IS NOT NULL AND (jsonb_typeof(data->'slotStepMin') = 'number' AND (data->>'slotStepMin') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_settings" VALIDATE CONSTRAINT "records_blocks_core_booking_settings_slot_step_min_chk";

-- add_check public.records_blocks_core_booking_settings:constraint:records_blocks_core_booking_settings_min_lead_min_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_settings" ADD CONSTRAINT "records_blocks_core_booking_settings_min_lead_min_chk" CHECK ((data->>'minLeadMin') IS NOT NULL AND (jsonb_typeof(data->'minLeadMin') = 'number' AND (data->>'minLeadMin') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_settings" VALIDATE CONSTRAINT "records_blocks_core_booking_settings_min_lead_min_chk";

-- add_check public.records_blocks_core_booking_settings:constraint:records_blocks_core_booking_settings_max_advance_days_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_settings" ADD CONSTRAINT "records_blocks_core_booking_settings_max_advance_days_chk" CHECK ((data->>'maxAdvanceDays') IS NOT NULL AND (jsonb_typeof(data->'maxAdvanceDays') = 'number' AND (data->>'maxAdvanceDays') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_settings" VALIDATE CONSTRAINT "records_blocks_core_booking_settings_max_advance_days_chk";

-- add_check public.records_blocks_core_booking_settings:constraint:records_blocks_core_booking_settings_remind_hours_before_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_settings" ADD CONSTRAINT "records_blocks_core_booking_settings_remind_hours_before_chk" CHECK ((data->>'remindHoursBefore') IS NOT NULL AND (jsonb_typeof(data->'remindHoursBefore') = 'number' AND (data->>'remindHoursBefore') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_settings" VALIDATE CONSTRAINT "records_blocks_core_booking_settings_remind_hours_before_chk";

-- add_check public.records_blocks_core_booking_settings:constraint:records_blocks_core_booking_settings_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_settings" ADD CONSTRAINT "records_blocks_core_booking_settings_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_booking_settings" VALIDATE CONSTRAINT "records_blocks_core_booking_settings_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_booking_settings:constraint:records_blocks_core_booking_settings_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_booking_settings" ADD CONSTRAINT "records_blocks_core_booking_settings_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_booking_settings" VALIDATE CONSTRAINT "records_blocks_core_booking_settings_agent_fk";

-- create_index public.records_blocks_core_booking_settings:index:records_blocks_core_booking_settings_key: on workspace_id, data->>'key', id using btree
CREATE INDEX "records_blocks_core_booking_settings_key" ON public."records_blocks_core_booking_settings" USING btree (workspace_id, (data->>'key'), id);

-- add_unique public.records_blocks_core_booking_settings:index:records_blocks_core_booking_settings_booking_key: on workspace_id, agent_id, data->>'key' using btree
CREATE UNIQUE INDEX "records_blocks_core_booking_settings_booking_key" ON public."records_blocks_core_booking_settings" USING btree (workspace_id, agent_id, (data->>'key')) WHERE deleted_at IS NULL;

-- create_partition public.records_blocks_core_chatbot_chat: records for values in ('blocks-core.chatbot.chat')
CREATE TABLE public."records_blocks_core_chatbot_chat" PARTITION OF public.records FOR VALUES IN ('blocks-core.chatbot.chat');

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_channel_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_channel_chk" CHECK ((data->>'channel') IS NOT NULL AND ((data->>'channel') IN ('telegram', 'zalo', 'facebook', 'instagram', 'website'))) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_channel_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_contact_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_contact_id_chk" CHECK ((data->>'contactId') IS NULL OR ((data->>'contactId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_contact_id_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_route_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_route_id_chk" CHECK ((data->>'routeId') IS NULL OR ((data->>'routeId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_route_id_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_name_chk" CHECK ((data->>'name') IS NOT NULL AND (jsonb_typeof(data->'name') = 'string' AND char_length((data->>'name')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_name_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('ai', 'needs'))) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_status_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_waiting_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_waiting_chk" CHECK ((data->>'waiting') IS NOT NULL AND (jsonb_typeof(data->'waiting') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_waiting_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_unanswered_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_unanswered_chk" CHECK ((data->>'unanswered') IS NOT NULL AND (jsonb_typeof(data->'unanswered') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_unanswered_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_last_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_last_at_chk" CHECK ((data->>'lastAt') IS NULL OR ((data->>'lastAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_last_at_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_avatar_url_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_avatar_url_chk" CHECK ((data->>'avatarUrl') IS NULL OR (jsonb_typeof(data->'avatarUrl') = 'string' AND char_length((data->>'avatarUrl')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_avatar_url_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_profile_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_profile_at_chk" CHECK ((data->>'profileAt') IS NULL OR ((data->>'profileAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_profile_at_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_profile_tried_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_profile_tried_at_chk" CHECK ((data->>'profileTriedAt') IS NULL OR ((data->>'profileTriedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_profile_tried_at_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_started_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_started_at_chk" CHECK ((data->>'startedAt') IS NOT NULL AND ((data->>'startedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_started_at_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_archived_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_archived_at_chk" CHECK ((data->>'archivedAt') IS NULL OR ((data->>'archivedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_archived_at_chk";

-- add_check public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_chatbot_chat:constraint:records_blocks_core_chatbot_chat_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_chat" ADD CONSTRAINT "records_blocks_core_chatbot_chat_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_chat" VALIDATE CONSTRAINT "records_blocks_core_chatbot_chat_agent_fk";

-- create_index public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_key: on workspace_id, id using btree
CREATE INDEX "records_blocks_core_chatbot_chat_key" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, id);

-- create_index public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_route: on workspace_id, data->>'routeid', id using btree
CREATE INDEX "records_blocks_core_chatbot_chat_route" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, ((data->>'routeId')::uuid), id);

-- create_index public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_recent: on workspace_id, data->>'lastat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_chatbot_chat_recent" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, (data->>'lastAt') DESC, id DESC);

-- create_index public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_contact_created: on workspace_id, data->>'contactid', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_chatbot_chat_contact_created" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, ((data->>'contactId')::uuid), created_at DESC, id DESC);

-- create_index public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_contact_recent: on workspace_id, data->>'contactid', data->>'lastat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_chatbot_chat_contact_recent" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, ((data->>'contactId')::uuid), (data->>'lastAt') DESC, id DESC);

-- create_index public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_channel_recent: on workspace_id, data->>'channel', data->>'lastat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_chatbot_chat_channel_recent" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, (data->>'channel'), (data->>'lastAt') DESC, id DESC);

-- create_index public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_status_recent: on workspace_id, data->>'status', data->>'lastat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_chatbot_chat_status_recent" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, (data->>'status'), (data->>'lastAt') DESC, id DESC);

-- create_index public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_status_channel_recent: on workspace_id, data->>'status', data->>'channel', data->>'lastat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_chatbot_chat_status_channel_recent" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, (data->>'status'), (data->>'channel'), (data->>'lastAt') DESC, id DESC);

-- add_unique public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_route_key: on workspace_id, agent_id, data->>'routeid' using btree
CREATE UNIQUE INDEX "records_blocks_core_chatbot_chat_route_key" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, agent_id, ((data->>'routeId')::uuid)) WHERE ((((data->>'routeId')::uuid) IS NOT NULL AND (data->>'archivedAt') IS NULL)) AND deleted_at IS NULL;

-- create_index public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_contact_id_contact_idx: on workspace_id, data->>'contactid' using btree
CREATE INDEX "records_blocks_core_chatbot_chat_contact_id_contact_idx" ON public."records_blocks_core_chatbot_chat" USING btree (workspace_id, ((data->>'contactId')::uuid));

-- create_index public.records_blocks_core_chatbot_chat:index:records_blocks_core_chatbot_chat_name_trgm_idx: on knowledge_folddata->>'name' using gin
CREATE INDEX "records_blocks_core_chatbot_chat_name_trgm_idx" ON public."records_blocks_core_chatbot_chat" USING gin (public.knowledge_fold((data->>'name')) extensions.gin_trgm_ops);

-- create_partition public.records_blocks_core_chatbot_note: records for values in ('blocks-core.chatbot.note')
CREATE TABLE public."records_blocks_core_chatbot_note" PARTITION OF public.records FOR VALUES IN ('blocks-core.chatbot.note');

-- add_check public.records_blocks_core_chatbot_note:constraint:records_blocks_core_chatbot_note_conversation_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_note" ADD CONSTRAINT "records_blocks_core_chatbot_note_conversation_id_chk" CHECK ((data->>'conversationId') IS NOT NULL AND ((data->>'conversationId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_note" VALIDATE CONSTRAINT "records_blocks_core_chatbot_note_conversation_id_chk";

-- add_check public.records_blocks_core_chatbot_note:constraint:records_blocks_core_chatbot_note_kind_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_note" ADD CONSTRAINT "records_blocks_core_chatbot_note_kind_chk" CHECK ((data->>'kind') IS NOT NULL AND ((data->>'kind') IN ('taken', 'released'))) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_note" VALIDATE CONSTRAINT "records_blocks_core_chatbot_note_kind_chk";

-- add_check public.records_blocks_core_chatbot_note:constraint:records_blocks_core_chatbot_note_text_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_note" ADD CONSTRAINT "records_blocks_core_chatbot_note_text_chk" CHECK ((data->>'text') IS NOT NULL AND (jsonb_typeof(data->'text') = 'string' AND char_length((data->>'text')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_note" VALIDATE CONSTRAINT "records_blocks_core_chatbot_note_text_chk";

-- add_check public.records_blocks_core_chatbot_note:constraint:records_blocks_core_chatbot_note_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_note" ADD CONSTRAINT "records_blocks_core_chatbot_note_at_chk" CHECK ((data->>'at') IS NOT NULL AND ((data->>'at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_note" VALIDATE CONSTRAINT "records_blocks_core_chatbot_note_at_chk";

-- add_check public.records_blocks_core_chatbot_note:constraint:records_blocks_core_chatbot_note_member_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_note" ADD CONSTRAINT "records_blocks_core_chatbot_note_member_id_chk" CHECK ((data->>'memberId') IS NULL OR ((data->>'memberId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_note" VALIDATE CONSTRAINT "records_blocks_core_chatbot_note_member_id_chk";

-- add_check public.records_blocks_core_chatbot_note:constraint:records_blocks_core_chatbot_note_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_note" ADD CONSTRAINT "records_blocks_core_chatbot_note_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_note" VALIDATE CONSTRAINT "records_blocks_core_chatbot_note_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_chatbot_note:constraint:records_blocks_core_chatbot_note_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_note" ADD CONSTRAINT "records_blocks_core_chatbot_note_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_note" VALIDATE CONSTRAINT "records_blocks_core_chatbot_note_agent_fk";

-- create_index public.records_blocks_core_chatbot_note:index:records_blocks_core_chatbot_note_conversation_at: on workspace_id, data->>'conversationid', data->>'at'desc, iddesc using btree
CREATE INDEX "records_blocks_core_chatbot_note_conversation_at" ON public."records_blocks_core_chatbot_note" USING btree (workspace_id, ((data->>'conversationId')::uuid), (data->>'at') DESC, id DESC);

-- create_partition public.records_blocks_core_chatbot_reply: records for values in ('blocks-core.chatbot.reply')
CREATE TABLE public."records_blocks_core_chatbot_reply" PARTITION OF public.records FOR VALUES IN ('blocks-core.chatbot.reply');

-- add_check public.records_blocks_core_chatbot_reply:constraint:records_blocks_core_chatbot_reply_conversation_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_reply" ADD CONSTRAINT "records_blocks_core_chatbot_reply_conversation_id_chk" CHECK ((data->>'conversationId') IS NOT NULL AND ((data->>'conversationId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_reply" VALIDATE CONSTRAINT "records_blocks_core_chatbot_reply_conversation_id_chk";

-- add_check public.records_blocks_core_chatbot_reply:constraint:records_blocks_core_chatbot_reply_text_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_reply" ADD CONSTRAINT "records_blocks_core_chatbot_reply_text_chk" CHECK ((data->>'text') IS NOT NULL AND (jsonb_typeof(data->'text') = 'string' AND char_length((data->>'text')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_reply" VALIDATE CONSTRAINT "records_blocks_core_chatbot_reply_text_chk";

-- add_check public.records_blocks_core_chatbot_reply:constraint:records_blocks_core_chatbot_reply_member_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_reply" ADD CONSTRAINT "records_blocks_core_chatbot_reply_member_id_chk" CHECK ((data->>'memberId') IS NOT NULL AND ((data->>'memberId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_reply" VALIDATE CONSTRAINT "records_blocks_core_chatbot_reply_member_id_chk";

-- add_check public.records_blocks_core_chatbot_reply:constraint:records_blocks_core_chatbot_reply_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_reply" ADD CONSTRAINT "records_blocks_core_chatbot_reply_key_chk" CHECK ((data->>'key') IS NOT NULL AND ((data->>'key') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_reply" VALIDATE CONSTRAINT "records_blocks_core_chatbot_reply_key_chk";

-- add_check public.records_blocks_core_chatbot_reply:constraint:records_blocks_core_chatbot_reply_handed_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_reply" ADD CONSTRAINT "records_blocks_core_chatbot_reply_handed_at_chk" CHECK ((data->>'handedAt') IS NULL OR ((data->>'handedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_reply" VALIDATE CONSTRAINT "records_blocks_core_chatbot_reply_handed_at_chk";

-- add_check public.records_blocks_core_chatbot_reply:constraint:records_blocks_core_chatbot_reply_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_reply" ADD CONSTRAINT "records_blocks_core_chatbot_reply_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_reply" VALIDATE CONSTRAINT "records_blocks_core_chatbot_reply_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_chatbot_reply:constraint:records_blocks_core_chatbot_reply_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_reply" ADD CONSTRAINT "records_blocks_core_chatbot_reply_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_reply" VALIDATE CONSTRAINT "records_blocks_core_chatbot_reply_agent_fk";

-- create_index public.records_blocks_core_chatbot_reply:index:records_blocks_core_chatbot_reply_conversation: on workspace_id, data->>'conversationid', id using btree
CREATE INDEX "records_blocks_core_chatbot_reply_conversation" ON public."records_blocks_core_chatbot_reply" USING btree (workspace_id, ((data->>'conversationId')::uuid), id);

-- add_unique public.records_blocks_core_chatbot_reply:index:records_blocks_core_chatbot_reply_send_key: on workspace_id, agent_id, data->>'key' using btree
CREATE UNIQUE INDEX "records_blocks_core_chatbot_reply_send_key" ON public."records_blocks_core_chatbot_reply" USING btree (workspace_id, agent_id, ((data->>'key')::uuid)) WHERE deleted_at IS NULL;

-- create_partition public.records_blocks_core_chatbot_settings: records for values in ('blocks-core.chatbot.settings')
CREATE TABLE public."records_blocks_core_chatbot_settings" PARTITION OF public.records FOR VALUES IN ('blocks-core.chatbot.settings');

-- add_check public.records_blocks_core_chatbot_settings:constraint:records_blocks_core_chatbot_settings_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_settings" ADD CONSTRAINT "records_blocks_core_chatbot_settings_scope_chk" CHECK ((data->>'scope') IS NOT NULL AND (jsonb_typeof(data->'scope') = 'string' AND char_length((data->>'scope')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_settings" VALIDATE CONSTRAINT "records_blocks_core_chatbot_settings_scope_chk";

-- add_check public.records_blocks_core_chatbot_settings:constraint:records_blocks_core_chatbot_settings_holding_message_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_settings" ADD CONSTRAINT "records_blocks_core_chatbot_settings_holding_message_chk" CHECK ((data->>'holdingMessage') IS NOT NULL AND (jsonb_typeof(data->'holdingMessage') = 'string' AND char_length((data->>'holdingMessage')) <= 400)) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_settings" VALIDATE CONSTRAINT "records_blocks_core_chatbot_settings_holding_message_chk";

-- add_check public.records_blocks_core_chatbot_settings:constraint:records_blocks_core_chatbot_settings_updated_by_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_settings" ADD CONSTRAINT "records_blocks_core_chatbot_settings_updated_by_chk" CHECK ((data->>'updatedBy') IS NULL OR (jsonb_typeof(data->'updatedBy') = 'string' AND char_length((data->>'updatedBy')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_settings" VALIDATE CONSTRAINT "records_blocks_core_chatbot_settings_updated_by_chk";

-- add_check public.records_blocks_core_chatbot_settings:constraint:records_blocks_core_chatbot_settings_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_settings" ADD CONSTRAINT "records_blocks_core_chatbot_settings_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_settings" VALIDATE CONSTRAINT "records_blocks_core_chatbot_settings_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_chatbot_settings:constraint:records_blocks_core_chatbot_settings_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_chatbot_settings" ADD CONSTRAINT "records_blocks_core_chatbot_settings_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_chatbot_settings" VALIDATE CONSTRAINT "records_blocks_core_chatbot_settings_agent_fk";

-- create_index public.records_blocks_core_chatbot_settings:index:records_blocks_core_chatbot_settings_key: on workspace_id, id using btree
CREATE INDEX "records_blocks_core_chatbot_settings_key" ON public."records_blocks_core_chatbot_settings" USING btree (workspace_id, id);

-- create_index public.records_blocks_core_chatbot_settings:index:records_blocks_core_chatbot_settings_scope: on workspace_id, data->>'scope', id using btree
CREATE INDEX "records_blocks_core_chatbot_settings_scope" ON public."records_blocks_core_chatbot_settings" USING btree (workspace_id, (data->>'scope'), id);

-- add_unique public.records_blocks_core_chatbot_settings:index:records_blocks_core_chatbot_settings_scope_key: on workspace_id, agent_id, data->>'scope' using btree
CREATE UNIQUE INDEX "records_blocks_core_chatbot_settings_scope_key" ON public."records_blocks_core_chatbot_settings" USING btree (workspace_id, agent_id, (data->>'scope')) WHERE deleted_at IS NULL;

-- create_partition public.records_blocks_core_content_brand: records for values in ('blocks-core.content.brand')
CREATE TABLE public."records_blocks_core_content_brand" PARTITION OF public.records FOR VALUES IN ('blocks-core.content.brand');

-- add_check public.records_blocks_core_content_brand:constraint:records_blocks_core_content_brand_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_brand" ADD CONSTRAINT "records_blocks_core_content_brand_key_chk" CHECK ((data->>'key') IS NOT NULL AND ((data->>'key') IN ('content'))) NOT VALID;
ALTER TABLE public."records_blocks_core_content_brand" VALIDATE CONSTRAINT "records_blocks_core_content_brand_key_chk";

-- add_check public.records_blocks_core_content_brand:constraint:records_blocks_core_content_brand_voice_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_brand" ADD CONSTRAINT "records_blocks_core_content_brand_voice_chk" CHECK ((data->>'voice') IS NOT NULL AND (jsonb_typeof(data->'voice') = 'string' AND char_length((data->>'voice')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_brand" VALIDATE CONSTRAINT "records_blocks_core_content_brand_voice_chk";

-- add_check public.records_blocks_core_content_brand:constraint:records_blocks_core_content_brand_avoid_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_brand" ADD CONSTRAINT "records_blocks_core_content_brand_avoid_chk" CHECK ((data->>'avoid') IS NOT NULL AND (jsonb_typeof(data->'avoid') = 'string' AND char_length((data->>'avoid')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_brand" VALIDATE CONSTRAINT "records_blocks_core_content_brand_avoid_chk";

-- add_check public.records_blocks_core_content_brand:constraint:records_blocks_core_content_brand_audience_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_brand" ADD CONSTRAINT "records_blocks_core_content_brand_audience_chk" CHECK ((data->>'audience') IS NOT NULL AND (jsonb_typeof(data->'audience') = 'string' AND char_length((data->>'audience')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_brand" VALIDATE CONSTRAINT "records_blocks_core_content_brand_audience_chk";

-- add_check public.records_blocks_core_content_brand:constraint:records_blocks_core_content_brand_cta_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_brand" ADD CONSTRAINT "records_blocks_core_content_brand_cta_chk" CHECK ((data->>'cta') IS NOT NULL AND (jsonb_typeof(data->'cta') = 'string' AND char_length((data->>'cta')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_brand" VALIDATE CONSTRAINT "records_blocks_core_content_brand_cta_chk";

-- add_check public.records_blocks_core_content_brand:constraint:records_blocks_core_content_brand_hashtags_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_brand" ADD CONSTRAINT "records_blocks_core_content_brand_hashtags_chk" CHECK ((data->>'hashtags') IS NOT NULL AND (jsonb_typeof(data->'hashtags') = 'string' AND char_length((data->>'hashtags')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_brand" VALIDATE CONSTRAINT "records_blocks_core_content_brand_hashtags_chk";

-- add_check public.records_blocks_core_content_brand:constraint:records_blocks_core_content_brand_pillars_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_brand" ADD CONSTRAINT "records_blocks_core_content_brand_pillars_chk" CHECK ((data->>'pillars') IS NOT NULL AND (jsonb_typeof(data->'pillars') = 'object')) NOT VALID;
ALTER TABLE public."records_blocks_core_content_brand" VALIDATE CONSTRAINT "records_blocks_core_content_brand_pillars_chk";

-- add_check public.records_blocks_core_content_brand:constraint:records_blocks_core_content_brand_cadence_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_brand" ADD CONSTRAINT "records_blocks_core_content_brand_cadence_chk" CHECK ((data->>'cadence') IS NOT NULL AND (jsonb_typeof(data->'cadence') = 'object')) NOT VALID;
ALTER TABLE public."records_blocks_core_content_brand" VALIDATE CONSTRAINT "records_blocks_core_content_brand_cadence_chk";

-- add_check public.records_blocks_core_content_brand:constraint:records_blocks_core_content_brand_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_brand" ADD CONSTRAINT "records_blocks_core_content_brand_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_content_brand" VALIDATE CONSTRAINT "records_blocks_core_content_brand_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_content_brand:constraint:records_blocks_core_content_brand_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_brand" ADD CONSTRAINT "records_blocks_core_content_brand_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_content_brand" VALIDATE CONSTRAINT "records_blocks_core_content_brand_agent_fk";

-- create_index public.records_blocks_core_content_brand:index:records_blocks_core_content_brand_key_id: on workspace_id, data->>'key', id using btree
CREATE INDEX "records_blocks_core_content_brand_key_id" ON public."records_blocks_core_content_brand" USING btree (workspace_id, (data->>'key'), id);

-- add_unique public.records_blocks_core_content_brand:index:records_blocks_core_content_brand_brand_key: on workspace_id, agent_id, data->>'key' using btree
CREATE UNIQUE INDEX "records_blocks_core_content_brand_brand_key" ON public."records_blocks_core_content_brand" USING btree (workspace_id, agent_id, (data->>'key')) WHERE deleted_at IS NULL;

-- create_partition public.records_blocks_core_content_post: records for values in ('blocks-core.content.post')
CREATE TABLE public."records_blocks_core_content_post" PARTITION OF public.records FOR VALUES IN ('blocks-core.content.post');

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_channel_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_channel_chk" CHECK ((data->>'channel') IS NOT NULL AND ((data->>'channel') IN ('facebook', 'zalo', 'tiktok', 'instagram'))) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_channel_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('draft', 'approved', 'published'))) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_status_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_title_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_title_chk" CHECK ((data->>'title') IS NOT NULL AND (jsonb_typeof(data->'title') = 'string' AND char_length((data->>'title')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_title_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_brief_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_brief_chk" CHECK ((data->>'brief') IS NOT NULL AND (jsonb_typeof(data->'brief') = 'string' AND char_length((data->>'brief')) <= 5000)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_brief_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_pillar_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_pillar_chk" CHECK ((data->>'pillar') IS NOT NULL AND (jsonb_typeof(data->'pillar') = 'string' AND char_length((data->>'pillar')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_pillar_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_text_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_text_chk" CHECK ((data->>'text') IS NOT NULL AND (jsonb_typeof(data->'text') = 'string' AND char_length((data->>'text')) <= 5000)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_text_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_note_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_note_chk" CHECK ((data->>'note') IS NOT NULL AND (jsonb_typeof(data->'note') = 'string' AND char_length((data->>'note')) <= 5000)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_note_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_media_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_media_chk" CHECK ((data->>'media') IS NULL OR (jsonb_typeof(data->'media') = 'object' AND jsonb_typeof(data->'media'->'key') = 'string' AND jsonb_typeof(data->'media'->'size') = 'number')) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_media_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_day_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_day_chk" CHECK ((data->>'day') IS NULL OR ((data->>'day') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_day_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_time_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_time_chk" CHECK ((data->>'time') IS NOT NULL AND (jsonb_typeof(data->'time') = 'string' AND char_length((data->>'time')) <= 5)) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_time_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_published_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_published_at_chk" CHECK ((data->>'publishedAt') IS NULL OR ((data->>'publishedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_published_at_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_publish_result_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_publish_result_chk" CHECK ((data->>'publishResult') IS NULL OR (jsonb_typeof(data->'publishResult') = 'object')) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_publish_result_chk";

-- add_check public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_content_post:constraint:records_blocks_core_content_post_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_content_post" ADD CONSTRAINT "records_blocks_core_content_post_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_content_post" VALIDATE CONSTRAINT "records_blocks_core_content_post_agent_fk";

-- create_index public.records_blocks_core_content_post:index:records_blocks_core_content_post_day: on workspace_id, data->>'day', id using btree
CREATE INDEX "records_blocks_core_content_post_day" ON public."records_blocks_core_content_post" USING btree (workspace_id, (data->>'day'), id);

-- create_index public.records_blocks_core_content_post:index:records_blocks_core_content_post_status_day: on workspace_id, data->>'status', data->>'day', id using btree
CREATE INDEX "records_blocks_core_content_post_status_day" ON public."records_blocks_core_content_post" USING btree (workspace_id, (data->>'status'), (data->>'day'), id);

-- create_index public.records_blocks_core_content_post:index:records_blocks_core_content_post_channel_day: on workspace_id, data->>'channel', data->>'day', id using btree
CREATE INDEX "records_blocks_core_content_post_channel_day" ON public."records_blocks_core_content_post" USING btree (workspace_id, (data->>'channel'), (data->>'day'), id);

-- create_index public.records_blocks_core_content_post:index:records_blocks_core_content_post_title_trgm_idx: on knowledge_folddata->>'title' using gin
CREATE INDEX "records_blocks_core_content_post_title_trgm_idx" ON public."records_blocks_core_content_post" USING gin (public.knowledge_fold((data->>'title')) extensions.gin_trgm_ops);

-- create_partition public.records_blocks_core_hiring_candidate: records for values in ('blocks-core.hiring.candidate')
CREATE TABLE public."records_blocks_core_hiring_candidate" PARTITION OF public.records FOR VALUES IN ('blocks-core.hiring.candidate');

-- add_check public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_name_chk" CHECK ((data->>'name') IS NOT NULL AND (jsonb_typeof(data->'name') = 'string' AND char_length((data->>'name')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_name_chk";

-- add_check public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_contact_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_contact_id_chk" CHECK ((data->>'contactId') IS NULL OR ((data->>'contactId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_contact_id_chk";

-- add_check public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_contact_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_contact_chk" CHECK ((data->>'contact') IS NOT NULL AND (jsonb_typeof(data->'contact') = 'string' AND char_length((data->>'contact')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_contact_chk";

-- add_check public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_job_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_job_id_chk" CHECK ((data->>'jobId') IS NOT NULL AND ((data->>'jobId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_job_id_chk";

-- add_check public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_cv_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_cv_chk" CHECK ((data->>'cv') IS NULL OR (jsonb_typeof(data->'cv') = 'object' AND jsonb_typeof(data->'cv'->'key') = 'string' AND jsonb_typeof(data->'cv'->'size') = 'number')) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_cv_chk";

-- add_check public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_profile_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_profile_chk" CHECK ((data->>'profile') IS NOT NULL AND (jsonb_typeof(data->'profile') = 'string' AND char_length((data->>'profile')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_profile_chk";

-- add_check public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_stage_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_stage_chk" CHECK ((data->>'stage') IS NOT NULL AND ((data->>'stage') IN ('new', 'screened', 'interview', 'offer', 'hired', 'rejected'))) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_stage_chk";

-- add_check public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_screening_summary_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_screening_summary_chk" CHECK ((data->>'screeningSummary') IS NOT NULL AND (jsonb_typeof(data->'screeningSummary') = 'string' AND char_length((data->>'screeningSummary')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_screening_summary_chk";

-- add_check public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_notes_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_notes_chk" CHECK ((data->>'notes') IS NOT NULL AND (jsonb_typeof(data->'notes') = 'string' AND char_length((data->>'notes')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_notes_chk";

-- add_check public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_hiring_candidate:constraint:records_blocks_core_hiring_candidate_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_candidate" ADD CONSTRAINT "records_blocks_core_hiring_candidate_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_candidate" VALIDATE CONSTRAINT "records_blocks_core_hiring_candidate_agent_fk";

-- create_index public.records_blocks_core_hiring_candidate:index:records_blocks_core_hiring_candidate_recent: on workspace_id, created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_hiring_candidate_recent" ON public."records_blocks_core_hiring_candidate" USING btree (workspace_id, created_at DESC, id DESC);

-- create_index public.records_blocks_core_hiring_candidate:index:records_blocks_core_hiring_candidate_stage_recent: on workspace_id, data->>'stage', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_hiring_candidate_stage_recent" ON public."records_blocks_core_hiring_candidate" USING btree (workspace_id, (data->>'stage'), created_at DESC, id DESC);

-- create_index public.records_blocks_core_hiring_candidate:index:records_blocks_core_hiring_candidate_job_recent: on workspace_id, data->>'jobid', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_hiring_candidate_job_recent" ON public."records_blocks_core_hiring_candidate" USING btree (workspace_id, ((data->>'jobId')::uuid), created_at DESC, id DESC);

-- create_index public.records_blocks_core_hiring_candidate:index:records_blocks_core_hiring_candidate_contact_recent: on workspace_id, data->>'contactid', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_hiring_candidate_contact_recent" ON public."records_blocks_core_hiring_candidate" USING btree (workspace_id, ((data->>'contactId')::uuid), created_at DESC, id DESC);

-- create_index public.records_blocks_core_hiring_candidate:index:records_blocks_core_hiring_candidate_name_trgm_idx: on knowledge_folddata->>'name' using gin
CREATE INDEX "records_blocks_core_hiring_candidate_name_trgm_idx" ON public."records_blocks_core_hiring_candidate" USING gin (public.knowledge_fold((data->>'name')) extensions.gin_trgm_ops);

-- create_index public.records_blocks_core_hiring_candidate:index:records_blocks_core_hiring_candidate_contact_id_contact_idx: on workspace_id, data->>'contactid' using btree
CREATE INDEX "records_blocks_core_hiring_candidate_contact_id_contact_idx" ON public."records_blocks_core_hiring_candidate" USING btree (workspace_id, ((data->>'contactId')::uuid));

-- create_index public.records_blocks_core_hiring_candidate:index:records_blocks_core_hiring_candidate_contact_trgm_idx: on knowledge_folddata->>'contact' using gin
CREATE INDEX "records_blocks_core_hiring_candidate_contact_trgm_idx" ON public."records_blocks_core_hiring_candidate" USING gin (public.knowledge_fold((data->>'contact')) extensions.gin_trgm_ops);

-- create_partition public.records_blocks_core_hiring_job: records for values in ('blocks-core.hiring.job')
CREATE TABLE public."records_blocks_core_hiring_job" PARTITION OF public.records FOR VALUES IN ('blocks-core.hiring.job');

-- add_check public.records_blocks_core_hiring_job:constraint:records_blocks_core_hiring_job_title_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_job" ADD CONSTRAINT "records_blocks_core_hiring_job_title_chk" CHECK ((data->>'title') IS NOT NULL AND (jsonb_typeof(data->'title') = 'string' AND char_length((data->>'title')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_job" VALIDATE CONSTRAINT "records_blocks_core_hiring_job_title_chk";

-- add_check public.records_blocks_core_hiring_job:constraint:records_blocks_core_hiring_job_description_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_job" ADD CONSTRAINT "records_blocks_core_hiring_job_description_chk" CHECK ((data->>'description') IS NOT NULL AND (jsonb_typeof(data->'description') = 'string' AND char_length((data->>'description')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_job" VALIDATE CONSTRAINT "records_blocks_core_hiring_job_description_chk";

-- add_check public.records_blocks_core_hiring_job:constraint:records_blocks_core_hiring_job_requirements_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_job" ADD CONSTRAINT "records_blocks_core_hiring_job_requirements_chk" CHECK ((data->>'requirements') IS NOT NULL AND (jsonb_typeof(data->'requirements') = 'string' AND char_length((data->>'requirements')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_job" VALIDATE CONSTRAINT "records_blocks_core_hiring_job_requirements_chk";

-- add_check public.records_blocks_core_hiring_job:constraint:records_blocks_core_hiring_job_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_job" ADD CONSTRAINT "records_blocks_core_hiring_job_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('open', 'closed'))) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_job" VALIDATE CONSTRAINT "records_blocks_core_hiring_job_status_chk";

-- add_check public.records_blocks_core_hiring_job:constraint:records_blocks_core_hiring_job_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_job" ADD CONSTRAINT "records_blocks_core_hiring_job_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_job" VALIDATE CONSTRAINT "records_blocks_core_hiring_job_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_hiring_job:constraint:records_blocks_core_hiring_job_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_hiring_job" ADD CONSTRAINT "records_blocks_core_hiring_job_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_hiring_job" VALIDATE CONSTRAINT "records_blocks_core_hiring_job_agent_fk";

-- create_index public.records_blocks_core_hiring_job:index:records_blocks_core_hiring_job_recent: on workspace_id, created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_hiring_job_recent" ON public."records_blocks_core_hiring_job" USING btree (workspace_id, created_at DESC, id DESC);

-- create_index public.records_blocks_core_hiring_job:index:records_blocks_core_hiring_job_status_recent: on workspace_id, data->>'status', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_hiring_job_status_recent" ON public."records_blocks_core_hiring_job" USING btree (workspace_id, (data->>'status'), created_at DESC, id DESC);

-- create_index public.records_blocks_core_hiring_job:index:records_blocks_core_hiring_job_title_trgm_idx: on knowledge_folddata->>'title' using gin
CREATE INDEX "records_blocks_core_hiring_job_title_trgm_idx" ON public."records_blocks_core_hiring_job" USING gin (public.knowledge_fold((data->>'title')) extensions.gin_trgm_ops);

-- create_partition public.records_blocks_core_sales_claim: records for values in ('blocks-core.sales.claim')
CREATE TABLE public."records_blocks_core_sales_claim" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.claim');

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_code_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_code_chk" CHECK ((data->>'code') IS NULL OR (jsonb_typeof(data->'code') = 'string' AND char_length((data->>'code')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_code_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_contact_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_contact_id_chk" CHECK ((data->>'contactId') IS NULL OR ((data->>'contactId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_contact_id_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_conversation_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_conversation_id_chk" CHECK ((data->>'conversationId') IS NULL OR ((data->>'conversationId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_conversation_id_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_amount_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_amount_vnd_chk" CHECK ((data->>'amountVnd') IS NULL OR (jsonb_typeof(data->'amountVnd') = 'number' AND (data->>'amountVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_amount_vnd_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_names_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_names_chk" CHECK ((data->>'names') IS NOT NULL AND (jsonb_typeof(data->'names') = 'object')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_names_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_body_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_body_chk" CHECK ((data->>'body') IS NOT NULL AND (jsonb_typeof(data->'body') = 'string' AND char_length((data->>'body')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_body_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('open', 'settled', 'escalated', 'withdrawn'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_status_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_claimed_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_claimed_at_chk" CHECK ((data->>'claimedAt') IS NOT NULL AND ((data->>'claimedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_claimed_at_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_settled_transaction_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_settled_transaction_id_chk" CHECK ((data->>'settledTransactionId') IS NULL OR ((data->>'settledTransactionId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_settled_transaction_id_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_dedupe_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_dedupe_key_chk" CHECK ((data->>'dedupeKey') IS NOT NULL AND (jsonb_typeof(data->'dedupeKey') = 'string' AND char_length((data->>'dedupeKey')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_dedupe_key_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_amount_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_amount_chk" CHECK ((((data->>'amountVnd')::bigint) IS NULL OR ((data->>'amountVnd')::bigint) > 0)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_amount_chk";

-- add_check public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_claim:constraint:records_blocks_core_sales_claim_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_claim" ADD CONSTRAINT "records_blocks_core_sales_claim_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_claim" VALIDATE CONSTRAINT "records_blocks_core_sales_claim_agent_fk";

-- create_index public.records_blocks_core_sales_claim:index:records_blocks_core_sales_claim_key: on workspace_id, id using btree
CREATE INDEX "records_blocks_core_sales_claim_key" ON public."records_blocks_core_sales_claim" USING btree (workspace_id, id);

-- create_index public.records_blocks_core_sales_claim:index:records_blocks_core_sales_claim_status_recent: on workspace_id, data->>'status', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_claim_status_recent" ON public."records_blocks_core_sales_claim" USING btree (workspace_id, (data->>'status'), created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_claim:index:records_blocks_core_sales_claim_status_claimed: on workspace_id, data->>'status', data->>'claimedat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_claim_status_claimed" ON public."records_blocks_core_sales_claim" USING btree (workspace_id, (data->>'status'), (data->>'claimedAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_claim:index:records_blocks_core_sales_claim_contact_claimed: on workspace_id, data->>'contactid', data->>'claimedat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_claim_contact_claimed" ON public."records_blocks_core_sales_claim" USING btree (workspace_id, ((data->>'contactId')::uuid), (data->>'claimedAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_claim:index:records_blocks_core_sales_claim_conversation_claimed: on workspace_id, data->>'conversationid', data->>'claimedat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_claim_conversation_claimed" ON public."records_blocks_core_sales_claim" USING btree (workspace_id, ((data->>'conversationId')::uuid), (data->>'claimedAt') DESC, id DESC);

-- add_unique public.records_blocks_core_sales_claim:index:records_blocks_core_sales_claim_dedupe_key: on workspace_id, agent_id, data->>'dedupekey' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_claim_dedupe_key" ON public."records_blocks_core_sales_claim" USING btree (workspace_id, agent_id, (data->>'dedupeKey')) WHERE deleted_at IS NULL;

-- add_unique public.records_blocks_core_sales_claim:index:records_blocks_core_sales_claim_settled_transaction_key: on workspace_id, agent_id, data->>'settledtransactionid' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_claim_settled_transaction_key" ON public."records_blocks_core_sales_claim" USING btree (workspace_id, agent_id, ((data->>'settledTransactionId')::uuid)) WHERE (((data->>'settledTransactionId')::uuid) IS NOT NULL) AND deleted_at IS NULL;

-- create_index public.records_blocks_core_sales_claim:index:records_blocks_core_sales_claim_contact_id_contact_idx: on workspace_id, data->>'contactid' using btree
CREATE INDEX "records_blocks_core_sales_claim_contact_id_contact_idx" ON public."records_blocks_core_sales_claim" USING btree (workspace_id, ((data->>'contactId')::uuid));

-- create_partition public.records_blocks_core_sales_invoice: records for values in ('blocks-core.sales.invoice')
CREATE TABLE public."records_blocks_core_sales_invoice" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.invoice');

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_invoice_no_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_invoice_no_chk" CHECK ((data->>'invoiceNo') IS NOT NULL AND (jsonb_typeof(data->'invoiceNo') = 'string')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_invoice_no_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_order_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_order_id_chk" CHECK ((data->>'orderId') IS NULL OR ((data->>'orderId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_order_id_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_contact_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_contact_id_chk" CHECK ((data->>'contactId') IS NULL OR ((data->>'contactId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_contact_id_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_amount_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_amount_vnd_chk" CHECK ((data->>'amountVnd') IS NOT NULL AND (jsonb_typeof(data->'amountVnd') = 'number' AND (data->>'amountVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_amount_vnd_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('draft', 'issued', 'paid', 'void'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_status_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_due_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_due_at_chk" CHECK ((data->>'dueAt') IS NULL OR ((data->>'dueAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_due_at_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_issued_by_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_issued_by_chk" CHECK ((data->>'issuedBy') IS NULL OR (jsonb_typeof(data->'issuedBy') = 'string' AND char_length((data->>'issuedBy')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_issued_by_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_issued_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_issued_at_chk" CHECK ((data->>'issuedAt') IS NULL OR ((data->>'issuedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_issued_at_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_paid_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_paid_at_chk" CHECK ((data->>'paidAt') IS NULL OR ((data->>'paidAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_paid_at_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_contract_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_contract_id_chk" CHECK ((data->>'contractId') IS NULL OR ((data->>'contractId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_contract_id_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_period_ends_on_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_period_ends_on_chk" CHECK ((data->>'periodEndsOn') IS NULL OR ((data->>'periodEndsOn') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_period_ends_on_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_amount_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_amount_chk" CHECK (((data->>'amountVnd')::bigint) >= 0) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_amount_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_contract_period_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_contract_period_chk" CHECK ((((data->>'contractId')::uuid) IS NULL OR (data->>'periodEndsOn') IS NOT NULL)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_contract_period_chk";

-- add_check public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_invoice:constraint:records_blocks_core_sales_invoice_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_invoice" ADD CONSTRAINT "records_blocks_core_sales_invoice_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_invoice" VALIDATE CONSTRAINT "records_blocks_core_sales_invoice_agent_fk";

-- create_index public.records_blocks_core_sales_invoice:index:records_blocks_core_sales_invoice_key: on workspace_id, id using btree
CREATE INDEX "records_blocks_core_sales_invoice_key" ON public."records_blocks_core_sales_invoice" USING btree (workspace_id, id);

-- create_index public.records_blocks_core_sales_invoice:index:records_blocks_core_sales_invoice_recent: on workspace_id, created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_invoice_recent" ON public."records_blocks_core_sales_invoice" USING btree (workspace_id, created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_invoice:index:records_blocks_core_sales_invoice_status_recent: on workspace_id, data->>'status', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_invoice_status_recent" ON public."records_blocks_core_sales_invoice" USING btree (workspace_id, (data->>'status'), created_at DESC, id DESC);

-- add_unique public.records_blocks_core_sales_invoice:index:records_blocks_core_sales_invoice_order_key: on workspace_id, agent_id, data->>'orderid' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_invoice_order_key" ON public."records_blocks_core_sales_invoice" USING btree (workspace_id, agent_id, ((data->>'orderId')::uuid)) WHERE (((data->>'orderId')::uuid) IS NOT NULL) AND deleted_at IS NULL;

-- add_unique public.records_blocks_core_sales_invoice:index:records_blocks_core_sales_invoice_invoice_no_key: on workspace_id, agent_id, data->>'invoiceno' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_invoice_invoice_no_key" ON public."records_blocks_core_sales_invoice" USING btree (workspace_id, agent_id, (data->>'invoiceNo')) WHERE deleted_at IS NULL;

-- add_unique public.records_blocks_core_sales_invoice:index:records_blocks_core_sales_invoice_contract_period_key: on workspace_id, agent_id, data->>'contractid', data->>'periodendson' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_invoice_contract_period_key" ON public."records_blocks_core_sales_invoice" USING btree (workspace_id, agent_id, ((data->>'contractId')::uuid), (data->>'periodEndsOn')) WHERE (((data->>'contractId')::uuid) IS NOT NULL) AND deleted_at IS NULL;

-- create_index public.records_blocks_core_sales_invoice:index:records_blocks_core_sales_invoice_contact_id_contact_idx: on workspace_id, data->>'contactid' using btree
CREATE INDEX "records_blocks_core_sales_invoice_contact_id_contact_idx" ON public."records_blocks_core_sales_invoice" USING btree (workspace_id, ((data->>'contactId')::uuid));

-- create_partition public.records_blocks_core_sales_lead: records for values in ('blocks-core.sales.lead')
CREATE TABLE public."records_blocks_core_sales_lead" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.lead');

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_contact_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_contact_id_chk" CHECK ((data->>'contactId') IS NULL OR ((data->>'contactId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_contact_id_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_contact_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_contact_name_chk" CHECK ((data->>'contactName') IS NOT NULL AND (jsonb_typeof(data->'contactName') = 'string' AND char_length((data->>'contactName')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_contact_name_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_company_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_company_chk" CHECK ((data->>'company') IS NULL OR (jsonb_typeof(data->'company') = 'string' AND char_length((data->>'company')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_company_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_channel_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_channel_chk" CHECK ((data->>'channel') IS NOT NULL AND ((data->>'channel') IN ('telegram', 'zalo', 'facebook', 'instagram', 'website'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_channel_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_need_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_need_chk" CHECK ((data->>'need') IS NULL OR (jsonb_typeof(data->'need') = 'string' AND char_length((data->>'need')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_need_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_stage_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_stage_chk" CHECK ((data->>'stage') IS NOT NULL AND ((data->>'stage') IN ('new', 'qualified', 'proposal', 'won', 'lost'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_stage_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_context_summary_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_context_summary_chk" CHECK ((data->>'contextSummary') IS NULL OR (jsonb_typeof(data->'contextSummary') = 'string' AND char_length((data->>'contextSummary')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_context_summary_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_closed_reason_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_closed_reason_chk" CHECK ((data->>'closedReason') IS NULL OR (jsonb_typeof(data->'closedReason') = 'string' AND char_length((data->>'closedReason')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_closed_reason_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_phone_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_phone_chk" CHECK ((data->>'phone') IS NULL OR (jsonb_typeof(data->'phone') = 'string' AND char_length((data->>'phone')) <= 30)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_phone_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_email_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_email_chk" CHECK ((data->>'email') IS NULL OR (jsonb_typeof(data->'email') = 'string' AND char_length((data->>'email')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_email_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_awaiting_since_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_awaiting_since_chk" CHECK ((data->>'awaitingSince') IS NULL OR ((data->>'awaitingSince') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_awaiting_since_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_owner_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_owner_chk" CHECK ((data->>'owner') IS NULL OR (jsonb_typeof(data->'owner') = 'string' AND char_length((data->>'owner')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_owner_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_next_step_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_next_step_chk" CHECK ((data->>'nextStep') IS NULL OR (jsonb_typeof(data->'nextStep') = 'string' AND char_length((data->>'nextStep')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_next_step_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_next_due_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_next_due_at_chk" CHECK ((data->>'nextDueAt') IS NULL OR ((data->>'nextDueAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_next_due_at_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_quote_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_quote_vnd_chk" CHECK ((data->>'quoteVnd') IS NULL OR (jsonb_typeof(data->'quoteVnd') = 'number' AND (data->>'quoteVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_quote_vnd_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_order_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_order_vnd_chk" CHECK ((data->>'orderVnd') IS NULL OR (jsonb_typeof(data->'orderVnd') = 'number' AND (data->>'orderVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_order_vnd_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_note_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_note_chk" CHECK ((data->>'note') IS NULL OR (jsonb_typeof(data->'note') = 'string' AND char_length((data->>'note')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_note_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_needs_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_needs_chk" CHECK ((data->>'needs') IS NULL OR (jsonb_typeof(data->'needs') = 'string' AND char_length((data->>'needs')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_needs_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_consult_stage_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_consult_stage_chk" CHECK ((data->>'consultStage') IS NULL OR ((data->>'consultStage') IN ('discover', 'recommend', 'close', 'ordered', 'after_sale'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_consult_stage_chk";

-- add_check public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_lead:constraint:records_blocks_core_sales_lead_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_lead" ADD CONSTRAINT "records_blocks_core_sales_lead_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_lead" VALIDATE CONSTRAINT "records_blocks_core_sales_lead_agent_fk";

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_key: on workspace_id, id using btree
CREATE INDEX "records_blocks_core_sales_lead_key" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, id);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_recent: on workspace_id, updated_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_lead_recent" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, updated_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_stage_recent: on workspace_id, data->>'stage', updated_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_lead_stage_recent" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, (data->>'stage'), updated_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_name: on workspace_id, data->>'contactname', id using btree
CREATE INDEX "records_blocks_core_sales_lead_name" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, (data->>'contactName'), id);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_stage_name: on workspace_id, data->>'stage', data->>'contactname', id using btree
CREATE INDEX "records_blocks_core_sales_lead_stage_name" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, (data->>'stage'), (data->>'contactName'), id);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_awaiting: on workspace_id, data->>'awaitingsince', id using btree
CREATE INDEX "records_blocks_core_sales_lead_awaiting" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, (data->>'awaitingSince'), id);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_due: on workspace_id, data->>'nextdueat', id using btree
CREATE INDEX "records_blocks_core_sales_lead_due" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, (data->>'nextDueAt'), id);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_needs: on workspace_id, data->>'needs', id using btree
CREATE INDEX "records_blocks_core_sales_lead_needs" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, (data->>'needs'), id);

-- add_unique public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_contact_key: on workspace_id, agent_id, data->>'contactid' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_lead_contact_key" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, agent_id, ((data->>'contactId')::uuid)) WHERE (((data->>'contactId')::uuid) IS NOT NULL) AND deleted_at IS NULL;

-- add_unique public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_phone_key: on workspace_id, agent_id, data->>'phone' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_lead_phone_key" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, agent_id, (data->>'phone')) WHERE ((data->>'phone') IS NOT NULL) AND deleted_at IS NULL;

-- add_unique public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_email_key: on workspace_id, agent_id, data->>'email' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_lead_email_key" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, agent_id, (data->>'email')) WHERE ((data->>'email') IS NOT NULL) AND deleted_at IS NULL;

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_contact_id_contact_idx: on workspace_id, data->>'contactid' using btree
CREATE INDEX "records_blocks_core_sales_lead_contact_id_contact_idx" ON public."records_blocks_core_sales_lead" USING btree (workspace_id, ((data->>'contactId')::uuid));

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_contact_name_trgm_idx: on knowledge_folddata->>'contactname' using gin
CREATE INDEX "records_blocks_core_sales_lead_contact_name_trgm_idx" ON public."records_blocks_core_sales_lead" USING gin (public.knowledge_fold((data->>'contactName')) extensions.gin_trgm_ops);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_company_trgm_idx: on knowledge_folddata->>'company' using gin
CREATE INDEX "records_blocks_core_sales_lead_company_trgm_idx" ON public."records_blocks_core_sales_lead" USING gin (public.knowledge_fold((data->>'company')) extensions.gin_trgm_ops);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_need_trgm_idx: on knowledge_folddata->>'need' using gin
CREATE INDEX "records_blocks_core_sales_lead_need_trgm_idx" ON public."records_blocks_core_sales_lead" USING gin (public.knowledge_fold((data->>'need')) extensions.gin_trgm_ops);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_phone_trgm_idx: on knowledge_folddata->>'phone' using gin
CREATE INDEX "records_blocks_core_sales_lead_phone_trgm_idx" ON public."records_blocks_core_sales_lead" USING gin (public.knowledge_fold((data->>'phone')) extensions.gin_trgm_ops);

-- create_index public.records_blocks_core_sales_lead:index:records_blocks_core_sales_lead_email_trgm_idx: on knowledge_folddata->>'email' using gin
CREATE INDEX "records_blocks_core_sales_lead_email_trgm_idx" ON public."records_blocks_core_sales_lead" USING gin (public.knowledge_fold((data->>'email')) extensions.gin_trgm_ops);

-- create_partition public.records_blocks_core_sales_ledger_adjustment: records for values in ('blocks-core.sales.ledger-adjustment')
CREATE TABLE public."records_blocks_core_sales_ledger_adjustment" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.ledger-adjustment');

-- add_check public.records_blocks_core_sales_ledger_adjustment:constraint:records_blocks_core_sales_ledger_adjustment_target_type_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" ADD CONSTRAINT "records_blocks_core_sales_ledger_adjustment_target_type_chk" CHECK ((data->>'targetType') IS NOT NULL AND ((data->>'targetType') IN ('invoice', 'transaction'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_adjustment_target_type_chk";

-- add_check public.records_blocks_core_sales_ledger_adjustment:constraint:records_blocks_core_sales_ledger_adjustment_target_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" ADD CONSTRAINT "records_blocks_core_sales_ledger_adjustment_target_id_chk" CHECK ((data->>'targetId') IS NOT NULL AND ((data->>'targetId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_adjustment_target_id_chk";

-- add_check public.records_blocks_core_sales_ledger_adjustment:constraint:records_blocks_core_sales_ledger_adjustment_note_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" ADD CONSTRAINT "records_blocks_core_sales_ledger_adjustment_note_chk" CHECK ((data->>'note') IS NOT NULL AND (jsonb_typeof(data->'note') = 'string' AND char_length((data->>'note')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_adjustment_note_chk";

-- add_check public.records_blocks_core_sales_ledger_adjustment:constraint:records_blocks_core_sales_ledger_adjustment_corrected_amount_vn: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" ADD CONSTRAINT "records_blocks_core_sales_ledger_adjustment_corrected_amount_vn" CHECK ((data->>'correctedAmountVnd') IS NULL OR (jsonb_typeof(data->'correctedAmountVnd') = 'number' AND (data->>'correctedAmountVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_adjustment_corrected_amount_vn";

-- add_check public.records_blocks_core_sales_ledger_adjustment:constraint:records_blocks_core_sales_ledger_adjustment_created_by_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" ADD CONSTRAINT "records_blocks_core_sales_ledger_adjustment_created_by_chk" CHECK ((data->>'createdBy') IS NOT NULL AND (jsonb_typeof(data->'createdBy') = 'string' AND char_length((data->>'createdBy')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_adjustment_created_by_chk";

-- add_check public.records_blocks_core_sales_ledger_adjustment:constraint:records_blocks_core_sales_ledger_adjustment_created_by_user_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" ADD CONSTRAINT "records_blocks_core_sales_ledger_adjustment_created_by_user_chk" CHECK ((data->>'createdByUser') IS NULL OR ((data->>'createdByUser') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_adjustment_created_by_user_chk";

-- add_check public.records_blocks_core_sales_ledger_adjustment:constraint:records_blocks_core_sales_ledger_adjustment_corrected_amount_ch: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" ADD CONSTRAINT "records_blocks_core_sales_ledger_adjustment_corrected_amount_ch" CHECK ((((data->>'correctedAmountVnd')::bigint) IS NULL OR ((data->>'correctedAmountVnd')::bigint) >= 0)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_adjustment_corrected_amount_ch";

-- add_check public.records_blocks_core_sales_ledger_adjustment:constraint:records_blocks_core_sales_ledger_adjustment_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" ADD CONSTRAINT "records_blocks_core_sales_ledger_adjustment_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_adjustment_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_ledger_adjustment:constraint:records_blocks_core_sales_ledger_adjustment_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" ADD CONSTRAINT "records_blocks_core_sales_ledger_adjustment_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_adjustment" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_adjustment_agent_fk";

-- create_index public.records_blocks_core_sales_ledger_adjustment:index:records_blocks_core_sales_ledger_adjustment_target: on workspace_id, data->>'targettype', data->>'targetid', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_ledger_adjustment_target" ON public."records_blocks_core_sales_ledger_adjustment" USING btree (workspace_id, (data->>'targetType'), ((data->>'targetId')::uuid), created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_ledger_adjustment:index:records_blocks_core_sales_ledger_adjustment_recent: on workspace_id, created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_ledger_adjustment_recent" ON public."records_blocks_core_sales_ledger_adjustment" USING btree (workspace_id, created_at DESC, id DESC);

-- create_partition public.records_blocks_core_sales_ledger_entry: records for values in ('blocks-core.sales.ledger-entry')
CREATE TABLE public."records_blocks_core_sales_ledger_entry" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.ledger-entry');

-- add_check public.records_blocks_core_sales_ledger_entry:constraint:records_blocks_core_sales_ledger_entry_kind_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_ledger_entry_kind_chk" CHECK ((data->>'kind') IS NOT NULL AND ((data->>'kind') IN ('income', 'expense', 'invoice', 'reversal', 'adjustment'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_entry_kind_chk";

-- add_check public.records_blocks_core_sales_ledger_entry:constraint:records_blocks_core_sales_ledger_entry_source_entity_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_ledger_entry_source_entity_chk" CHECK ((data->>'sourceEntity') IS NOT NULL AND (jsonb_typeof(data->'sourceEntity') = 'string' AND char_length((data->>'sourceEntity')) <= 120)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_entry_source_entity_chk";

-- add_check public.records_blocks_core_sales_ledger_entry:constraint:records_blocks_core_sales_ledger_entry_source_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_ledger_entry_source_id_chk" CHECK ((data->>'sourceId') IS NOT NULL AND ((data->>'sourceId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_entry_source_id_chk";

-- add_check public.records_blocks_core_sales_ledger_entry:constraint:records_blocks_core_sales_ledger_entry_entry_date_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_ledger_entry_entry_date_chk" CHECK ((data->>'entryDate') IS NOT NULL AND ((data->>'entryDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_entry_entry_date_chk";

-- add_check public.records_blocks_core_sales_ledger_entry:constraint:records_blocks_core_sales_ledger_entry_amount_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_ledger_entry_amount_vnd_chk" CHECK ((data->>'amountVnd') IS NOT NULL AND (jsonb_typeof(data->'amountVnd') = 'number' AND (data->>'amountVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_entry_amount_vnd_chk";

-- add_check public.records_blocks_core_sales_ledger_entry:constraint:records_blocks_core_sales_ledger_entry_note_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_ledger_entry_note_chk" CHECK ((data->>'note') IS NULL OR (jsonb_typeof(data->'note') = 'string' AND char_length((data->>'note')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_entry_note_chk";

-- add_check public.records_blocks_core_sales_ledger_entry:constraint:records_blocks_core_sales_ledger_entry_counterparty_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_ledger_entry_counterparty_chk" CHECK ((data->>'counterparty') IS NULL OR (jsonb_typeof(data->'counterparty') = 'string' AND char_length((data->>'counterparty')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_entry_counterparty_chk";

-- add_check public.records_blocks_core_sales_ledger_entry:constraint:records_blocks_core_sales_ledger_entry_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_ledger_entry_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('paid', 'open', 'expense', 'review'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_entry_status_chk";

-- add_check public.records_blocks_core_sales_ledger_entry:constraint:records_blocks_core_sales_ledger_entry_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_ledger_entry_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_entry_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_ledger_entry:constraint:records_blocks_core_sales_ledger_entry_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_ledger_entry_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_entry_agent_fk";

-- create_index public.records_blocks_core_sales_ledger_entry:index:records_blocks_core_sales_ledger_entry_date: on workspace_id, data->>'entrydate'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_ledger_entry_date" ON public."records_blocks_core_sales_ledger_entry" USING btree (workspace_id, (data->>'entryDate') DESC, id DESC);

-- create_index public.records_blocks_core_sales_ledger_entry:index:records_blocks_core_sales_ledger_entry_kind_date: on workspace_id, data->>'kind', data->>'entrydate'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_ledger_entry_kind_date" ON public."records_blocks_core_sales_ledger_entry" USING btree (workspace_id, (data->>'kind'), (data->>'entryDate') DESC, id DESC);

-- create_index public.records_blocks_core_sales_ledger_entry:index:records_blocks_core_sales_ledger_entry_amount: on workspace_id, data->>'amountvnd'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_ledger_entry_amount" ON public."records_blocks_core_sales_ledger_entry" USING btree (workspace_id, ((data->>'amountVnd')::bigint) DESC, id DESC);

-- create_index public.records_blocks_core_sales_ledger_entry:index:records_blocks_core_sales_ledger_entry_kind_amount: on workspace_id, data->>'kind', data->>'amountvnd'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_ledger_entry_kind_amount" ON public."records_blocks_core_sales_ledger_entry" USING btree (workspace_id, (data->>'kind'), ((data->>'amountVnd')::bigint) DESC, id DESC);

-- create_index public.records_blocks_core_sales_ledger_entry:index:records_blocks_core_sales_ledger_entry_status_date: on workspace_id, data->>'status', data->>'entrydate'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_ledger_entry_status_date" ON public."records_blocks_core_sales_ledger_entry" USING btree (workspace_id, (data->>'status'), (data->>'entryDate') DESC, id DESC);

-- create_index public.records_blocks_core_sales_ledger_entry:index:records_blocks_core_sales_ledger_entry_status_amount: on workspace_id, data->>'status', data->>'amountvnd'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_ledger_entry_status_amount" ON public."records_blocks_core_sales_ledger_entry" USING btree (workspace_id, (data->>'status'), ((data->>'amountVnd')::bigint) DESC, id DESC);

-- create_index public.records_blocks_core_sales_ledger_entry:index:records_blocks_core_sales_ledger_entry_kind_day: on workspace_id, data->>'kind', data->>'entrydate', id using btree
CREATE INDEX "records_blocks_core_sales_ledger_entry_kind_day" ON public."records_blocks_core_sales_ledger_entry" USING btree (workspace_id, (data->>'kind'), (data->>'entryDate'), id);

-- add_unique public.records_blocks_core_sales_ledger_entry:index:records_blocks_core_sales_ledger_entry_source_key: on workspace_id, agent_id, data->>'sourceentity', data->>'sourceid', data->>'kind' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_ledger_entry_source_key" ON public."records_blocks_core_sales_ledger_entry" USING btree (workspace_id, agent_id, (data->>'sourceEntity'), ((data->>'sourceId')::uuid), (data->>'kind')) WHERE deleted_at IS NULL;

-- create_index public.records_blocks_core_sales_ledger_entry:index:records_blocks_core_sales_ledger_entry_note_trgm_idx: on knowledge_folddata->>'note' using gin
CREATE INDEX "records_blocks_core_sales_ledger_entry_note_trgm_idx" ON public."records_blocks_core_sales_ledger_entry" USING gin (public.knowledge_fold((data->>'note')) extensions.gin_trgm_ops);

-- create_view public.v_records_blocks_core_sales_ledger_entry: typed view with 13 columns
CREATE VIEW public."v_records_blocks_core_sales_ledger_entry" WITH (security_invoker = true) AS SELECT id, workspace_id, version, created_at, updated_at, (data->>'kind') AS "kind", (data->>'sourceEntity') AS "source_entity", ((data->>'sourceId')::uuid) AS "source_id", ((data->>'entryDate')::date) AS "entry_date", ((data->>'amountVnd')::bigint) AS "amount_vnd", (data->>'note') AS "note", (data->>'counterparty') AS "counterparty", (data->>'status') AS "status" FROM public.records WHERE entity = 'blocks-core.sales.ledger-entry' AND deleted_at IS NULL;
GRANT SELECT ON TABLE public."v_records_blocks_core_sales_ledger_entry" TO app_engine;

-- create_partition public.records_blocks_core_sales_ledger_question: records for values in ('blocks-core.sales.ledger-question')
CREATE TABLE public."records_blocks_core_sales_ledger_question" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.ledger-question');

-- add_check public.records_blocks_core_sales_ledger_question:constraint:records_blocks_core_sales_ledger_question_text_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_question" ADD CONSTRAINT "records_blocks_core_sales_ledger_question_text_chk" CHECK ((data->>'text') IS NOT NULL AND (jsonb_typeof(data->'text') = 'string' AND char_length((data->>'text')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_question" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_question_text_chk";

-- add_check public.records_blocks_core_sales_ledger_question:constraint:records_blocks_core_sales_ledger_question_source_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_question" ADD CONSTRAINT "records_blocks_core_sales_ledger_question_source_chk" CHECK ((data->>'source') IS NULL OR (jsonb_typeof(data->'source') = 'string' AND char_length((data->>'source')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_question" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_question_source_chk";

-- add_check public.records_blocks_core_sales_ledger_question:constraint:records_blocks_core_sales_ledger_question_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_question" ADD CONSTRAINT "records_blocks_core_sales_ledger_question_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('open', 'answered'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_question" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_question_status_chk";

-- add_check public.records_blocks_core_sales_ledger_question:constraint:records_blocks_core_sales_ledger_question_answer_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_question" ADD CONSTRAINT "records_blocks_core_sales_ledger_question_answer_chk" CHECK ((data->>'answer') IS NULL OR (jsonb_typeof(data->'answer') = 'string' AND char_length((data->>'answer')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_question" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_question_answer_chk";

-- add_check public.records_blocks_core_sales_ledger_question:constraint:records_blocks_core_sales_ledger_question_answered_by_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_question" ADD CONSTRAINT "records_blocks_core_sales_ledger_question_answered_by_chk" CHECK ((data->>'answeredBy') IS NULL OR (jsonb_typeof(data->'answeredBy') = 'string' AND char_length((data->>'answeredBy')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_question" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_question_answered_by_chk";

-- add_check public.records_blocks_core_sales_ledger_question:constraint:records_blocks_core_sales_ledger_question_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_question" ADD CONSTRAINT "records_blocks_core_sales_ledger_question_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_question" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_question_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_ledger_question:constraint:records_blocks_core_sales_ledger_question_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_question" ADD CONSTRAINT "records_blocks_core_sales_ledger_question_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_question" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_question_agent_fk";

-- create_index public.records_blocks_core_sales_ledger_question:index:records_blocks_core_sales_ledger_question_status_created: on workspace_id, data->>'status', created_at, id using btree
CREATE INDEX "records_blocks_core_sales_ledger_question_status_created" ON public."records_blocks_core_sales_ledger_question" USING btree (workspace_id, (data->>'status'), created_at, id);

-- create_index public.records_blocks_core_sales_ledger_question:index:records_blocks_core_sales_ledger_question_source: on workspace_id, data->>'source', id using btree
CREATE INDEX "records_blocks_core_sales_ledger_question_source" ON public."records_blocks_core_sales_ledger_question" USING btree (workspace_id, (data->>'source'), id);

-- create_partition public.records_blocks_core_sales_ledger_settings: records for values in ('blocks-core.sales.ledger-settings')
CREATE TABLE public."records_blocks_core_sales_ledger_settings" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.ledger-settings');

-- add_check public.records_blocks_core_sales_ledger_settings:constraint:records_blocks_core_sales_ledger_settings_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_settings" ADD CONSTRAINT "records_blocks_core_sales_ledger_settings_scope_chk" CHECK ((data->>'scope') IS NOT NULL AND (jsonb_typeof(data->'scope') = 'string' AND char_length((data->>'scope')) <= 40)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_settings_scope_chk";

-- add_check public.records_blocks_core_sales_ledger_settings:constraint:records_blocks_core_sales_ledger_settings_post_expenses_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_settings" ADD CONSTRAINT "records_blocks_core_sales_ledger_settings_post_expenses_chk" CHECK ((data->>'postExpenses') IS NOT NULL AND (jsonb_typeof(data->'postExpenses') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_settings_post_expenses_chk";

-- add_check public.records_blocks_core_sales_ledger_settings:constraint:records_blocks_core_sales_ledger_settings_post_outgoing_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_settings" ADD CONSTRAINT "records_blocks_core_sales_ledger_settings_post_outgoing_chk" CHECK ((data->>'postOutgoing') IS NOT NULL AND (jsonb_typeof(data->'postOutgoing') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_settings_post_outgoing_chk";

-- add_check public.records_blocks_core_sales_ledger_settings:constraint:records_blocks_core_sales_ledger_settings_post_unmatched_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_settings" ADD CONSTRAINT "records_blocks_core_sales_ledger_settings_post_unmatched_chk" CHECK ((data->>'postUnmatched') IS NOT NULL AND (jsonb_typeof(data->'postUnmatched') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_settings_post_unmatched_chk";

-- add_check public.records_blocks_core_sales_ledger_settings:constraint:records_blocks_core_sales_ledger_settings_void_mode_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_settings" ADD CONSTRAINT "records_blocks_core_sales_ledger_settings_void_mode_chk" CHECK ((data->>'voidMode') IS NOT NULL AND ((data->>'voidMode') IN ('reversal', 'none'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_settings_void_mode_chk";

-- add_check public.records_blocks_core_sales_ledger_settings:constraint:records_blocks_core_sales_ledger_settings_vat_period_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_settings" ADD CONSTRAINT "records_blocks_core_sales_ledger_settings_vat_period_chk" CHECK ((data->>'vatPeriod') IS NOT NULL AND ((data->>'vatPeriod') IN ('monthly', 'quarterly'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_settings_vat_period_chk";

-- add_check public.records_blocks_core_sales_ledger_settings:constraint:records_blocks_core_sales_ledger_settings_rematch_days_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_settings" ADD CONSTRAINT "records_blocks_core_sales_ledger_settings_rematch_days_chk" CHECK ((data->>'rematchDays') IS NOT NULL AND (jsonb_typeof(data->'rematchDays') = 'number' AND (data->>'rematchDays') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_settings_rematch_days_chk";

-- add_check public.records_blocks_core_sales_ledger_settings:constraint:records_blocks_core_sales_ledger_settings_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_settings" ADD CONSTRAINT "records_blocks_core_sales_ledger_settings_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_settings_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_ledger_settings:constraint:records_blocks_core_sales_ledger_settings_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_ledger_settings" ADD CONSTRAINT "records_blocks_core_sales_ledger_settings_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_ledger_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_ledger_settings_agent_fk";

-- create_index public.records_blocks_core_sales_ledger_settings:index:records_blocks_core_sales_ledger_settings_scope: on workspace_id, data->>'scope', id using btree
CREATE INDEX "records_blocks_core_sales_ledger_settings_scope" ON public."records_blocks_core_sales_ledger_settings" USING btree (workspace_id, (data->>'scope'), id);

-- add_unique public.records_blocks_core_sales_ledger_settings:index:records_blocks_core_sales_ledger_settings_scope_key: on workspace_id, agent_id, data->>'scope' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_ledger_settings_scope_key" ON public."records_blocks_core_sales_ledger_settings" USING btree (workspace_id, agent_id, (data->>'scope')) WHERE deleted_at IS NULL;

-- create_partition public.records_blocks_core_sales_loyalty_campaign: records for values in ('blocks-core.sales.loyalty-campaign')
CREATE TABLE public."records_blocks_core_sales_loyalty_campaign" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.loyalty-campaign');

-- add_check public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_name_chk" CHECK ((data->>'name') IS NOT NULL AND (jsonb_typeof(data->'name') = 'string' AND char_length((data->>'name')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_name_chk";

-- add_check public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_segment_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_segment_chk" CHECK ((data->>'segment') IS NOT NULL AND (jsonb_typeof(data->'segment') = 'object')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_segment_chk";

-- add_check public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_draft_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_draft_chk" CHECK ((data->>'draft') IS NOT NULL AND (jsonb_typeof(data->'draft') = 'string' AND char_length((data->>'draft')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_draft_chk";

-- add_check public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('waiting', 'draft', 'waiting_decision', 'sending', 'done', 'failed'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_status_chk";

-- add_check public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_work_item_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_work_item_id_chk" CHECK ((data->>'workItemId') IS NULL OR ((data->>'workItemId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_work_item_id_chk";

-- add_check public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_recipients_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_recipients_chk" CHECK ((data->>'recipients') IS NOT NULL AND (jsonb_typeof(data->'recipients') = 'number' AND (data->>'recipients') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_recipients_chk";

-- add_check public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_sent_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_sent_chk" CHECK ((data->>'sent') IS NOT NULL AND (jsonb_typeof(data->'sent') = 'number' AND (data->>'sent') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_sent_chk";

-- add_check public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_failed_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_failed_chk" CHECK ((data->>'failed') IS NOT NULL AND (jsonb_typeof(data->'failed') = 'number' AND (data->>'failed') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_failed_chk";

-- add_check public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_created_by_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_created_by_chk" CHECK ((data->>'createdBy') IS NOT NULL AND (jsonb_typeof(data->'createdBy') = 'string' AND char_length((data->>'createdBy')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_created_by_chk";

-- add_check public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_loyalty_campaign:constraint:records_blocks_core_sales_loyalty_campaign_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" ADD CONSTRAINT "records_blocks_core_sales_loyalty_campaign_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_campaign" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_campaign_agent_fk";

-- create_index public.records_blocks_core_sales_loyalty_campaign:index:records_blocks_core_sales_loyalty_campaign_recent: on workspace_id, created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_campaign_recent" ON public."records_blocks_core_sales_loyalty_campaign" USING btree (workspace_id, created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_campaign:index:records_blocks_core_sales_loyalty_campaign_status_recent: on workspace_id, data->>'status', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_campaign_status_recent" ON public."records_blocks_core_sales_loyalty_campaign" USING btree (workspace_id, (data->>'status'), created_at DESC, id DESC);

-- create_partition public.records_blocks_core_sales_loyalty_decision: records for values in ('blocks-core.sales.loyalty-decision')
CREATE TABLE public."records_blocks_core_sales_loyalty_decision" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.loyalty-decision');

-- add_check public.records_blocks_core_sales_loyalty_decision:constraint:records_blocks_core_sales_loyalty_decision_action_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" ADD CONSTRAINT "records_blocks_core_sales_loyalty_decision_action_chk" CHECK ((data->>'action') IS NOT NULL AND ((data->>'action') IN ('award_points', 'redeem_reward', 'send_promo', 'adjust_points'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_decision_action_chk";

-- add_check public.records_blocks_core_sales_loyalty_decision:constraint:records_blocks_core_sales_loyalty_decision_summary_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" ADD CONSTRAINT "records_blocks_core_sales_loyalty_decision_summary_chk" CHECK ((data->>'summary') IS NOT NULL AND (jsonb_typeof(data->'summary') = 'string' AND char_length((data->>'summary')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_decision_summary_chk";

-- add_check public.records_blocks_core_sales_loyalty_decision:constraint:records_blocks_core_sales_loyalty_decision_draft_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" ADD CONSTRAINT "records_blocks_core_sales_loyalty_decision_draft_chk" CHECK ((data->>'draft') IS NOT NULL AND (jsonb_typeof(data->'draft') = 'string' AND char_length((data->>'draft')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_decision_draft_chk";

-- add_check public.records_blocks_core_sales_loyalty_decision:constraint:records_blocks_core_sales_loyalty_decision_reason_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" ADD CONSTRAINT "records_blocks_core_sales_loyalty_decision_reason_chk" CHECK ((data->>'reason') IS NULL OR (jsonb_typeof(data->'reason') = 'string' AND char_length((data->>'reason')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_decision_reason_chk";

-- add_check public.records_blocks_core_sales_loyalty_decision:constraint:records_blocks_core_sales_loyalty_decision_amount_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" ADD CONSTRAINT "records_blocks_core_sales_loyalty_decision_amount_vnd_chk" CHECK ((data->>'amountVnd') IS NULL OR (jsonb_typeof(data->'amountVnd') = 'number' AND (data->>'amountVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_decision_amount_vnd_chk";

-- add_check public.records_blocks_core_sales_loyalty_decision:constraint:records_blocks_core_sales_loyalty_decision_customer_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" ADD CONSTRAINT "records_blocks_core_sales_loyalty_decision_customer_chk" CHECK ((data->>'customer') IS NOT NULL AND (jsonb_typeof(data->'customer') = 'string' AND char_length((data->>'customer')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_decision_customer_chk";

-- add_check public.records_blocks_core_sales_loyalty_decision:constraint:records_blocks_core_sales_loyalty_decision_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" ADD CONSTRAINT "records_blocks_core_sales_loyalty_decision_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('waiting', 'approved', 'rejected'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_decision_status_chk";

-- add_check public.records_blocks_core_sales_loyalty_decision:constraint:records_blocks_core_sales_loyalty_decision_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" ADD CONSTRAINT "records_blocks_core_sales_loyalty_decision_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_decision_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_loyalty_decision:constraint:records_blocks_core_sales_loyalty_decision_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" ADD CONSTRAINT "records_blocks_core_sales_loyalty_decision_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_decision" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_decision_agent_fk";

-- create_index public.records_blocks_core_sales_loyalty_decision:index:records_blocks_core_sales_loyalty_decision_status_created: on workspace_id, data->>'status', created_at, id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_decision_status_created" ON public."records_blocks_core_sales_loyalty_decision" USING btree (workspace_id, (data->>'status'), created_at, id);

-- create_partition public.records_blocks_core_sales_loyalty_ledger_entry: records for values in ('blocks-core.sales.loyalty-ledger-entry')
CREATE TABLE public."records_blocks_core_sales_loyalty_ledger_entry" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.loyalty-ledger-entry');

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_member_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_member_id_chk" CHECK ((data->>'memberId') IS NOT NULL AND ((data->>'memberId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_member_id_chk";

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_kind_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_kind_chk" CHECK ((data->>'kind') IS NOT NULL AND ((data->>'kind') IN ('earn', 'redeem', 'expire', 'adjust'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_kind_chk";

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_points_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_points_chk" CHECK ((data->>'points') IS NOT NULL AND (jsonb_typeof(data->'points') = 'number' AND (data->>'points') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_points_chk";

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_amount_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_amount_vnd_chk" CHECK ((data->>'amountVnd') IS NULL OR (jsonb_typeof(data->'amountVnd') = 'number' AND (data->>'amountVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_amount_vnd_chk";

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_evidence_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_evidence_chk" CHECK ((data->>'evidence') IS NULL OR (jsonb_typeof(data->'evidence') = 'string' AND char_length((data->>'evidence')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_evidence_chk";

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_by_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_by_chk" CHECK ((data->>'by') IS NOT NULL AND (jsonb_typeof(data->'by') = 'string' AND char_length((data->>'by')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_by_chk";

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_expires_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_expires_at_chk" CHECK ((data->>'expiresAt') IS NULL OR ((data->>'expiresAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_expires_at_chk";

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_occurred_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_occurred_at_chk" CHECK ((data->>'occurredAt') IS NOT NULL AND ((data->>'occurredAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_occurred_at_chk";

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_ref_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_ref_chk" CHECK ((data->>'ref') IS NOT NULL AND (jsonb_typeof(data->'ref') = 'string' AND char_length((data->>'ref')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_ref_chk";

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_reward_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_reward_id_chk" CHECK ((data->>'rewardId') IS NULL OR ((data->>'rewardId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_reward_id_chk";

-- add_check public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_loyalty_ledger_entry:constraint:records_blocks_core_sales_loyalty_ledger_entry_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" ADD CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_ledger_entry" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_ledger_entry_agent_fk";

-- create_index public.records_blocks_core_sales_loyalty_ledger_entry:index:records_blocks_core_sales_loyalty_ledger_entry_member_occurred: on workspace_id, data->>'memberid', data->>'occurredat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_ledger_entry_member_occurred" ON public."records_blocks_core_sales_loyalty_ledger_entry" USING btree (workspace_id, ((data->>'memberId')::uuid), (data->>'occurredAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_ledger_entry:index:records_blocks_core_sales_loyalty_ledger_entry_member_kind: on workspace_id, data->>'memberid', data->>'kind', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_ledger_entry_member_kind" ON public."records_blocks_core_sales_loyalty_ledger_entry" USING btree (workspace_id, ((data->>'memberId')::uuid), (data->>'kind'), id);

-- create_index public.records_blocks_core_sales_loyalty_ledger_entry:index:records_blocks_core_sales_loyalty_ledger_entry_occurred: on workspace_id, data->>'occurredat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_ledger_entry_occurred" ON public."records_blocks_core_sales_loyalty_ledger_entry" USING btree (workspace_id, (data->>'occurredAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_ledger_entry:index:records_blocks_core_sales_loyalty_ledger_entry_kind_occurred: on workspace_id, data->>'kind', data->>'occurredat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_ledger_entry_kind_occurred" ON public."records_blocks_core_sales_loyalty_ledger_entry" USING btree (workspace_id, (data->>'kind'), (data->>'occurredAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_ledger_entry:index:records_blocks_core_sales_loyalty_ledger_entry_ref: on workspace_id, data->>'ref', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_ledger_entry_ref" ON public."records_blocks_core_sales_loyalty_ledger_entry" USING btree (workspace_id, (data->>'ref'), id);

-- create_index public.records_blocks_core_sales_loyalty_ledger_entry:index:records_blocks_core_sales_loyalty_ledger_entry_reward: on workspace_id, data->>'rewardid', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_ledger_entry_reward" ON public."records_blocks_core_sales_loyalty_ledger_entry" USING btree (workspace_id, ((data->>'rewardId')::uuid), id);

-- add_unique public.records_blocks_core_sales_loyalty_ledger_entry:index:records_blocks_core_sales_loyalty_ledger_entry_ref_key: on workspace_id, agent_id, data->>'ref' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_loyalty_ledger_entry_ref_key" ON public."records_blocks_core_sales_loyalty_ledger_entry" USING btree (workspace_id, agent_id, (data->>'ref')) WHERE deleted_at IS NULL;

-- create_partition public.records_blocks_core_sales_loyalty_member: records for values in ('blocks-core.sales.loyalty-member')
CREATE TABLE public."records_blocks_core_sales_loyalty_member" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.loyalty-member');

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_name_chk" CHECK ((data->>'name') IS NOT NULL AND (jsonb_typeof(data->'name') = 'string' AND char_length((data->>'name')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_name_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_phone_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_phone_chk" CHECK ((data->>'phone') IS NULL OR (jsonb_typeof(data->'phone') = 'string' AND char_length((data->>'phone')) <= 30)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_phone_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_email_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_email_chk" CHECK ((data->>'email') IS NULL OR (jsonb_typeof(data->'email') = 'string' AND char_length((data->>'email')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_email_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_contact_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_contact_chk" CHECK ((data->>'contact') IS NOT NULL AND (jsonb_typeof(data->'contact') = 'string' AND char_length((data->>'contact')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_contact_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_birthday_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_birthday_chk" CHECK ((data->>'birthday') IS NULL OR ((data->>'birthday') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_birthday_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_note_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_note_chk" CHECK ((data->>'note') IS NOT NULL AND (jsonb_typeof(data->'note') = 'string' AND char_length((data->>'note')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_note_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_tier_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_tier_key_chk" CHECK ((data->>'tierKey') IS NULL OR (jsonb_typeof(data->'tierKey') = 'string' AND char_length((data->>'tierKey')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_tier_key_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_tier_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_tier_chk" CHECK ((data->>'tier') IS NOT NULL AND (jsonb_typeof(data->'tier') = 'string' AND char_length((data->>'tier')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_tier_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_points_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_points_chk" CHECK ((data->>'points') IS NOT NULL AND (jsonb_typeof(data->'points') = 'number' AND (data->>'points') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_points_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_lifetime_spend_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_lifetime_spend_vnd_chk" CHECK ((data->>'lifetimeSpendVnd') IS NOT NULL AND (jsonb_typeof(data->'lifetimeSpendVnd') = 'number' AND (data->>'lifetimeSpendVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_lifetime_spend_vnd_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_visits_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_visits_chk" CHECK ((data->>'visits') IS NOT NULL AND (jsonb_typeof(data->'visits') = 'number' AND (data->>'visits') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_visits_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_last_visit_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_last_visit_at_chk" CHECK ((data->>'lastVisitAt') IS NULL OR ((data->>'lastVisitAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_last_visit_at_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_last_activity_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_last_activity_at_chk" CHECK ((data->>'lastActivityAt') IS NOT NULL AND ((data->>'lastActivityAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_last_activity_at_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_joined_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_joined_at_chk" CHECK ((data->>'joinedAt') IS NOT NULL AND ((data->>'joinedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_joined_at_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_activity_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_activity_chk" CHECK ((data->>'activity') IS NOT NULL AND ((data->>'activity') IN ('active', 'at_risk', 'new'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_activity_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_contact_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_contact_id_chk" CHECK ((data->>'contactId') IS NULL OR ((data->>'contactId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_contact_id_chk";

-- add_check public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_loyalty_member:constraint:records_blocks_core_sales_loyalty_member_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_member" ADD CONSTRAINT "records_blocks_core_sales_loyalty_member_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_member" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_member_agent_fk";

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_recent: on workspace_id, data->>'lastactivityat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_recent" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'lastActivityAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_points: on workspace_id, data->>'points'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_points" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, ((data->>'points')::integer) DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_spend: on workspace_id, data->>'lifetimespendvnd'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_spend" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, ((data->>'lifetimeSpendVnd')::bigint) DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_name: on workspace_id, data->>'name', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_name" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'name'), id);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_activity_recent: on workspace_id, data->>'activity', data->>'lastactivityat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_activity_recent" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'activity'), (data->>'lastActivityAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_activity_points: on workspace_id, data->>'activity', data->>'points'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_activity_points" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'activity'), ((data->>'points')::integer) DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_activity_spend: on workspace_id, data->>'activity', data->>'lifetimespendvnd'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_activity_spend" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'activity'), ((data->>'lifetimeSpendVnd')::bigint) DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_activity_name: on workspace_id, data->>'activity', data->>'name', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_activity_name" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'activity'), (data->>'name'), id);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_tier_recent: on workspace_id, data->>'tierkey', data->>'lastactivityat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_tier_recent" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'tierKey'), (data->>'lastActivityAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_tier_points: on workspace_id, data->>'tierkey', data->>'points'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_tier_points" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'tierKey'), ((data->>'points')::integer) DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_tier_spend: on workspace_id, data->>'tierkey', data->>'lifetimespendvnd'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_tier_spend" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'tierKey'), ((data->>'lifetimeSpendVnd')::bigint) DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_tier_name: on workspace_id, data->>'tierkey', data->>'name', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_tier_name" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'tierKey'), (data->>'name'), id);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_phone: on workspace_id, data->>'phone', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_phone" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'phone'), id);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_email: on workspace_id, data->>'email', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_email" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, (data->>'email'), id);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_contact: on workspace_id, data->>'contactid', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_contact" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, ((data->>'contactId')::uuid), id);

-- add_unique public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_phone_key: on workspace_id, agent_id, data->>'phone' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_loyalty_member_phone_key" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, agent_id, (data->>'phone')) WHERE ((data->>'phone') IS NOT NULL) AND deleted_at IS NULL;

-- add_unique public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_email_key: on workspace_id, agent_id, data->>'email' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_loyalty_member_email_key" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, agent_id, (data->>'email')) WHERE ((data->>'email') IS NOT NULL) AND deleted_at IS NULL;

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_name_trgm_idx: on knowledge_folddata->>'name' using gin
CREATE INDEX "records_blocks_core_sales_loyalty_member_name_trgm_idx" ON public."records_blocks_core_sales_loyalty_member" USING gin (public.knowledge_fold((data->>'name')) extensions.gin_trgm_ops);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_contact_trgm_idx: on knowledge_folddata->>'contact' using gin
CREATE INDEX "records_blocks_core_sales_loyalty_member_contact_trgm_idx" ON public."records_blocks_core_sales_loyalty_member" USING gin (public.knowledge_fold((data->>'contact')) extensions.gin_trgm_ops);

-- create_index public.records_blocks_core_sales_loyalty_member:index:records_blocks_core_sales_loyalty_member_contact_id_contact_idx: on workspace_id, data->>'contactid' using btree
CREATE INDEX "records_blocks_core_sales_loyalty_member_contact_id_contact_idx" ON public."records_blocks_core_sales_loyalty_member" USING btree (workspace_id, ((data->>'contactId')::uuid));

-- create_partition public.records_blocks_core_sales_loyalty_program: records for values in ('blocks-core.sales.loyalty-program')
CREATE TABLE public."records_blocks_core_sales_loyalty_program" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.loyalty-program');

-- add_check public.records_blocks_core_sales_loyalty_program:constraint:records_blocks_core_sales_loyalty_program_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_program" ADD CONSTRAINT "records_blocks_core_sales_loyalty_program_scope_chk" CHECK ((data->>'scope') IS NOT NULL AND (jsonb_typeof(data->'scope') = 'string' AND char_length((data->>'scope')) <= 40)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_program" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_program_scope_chk";

-- add_check public.records_blocks_core_sales_loyalty_program:constraint:records_blocks_core_sales_loyalty_program_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_program" ADD CONSTRAINT "records_blocks_core_sales_loyalty_program_name_chk" CHECK ((data->>'name') IS NOT NULL AND (jsonb_typeof(data->'name') = 'string' AND char_length((data->>'name')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_program" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_program_name_chk";

-- add_check public.records_blocks_core_sales_loyalty_program:constraint:records_blocks_core_sales_loyalty_program_slug_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_program" ADD CONSTRAINT "records_blocks_core_sales_loyalty_program_slug_chk" CHECK ((data->>'slug') IS NOT NULL AND (jsonb_typeof(data->'slug') = 'string' AND char_length((data->>'slug')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_program" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_program_slug_chk";

-- add_check public.records_blocks_core_sales_loyalty_program:constraint:records_blocks_core_sales_loyalty_program_enabled_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_program" ADD CONSTRAINT "records_blocks_core_sales_loyalty_program_enabled_chk" CHECK ((data->>'enabled') IS NOT NULL AND (jsonb_typeof(data->'enabled') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_program" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_program_enabled_chk";

-- add_check public.records_blocks_core_sales_loyalty_program:constraint:records_blocks_core_sales_loyalty_program_config_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_program" ADD CONSTRAINT "records_blocks_core_sales_loyalty_program_config_chk" CHECK ((data->>'config') IS NOT NULL AND (jsonb_typeof(data->'config') = 'object')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_program" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_program_config_chk";

-- add_check public.records_blocks_core_sales_loyalty_program:constraint:records_blocks_core_sales_loyalty_program_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_program" ADD CONSTRAINT "records_blocks_core_sales_loyalty_program_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_program" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_program_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_loyalty_program:constraint:records_blocks_core_sales_loyalty_program_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_program" ADD CONSTRAINT "records_blocks_core_sales_loyalty_program_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_program" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_program_agent_fk";

-- create_index public.records_blocks_core_sales_loyalty_program:index:records_blocks_core_sales_loyalty_program_scope: on workspace_id, data->>'scope', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_program_scope" ON public."records_blocks_core_sales_loyalty_program" USING btree (workspace_id, (data->>'scope'), id);

-- add_unique public.records_blocks_core_sales_loyalty_program:index:records_blocks_core_sales_loyalty_program_scope_key: on workspace_id, agent_id, data->>'scope' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_loyalty_program_scope_key" ON public."records_blocks_core_sales_loyalty_program" USING btree (workspace_id, agent_id, (data->>'scope')) WHERE deleted_at IS NULL;

-- create_partition public.records_blocks_core_sales_loyalty_reward: records for values in ('blocks-core.sales.loyalty-reward')
CREATE TABLE public."records_blocks_core_sales_loyalty_reward" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.loyalty-reward');

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_key_chk" CHECK ((data->>'key') IS NOT NULL AND (jsonb_typeof(data->'key') = 'string' AND char_length((data->>'key')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_key_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_name_chk" CHECK ((data->>'name') IS NOT NULL AND (jsonb_typeof(data->'name') = 'string' AND char_length((data->>'name')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_name_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_kind_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_kind_chk" CHECK ((data->>'kind') IS NOT NULL AND ((data->>'kind') IN ('voucher', 'item', 'percent'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_kind_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_value_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_value_vnd_chk" CHECK ((data->>'valueVnd') IS NOT NULL AND (jsonb_typeof(data->'valueVnd') = 'number' AND (data->>'valueVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_value_vnd_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_percent_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_percent_chk" CHECK ((data->>'percent') IS NULL OR (jsonb_typeof(data->'percent') = 'number' AND (data->>'percent') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_percent_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_points_cost_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_points_cost_chk" CHECK ((data->>'pointsCost') IS NOT NULL AND (jsonb_typeof(data->'pointsCost') = 'number' AND (data->>'pointsCost') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_points_cost_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_stock_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_stock_chk" CHECK ((data->>'stock') IS NULL OR (jsonb_typeof(data->'stock') = 'number' AND (data->>'stock') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_stock_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_per_customer_limit_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_per_customer_limit_chk" CHECK ((data->>'perCustomerLimit') IS NULL OR (jsonb_typeof(data->'perCustomerLimit') = 'number' AND (data->>'perCustomerLimit') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_per_customer_limit_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_min_tier_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_min_tier_key_chk" CHECK ((data->>'minTierKey') IS NULL OR (jsonb_typeof(data->'minTierKey') = 'string' AND char_length((data->>'minTierKey')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_min_tier_key_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_note_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_note_chk" CHECK ((data->>'note') IS NOT NULL AND (jsonb_typeof(data->'note') = 'string' AND char_length((data->>'note')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_note_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_active_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_active_chk" CHECK ((data->>'active') IS NOT NULL AND (jsonb_typeof(data->'active') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_active_chk";

-- add_check public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_loyalty_reward:constraint:records_blocks_core_sales_loyalty_reward_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" ADD CONSTRAINT "records_blocks_core_sales_loyalty_reward_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_loyalty_reward" VALIDATE CONSTRAINT "records_blocks_core_sales_loyalty_reward_agent_fk";

-- create_index public.records_blocks_core_sales_loyalty_reward:index:records_blocks_core_sales_loyalty_reward_recent: on workspace_id, created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_reward_recent" ON public."records_blocks_core_sales_loyalty_reward" USING btree (workspace_id, created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_reward:index:records_blocks_core_sales_loyalty_reward_active_recent: on workspace_id, data->>'active', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_loyalty_reward_active_recent" ON public."records_blocks_core_sales_loyalty_reward" USING btree (workspace_id, ((data->>'active')::boolean), created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_loyalty_reward:index:records_blocks_core_sales_loyalty_reward_key: on workspace_id, data->>'key', id using btree
CREATE INDEX "records_blocks_core_sales_loyalty_reward_key" ON public."records_blocks_core_sales_loyalty_reward" USING btree (workspace_id, (data->>'key'), id);

-- add_unique public.records_blocks_core_sales_loyalty_reward:index:records_blocks_core_sales_loyalty_reward_key_key: on workspace_id, agent_id, data->>'key' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_loyalty_reward_key_key" ON public."records_blocks_core_sales_loyalty_reward" USING btree (workspace_id, agent_id, (data->>'key')) WHERE deleted_at IS NULL;

-- create_index public.records_blocks_core_sales_loyalty_reward:index:records_blocks_core_sales_loyalty_reward_name_trgm_idx: on knowledge_folddata->>'name' using gin
CREATE INDEX "records_blocks_core_sales_loyalty_reward_name_trgm_idx" ON public."records_blocks_core_sales_loyalty_reward" USING gin (public.knowledge_fold((data->>'name')) extensions.gin_trgm_ops);

-- create_partition public.records_blocks_core_sales_order: records for values in ('blocks-core.sales.order')
CREATE TABLE public."records_blocks_core_sales_order" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.order');

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_order_no_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_order_no_chk" CHECK ((data->>'orderNo') IS NOT NULL AND (jsonb_typeof(data->'orderNo') = 'string')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_order_no_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_contact_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_contact_id_chk" CHECK ((data->>'contactId') IS NULL OR ((data->>'contactId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_contact_id_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_items_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_items_chk" CHECK ((data->>'items') IS NOT NULL AND (jsonb_typeof(data->'items') = 'object')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_items_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_items_text_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_items_text_chk" CHECK ((data->>'itemsText') IS NOT NULL AND (jsonb_typeof(data->'itemsText') = 'string' AND char_length((data->>'itemsText')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_items_text_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_note_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_note_chk" CHECK ((data->>'note') IS NOT NULL AND (jsonb_typeof(data->'note') = 'string' AND char_length((data->>'note')) <= 20000)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_note_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_recipient_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_recipient_name_chk" CHECK ((data->>'recipientName') IS NULL OR (jsonb_typeof(data->'recipientName') = 'string' AND char_length((data->>'recipientName')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_recipient_name_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_delivery_address_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_delivery_address_chk" CHECK ((data->>'deliveryAddress') IS NULL OR (jsonb_typeof(data->'deliveryAddress') = 'string' AND char_length((data->>'deliveryAddress')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_delivery_address_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_recipient_phone_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_recipient_phone_chk" CHECK ((data->>'recipientPhone') IS NULL OR (jsonb_typeof(data->'recipientPhone') = 'string' AND char_length((data->>'recipientPhone')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_recipient_phone_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_delivery_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_delivery_at_chk" CHECK ((data->>'deliveryAt') IS NULL OR (jsonb_typeof(data->'deliveryAt') = 'string' AND char_length((data->>'deliveryAt')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_delivery_at_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_qr_connection_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_qr_connection_id_chk" CHECK ((data->>'qrConnectionId') IS NULL OR ((data->>'qrConnectionId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_qr_connection_id_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_paid_connection_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_paid_connection_id_chk" CHECK ((data->>'paidConnectionId') IS NULL OR ((data->>'paidConnectionId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_paid_connection_id_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_amount_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_amount_vnd_chk" CHECK ((data->>'amountVnd') IS NULL OR (jsonb_typeof(data->'amountVnd') = 'number' AND (data->>'amountVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_amount_vnd_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('draft', 'confirmed', 'invoiced', 'paid', 'cancelled', 'failed_system'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_status_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_confirmed_by_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_confirmed_by_chk" CHECK ((data->>'confirmedBy') IS NULL OR (jsonb_typeof(data->'confirmedBy') = 'string' AND char_length((data->>'confirmedBy')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_confirmed_by_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_confirmed_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_confirmed_at_chk" CHECK ((data->>'confirmedAt') IS NULL OR ((data->>'confirmedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_confirmed_at_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_shipped_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_shipped_at_chk" CHECK ((data->>'shippedAt') IS NULL OR ((data->>'shippedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_shipped_at_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_carrier_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_carrier_chk" CHECK ((data->>'carrier') IS NULL OR (jsonb_typeof(data->'carrier') = 'string' AND char_length((data->>'carrier')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_carrier_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_tracking_code_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_tracking_code_chk" CHECK ((data->>'trackingCode') IS NULL OR (jsonb_typeof(data->'trackingCode') = 'string' AND char_length((data->>'trackingCode')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_tracking_code_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_amount_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_amount_chk" CHECK ((((data->>'amountVnd')::bigint) IS NULL OR ((data->>'amountVnd')::bigint) >= 0)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_amount_chk";

-- add_check public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_order:constraint:records_blocks_core_sales_order_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_order" ADD CONSTRAINT "records_blocks_core_sales_order_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_order" VALIDATE CONSTRAINT "records_blocks_core_sales_order_agent_fk";

-- create_index public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_key: on workspace_id, id using btree
CREATE INDEX "records_blocks_core_sales_order_key" ON public."records_blocks_core_sales_order" USING btree (workspace_id, id);

-- create_index public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_recent: on workspace_id, created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_order_recent" ON public."records_blocks_core_sales_order" USING btree (workspace_id, created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_status_recent: on workspace_id, data->>'status', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_order_status_recent" ON public."records_blocks_core_sales_order" USING btree (workspace_id, (data->>'status'), created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_contact_recent: on workspace_id, data->>'contactid', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_order_contact_recent" ON public."records_blocks_core_sales_order" USING btree (workspace_id, ((data->>'contactId')::uuid), created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_contact_status_recent: on workspace_id, data->>'contactid', data->>'status', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_order_contact_status_recent" ON public."records_blocks_core_sales_order" USING btree (workspace_id, ((data->>'contactId')::uuid), (data->>'status'), created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_amount: on workspace_id, data->>'amountvnd'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_order_amount" ON public."records_blocks_core_sales_order" USING btree (workspace_id, ((data->>'amountVnd')::bigint) DESC, id DESC);

-- create_index public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_status_amount: on workspace_id, data->>'status', data->>'amountvnd'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_order_status_amount" ON public."records_blocks_core_sales_order" USING btree (workspace_id, (data->>'status'), ((data->>'amountVnd')::bigint) DESC, id DESC);

-- add_unique public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_order_no_key: on workspace_id, agent_id, data->>'orderno' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_order_order_no_key" ON public."records_blocks_core_sales_order" USING btree (workspace_id, agent_id, (data->>'orderNo')) WHERE deleted_at IS NULL;

-- create_index public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_contact_id_contact_idx: on workspace_id, data->>'contactid' using btree
CREATE INDEX "records_blocks_core_sales_order_contact_id_contact_idx" ON public."records_blocks_core_sales_order" USING btree (workspace_id, ((data->>'contactId')::uuid));

-- create_index public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_items_text_trgm_idx: on knowledge_folddata->>'itemstext' using gin
CREATE INDEX "records_blocks_core_sales_order_items_text_trgm_idx" ON public."records_blocks_core_sales_order" USING gin (public.knowledge_fold((data->>'itemsText')) extensions.gin_trgm_ops);

-- create_index public.records_blocks_core_sales_order:index:records_blocks_core_sales_order_note_trgm_idx: on knowledge_folddata->>'note' using gin
CREATE INDEX "records_blocks_core_sales_order_note_trgm_idx" ON public."records_blocks_core_sales_order" USING gin (public.knowledge_fold((data->>'note')) extensions.gin_trgm_ops);

-- create_partition public.records_blocks_core_sales_settings: records for values in ('blocks-core.sales.settings')
CREATE TABLE public."records_blocks_core_sales_settings" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.settings');

-- add_check public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_key_chk" CHECK ((data->>'key') IS NOT NULL AND (jsonb_typeof(data->'key') = 'string' AND char_length((data->>'key')) <= 20)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_key_chk";

-- add_check public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_approval_threshold_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_approval_threshold_vnd_chk" CHECK ((data->>'approvalThresholdVnd') IS NOT NULL AND (jsonb_typeof(data->'approvalThresholdVnd') = 'number' AND (data->>'approvalThresholdVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_approval_threshold_vnd_chk";

-- add_check public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_draft_without_total_needs_ap: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_draft_without_total_needs_ap" CHECK ((data->>'draftWithoutTotalNeedsApproval') IS NOT NULL AND (jsonb_typeof(data->'draftWithoutTotalNeedsApproval') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_draft_without_total_needs_ap";

-- add_check public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_closed_deals_can_flip_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_closed_deals_can_flip_chk" CHECK ((data->>'closedDealsCanFlip') IS NOT NULL AND (jsonb_typeof(data->'closedDealsCanFlip') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_closed_deals_can_flip_chk";

-- add_check public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_reopen_needs_approval_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_reopen_needs_approval_chk" CHECK ((data->>'reopenNeedsApproval') IS NOT NULL AND (jsonb_typeof(data->'reopenNeedsApproval') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_reopen_needs_approval_chk";

-- add_check public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_max_discount_pct_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_max_discount_pct_chk" CHECK ((data->>'maxDiscountPct') IS NOT NULL AND (jsonb_typeof(data->'maxDiscountPct') = 'number' AND (data->>'maxDiscountPct') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_max_discount_pct_chk";

-- add_check public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_remind_after_days_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_remind_after_days_chk" CHECK ((data->>'remindAfterDays') IS NOT NULL AND (jsonb_typeof(data->'remindAfterDays') = 'number' AND (data->>'remindAfterDays') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_remind_after_days_chk";

-- add_check public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_auto_won_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_auto_won_chk" CHECK ((data->>'autoWon') IS NOT NULL AND (jsonb_typeof(data->'autoWon') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_auto_won_chk";

-- add_check public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_notify_accounting_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_notify_accounting_chk" CHECK ((data->>'notifyAccounting') IS NOT NULL AND (jsonb_typeof(data->'notifyAccounting') = 'boolean')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_notify_accounting_chk";

-- add_check public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_settings:constraint:records_blocks_core_sales_settings_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_settings" ADD CONSTRAINT "records_blocks_core_sales_settings_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_settings" VALIDATE CONSTRAINT "records_blocks_core_sales_settings_agent_fk";

-- create_index public.records_blocks_core_sales_settings:index:records_blocks_core_sales_settings_key: on workspace_id, data->>'key', id using btree
CREATE INDEX "records_blocks_core_sales_settings_key" ON public."records_blocks_core_sales_settings" USING btree (workspace_id, (data->>'key'), id);

-- add_unique public.records_blocks_core_sales_settings:index:records_blocks_core_sales_settings_key_key: on workspace_id, agent_id, data->>'key' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_settings_key_key" ON public."records_blocks_core_sales_settings" USING btree (workspace_id, agent_id, (data->>'key')) WHERE deleted_at IS NULL;

-- create_partition public.records_blocks_core_sales_transaction: records for values in ('blocks-core.sales.transaction')
CREATE TABLE public."records_blocks_core_sales_transaction" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.transaction');

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_channel_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_channel_chk" CHECK ((data->>'channel') IS NOT NULL AND ((data->>'channel') IN ('bank', 'cash', 'card', 'ewallet'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_channel_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_direction_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_direction_chk" CHECK ((data->>'direction') IS NOT NULL AND ((data->>'direction') IN ('credit', 'debit'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_direction_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_amount_vnd_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_amount_vnd_chk" CHECK ((data->>'amountVnd') IS NOT NULL AND (jsonb_typeof(data->'amountVnd') = 'number' AND (data->>'amountVnd') ~ '^-?[0-9]{1,19}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_amount_vnd_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_reference_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_reference_chk" CHECK ((data->>'reference') IS NULL OR (jsonb_typeof(data->'reference') = 'string' AND char_length((data->>'reference')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_reference_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_payer_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_payer_chk" CHECK ((data->>'payer') IS NULL OR (jsonb_typeof(data->'payer') = 'string' AND char_length((data->>'payer')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_payer_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_order_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_order_id_chk" CHECK ((data->>'orderId') IS NULL OR ((data->>'orderId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_order_id_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_invoice_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_invoice_id_chk" CHECK ((data->>'invoiceId') IS NULL OR ((data->>'invoiceId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_invoice_id_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_external_ref_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_external_ref_chk" CHECK ((data->>'externalRef') IS NULL OR (jsonb_typeof(data->'externalRef') = 'string' AND char_length((data->>'externalRef')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_external_ref_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_account_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_account_chk" CHECK ((data->>'account') IS NULL OR (jsonb_typeof(data->'account') = 'string' AND char_length((data->>'account')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_account_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_connection_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_connection_id_chk" CHECK ((data->>'connectionId') IS NULL OR ((data->>'connectionId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_connection_id_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_occurred_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_occurred_at_chk" CHECK ((data->>'occurredAt') IS NOT NULL AND ((data->>'occurredAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_occurred_at_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('unmatched', 'matched', 'needs_review', 'other_income'))) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_status_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_amount_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_amount_chk" CHECK (((data->>'amountVnd')::bigint) >= 0) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_amount_chk";

-- add_check public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_sales_transaction:constraint:records_blocks_core_sales_transaction_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_sales_transaction" ADD CONSTRAINT "records_blocks_core_sales_transaction_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_sales_transaction" VALIDATE CONSTRAINT "records_blocks_core_sales_transaction_agent_fk";

-- create_index public.records_blocks_core_sales_transaction:index:records_blocks_core_sales_transaction_key: on workspace_id, id using btree
CREATE INDEX "records_blocks_core_sales_transaction_key" ON public."records_blocks_core_sales_transaction" USING btree (workspace_id, id);

-- create_index public.records_blocks_core_sales_transaction:index:records_blocks_core_sales_transaction_amount_recent: on workspace_id, data->>'amountvnd', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_transaction_amount_recent" ON public."records_blocks_core_sales_transaction" USING btree (workspace_id, ((data->>'amountVnd')::bigint), created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_transaction:index:records_blocks_core_sales_transaction_status_recent: on workspace_id, data->>'status', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_transaction_status_recent" ON public."records_blocks_core_sales_transaction" USING btree (workspace_id, (data->>'status'), created_at DESC, id DESC);

-- create_index public.records_blocks_core_sales_transaction:index:records_blocks_core_sales_transaction_occurred: on workspace_id, data->>'occurredat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_transaction_occurred" ON public."records_blocks_core_sales_transaction" USING btree (workspace_id, (data->>'occurredAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_transaction:index:records_blocks_core_sales_transaction_status_occurred: on workspace_id, data->>'status', data->>'occurredat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_transaction_status_occurred" ON public."records_blocks_core_sales_transaction" USING btree (workspace_id, (data->>'status'), (data->>'occurredAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_transaction:index:records_blocks_core_sales_transaction_direction_occurred: on workspace_id, data->>'direction', data->>'occurredat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_transaction_direction_occurred" ON public."records_blocks_core_sales_transaction" USING btree (workspace_id, (data->>'direction'), (data->>'occurredAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_transaction:index:records_blocks_core_sales_transaction_direction_status_occurred: on workspace_id, data->>'direction', data->>'status', data->>'occurredat'desc, iddesc using btree
CREATE INDEX "records_blocks_core_sales_transaction_direction_status_occurred" ON public."records_blocks_core_sales_transaction" USING btree (workspace_id, (data->>'direction'), (data->>'status'), (data->>'occurredAt') DESC, id DESC);

-- create_index public.records_blocks_core_sales_transaction:index:records_blocks_core_sales_transaction_invoice: on workspace_id, data->>'invoiceid', iddesc using btree
CREATE INDEX "records_blocks_core_sales_transaction_invoice" ON public."records_blocks_core_sales_transaction" USING btree (workspace_id, ((data->>'invoiceId')::uuid), id DESC);

-- create_index public.records_blocks_core_sales_transaction:index:records_blocks_core_sales_transaction_order: on workspace_id, data->>'orderid', iddesc using btree
CREATE INDEX "records_blocks_core_sales_transaction_order" ON public."records_blocks_core_sales_transaction" USING btree (workspace_id, ((data->>'orderId')::uuid), id DESC);

-- add_unique public.records_blocks_core_sales_transaction:index:records_blocks_core_sales_transaction_external_ref_key: on workspace_id, agent_id, data->>'externalref' using btree
CREATE UNIQUE INDEX "records_blocks_core_sales_transaction_external_ref_key" ON public."records_blocks_core_sales_transaction" USING btree (workspace_id, agent_id, (data->>'externalRef')) WHERE ((data->>'externalRef') IS NOT NULL) AND deleted_at IS NULL;

-- create_partition public.records_blocks_core_video_brand_kit: records for values in ('blocks-core.video.brand-kit')
CREATE TABLE public."records_blocks_core_video_brand_kit" PARTITION OF public.records FOR VALUES IN ('blocks-core.video.brand-kit');

-- add_check public.records_blocks_core_video_brand_kit:constraint:records_blocks_core_video_brand_kit_key_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_brand_kit" ADD CONSTRAINT "records_blocks_core_video_brand_kit_key_chk" CHECK ((data->>'key') IS NOT NULL AND ((data->>'key') IN ('video'))) NOT VALID;
ALTER TABLE public."records_blocks_core_video_brand_kit" VALIDATE CONSTRAINT "records_blocks_core_video_brand_kit_key_chk";

-- add_check public.records_blocks_core_video_brand_kit:constraint:records_blocks_core_video_brand_kit_shop_name_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_brand_kit" ADD CONSTRAINT "records_blocks_core_video_brand_kit_shop_name_chk" CHECK ((data->>'shopName') IS NOT NULL AND (jsonb_typeof(data->'shopName') = 'string' AND char_length((data->>'shopName')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_brand_kit" VALIDATE CONSTRAINT "records_blocks_core_video_brand_kit_shop_name_chk";

-- add_check public.records_blocks_core_video_brand_kit:constraint:records_blocks_core_video_brand_kit_primary_color_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_brand_kit" ADD CONSTRAINT "records_blocks_core_video_brand_kit_primary_color_chk" CHECK ((data->>'primaryColor') IS NULL OR (jsonb_typeof(data->'primaryColor') = 'string' AND char_length((data->>'primaryColor')) <= 7)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_brand_kit" VALIDATE CONSTRAINT "records_blocks_core_video_brand_kit_primary_color_chk";

-- add_check public.records_blocks_core_video_brand_kit:constraint:records_blocks_core_video_brand_kit_secondary_color_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_brand_kit" ADD CONSTRAINT "records_blocks_core_video_brand_kit_secondary_color_chk" CHECK ((data->>'secondaryColor') IS NULL OR (jsonb_typeof(data->'secondaryColor') = 'string' AND char_length((data->>'secondaryColor')) <= 7)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_brand_kit" VALIDATE CONSTRAINT "records_blocks_core_video_brand_kit_secondary_color_chk";

-- add_check public.records_blocks_core_video_brand_kit:constraint:records_blocks_core_video_brand_kit_voice_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_brand_kit" ADD CONSTRAINT "records_blocks_core_video_brand_kit_voice_id_chk" CHECK ((data->>'voiceId') IS NULL OR (jsonb_typeof(data->'voiceId') = 'string' AND char_length((data->>'voiceId')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_brand_kit" VALIDATE CONSTRAINT "records_blocks_core_video_brand_kit_voice_id_chk";

-- add_check public.records_blocks_core_video_brand_kit:constraint:records_blocks_core_video_brand_kit_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_brand_kit" ADD CONSTRAINT "records_blocks_core_video_brand_kit_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_video_brand_kit" VALIDATE CONSTRAINT "records_blocks_core_video_brand_kit_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_video_brand_kit:constraint:records_blocks_core_video_brand_kit_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_brand_kit" ADD CONSTRAINT "records_blocks_core_video_brand_kit_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_video_brand_kit" VALIDATE CONSTRAINT "records_blocks_core_video_brand_kit_agent_fk";

-- create_index public.records_blocks_core_video_brand_kit:index:records_blocks_core_video_brand_kit_key_id: on workspace_id, data->>'key', id using btree
CREATE INDEX "records_blocks_core_video_brand_kit_key_id" ON public."records_blocks_core_video_brand_kit" USING btree (workspace_id, (data->>'key'), id);

-- add_unique public.records_blocks_core_video_brand_kit:index:records_blocks_core_video_brand_kit_brand_key: on workspace_id, agent_id, data->>'key' using btree
CREATE UNIQUE INDEX "records_blocks_core_video_brand_kit_brand_key" ON public."records_blocks_core_video_brand_kit" USING btree (workspace_id, agent_id, (data->>'key')) WHERE deleted_at IS NULL;

-- create_partition public.records_blocks_core_video_project: records for values in ('blocks-core.video.project')
CREATE TABLE public."records_blocks_core_video_project" PARTITION OF public.records FOR VALUES IN ('blocks-core.video.project');

-- add_check public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_title_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_title_chk" CHECK ((data->>'title') IS NOT NULL AND (jsonb_typeof(data->'title') = 'string' AND char_length((data->>'title')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_title_chk";

-- add_check public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_goal_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_goal_chk" CHECK ((data->>'goal') IS NOT NULL AND ((data->>'goal') IN ('service', 'offer', 'testimonial', 'behind_scenes', 'hiring', 'custom'))) NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_goal_chk";

-- add_check public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_aspect_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_aspect_chk" CHECK ((data->>'aspect') IS NOT NULL AND ((data->>'aspect') IN ('9:16', '16:9'))) NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_aspect_chk";

-- add_check public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_target_seconds_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_target_seconds_chk" CHECK ((data->>'targetSeconds') IS NOT NULL AND (jsonb_typeof(data->'targetSeconds') = 'number' AND (data->>'targetSeconds') ~ '^-?[0-9]{1,10}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_target_seconds_chk";

-- add_check public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_brief_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_brief_chk" CHECK ((data->>'brief') IS NOT NULL AND (jsonb_typeof(data->'brief') = 'string' AND char_length((data->>'brief')) <= 2000)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_brief_chk";

-- add_check public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_status_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_status_chk" CHECK ((data->>'status') IS NOT NULL AND ((data->>'status') IN ('draft', 'scripted', 'rendering', 'review', 'published', 'failed', 'archived'))) NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_status_chk";

-- add_check public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_script_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_script_chk" CHECK ((data->>'script') IS NOT NULL AND (jsonb_typeof(data->'script') = 'object')) NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_script_chk";

-- add_check public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_last_error_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_last_error_chk" CHECK ((data->>'lastError') IS NULL OR (jsonb_typeof(data->'lastError') = 'string' AND char_length((data->>'lastError')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_last_error_chk";

-- add_check public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_published_at_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_published_at_chk" CHECK ((data->>'publishedAt') IS NULL OR ((data->>'publishedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9]{2}:[0-9]{2})$')) NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_published_at_chk";

-- add_check public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_video_project:constraint:records_blocks_core_video_project_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_project" ADD CONSTRAINT "records_blocks_core_video_project_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_video_project" VALIDATE CONSTRAINT "records_blocks_core_video_project_agent_fk";

-- create_index public.records_blocks_core_video_project:index:records_blocks_core_video_project_recent: on workspace_id, created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_video_project_recent" ON public."records_blocks_core_video_project" USING btree (workspace_id, created_at DESC, id DESC);

-- create_index public.records_blocks_core_video_project:index:records_blocks_core_video_project_status_recent: on workspace_id, data->>'status', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_video_project_status_recent" ON public."records_blocks_core_video_project" USING btree (workspace_id, (data->>'status'), created_at DESC, id DESC);

-- create_partition public.records_blocks_core_video_render: records for values in ('blocks-core.video.render')
CREATE TABLE public."records_blocks_core_video_render" PARTITION OF public.records FOR VALUES IN ('blocks-core.video.render');

-- add_check public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_project_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_project_id_chk" CHECK ((data->>'projectId') IS NOT NULL AND ((data->>'projectId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_project_id_chk";

-- add_check public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_state_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_state_chk" CHECK ((data->>'state') IS NOT NULL AND ((data->>'state') IN ('generating', 'composing', 'done', 'failed'))) NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_state_chk";

-- add_check public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_jobs_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_jobs_chk" CHECK ((data->>'jobs') IS NOT NULL AND (jsonb_typeof(data->'jobs') = 'object')) NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_jobs_chk";

-- add_check public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_clips_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_clips_chk" CHECK ((data->>'clips') IS NOT NULL AND (jsonb_typeof(data->'clips') = 'array' AND jsonb_array_length(data->'clips') <= 12)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_clips_chk";

-- add_check public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_voice_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_voice_chk" CHECK ((data->>'voice') IS NULL OR (jsonb_typeof(data->'voice') = 'object' AND jsonb_typeof(data->'voice'->'key') = 'string' AND jsonb_typeof(data->'voice'->'size') = 'number')) NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_voice_chk";

-- add_check public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_output_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_output_chk" CHECK ((data->>'output') IS NULL OR (jsonb_typeof(data->'output') = 'object' AND jsonb_typeof(data->'output'->'key') = 'string' AND jsonb_typeof(data->'output'->'size') = 'number')) NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_output_chk";

-- add_check public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_render_id_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_render_id_chk" CHECK ((data->>'renderId') IS NULL OR (jsonb_typeof(data->'renderId') = 'string' AND char_length((data->>'renderId')) <= 200)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_render_id_chk";

-- add_check public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_provider_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_provider_chk" CHECK ((data->>'provider') IS NULL OR (jsonb_typeof(data->'provider') = 'string' AND char_length((data->>'provider')) <= 40)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_provider_chk";

-- add_check public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_error_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_error_chk" CHECK ((data->>'error') IS NULL OR (jsonb_typeof(data->'error') = 'string' AND char_length((data->>'error')) <= 500)) NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_error_chk";

-- add_check public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_agent_scope_chk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_agent_scope_chk";

-- add_foreign_key public.records_blocks_core_video_render:constraint:records_blocks_core_video_render_agent_fk: added NOT VALID, then validated
ALTER TABLE public."records_blocks_core_video_render" ADD CONSTRAINT "records_blocks_core_video_render_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public."records_blocks_core_video_render" VALIDATE CONSTRAINT "records_blocks_core_video_render_agent_fk";

-- create_index public.records_blocks_core_video_render:index:records_blocks_core_video_render_project_recent: on workspace_id, data->>'projectid', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_video_render_project_recent" ON public."records_blocks_core_video_render" USING btree (workspace_id, ((data->>'projectId')::uuid), created_at DESC, id DESC);

-- create_index public.records_blocks_core_video_render:index:records_blocks_core_video_render_state_recent: on workspace_id, data->>'state', created_atdesc, iddesc using btree
CREATE INDEX "records_blocks_core_video_render_state_recent" ON public."records_blocks_core_video_render" USING btree (workspace_id, (data->>'state'), created_at DESC, id DESC);
