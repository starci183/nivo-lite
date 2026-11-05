-- graph host change 1, contract: agent runs, run steps and the node effect ledger live in public.records (agent.run, agent.run-step,
-- agent.node-effect); the two run tables, the ledger table and the database functions that wrote them have no user left.
-- Owner 2026-11-05 "không care prod": no data is carried over.
DROP FUNCTION public.agent_run_append(uuid, jsonb);
DROP FUNCTION public.agent_step_claim(uuid, text);
DROP FUNCTION public.agent_step_commit(uuid, text, bigint, text, jsonb, text, integer, uuid, timestamptz, boolean);
DROP FUNCTION public.agent_step_resume(uuid, jsonb, boolean);
DROP FUNCTION public.agent_step_release(uuid, text, bigint);
DROP FUNCTION public.agent_run_park_mark(uuid, text);
DROP FUNCTION public.agent_run_resume(uuid, text, text, jsonb, boolean, integer, integer);
DROP FUNCTION public.agent_run_parked(integer, text, boolean, integer, integer, text[]);
DROP FUNCTION public.agent_run_route(uuid, text, text, text, text[]);
DROP FUNCTION public.agent_comp_claim(uuid, integer);
DROP FUNCTION public.agent_comp_commit(uuid, text, bigint, boolean, text, integer, integer);
DROP FUNCTION public.agent_run_spoken(uuid);
DROP FUNCTION public.agent_run_due(integer);
DROP FUNCTION public.agent_run_step_json(public.agent_run_steps);
DROP FUNCTION public.agent_run_status_after(uuid, boolean);
DROP TABLE public.agent_run_steps;
DROP TABLE public.agent_runs;
DROP TABLE public.graph_node_effects;
