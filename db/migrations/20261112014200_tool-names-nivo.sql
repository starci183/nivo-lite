-- tool-names-nivo: forward-only; immutable once on origin/main. EXPAND half of the tool-name flip (the CHECK swap is
-- 20261112014201_tool-names_contract_grant-check.sql, which also renames the two kinds of grant the old CHECK cannot hold).
--
-- THE ONE RENAME FLIP (owner 2026-11-11: "lật"). Every native NIVO tool takes the `nivo.` prefix with its verb (customer.* -> nivo.lead.*;
-- ledger and bank reads are nivo.*; only sepay.*, google.drive.*, zalo.*, telegram.* keep a provider name). No alias, no dual read: after
-- the restart an old name resolves to nothing. This file rewrites the ids where they are stored as LIVE data and leaves HISTORY as written.
--
--   rewritten (live):  public.mcp_tool_grants.tool (exact grants the old CHECK accepts; customer.* / lead.* expanded into exact rows;
--                      absent ids deleted); public.workspaces_nivo_agent() (the internal agent's door grants of a new workspace);
--                      workflow documents (agent.graph, agent.graph-version, agent.workflow, agent.workflow-version, agent.graph-proposal);
--                      public.module_context_versions.snapshot; the native connector row of the effect domain `customer` (now `lead`).
--   unchanged (not tool ids): public.mcp_connector_access.abilities keys are ABILITY ids (customer.send, qr.create, ledger.write ...);
--                      public.mcp_connectors.key of native rows is the internal row key (the public prefix is the manifest `namespace`
--                      in code), so no row moves except `customer` above; ai_usage_events.purpose (`<node id>:<tag>`) and work_kind hold node ids / work kinds.
--   left as history:   public.mcp_call_log (connector, tool); records agent.node-effect (the effect ledger: keys of closed runs are never
--                      asked again; business keys such as ledger:<txId>, dedupe:<k> hold no tool id); agent.run-step / agent.run-stop
--                      (closed); work_items / approval_requests (decided); team-chat card payloads; public.agent_template_versions.package
--                      (published, hashed packages: a rewrite would break their hash; the first-party sync publishes a new version from
--                      the flipped code); public.brain_lesson_candidates (question / answer text, no tool id).
--
-- HARD PRECONDITION: nothing open (block 0 refuses otherwise). The once-per-key effect ledger keys a call by a digest OF THE TOOL ID,
-- LangGraph checkpoints (bytea) hold wire names, a module job's door opKey is `<jobId>:<tool>:<argsHash>`: a run, stop, timer, job or
-- deadline open across the flip re-runs its step under a NEW key, misses the ledger and acts a second time. On dev the drain is the
-- extended `reset-workflows` (runs, steps, stops, holds, freezes, checkpoints, step/deadline jobs, thread wakes, run work items, care
-- timers of the reset agents). It does not depend on 20261112014100 (contract): the expand phase may apply this file before it.
-- The harness applies a file in ONE transaction with its history mark: temp objects are dropped at commit.

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 0. Refuse while anything is open.
DO $$
DECLARE
  v_runs bigint; v_steps bigint; v_stops bigint; v_freezes bigint; v_holds bigint; v_jobs bigint; v_outbox bigint;
  v_wakes bigint; v_approvals bigint; v_items bigint; v_threads bigint; v_timers bigint;
BEGIN
  SELECT count(*) INTO v_runs    FROM public.records WHERE entity = 'agent.run'
     AND data->>'status' IN ('running', 'waiting', 'parked', 'compensating');
  SELECT count(*) INTO v_steps   FROM public.records WHERE entity = 'agent.run-step'
     AND data->>'status' IN ('pending', 'running', 'compensating');
  SELECT count(*) INTO v_stops   FROM public.records WHERE entity = 'agent.run-stop' AND data->>'state' = 'open';
  SELECT count(*) INTO v_freezes FROM public.records WHERE entity = 'agent.lead-freeze' AND data->>'status' IN ('frozen', 'retrying');
  SELECT count(*) INTO v_holds   FROM public.records WHERE entity = 'agent.conversation-hold';
  -- module jobs: a door call's opKey names the tool
  SELECT count(*) INTO v_jobs    FROM public.jobs WHERE status IN ('running', 'failed_awaiting_fix');
  -- the engine's queues (underscored names, as the code declares them); the recurring ticks carry no tool and are not counted;
  -- agent_step is gone (20261112014100 deleted its rows and nothing produces it)
  SELECT count(*) INTO v_outbox  FROM public.job_outbox WHERE state IN ('queued', 'running')
     AND queue IN ('agent_turn', 'thread_deadline', 'module_jobs', 'payment_order_requested', 'decisions')
     AND name NOT IN ('agent-turn.sweep', 'decisions.agent-graph-watch', 'decisions.expire-approvals');
  -- wakes about to run (held = parked by the owner's kill switch: no effect recorded yet, they run on the new names) and every open
  -- wake of a thread
  SELECT count(*) INTO v_wakes   FROM public.agent_wakes
   WHERE status IN ('pending', 'running') OR (source = 'thread' AND status IN ('held', 'failed'));
  SELECT count(*) INTO v_approvals FROM public.approval_requests WHERE status = 'pending';
  -- work items that name a tool or a run: tool approvals, run decisions, lead freezes
  SELECT count(*) INTO v_items   FROM public.work_items
   WHERE status IN ('queued', 'waiting_decision')
     AND (action = 'lead_frozen' OR dedupe_key LIKE 'tool-approval:%' OR proposal->'fields'->>'runId' IS NOT NULL);
  -- (public.agent_checkpoints is created by 20261112010700, which always precedes this file)
  SELECT count(DISTINCT c.thread_id) INTO v_threads FROM public.agent_checkpoints c
    JOIN public.records r ON r.entity = 'agent.run' AND r.workspace_id = c.workspace_id AND r.id::text = c.thread_id
   WHERE r.data->>'status' IN ('running', 'waiting', 'parked', 'compensating');
  -- care timers (payment reminder, payment stale, delivery check, occasion ...): each wakes a run that acts on a customer
  SELECT count(*) INTO v_timers  FROM public.agent_tasks WHERE status IN ('open', 'waiting') AND next_action_at IS NOT NULL;
  IF v_runs + v_steps + v_stops + v_freezes + v_holds + v_jobs + v_outbox + v_wakes + v_approvals + v_items + v_threads + v_timers > 0 THEN
    RAISE EXCEPTION 'tool-names-nivo: not drained: runs=% steps=% stops=% freezes=% holds=% jobs=% outbox=% wakes=% approvals=% work_items=% threads=% care_timers=%',
      v_runs, v_steps, v_stops, v_freezes, v_holds, v_jobs, v_outbox, v_wakes, v_approvals, v_items, v_threads, v_timers;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 1. The map (name-table of the flip: every exact tool id; the wildcards are renamed by the contract half).
CREATE TEMP TABLE flip_map (old text PRIMARY KEY, new text NOT NULL) ON COMMIT DROP;
INSERT INTO flip_map (old, new) VALUES
  ('customer.message.send',     'nivo.lead.message.send'),
  ('customer.care.schedule',    'nivo.lead.care.schedule'),
  ('lead.ensure',               'nivo.lead.ensure'),
  ('lead.update',               'nivo.lead.update'),
  ('lead.stage.update',         'nivo.lead.stage.update'),
  ('order.create',              'nivo.order.create'),
  ('order.confirm',             'nivo.order.confirm'),
  ('order.cancel',              'nivo.order.cancel'),
  ('payment.qr.create',         'nivo.payment.qr.create'),
  ('payment.order.settle',      'nivo.payment.order.settle'),
  ('payment.credit.rematch',    'nivo.payment.credit.rematch'),
  ('payment.claim.record',      'nivo.payment.claim.record'),
  ('payment.claim.cancel',      'nivo.payment.claim.cancel'),
  ('team.message.post',         'nivo.team.message.post'),
  ('agent.tag',                 'nivo.agent.tag'),
  ('work.item.create',          'nivo.work.item.create'),
  ('work.item.cancel',          'nivo.work.item.cancel'),
  ('report.daily.close',        'nivo.report.daily.close'),
  ('ledger.append',             'nivo.ledger.entry.append'),
  ('ledger.void',               'nivo.ledger.entry.void'),
  ('ledger.status',             'nivo.ledger.status.get'),
  ('bank.transactions',         'nivo.bank.transaction.list'),
  ('brain.search',              'nivo.brain.search'),
  ('brain.facts.list',          'nivo.brain.fact.list'),
  ('brain.facts.get',           'nivo.brain.fact.get'),
  ('brain.documents.read',      'nivo.brain.document.read'),
  ('brain.fact.related',        'nivo.brain.fact.related'),
  ('brain.change.propose',      'nivo.brain.change.propose'),
  ('sepay.transactions.list',   'sepay.transaction.list'),
  ('sepay.transactions.debits', 'sepay.debit.list'),
  ('sepay.status',              'sepay.status.get'),
  ('zalo.status',               'zalo.status.get'),
  ('telegram.status',           'telegram.status.get'),
  ('drive.status',              'google.drive.status.get'),
  ('drive.sources.list',        'google.drive.source.list'),
  ('dossier.status',            'nivo.dossier.status.get'),
  ('dossier.findings.list',     'nivo.dossier.finding.list'),
  ('einvoice.list',             'nivo.einvoice.list'),
  ('einvoice.get',              'nivo.einvoice.get'),
  ('chat.send',                 'nivo.chat.send'),
  ('chat.profile',              'nivo.chat.profile.get'),
  ('team-chat.post-report',     'nivo.team-chat.report.post'),
  ('team-chat.post-approval',   'nivo.team-chat.approval.post');

-- Retired ids: a stored grant is deleted (customer.care.send is carried to the one customer send first, 2b).
CREATE TEMP TABLE flip_absent (old text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO flip_absent (old) VALUES
  ('customer.care.send'), ('agent.turn'), ('agent.history'), ('agent.*'), ('ai.agent.turn'), ('ai.agent.history'), ('payment.instruction');

-- The JSON rewriter: every string VALUE and every object KEY equal to an old id is replaced; nothing else is touched (a longer string
-- holding an id, a ref such as lead.address, a node id such as payment.settle stay). plpgsql: a recursive LANGUAGE sql function fails
-- body validation at CREATE.
CREATE FUNCTION pg_temp.flip_json(p jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    AS $f$
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  CASE jsonb_typeof(p)
    WHEN 'string' THEN
      RETURN COALESCE((SELECT to_jsonb(m.new) FROM flip_map m WHERE m.old = p #>> '{}'), p);
    WHEN 'array' THEN
      RETURN COALESCE((SELECT jsonb_agg(pg_temp.flip_json(e) ORDER BY i) FROM jsonb_array_elements(p) WITH ORDINALITY AS a(e, i)), '[]'::jsonb);
    WHEN 'object' THEN
      RETURN COALESCE((SELECT jsonb_object_agg(COALESCE((SELECT m.new FROM flip_map m WHERE m.old = o.k), o.k), pg_temp.flip_json(o.v))
                         FROM jsonb_each(p) AS o(k, v)), '{}'::jsonb);
    ELSE
      RETURN p;
  END CASE;
END
$f$;

-- Whether a JSON document still holds an old id as a whole string value or key (its exact quoted form in the text).
CREATE FUNCTION pg_temp.flip_has_old(p jsonb) RETURNS boolean
    LANGUAGE sql STABLE
    AS $f$
  SELECT EXISTS (SELECT 1 FROM flip_map m WHERE position(to_jsonb(m.old)::text IN p::text) > 0)
$f$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 2. public.mcp_tool_grants.tool (unique (agent_id, tool); CHECK mcp_tool_grants_tool_check of the baseline:
--    ^[a-z][a-z0-9-]{1,30}\.([a-zA-Z][a-zA-Z0-9_.]{1,80}|\*)$ — it holds every new exact id but nivo.team-chat.* and a namespaced
--    wildcard, which the contract half renames after widening it).
--
-- 2a. customer.* and lead.* expand into their exact tools (nivo.lead.* would also grant the context reads and the customer send).
INSERT INTO public.mcp_tool_grants (workspace_id, agent_id, tool, mode, limit_vnd, constraints, updated_by)
SELECT g.workspace_id, g.agent_id, x.tool, g.mode, g.limit_vnd, g.constraints, g.updated_by
  FROM public.mcp_tool_grants g
  JOIN (VALUES ('customer.*', 'nivo.lead.message.send'), ('customer.*', 'nivo.lead.care.schedule'),
               ('lead.*', 'nivo.lead.ensure'), ('lead.*', 'nivo.lead.update'), ('lead.*', 'nivo.lead.stage.update')) AS x(wild, tool)
    ON x.wild = g.tool
ON CONFLICT (agent_id, tool) DO NOTHING;
DELETE FROM public.mcp_tool_grants WHERE tool IN ('customer.*', 'lead.*');

-- 2b. customer.care.send (folded before the flip; last resort): carried to the one send unless the agent already holds it.
UPDATE public.mcp_tool_grants g SET tool = 'nivo.lead.message.send', updated_at = now()
 WHERE g.tool = 'customer.care.send'
   AND NOT EXISTS (SELECT 1 FROM public.mcp_tool_grants o
                    WHERE o.agent_id = g.agent_id AND o.tool IN ('nivo.lead.message.send', 'customer.message.send'));
DELETE FROM public.mcp_tool_grants g USING flip_absent a WHERE g.tool = a.old;

-- 2c. An agent holding both names (a row written under the new name before the flip): the new row wins.
DELETE FROM public.mcp_tool_grants g
 USING flip_map m
 WHERE g.tool = m.old
   AND m.new NOT LIKE 'nivo.team-chat.%'
   AND EXISTS (SELECT 1 FROM public.mcp_tool_grants o WHERE o.agent_id = g.agent_id AND o.tool = m.new);

-- 2d. Rename every exact grant the current CHECK can hold (all but nivo.team-chat.*: the contract half).
UPDATE public.mcp_tool_grants g SET tool = m.new, updated_at = now()
  FROM flip_map m
 WHERE g.tool = m.old AND m.new NOT LIKE 'nivo.team-chat.%';

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 3. public.workspaces_nivo_agent() (trigger on public.workspaces; live body = 20261112012300): a new workspace's internal agent gets
--    its door grants from this list. Same four tools, new names (team-chat report/approval are held by DOOR_GRANTS in code, as before).
CREATE OR REPLACE FUNCTION public.workspaces_nivo_agent() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_agent uuid;
begin
  insert into public.agents (workspace_id, module, name, handle, role, instructions, status)
  values (new.id, 'nivo', 'Nivo', 'nivo', 'Runs the declared jobs of the modules',
          'Internal. Calls only the door tools the declared jobs of the modules name.', 'paused')
  returning id into v_agent;
  insert into public.mcp_tool_grants (workspace_id, agent_id, tool, mode)
  select new.id, v_agent, tool, 'auto'
  from unnest(array['nivo.chat.send', 'nivo.chat.profile.get', 'nivo.ledger.entry.append', 'nivo.ledger.status.get']) as tool;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 4. Workflow documents (entity-engine records; parent public.records(entity, id, workspace_id, data jsonb, version, created_at,
--    updated_at), one partition per entity). Steps hold tool ids under `tools`, `effects`, `requires`; grants under the workflow's
--    rights. A rewritten version keeps its old `documentHash`: on dev the workflows are re-adopted from the templates after the restart
--    (`reset-workflows`), and production re-adopts at its deploy; the rewrite keeps every stored version consistent meanwhile.
UPDATE public.records SET data = pg_temp.flip_json(data), version = version + 1, updated_at = now()
 WHERE entity IN ('agent.graph', 'agent.graph-version', 'agent.workflow', 'agent.workflow-version', 'agent.graph-proposal')
   AND pg_temp.flip_has_old(data);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 5. Context snapshots of installations (public.module_context_versions(snapshot jsonb); the table has no updated_at).
UPDATE public.module_context_versions SET snapshot = pg_temp.flip_json(snapshot) WHERE pg_temp.flip_has_old(snapshot);

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 6. The native connector row of the effect domain `customer` (status / time limit of a workspace): its tools now live under the
--    domain `lead` (nivo.lead.message.send, nivo.lead.care.schedule). A workspace that already has a `lead` row keeps that one.
DELETE FROM public.mcp_connectors c
 WHERE c.kind = 'native' AND c.key = 'customer'
   AND EXISTS (SELECT 1 FROM public.mcp_connectors o WHERE o.workspace_id = c.workspace_id AND o.key = 'lead');
UPDATE public.mcp_connectors SET key = 'lead', name = 'NIVO lead', updated_at = now() WHERE kind = 'native' AND key = 'customer';

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 7. Free text that may NAME a tool (shop-written; never rewritten by a machine): counted, reported as a NOTICE, fixed by hand.
DO $$
DECLARE
  v_re text;
  v_agents bigint; v_facts bigint; v_templates bigint;
BEGIN
  SELECT '(^|[^A-Za-z0-9_./@$-])(' || string_agg(regexp_replace(old, '([.*])', '\\\1', 'g'), '|' ORDER BY length(old) DESC) || ')($|[^A-Za-z0-9_*-])'
    INTO v_re FROM flip_map;
  SELECT count(*) INTO v_agents FROM public.agents
   WHERE instructions ~ v_re OR knowledge ~ v_re OR approval_rule ~ v_re OR greeting ~ v_re;
  SELECT count(*) INTO v_facts FROM public.brain_facts WHERE value ~ v_re OR coalesce(decision_note, '') ~ v_re;
  SELECT count(*) INTO v_templates FROM public.agent_template_versions WHERE package::text ~ v_re;
  RAISE NOTICE 'tool-names-nivo: text naming an old tool id (by hand, not by this migration): agents=% brain_facts=% template_versions(history)=%',
    v_agents, v_facts, v_templates;
END
$$;

-- ---------------------------------------------------------------------------------------------------------------------------------
-- 8. Final check: the file fails (and rolls back) when an old id is left in a LIVE store this half owns.
DO $$
DECLARE
  v_grants bigint; v_docs bigint; v_snap bigint; v_fn bigint; v_rows bigint;
BEGIN
  SELECT count(*) INTO v_grants FROM public.mcp_tool_grants g
   WHERE (g.tool IN (SELECT old FROM flip_map WHERE new NOT LIKE 'nivo.team-chat.%') OR g.tool IN (SELECT old FROM flip_absent)
          OR g.tool IN ('customer.*', 'lead.*'));
  SELECT count(*) INTO v_docs FROM public.records
   WHERE entity IN ('agent.graph', 'agent.graph-version', 'agent.workflow', 'agent.workflow-version', 'agent.graph-proposal')
     AND pg_temp.flip_has_old(data);
  SELECT count(*) INTO v_snap FROM public.module_context_versions WHERE pg_temp.flip_has_old(snapshot);
  -- a live SQL function body that still names an old tool id as a quoted literal
  SELECT count(*) INTO v_fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND EXISTS (SELECT 1 FROM flip_map m WHERE position(quote_literal(m.old) IN p.prosrc) > 0);
  SELECT count(*) INTO v_rows FROM public.mcp_connectors WHERE kind = 'native' AND key = 'customer';
  IF v_grants + v_docs + v_snap + v_fn + v_rows > 0 THEN
    RAISE EXCEPTION 'tool-names-nivo: old ids remain: grants=% workflow_docs=% context_snapshots=% sql_functions=% customer_rows=%',
      v_grants, v_docs, v_snap, v_fn, v_rows;
  END IF;
END
$$;
