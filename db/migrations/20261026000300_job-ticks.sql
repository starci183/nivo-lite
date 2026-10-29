-- The recurring ticks of the back end, declared by the migrations (a cron command is one pgmq.send to an existing queue). The message is the body the
-- queue worker routes by `name`, the same body the back end's scheduler used to send; the jobs are upserted by name, so a database whose api already
-- registered them at boot keeps one job each. The pruning, reaping and hiring jobs of the old baseline are not declared here: they are queue jobs of the
-- back end (see be/docs/runbooks/cutover.md).

