-- v0.3.2 step 3: the minute tick that expires the approval requests whose time ran out (and reminds a group once, half-way). The job is a
-- message of the decisions queue, like the work drain; the back end claims it and hands each expired request to the owner of the agent.

SELECT cron.schedule('decisions-expire-approvals', '*/1 * * * *', $cron$SELECT pgmq.send('decisions', '{"name":"decisions.expire-approvals","payload":{}}'::jsonb)$cron$);
