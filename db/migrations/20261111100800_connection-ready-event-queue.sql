-- The consumer queue of the bank_feed_poll reactor (be/src/features/reactors/bank-feed-poll): connection_ready tells it that a connection
-- can be read back from its provider, so it enqueues the first poll at once. The queue, its dead-letter queue and its topic binding follow
-- event-bus.queue.ts. Every call is idempotent (pgmq.create skips an existing queue, pgmq.bind_topic upserts the binding).

select pgmq.create('connection_ready__bank_feed_poll');
select pgmq.create('connection_ready__bank_feed_poll__dead');
select pgmq.bind_topic('connection_ready', 'connection_ready__bank_feed_poll');
