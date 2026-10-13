-- Obsolete now that the api serves inventory and shifts through GraphQL: a member calls a mutation that runs the domain service
-- directly, so the submit/finish command relay (commands table + pgmq queue + finish function) is no longer needed.

drop function if exists public.inventory_submit(uuid, text, jsonb);
drop function if exists public.inventory_command_finish(uuid, text, jsonb, text, text);
drop function if exists public.shifts_submit(uuid, text, jsonb);
drop function if exists public.shifts_command_finish(uuid, text, jsonb, text, text);

drop table if exists public.inventory_commands;
drop table if exists public.shifts_commands;

select pgmq.drop_queue('inventory_command');
select pgmq.drop_queue('shifts_command');
