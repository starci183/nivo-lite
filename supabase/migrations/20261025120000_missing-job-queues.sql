-- The pgmq queues the back end produces to and consumes from that no earlier migration created: without them a customer chat turn
-- (chat_turn) cannot be enqueued or answered, and the agent sync, decisions, connection health, data sync, inventory and Zalo token
-- jobs cannot run. pgmq.create is idempotent, so a queue another lane already created is left as it is.
select pgmq.create('chat_turn');
select pgmq.create('agents');
select pgmq.create('decisions');
select pgmq.create('connection_health');
select pgmq.create('data_sync');
select pgmq.create('inventory_order');
select pgmq.create('inventory_replenish');
select pgmq.create('zalo_refresh');
