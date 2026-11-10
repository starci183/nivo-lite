import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { ZodType } from "zod"

import { MAX_BODY, MAX_ID } from "../../bounds"
import { boundedRecord } from "../../json.schema"

/** How a workflow version came to be. */
export const WORKFLOW_CHANGE_KINDS: readonly [string, ...Array<string>] = [
    "template",
    "blank",
    "adopt",
    "copy",
    "edit",
    "proposal",
    "accept_template",
    "rollback",
]

/** Who made a workflow version: the owner (a member), NIVO (a proposal it raised) or the system (a seed, a copy). */
export const WORKFLOW_AUTHOR_KINDS: readonly [string, ...Array<string>] = ["owner", "nivo", "system"]

/** The full graph snapshot of a version. */
type SnapshotJson = { readonly [key: string]: JsonValue }

type WorkflowVersionFields = {
    readonly workflowId: FieldDef<"uuid", false>
    readonly agentId: FieldDef<"uuid", false>
    readonly number: FieldDef<"int", false>
    readonly document: FieldDef<"jsonb", false> & { readonly shape: ZodType<SnapshotJson> }
    readonly documentHash: FieldDef<"text", false>
    readonly changeKind: FieldDef<"enum", false>
    readonly authorKind: FieldDef<"enum", false>
    readonly authorId: FieldDef<"uuid", true>
    readonly note: FieldDef<"text", false>
    readonly templateId: FieldDef<"text", true>
    readonly templateVersion: FieldDef<"int", true>
    readonly fromNumber: FieldDef<"int", true>
    readonly graphVersionId: FieldDef<"uuid", true>
    readonly publishedAt: FieldDef<"timestamptz", false>
}

const workflowVersionFields: WorkflowVersionFields = {
    workflowId: field.uuid(),
    agentId: field.uuid(),
    number: field.int(),
    document: field.jsonb({ shape: boundedRecord }),
    documentHash: field.text({ maxLength: MAX_ID }),
    changeKind: field.enum({ of: WORKFLOW_CHANGE_KINDS }),
    authorKind: field.enum({ of: WORKFLOW_AUTHOR_KINDS }),
    authorId: field.uuid({ nullable: true }),
    note: field.text({ maxLength: MAX_BODY, default: "empty" }),
    templateId: field.text({ maxLength: MAX_ID, nullable: true }),
    templateVersion: field.int({ nullable: true }),
    fromNumber: field.int({ nullable: true }),
    graphVersionId: field.uuid({ nullable: true }),
    publishedAt: field.timestamptz({ default: "now" }),
}

/**
 * One version of a workflow: the FULL graph snapshot (nodes, edges, params, grants, groups, waits), written once and never changed.
 * `templateId`/`templateVersion` is the provenance the version carries (copied from a template, or the template whose change it
 * accepted); `fromNumber` is the version a rollback copied; `graphVersionId` is the agent graph version a primary workflow version
 * published or adopted. Runs pin to a version and execute this snapshot.
 */
export const agentWorkflowVersionEntity: EntityDefinition<WorkflowVersionFields> = defineEntity({
    name: "agent.workflow-version",
    dataKind: "agent-workflow-version",
    fields: workflowVersionFields,
    indexes: [
        { name: "workflow_number", on: ["workflowId", { desc: "number" }, { desc: "id" }] },
        { name: "agent_graph_version", on: ["agentId", "graphVersionId", "id"] },
    ],
    constraints: [
        { kind: "unique", name: "workflow_number_key", on: ["workflowId", "number"], refusal: "version-taken" },
    ],
    view: true,
})
