-- AI Ke toan (HAKUEN demo, PLAN N14 / N15 / N16 / N23): the morning run of the accounting agent. One queue and one tick at 06:30
-- Vietnam time (23:30 UTC): the agent reads the day's e-invoices and bank credits through the MCP gateway, checks them, matches
-- folio payments, and posts the daily summary card and the due-date reminders into the Ke toan room. No table: the sources stay
-- behind the gateway and the tax profile is Second Brain knowledge.
SELECT pgmq.create('accounting_desk');
SELECT cron.schedule('accounting-desk-morning', '30 23 * * *', $cron$SELECT pgmq.send('accounting_desk', '{"name":"accounting_desk.morning","payload":{}}'::jsonb)$cron$);
