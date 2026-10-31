-- The consumer queues of the agent_wakes reactor (be/src/features/reactors/agent-wakes): three internal events that wake the agents which
-- asked for them, and installation_changed, which seeds the triggers a module declares. Each queue, its dead-letter queue and its topic
-- binding follow event-bus.queue.ts. Every call is idempotent (pgmq.create skips an existing queue, pgmq.bind_topic upserts the binding).

select pgmq.create('bank_credit_booked__agent_wakes');
select pgmq.create('bank_credit_booked__agent_wakes__dead');
select pgmq.bind_topic('bank_credit_booked', 'bank_credit_booked__agent_wakes');

select pgmq.create('payment_reconciled__agent_wakes');
select pgmq.create('payment_reconciled__agent_wakes__dead');
select pgmq.bind_topic('payment_reconciled', 'payment_reconciled__agent_wakes');

select pgmq.create('knowledge_source_indexed__agent_wakes');
select pgmq.create('knowledge_source_indexed__agent_wakes__dead');
select pgmq.bind_topic('knowledge_source_indexed', 'knowledge_source_indexed__agent_wakes');

select pgmq.create('installation_changed__agent_wakes');
select pgmq.create('installation_changed__agent_wakes__dead');
select pgmq.bind_topic('installation_changed', 'installation_changed__agent_wakes');
