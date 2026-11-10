import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

type RunWorkflowFields = {
    readonly runId: FieldDef<"uuid", false>
    readonly agentId: FieldDef<"uuid", false>
    readonly workflowId: FieldDef<"uuid", false>
    readonly workflowVersionId: FieldDef<"uuid", false>
    readonly workflowVersion: FieldDef<"int", false>
    readonly startedAt: FieldDef<"timestamptz", false>
}

const runWorkflowFields: RunWorkflowFields = {
    runId: field.uuid(),
    agentId: field.uuid(),
    workflowId: field.uuid(),
    workflowVersionId: field.uuid(),
    workflowVersion: field.int(),
    startedAt: field.timestamptz({ default: "now" }),
}

/**
 * The pin of one run to the workflow and the version it executes, written once in the transaction that opens the run and never
 * changed. It lives beside the run (one per run) so the run record keeps its shape; the runs list filters by workflow through it.
 */
export const agentRunWorkflowEntity: EntityDefinition<RunWorkflowFields> = defineEntity({
    name: "agent.run-workflow",
    dataKind: "agent-run-workflow",
    fields: runWorkflowFields,
    indexes: [
        { name: "key", on: ["id"] },
        { name: "agent_workflow_started", on: ["agentId", "workflowId", { desc: "startedAt" }, { desc: "id" }] },
    ],
    constraints: [{ kind: "unique", name: "run_key", on: ["runId"], refusal: "run-pinned" }],
    matchKeys: [{ name: "run", on: ["runId"] }],
    view: true,
})
