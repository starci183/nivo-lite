-- node-rights_contract_drop-agent-ticks: CONTRACT (phase P7) of rights at node level: the expand halves are
-- 20261112021200_mcp-call-log-origin-node.sql, 20261112021300_node-account-policies.sql, 20261112021500_node-rights-switch.sql,
-- 20261112021700_work-item-node-origins.sql and 20261112021800_mcp-endpoint-rights.sql.
--
-- NOT TO APPLY. This file is kept in db/pending/ ON PURPOSE: `starci app db migrate` applies every file of db/migrations/, so a file
-- there would drop the agents' ticks at the next restart, while every workspace still runs with the switch OFF and the ticks decide.
-- Destructive DDL is accepted only after the code stops using the target (BE-PERSISTENCE-19, R255). The coordinator moves it into
-- db/migrations/ (same name; re-stamp it after the highest stamp there if needed) ONLY as the THIRD of three releases, each its own:
--   release 1, STOP WRITING: no road writes `mcp_connector_access.abilities` any more (setAgentAbility and its handler / GraphQL / web
--     hook gone, `attach` / `attachDefaults` / `attachByTemplate` write the attachment row alone, the dual-write and the backfill gone);
--   release 2, REMOVE READERS: nothing reads the ticks or the switch (the agent-level judge, the shadow compare, `nodeRightsDecide`,
--     the "ticks" model of the web, the boards and registry reads built on ticks); the entity `McpConnectorAccessEntity` no longer maps
--     `abilities` (TypeORM would select a dropped column), `NodeRightsSwitchEntity` and the tally function's caller are gone;
--   release 3, THIS FILE.
-- The list of files and symbols of releases 1 and 2 is on paper in LG-REQUESTS-20261110.md, `## NODE-RIGHTS P7 (parked): contract plan`.
--
-- PRE-CHECKS the restart owner runs (read-only, against the database the release goes to) BEFORE release 1, and again before this file.
-- Each must answer as written; the guard block below re-checks 1 to 5 and refuses otherwise.
--   1. Every workspace that holds a tick is flipped, not forced, and its flip compared something:
--        SELECT a.workspace_id FROM public.mcp_connector_access a LEFT JOIN public.node_rights_switches s USING (workspace_id)
--         WHERE a.abilities <> '{}'::jsonb AND (s.decides IS NOT TRUE OR s.forced OR s.compared = 0 OR s.differed > 0)
--         GROUP BY 1;                                                                                        -- 0 rows
--   2. The forward shadow agreed 100 % on every compared tuple, by origin kind (the report `cli node-rights shadow-report`):
--        SELECT origin_kind, sum(calls) FILTER (WHERE real_code = shadow_code) AS agreed, sum(calls) AS compared
--          FROM public.node_policy_shadow_tallies
--         WHERE shadow_code NOT IN ('outside_node','no_workflow','action_not_compared','node_path_unbound') AND shadow_code NOT LIKE 'agent:%'
--         GROUP BY 1;                                                                                        -- agreed = compared on every line
--   3. Since each workspace's flip, no call a tick let through was made where no node row could carry it (a run of no workflow, a road
--      outside a node, a work action judged at agent level), and no process judged a node call unbound:
--        SELECT t.workspace_id, t.origin_kind, t.shadow_code, t.real_code, t.tool, t.calls FROM public.node_policy_shadow_tallies t
--          JOIN public.node_rights_switches s USING (workspace_id)
--         WHERE t.updated_at >= s.updated_at
--           AND ((t.shadow_code IN ('outside_node','no_workflow','action_not_compared') AND t.real_code IN ('allow','approval'))
--                OR t.shadow_code = 'node_path_unbound');                                                  -- 0 rows
--   4. Since each workspace's flip, the reverse shadow shows no call the node refused that the tick would have let through
--      (a right the contract would take away silently):
--        SELECT t.* FROM public.node_policy_shadow_tallies t JOIN public.node_rights_switches s USING (workspace_id)
--         WHERE t.updated_at >= s.updated_at AND t.shadow_code IN ('agent:allow','agent:approval')
--           AND t.real_code NOT IN ('allow','approval','none');                                             -- 0 rows
--      A line the owner reads and accepts as a narrowing he wants is cleared, with his yes, by
--        DELETE FROM public.node_policy_shadow_tallies WHERE id = '<id>';   (the tallies are an audit of the move; this file drops them)
--   5. No tick is left that no node row and no "Cổng MCP" row carries (the operation of a tick, from PROVIDER_CATALOGUE as read on
--      2026-11-12: customer.send -> nivo.tool.customer.message.send; qr.create -> nivo.tool.payment.transfer.create; credit.rematch ->
--      nivo.tool.payment.credit.rematch; transactions.read -> nivo.tool.bank.transaction.list, nivo.tool.payment.credit.list, nivo.tool.payment.debit.list,
--      nivo.tool.connection.status.get; mail.read -> nivo.tool.mail.message.list, nivo.tool.mail.message.get; ledger.read -> nivo.tool.ledger.status.get;
--      ledger.write -> nivo.tool.ledger.entry.append, nivo.tool.ledger.entry.void; drive.read -> nivo.tool.drive.status.get,
--      nivo.tool.drive.source.list; email.send -> send_email (the work action, HB); an `openapi` ability's id IS its tool id):
--        the query of the guard below, run as a SELECT. The three rights of Accounting no node calls (transactions.read,
--        credit.rematch, ledger.read on an agent of module `accounting`) are the plan's settled loss (RIGHTS-NODE-LEVEL question 6,
--        S1 "Accounting's four unused rights get no node row") and are not counted. Any other line is a right the owner loses: show
--        him the list; with his yes, either list it on the agent's "Cổng MCP" (`setMcpEndpointRight`), or record the loss by removing
--        the key while ticks can still be written (before release 1):
--          UPDATE public.mcp_connector_access SET abilities = abilities - '<ability id>' WHERE id = '<row id>';
--   6. No waiting `gateway_call` work item (its performer is deleted in release 2, HB's dead road):
--        SELECT id FROM public.work_items WHERE action = 'gateway_call' AND status IN ('queued','waiting_decision');   -- 0 rows
--   7. Read, not enforced by this file (no table tells it): the NIVO Web mail nodes state `send_email` (the SDK cut + new template
--      versions of `## NODE-RIGHTS HB -> SDK cut`), H3's desk and H4's no-person reads, the public API's `reply_customer` and the
--      bookings' mail have their own declared holder (engine or person right), and the web shows no tick board on any workspace.
--
-- What it drops, in dependency order:
--   public.mcp_connector_access: check `mcp_connector_access_abilities_check`, column `abilities` (the ticks, 20261112010600). The ROW
--     stays: it is tier 1 (the agent's attachment to one connected account, the kill switch, who a provider trigger may wake).
--   public.node_policy_shadow_count(...) and public.node_policy_shadow_tallies (20261112021300): the shadow compares a tick with a node
--     row; with no tick there is nothing to compare. The tallies are an audit of the move only.
--   public.node_rights_switches (20261112021500): every workspace decides by node; the switch has no reader left.
-- Kept: public.node_account_policies (the grants), public.mcp_endpoint_rights, public.work_item_node_origins, the origin columns of
--   public.mcp_call_log, public.mcp_default_accounts, public.mcp_tool_grants (rights that are not provider rights).
-- Data: the ticks are deleted. Rollback BEFORE this file: `cli node-rights flip --workspace <id> --off` (the ticks decide again) as
--   long as release 2 is not out; after release 2 only by redeploying release 1's code. AFTER this file: none; the ticks can be
--   rebuilt only by hand from node_account_policies, which is not a promise this file makes.

DO $$
DECLARE
    v_unflipped bigint;
    v_differs bigint;
    v_outside bigint;
    v_lost bigint;
    v_waiting bigint;
BEGIN
    SELECT count(DISTINCT a.workspace_id) INTO v_unflipped
      FROM public.mcp_connector_access a
      LEFT JOIN public.node_rights_switches s ON s.workspace_id = a.workspace_id
     WHERE a.abilities <> '{}'::jsonb
       AND (s.decides IS NOT TRUE OR s.forced OR s.compared = 0 OR s.differed > 0);
    IF v_unflipped > 0 THEN
        RAISE EXCEPTION 'node-rights contract: % workspace(s) hold ticks and are not flipped clean (switch off, forced, nothing compared or a difference): flip each with `cli node-rights flip --workspace <id>` after a clean walk', v_unflipped;
    END IF;

    SELECT count(*) INTO v_differs
      FROM public.node_policy_shadow_tallies
     WHERE shadow_code NOT IN ('outside_node', 'no_workflow', 'action_not_compared', 'node_path_unbound')
       AND shadow_code NOT LIKE 'agent:%'
       AND real_code <> shadow_code;
    IF v_differs > 0 THEN
        RAISE EXCEPTION 'node-rights contract: % shadow tuple(s) differ (tick vs node row): read `cli node-rights shadow-report` and settle each before this migration', v_differs;
    END IF;

    SELECT count(*) INTO v_outside
      FROM public.node_policy_shadow_tallies t
      JOIN public.node_rights_switches s ON s.workspace_id = t.workspace_id
     WHERE t.updated_at >= s.updated_at
       AND ((t.shadow_code IN ('outside_node', 'no_workflow', 'action_not_compared') AND t.real_code IN ('allow', 'approval'))
            OR t.shadow_code = 'node_path_unbound'
            OR (t.shadow_code IN ('agent:allow', 'agent:approval') AND t.real_code NOT IN ('allow', 'approval', 'none')));
    IF v_outside > 0 THEN
        RAISE EXCEPTION 'node-rights contract: % tuple(s) since a flip still lean on a tick (a road outside a node, a run of no workflow, an unbound process) or show a right the node took away: close each road or have the owner accept each line before this migration', v_outside;
    END IF;

    WITH ticked AS (
        SELECT a.id, a.workspace_id, a.agent_id, a.connection_id, t.key AS ability, ag.module
          FROM public.mcp_connector_access a
          JOIN public.agents ag ON ag.id = a.agent_id
          CROSS JOIN LATERAL jsonb_object_keys(a.abilities) AS t(key)
    ),
    operations (ability, operation) AS (
        VALUES ('customer.send', 'nivo.tool.customer.message.send'),
               ('qr.create', 'nivo.tool.payment.transfer.create'),
               ('credit.rematch', 'nivo.tool.payment.credit.rematch'),
               ('transactions.read', 'nivo.tool.bank.transaction.list'),
               ('transactions.read', 'nivo.tool.payment.credit.list'),
               ('transactions.read', 'nivo.tool.payment.debit.list'),
               ('transactions.read', 'nivo.tool.connection.status.get'),
               ('mail.read', 'nivo.tool.mail.message.list'),
               ('mail.read', 'nivo.tool.mail.message.get'),
               ('ledger.read', 'nivo.tool.ledger.status.get'),
               ('ledger.write', 'nivo.tool.ledger.entry.append'),
               ('ledger.write', 'nivo.tool.ledger.entry.void'),
               ('drive.read', 'nivo.tool.drive.status.get'),
               ('drive.read', 'nivo.tool.drive.source.list'),
               ('email.send', 'send_email')
    )
    SELECT count(*) INTO v_lost
      FROM ticked k
     WHERE NOT (k.module = 'accounting' AND k.ability IN ('transactions.read', 'credit.rematch', 'ledger.read'))
       AND NOT EXISTS (
            SELECT 1 FROM public.node_account_policies p
             WHERE p.agent_id = k.agent_id AND p.connection_id = k.connection_id
               AND (p.operation = k.ability
                    OR p.operation IN (SELECT o.operation FROM operations o WHERE o.ability = k.ability)))
       AND NOT EXISTS (
            SELECT 1 FROM public.mcp_endpoint_rights e
             WHERE e.agent_id = k.agent_id AND e.connection_id = k.connection_id
               AND (e.operation = k.ability
                    OR e.operation IN (SELECT o.operation FROM operations o WHERE o.ability = k.ability)));
    IF v_lost > 0 THEN
        RAISE EXCEPTION 'node-rights contract: % tick(s) are carried by no node row and no "Cong MCP" row: dropping them takes a right away; show the owner the list (pre-check 5) and record his answer before this migration', v_lost;
    END IF;

    SELECT count(*) INTO v_waiting
      FROM public.work_items
     WHERE action = 'gateway_call' AND status IN ('queued', 'waiting_decision');
    IF v_waiting > 0 THEN
        RAISE EXCEPTION 'node-rights contract: % gateway_call work item(s) still wait: decide or reject them before this migration', v_waiting;
    END IF;
END
$$;

ALTER TABLE public.mcp_connector_access DROP CONSTRAINT mcp_connector_access_abilities_check;
ALTER TABLE public.mcp_connector_access DROP COLUMN abilities;

DROP FUNCTION public.node_policy_shadow_count(p_key text, p_workspace uuid, p_agent uuid, p_origin text, p_workflow text, p_node text, p_tool text, p_real text, p_shadow text, p_version text);
DROP TABLE public.node_policy_shadow_tallies;

DROP TABLE public.node_rights_switches;
