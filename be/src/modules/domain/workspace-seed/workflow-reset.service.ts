import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { GraphSeedService } from "./graph-seed.service"
import { readGraphSpecs } from "./graph-seed.policy"
import { InjectWorkspaceSeedOptions } from "./workspace-seed.decorators"
import {
    RESET_LESSON_TABLE,
    RESET_RUN_STATE,
    resetClearValuesOf,
    resetCountValuesOf,
    type ResetKind,
    type ResetScope,
} from "./workflow-reset.policy"
import type { WorkspaceSeedOptions } from "./workspace-seed.options"

/**
 * The record entities a workflow reset clears for the agents it resets: the workflows, their versions and the run pins, and the
 * conversation holds (a hold names a run and a workflow that are cleared here, and would send the customer's next line to them).
 */
const WORKFLOW_ENTITIES: ReadonlyArray<string> = [
    "agent.workflow",
    "agent.workflow-version",
    "agent.run-workflow",
    "agent.conversation-hold",
]

/** The graph of an agent and its frozen versions: a version that holds a flow is an old workflow the seed would adopt again. */
const GRAPH_ENTITY = "agent.graph"
const GRAPH_VERSION_ENTITY = "agent.graph-version"

/** The record entities of the runs: the runs themselves (by agent) and their steps (by run). */
const RUN_ENTITY = "agent.run"
const STEP_ENTITY = "agent.run-step"

/** What the runs left about leads, cleared for the whole workspace: the one memory of each lead and the freezes of failed runs. */
const LEAD_ENTITIES: ReadonlyArray<string> = ["agent.lead-memory", "agent.lead-freeze"]

/** The modules whose agents the reset replaces the workflows of. */
const RESET_MODULES: ReadonlyArray<string> = ["chatbot", "sales", "accounting"]

/** One count of what a reset removed. */
interface Removed {
    readonly what: string
    readonly count: number
}

/** How a reset runs: `dryRun` counts what it would clear, per kind, and changes nothing (no clear, no seed). */
export interface WorkflowResetRun {
    /** True counts only. */
    readonly dryRun?: boolean | undefined
}

/** The kinds the seed writes again right after the clear: a dry run after a reset reads them non-zero by design. */
const SEEDED = " (the seed writes these again)"

@Injectable()
/**
 * Replaces the workflows of the Chatbot, Sales and Accounting agents of a workspace with the seeded graphs, and clears what their old
 * runs left: their workflows, versions, run pins and conversation holds, their runs and steps, the graph versions that froze an older
 * flow (so no old flow is adopted again as history), and the lead memory and lead freezes of the workspace; then the run state of every
 * run that is gone (`RESET_RUN_STATE`: stops, LangGraph checkpoints, open step/deadline jobs, thread wakes, open work items, care timers
 * of the reset agents, open lesson candidates), all in one transaction. A dry run prints the same counts and changes nothing.
 * Agents, installations, connections, products, orders, conversations, users and everything else are kept. Then the graph seed runs as
 * it does on every start: it publishes the seeded graph as each agent's flow and makes its workflows from the module's templates (the
 * chain's links active). Running it twice leaves the same state: idempotent. It prints counts, never a value.
 */
