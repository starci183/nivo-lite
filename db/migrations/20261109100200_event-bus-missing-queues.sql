-- Declares the event bus consumer queues of platform/event-bus/event-bus.queues.ts with literal names. The queues already exist from
-- 20261109000554_event-bus.sql, which creates them in a loop over name pairs; the app check reads only literal pgmq.create and
-- pgmq.bind_topic calls, so each queue, its dead-letter queue and its topic binding is restated here. Every call is idempotent
-- (pgmq.create skips an existing queue, pgmq.bind_topic upserts the binding), so applying this over the earlier chain changes nothing.

select pgmq.create('event_bus_probe__probe');
select pgmq.create('event_bus_probe__probe__dead');
select pgmq.bind_topic('event_bus_probe', 'event_bus_probe__probe');

select pgmq.create('bank_credit_booked__accounting');
select pgmq.create('bank_credit_booked__accounting__dead');
select pgmq.bind_topic('bank_credit_booked', 'bank_credit_booked__accounting');

select pgmq.create('payment_reconciled__contracts');
select pgmq.create('payment_reconciled__contracts__dead');
select pgmq.bind_topic('payment_reconciled', 'payment_reconciled__contracts');

select pgmq.create('payment_reconciled__automations');
select pgmq.create('payment_reconciled__automations__dead');
select pgmq.bind_topic('payment_reconciled', 'payment_reconciled__automations');

select pgmq.create('payment_reconciled__payment_receipts');
select pgmq.create('payment_reconciled__payment_receipts__dead');
select pgmq.bind_topic('payment_reconciled', 'payment_reconciled__payment_receipts');

select pgmq.create('payment_reconciled__care');
select pgmq.create('payment_reconciled__care__dead');
select pgmq.bind_topic('payment_reconciled', 'payment_reconciled__care');

select pgmq.create('lead_captured__automations');
select pgmq.create('lead_captured__automations__dead');
select pgmq.bind_topic('lead_captured', 'lead_captured__automations');

select pgmq.create('deal_won__automations');
select pgmq.create('deal_won__automations__dead');
select pgmq.bind_topic('deal_won', 'deal_won__automations');

select pgmq.create('order_confirmed__automations');
select pgmq.create('order_confirmed__automations__dead');
select pgmq.bind_topic('order_confirmed', 'order_confirmed__automations');

select pgmq.create('order_confirmed__inventory');
select pgmq.create('order_confirmed__inventory__dead');
select pgmq.bind_topic('order_confirmed', 'order_confirmed__inventory');

select pgmq.create('order_shipped__automations');
select pgmq.create('order_shipped__automations__dead');
select pgmq.bind_topic('order_shipped', 'order_shipped__automations');

select pgmq.create('decision_made__automations');
select pgmq.create('decision_made__automations__dead');
select pgmq.bind_topic('decision_made', 'decision_made__automations');

select pgmq.create('approval_resolved__thread_outcomes');
select pgmq.create('approval_resolved__thread_outcomes__dead');
select pgmq.bind_topic('approval_resolved', 'approval_resolved__thread_outcomes');

select pgmq.create('booking_status_changed__booking_effects');
select pgmq.create('booking_status_changed__booking_effects__dead');
select pgmq.bind_topic('booking_status_changed', 'booking_status_changed__booking_effects');

select pgmq.create('ai_generation_completed__content');
select pgmq.create('ai_generation_completed__content__dead');
select pgmq.bind_topic('ai_generation_completed', 'ai_generation_completed__content');

select pgmq.create('ai_generation_completed__video');
select pgmq.create('ai_generation_completed__video__dead');
select pgmq.bind_topic('ai_generation_completed', 'ai_generation_completed__video');

select pgmq.create('installation_changed__agent_sync');
select pgmq.create('installation_changed__agent_sync__dead');
select pgmq.bind_topic('installation_changed', 'installation_changed__agent_sync');

select pgmq.create('knowledge_source_indexed__brain');
select pgmq.create('knowledge_source_indexed__brain__dead');
select pgmq.bind_topic('knowledge_source_indexed', 'knowledge_source_indexed__brain');

-- The event bus functions are called by the application role alone: browser roles hold no execute on them (the earlier migration revoked
-- public; anon and authenticated are named here so no later grant to them goes unnoticed).
revoke all on function public.event_bus_send(text, jsonb) from public, anon, authenticated;
revoke all on function public.event_bus_read(text, integer, integer) from public, anon, authenticated;
revoke all on function public.event_bus_archive(text, bigint) from public, anon, authenticated;
revoke all on function public.event_bus_bury(text, bigint, integer, jsonb, text) from public, anon, authenticated;
revoke all on function public.event_bus_dead_letters(text, integer) from public, anon, authenticated;
revoke all on function public.event_bus_requeue(text, bigint) from public, anon, authenticated;
