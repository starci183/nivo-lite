import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID, MAX_LINE } from "../../bounds"

/** Where a workflow stands: `active` takes wakes, `draft` is kept but never runs, `paused` was active and is stopped. */
export const WORKFLOW_STATUSES: readonly [string, ...Array<string>] = ["active", "draft", "paused"]

type WorkflowFields = {
    readonly agentId: FieldDef<"uuid", false>
    readonly key: FieldDef<"text", false>
    readonly name: FieldDef<"text", false>
    readonly status: FieldDef<"enum", false>
    readonly primary: FieldDef<"bool", false>
    readonly position: FieldDef<"int", false>
    readonly activeVersionId: FieldDef<"uuid", true>
    readonly latestNumber: FieldDef<"int", false>
    readonly templateId: FieldDef<"text", true>
    readonly templateVersion: FieldDef<"int", true>
    readonly createdBy: FieldDef<"uuid", true>
}

const workflowFields: WorkflowFields = {
    agentId: field.uuid(),
    key: field.text({ maxLength: MAX_ID }),
    name: field.text({ maxLength: MAX_LINE }),
    status: field.enum({ of: WORKFLOW_STATUSES, default: { literal: "draft" } }),
    primary: field.bool({ default: { literal: false } }),
    position: field.int({ default: { literal: 0 } }),
    activeVersionId: field.uuid({ nullable: true }),
    latestNumber: field.int({ default: { literal: 0 } }),
    templateId: field.text({ maxLength: MAX_ID, nullable: true }),
    templateVersion: field.int({ nullable: true }),
    createdBy: field.uuid({ nullable: true }),
}

/**
 * One workflow of an agent: a named graph with its own append-only version history. It never points at a template's graph: the
 * template link is provenance only (`templateId`, `templateVersion` at copy or accept time). The version that runs is
 * `activeVersionId`; `latestNumber` is the newest version number, the fence of the next one. The primary workflow is the one every
 * wake of the agent goes to unless a narrower active workflow takes it. The record version is the fence of every write.
 */
export const agentWorkflowEntity: EntityDefinition<WorkflowFields> = defineEntity({
    name: "agent.workflow",
    dataKind: "agent-workflow",
    fields: workflowFields,
    indexes: [{ name: "agent_position", on: ["agentId", "position", "id"] }],
    constraints: [{ kind: "unique", name: "agent_key", on: ["agentId", "key"], refusal: "workflow-exists" }],
    matchKeys: [{ name: "agent_key", on: ["agentId", "key"] }],
    view: true,
})