export class WorkflowResetService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly seed: GraphSeedService,
        @InjectWorkspaceSeedOptions() private readonly options: WorkspaceSeedOptions,
    ) {}

    /** Resets the workflows of the workspace named `workspaceName` to the graphs of the envelope `text` (or, dry, counts what it would). */
    async run(text: string, workspaceName: string, how: WorkflowResetRun = {}): Promise<void> {
        readGraphSpecs(text)
        const workspaceId = await this.workspaceOf(workspaceName)
        if (how.dryRun === true) {
            const counted = await this.counted(this.entityManager, workspaceId)
            for (const entry of counted) this.options.print(`reset (dry run) ${entry.what}: ${entry.count} to remove`)
            return
        }
        const removed = await this.entityManager.transaction((tx) => this.clear(tx, workspaceId))
        for (const entry of removed) this.options.print(`reset ${entry.what}: ${entry.count} removed`)
        await this.seed.run(text, workspaceName)
    }

    /** What a clear would remove, per kind, read with the same conditions it deletes by. */
    private async counted(manager: EntityManager, workspaceId: string): Promise<ReadonlyArray<Removed>> {
        const scope = await this.scopeOf(manager, workspaceId)
        const { agents } = scope
        const links = await this.count(
            manager,
            `SELECT count(*)::int AS count FROM public.record_links l
              WHERE l.workspace_id = $1 AND EXISTS (SELECT 1 FROM public.records r
                WHERE r.workspace_id = $1
                  AND ((l.from_entity = r.entity AND l.from_id = r.id) OR (l.to_entity = r.entity AND l.to_id = r.id))
                  AND ((r.entity = ANY($2) AND r.data->>'agentId' = ANY($3))
                    OR (r.entity = $4 AND r.data->>'runId' IN (SELECT id::text FROM public.records WHERE workspace_id = $1 AND entity = $5 AND data->>'agentId' = ANY($3)))
                    OR r.entity = ANY($6)
                    OR (r.entity = $7 AND r.data->>'agentId' = ANY($3) AND jsonb_exists(r.data->'document', 'flow'))))`,
            [
                workspaceId,
                [RUN_ENTITY, ...WORKFLOW_ENTITIES],
                agents,
                STEP_ENTITY,
                RUN_ENTITY,
                LEAD_ENTITIES,
                GRAPH_VERSION_ENTITY,
            ],
        )
        const steps = await this.count(
            manager,
            `SELECT count(*)::int AS count FROM public.records WHERE workspace_id = $1 AND entity = $2
               AND data->>'runId' IN (SELECT id::text FROM public.records WHERE workspace_id = $1 AND entity = $3 AND data->>'agentId' = ANY($4))`,
            [workspaceId, STEP_ENTITY, RUN_ENTITY, agents],
        )
        const workflows = await this.count(
            manager,
            "SELECT count(*)::int AS count FROM public.records WHERE workspace_id = $1 AND entity = ANY($2) AND data->>'agentId' = ANY($3)",
            [workspaceId, WORKFLOW_ENTITIES, agents],
        )
        const leads = await this.count(
            manager,
            "SELECT count(*)::int AS count FROM public.records WHERE workspace_id = $1 AND entity = ANY($2)",
            [workspaceId, LEAD_ENTITIES],
        )
        const flows = await this.count(
            manager,
            `SELECT count(*)::int AS count FROM public.records WHERE workspace_id = $1 AND entity = $2 AND data->>'agentId' = ANY($3)
               AND jsonb_exists(data->'document', 'flow')`,
            [workspaceId, GRAPH_VERSION_ENTITY, agents],
        )
        const state = await this.eachKind(manager, (kind, present) =>
            present ? this.count(manager, kind.count, resetCountValuesOf(kind, scope)) : Promise.resolve(0),
        )
        return [
            { what: "agents", count: agents.length },
            { what: "record links", count: links },
            { what: "run steps", count: steps },
            { what: "runs", count: scope.runs.length },
            { what: `workflows, versions, run pins and conversation holds${SEEDED}`, count: workflows },
            { what: `graph versions that held a flow${SEEDED}`, count: flows },
            { what: "lead memory and freezes", count: leads },
            ...state,
        ]
    }

    private async clear(tx: EntityManager, workspaceId: string): Promise<ReadonlyArray<Removed>> {
        const scope = await this.scopeOf(tx, workspaceId)
        const { agents } = scope
        // The record links (a run step to its run) point at the records cleared below; they go first, or the delete is refused.
        const links = await this.deleted(
            tx,
            `DELETE FROM public.record_links l USING public.records r
              WHERE l.workspace_id = $1 AND r.workspace_id = $1
                AND ((l.from_entity = r.entity AND l.from_id = r.id) OR (l.to_entity = r.entity AND l.to_id = r.id))
                AND ((r.entity = ANY($2) AND r.data->>'agentId' = ANY($3))
                  OR (r.entity = $4 AND r.data->>'runId' IN (SELECT id::text FROM public.records WHERE workspace_id = $1 AND entity = $5 AND data->>'agentId' = ANY($3)))
                  OR r.entity = ANY($6)
                  OR (r.entity = $7 AND r.data->>'agentId' = ANY($3) AND jsonb_exists(r.data->'document', 'flow')))`,
            [
                workspaceId,
                [RUN_ENTITY, ...WORKFLOW_ENTITIES],
                agents,
                STEP_ENTITY,
                RUN_ENTITY,
                LEAD_ENTITIES,
                GRAPH_VERSION_ENTITY,
            ],
        )
        const steps = await this.deleted(
            tx,
            `DELETE FROM public.records WHERE workspace_id = $1 AND entity = $2
               AND data->>'runId' IN (SELECT id::text FROM public.records WHERE workspace_id = $1 AND entity = $3 AND data->>'agentId' = ANY($4))`,
            [workspaceId, STEP_ENTITY, RUN_ENTITY, agents],
        )
        const runs = await this.deleted(
            tx,
            "DELETE FROM public.records WHERE workspace_id = $1 AND entity = $2 AND data->>'agentId' = ANY($3)",
            [workspaceId, RUN_ENTITY, agents],
        )
        const workflows = await this.deleted(
            tx,
            "DELETE FROM public.records WHERE workspace_id = $1 AND entity = ANY($2) AND data->>'agentId' = ANY($3)",
            [workspaceId, WORKFLOW_ENTITIES, agents],
        )
        const leads = await this.deleted(tx, "DELETE FROM public.records WHERE workspace_id = $1 AND entity = ANY($2)", [
            workspaceId,
            LEAD_ENTITIES,
        ])
        // The graph goes back to its newest version with no flow (the one the installation made), or to none; then the versions that
        // froze a flow go, so the seed publishes the seeded flow as the one flow the primary workflow adopts: one version, no history.
        await tx.query(
            `UPDATE public.records g
                SET data = jsonb_set(g.data, '{activeVersionId}', COALESCE((
                        SELECT to_jsonb(v.id::text) FROM public.records v
                         WHERE v.workspace_id = $1 AND v.entity = $3 AND v.data->>'agentId' = g.data->>'agentId'
                           AND NOT jsonb_exists(v.data->'document', 'flow')
                         ORDER BY (v.data->>'number')::int DESC LIMIT 1), 'null'::jsonb)),
                    version = g.version + 1
              WHERE g.workspace_id = $1 AND g.entity = $2 AND g.data->>'agentId' = ANY($4)`,
            [workspaceId, GRAPH_ENTITY, GRAPH_VERSION_ENTITY, agents],
        )
        const flows = await this.deleted(
            tx,
            `DELETE FROM public.records WHERE workspace_id = $1 AND entity = $2 AND data->>'agentId' = ANY($3)
               AND jsonb_exists(data->'document', 'flow')`,
            [workspaceId, GRAPH_VERSION_ENTITY, agents],
        )
        // The run state of every run that is gone (the ones just deleted, and any an earlier reset left), each kind by its own condition.
        const state = await this.eachKind(tx, (kind, present) =>
            present ? this.deleted(tx, kind.clear, resetClearValuesOf(kind, scope)) : Promise.resolve(0),
        )
        return [
            { what: "agents", count: agents.length },
            { what: "record links", count: links },
            { what: "run steps", count: steps },
            { what: "runs", count: runs },
            { what: "workflows, versions, run pins and conversation holds", count: workflows },
            { what: "graph versions that held a flow", count: flows },
            { what: "lead memory and freezes", count: leads },
            ...state,
        ]
    }

    /** The reset agents and the ids of their runs (read before the runs are deleted: the run state is keyed by them). */
    private async scopeOf(manager: EntityManager, workspaceId: string): Promise<ResetScope> {
        const agents = await this.agentsOf(manager, workspaceId)
        const rows: ReadonlyArray<{ readonly id: string }> = await manager.query(
            "SELECT id::text AS id FROM public.records WHERE workspace_id = $1 AND entity = $2 AND data->>'agentId' = ANY($3)",
            [workspaceId, RUN_ENTITY, agents],
        )
        return { workspaceId, agents, runs: rows.map((row) => row.id) }
    }

    /** Runs `each` over the run-state kinds in order; a kind whose table does not exist yet is answered `present: false`. */
    private async eachKind(
        manager: EntityManager,
        each: (kind: ResetKind, present: boolean) => Promise<number>,
    ): Promise<ReadonlyArray<Removed>> {
        const lessons = await this.tableExists(manager, RESET_LESSON_TABLE)
        const counts: Array<Removed> = []
        for (const kind of RESET_RUN_STATE) {
            const count = await each(kind, kind.optional !== true || lessons)
            counts.push({ what: kind.what, count })
        }
        return counts
    }

    private async tableExists(manager: EntityManager, table: string): Promise<boolean> {
        const rows: ReadonlyArray<{ readonly present: boolean }> = await manager.query(
            "SELECT to_regclass($1) IS NOT NULL AS present",
            [table],
        )
        return rows[0]?.present === true
    }

    private async count(manager: EntityManager, sql: string, values: ReadonlyArray<unknown>): Promise<number> {
        const rows: unknown = await manager.query(sql, [...values])
        const first: unknown = Array.isArray(rows) ? rows[0] : undefined
        const count: unknown = typeof first === "object" && first !== null ? Reflect.get(first, "count") : undefined
        return typeof count === "number" ? count : 0
    }

    /** The agents of the reset modules in the workspace, from their installations. */
    private async agentsOf(tx: EntityManager, workspaceId: string): Promise<ReadonlyArray<string>> {
        const rows: ReadonlyArray<{ readonly agent_id: string | null }> = await tx.query(
            `SELECT agent_id::text AS agent_id FROM public.module_installations
              WHERE workspace_id = $1 AND module_key = ANY($2) AND removed_at IS NULL`,
            [workspaceId, RESET_MODULES],
        )
        return rows.flatMap((row) => (row.agent_id === null ? [] : [row.agent_id]))
    }

    private async deleted(tx: EntityManager, sql: string, values: ReadonlyArray<unknown>): Promise<number> {
        const result: unknown = await tx.query(sql, [...values])
        const count: unknown = Array.isArray(result) ? result[1] : undefined
        return typeof count === "number" ? count : 0
    }

    private async workspaceOf(name: string): Promise<string> {
        const rows: ReadonlyArray<{ readonly id: string }> = await this.entityManager.query(
            "SELECT id::text AS id FROM public.workspaces WHERE name = $1",
            [name],
        )
        const [only] = rows
        if (only === undefined || rows.length > 1) throw new Error(`workspace "${name}" is not exactly one workspace`)
        return only.id
    }
}
