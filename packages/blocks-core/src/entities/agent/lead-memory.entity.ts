import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { ZodType } from "zod"

import { MAX_ID } from "../../bounds"
import { boundedRecord } from "../../json.schema"

/**
 * What one memory entry holds: the outcome of a node step (`done`, `failed` on business grounds, `passed_over` for a side node that
 * failed), the trigger of the run (`trigger`), or the facts of the lead the nodes proved (`facts`).
 */
export const LEAD_MEMORY_KINDS: readonly [string, ...Array<string>] = ["done", "failed", "passed_over", "trigger", "facts"]

/** A JSON value as an entry keeps it: `{ value }`, so a list or a text output fits the bounded record of a `jsonb` field. */
type MemoryJson = { readonly [key: string]: JsonValue }

type LeadMemoryFields = {
    readonly entryKey: FieldDef<"text", false>
    readonly subjectKey: FieldDef<"text", false>
    readonly leadId: FieldDef<"uuid", true>
    readonly conversationId: FieldDef<"uuid", true>
    readonly namespace: FieldDef<"text", false>
    readonly nodeKey: FieldDef<"text", false>
    readonly step: FieldDef<"text", true>
    readonly kind: FieldDef<"enum", false>
    readonly agentId: FieldDef<"uuid", true>
    readonly workflowId: FieldDef<"uuid", true>
    readonly runId: FieldDef<"uuid", true>
    readonly versionId: FieldDef<"uuid", true>
    readonly output: FieldDef<"jsonb", false> & { readonly shape: ZodType<MemoryJson> }
    readonly error: FieldDef<"jsonb", true> & { readonly shape: ZodType<MemoryJson> }
    readonly writtenAt: FieldDef<"timestamptz", false>
    readonly closedAt: FieldDef<"timestamptz", true>
    readonly expiresAt: FieldDef<"timestamptz", false>
}

const leadMemoryFields: LeadMemoryFields = {
    entryKey: field.text({ maxLength: MAX_ID * 3 }),
    subjectKey: field.text({ maxLength: MAX_ID }),
    leadId: field.uuid({ nullable: true }),
    conversationId: field.uuid({ nullable: true }),
    namespace: field.text({ maxLength: MAX_ID }),
    nodeKey: field.text({ maxLength: MAX_ID }),
    step: field.text({ maxLength: MAX_ID, nullable: true }),
    kind: field.enum({ of: LEAD_MEMORY_KINDS }),
    agentId: field.uuid({ nullable: true }),
    workflowId: field.uuid({ nullable: true }),
    runId: field.uuid({ nullable: true }),
    versionId: field.uuid({ nullable: true }),
    output: field.jsonb({ shape: boundedRecord }),
    error: field.jsonb({ shape: boundedRecord, nullable: true }),
    writtenAt: field.timestamptz({ default: "now" }),
    closedAt: field.timestamptz({ nullable: true }),
    expiresAt: field.timestamptz(),
}

/**
 * The memory of one customer (a lead, else the conversation of a customer who is not a lead yet), across every workflow and run of
 * theirs: one entry per (customer, workflow namespace, node key) with the latest outcome of that node, one `trigger` entry per workflow
 * and one `facts` entry per customer (namespace `$lead`). Steps read it through refs (`lead.address`, `workflows.sales.consult.steps...`);
 * resume reads a node's stored outcome instead of running it again. Files are refs, never bytes. Written by the lead-memory capability
 * only; `expiresAt` is the retention (30 days after the lead closes), swept by the engine.
 */
export const agentLeadMemoryEntity: EntityDefinition<LeadMemoryFields> = defineEntity({
    name: "agent.lead-memory",
    dataKind: "agent-lead-memory",
    fields: leadMemoryFields,
    indexes: [
        { name: "subject", on: ["subjectKey", "id"] },
        { name: "lead", on: ["leadId", "id"] },
        { name: "conversation", on: ["conversationId", "id"] },
        { name: "run_node", on: ["runId", "nodeKey", "id"] },
        { name: "expires", on: ["expiresAt", "id"] },
        // One entry by its key, as a node's data port reads it (newest first): the customer's facts entry for care.
        { name: "entry_recent", on: ["entryKey", { desc: "createdAt" }, { desc: "id" }] },
    ],
    constraints: [{ kind: "unique", name: "entry_key", on: ["entryKey"], refusal: "lead-memory-entry-taken" }],
    matchKeys: [{ name: "entry", on: ["entryKey"] }],
    deletable: true,
    view: true,
})
