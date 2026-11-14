import type { ScopedTx } from "@modules/domain/entity-engine"
import type {
    WorkflowInsert,
    WorkflowPatch,
    WorkflowRecord,
    WorkflowVersionInsert,
    WorkflowVersionRecord,
} from "./agent-workflows.contracts"

/**
 * The workflows of the agents and their append-only versions (public.agent_workflows, agent_workflow_versions). Every member runs in the
 * transaction of the `ScopedTx` it is given, on the workspace it names, and never opens one. A write answers null when a unique key holds
 * its row already or, under a fence, when the row moved on (nothing written).
 */
export interface AgentWorkflowTableStore {
    /** One workflow, or null. */
    workflow(tx: ScopedTx, id: string): Promise<WorkflowRecord | null>
    /** The workflows of an agent (every agent of the workspace when null) in list order, agent by agent, at most `limit`. */
    workflows(tx: ScopedTx, agentId: string | null, limit: number): Promise<ReadonlyArray<WorkflowRecord>>
    /** Writes a workflow; null when the agent holds its key already. */
    insertWorkflow(tx: ScopedTx, workflow: WorkflowInsert): Promise<WorkflowRecord | null>
    /** Writes members of a workflow at the fence read. */
    updateWorkflow(tx: ScopedTx, id: string, fence: string, patch: WorkflowPatch): Promise<WorkflowRecord | null>
    /** One version, or null. */
    version(tx: ScopedTx, id: string): Promise<WorkflowVersionRecord | null>
    /** The versions of a workflow, newest first, at most `limit`. */
    versions(tx: ScopedTx, workflowId: string, limit: number): Promise<ReadonlyArray<WorkflowVersionRecord>>
    /** The version of an agent's workflow that mirrors this agent graph version, or null. */
    versionOfGraphVersion(tx: ScopedTx, agentId: string, graphVersionId: string): Promise<WorkflowVersionRecord | null>
    /** Writes a version; null when the workflow holds its number already. */
    addVersion(tx: ScopedTx, version: WorkflowVersionInsert): Promise<WorkflowVersionRecord | null>
}

/** The injection token of the workflow store. */
export const AGENT_WORKFLOW_STORE: unique symbol = Symbol("AGENT_WORKFLOW_STORE")
