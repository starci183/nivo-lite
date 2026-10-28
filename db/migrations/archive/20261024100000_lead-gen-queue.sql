-- The lead generation flow's own queue: what follows a finished lead_gen step (the next command of the prospect's state machine)
-- runs as a pgmq job of its own, so the work engine never waits for the next step or its model call.
create extension if not exists pgmq;
select pgmq.create('lead_gen');
grant select, insert, update, delete on table pgmq.q_lead_gen to app_be;
grant select, insert, update, delete on table pgmq.a_lead_gen to app_be;
