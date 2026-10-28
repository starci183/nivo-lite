-- The recurring ticks of the back end, declared by the migrations (a cron command is one pgmq.send to an existing queue). The message is the body the
-- queue worker routes by `name`, the same body the back end's scheduler used to send; the jobs are upserted by name, so a database whose api already
-- registered them at boot keeps one job each. The pruning, reaping and hiring jobs of the old baseline are not declared here: they are queue jobs of the
-- back end (see be/docs/runbooks/cutover.md).

SELECT cron.schedule('agents-sync-all', '*/5 * * * *', $cron$SELECT pgmq.send('agents', '{"name":"agents.sync","payload":{}}'::jsonb)$cron$);
SELECT cron.schedule('automation-tick', '*/1 * * * *', $cron$SELECT pgmq.send('automation', '{"name":"automation.tick","payload":{}}'::jsonb)$cron$);
SELECT cron.schedule('connection-health-tick', '*/15 * * * *', $cron$SELECT pgmq.send('connection_health', '{"name":"connection_health","payload":{"silentAfterHours":72}}'::jsonb)$cron$);
SELECT cron.schedule('content-tick', '*/15 * * * *', $cron$SELECT pgmq.send('content_tick', '{"name":"content_tick","payload":{}}'::jsonb)$cron$);
SELECT cron.schedule('data-sync-tick', '*/1 * * * *', $cron$SELECT pgmq.send('data_sync', '{"name":"data_sync","payload":{"tick":true}}'::jsonb)$cron$);
SELECT cron.schedule('decisions-drain-work', '*/1 * * * *', $cron$SELECT pgmq.send('decisions', '{"name":"decisions.drain-work","payload":{}}'::jsonb)$cron$);
SELECT cron.schedule('shifts-tick', '*/1 * * * *', $cron$SELECT pgmq.send('shifts_alerts', '{"name":"shifts.tick","payload":{"kind":"tick"}}'::jsonb)$cron$);
SELECT cron.schedule('zalo-refresh-tick', '0 */6 * * *', $cron$SELECT pgmq.send('zalo_refresh', '{"name":"zalo_refresh","payload":{"withinMs":25200000}}'::jsonb)$cron$);
