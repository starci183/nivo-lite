import { Inject, Injectable, Optional } from "@nestjs/common"
import { AgentRunRecordsService, type StoredRun } from "@modules/domain/agent-runs"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AGENT_WORKFLOW_STORE, type AgentWorkflowTableStore } from "./agent-workflow-store.port"
import type {
    OptionalWorkflowRecord,
    OptionalWorkflowVersionRecord,
    RunWorkflowPin,
    RunWorkflowPinWrite,
    WorkflowInsert,
    WorkflowPatch,
    WorkflowRecord,
    WorkflowVersionInsert,
    WorkflowVersionRecord,
} from "./agent-workflows.contracts"

/** The pin a run row holds, or null for a run of no workflow. */
const pinOf = (run: StoredRun): RunWorkflowPin | null =>
    run.workflowId === null || run.workflowVersionId === null || run.workflowVersion === null
        ? null
        : {
              runId: run.id,
              workflowId: run.workflowId,
              workflowVersionId: run.workflowVersionId,
              workflowVersion: run.workflowVersion,
          }

@Injectable()
/**
 * The one place the graph engine reads and writes the workflows of an agent and their append-only versions (inserted once, never updated),
 * on their core tables (`AGENT_WORKFLOW_STORE`), and the pin of a run to the version it executes (columns of the run, on the runs table:
 * an app with no runs pins none). A workflow patch is written under the version (fence) the caller read. Every method runs in the
 * transaction of the `ScopedTx` it is given.
 */
export class AgentWorkflowRecordsService {
    constructor(
        @Inject(AGENT_WORKFLOW_STORE) private readonly store: AgentWorkflowTableStore,
        @Optional() private readonly runs?: AgentRunRecordsService,
    ) {}

    /** One workflow, or null. */
    workflow(tx: ScopedTx, workflowId: string): Promise<OptionalWorkflowRecord> {
        return this.store.workflow(tx, workflowId)
    }

    /** The workflows of an agent in list order, at most `limit`. */
    workflowsOf(tx: ScopedTx, agentId: string, limit: number): Promise<ReadonlyArray<WorkflowRecord>> {
        return this.store.workflows(tx, agentId, limit)
    }

    /** Every workflow of the workspace the transaction is scoped to, of every agent: what an end hand-off may call. */
    workflowsOfWorkspace(tx: ScopedTx, limit: number): Promise<ReadonlyArray<WorkflowRecord>> {
        return this.store.workflows(tx, null, limit)
    }

    /** Inserts a workflow; null when the agent already holds one under its key. */
    insertWorkflow(tx: ScopedTx, values: WorkflowInsert): Promise<OptionalWorkflowRecord> {
        return this.store.insertWorkflow(tx, values)
    }

    /** Writes the workflow's fields under the version the caller read: the workflow after, or null when it had moved on. */
    patchWorkflow(tx: ScopedTx, workflow: WorkflowRecord, values: WorkflowPatch): Promise<OptionalWorkflowRecord> {
        return this.store.updateWorkflow(tx, workflow.id, workflow.fence, values)
    }

    /** One version, or null. */
    version(tx: ScopedTx, versionId: string): Promise<OptionalWorkflowVersionRecord> {
        return this.store.version(tx, versionId)
    }

    /** The versions of a workflow, newest first, at most `limit`. */
    versionsOf(tx: ScopedTx, workflowId: string, limit: number): Promise<ReadonlyArray<WorkflowVersionRecord>> {
        return this.store.versions(tx, workflowId, limit)
    }

    /** The version of an agent's workflow that published or adopted this agent graph version, or null. */
    versionOfGraphVersion(
        tx: ScopedTx,
        agentId: string,
        graphVersionId: string,
    ): Promise<OptionalWorkflowVersionRecord> {
        return this.store.versionOfGraphVersion(tx, agentId, graphVersionId)
    }

    /** Inserts a version; null when the workflow already holds its number. */
    insertVersion(tx: ScopedTx, values: WorkflowVersionInsert): Promise<OptionalWorkflowVersionRecord> {
        return this.store.addVersion(tx, values)
    }

    /** Pins a run to its workflow version once: a replay of the run finds the pin there and writes nothing. */
    async pinRun(tx: ScopedTx, values: RunWorkflowPinWrite): Promise<void> {
        await this.runsOf().pinRun(tx, values.runId, {
            workflowId: values.workflowId,
            workflowVersionId: values.workflowVersionId,
            workflowVersion: values.workflowVersion,
        })
    }

    /** The pins of these runs; a run of no workflow is left out. */
    async pinsOf(tx: ScopedTx, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<RunWorkflowPin>> {
        if (runIds.length === 0) return []
        const rows = await this.runsOf().runRows(tx, { ids: runIds, order: "started" }, runIds.length)
        return rows.flatMap((row) => pinOf(row) ?? [])
    }

    /** The newest runs of an agent pinned to one workflow, at most `limit`. */
    async runsOfWorkflow(
        tx: ScopedTx,
        agentId: string,
        workflowId: string,
        limit: number,
    ): Promise<ReadonlyArray<RunWorkflowPin>> {
        const rows = await this.runsOf().runRows(tx, { agentId, workflowId, order: "started" }, limit)
        return rows.flatMap((row) => pinOf(row) ?? [])
    }

    private runsOf(): AgentRunRecordsService {
        if (this.runs === undefined) throw new AgentGraphsError({ code: AgentGraphsErrorCode.EngineMissing })
        return this.runs
    }
}
