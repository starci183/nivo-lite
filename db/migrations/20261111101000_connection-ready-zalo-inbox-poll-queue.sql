-- The consumer queue of the zalo_inbox_poll reactor (be/src/features/reactors/zalo-inbox-poll): connection_ready tells it that a Zalo OA
-- connection holds a fresh OAuth token, so it enqueues the first reconcile at once. The queue, its dead-letter queue and its topic binding follow
-- event-bus.queue.ts. Every call is idempotent (pgmq.create skips an existing queue, pgmq.bind_topic upserts the binding).

select pgmq.create('connection_ready__zalo_inbox_poll');
select pgmq.create('connection_ready__zalo_inbox_poll__dead');
select pgmq.bind_topic('connection_ready', 'connection_ready__zalo_inbox_poll');
