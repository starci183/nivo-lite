import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z, type ZodType } from "zod"

import { MAX_BODY, MAX_ENTRIES, MAX_ID } from "../../bounds"
import { boundedRecord } from "../../json.schema"
import { GRAPH_MODES } from "./graph.entity"

/** The road a decision left by. */
export const DECISION_ROADS: readonly [string, ...Array<string>] = ["work", "reply", "tool", "handover"]

/** What the gate alone answered. */
export const DECISION_GATE_VERDICTS: readonly [string, ...Array<string>] = ["auto", "ask"]

/** What a run came to. */
export const DECISION_OUTCOMES: readonly [string, ...Array<string>] = ["auto", "ask", "stop", "divert"]

/** How the work of a decision ended. */
export const DECISION_CLOSED_AS: readonly [string, ...Array<string>] = [
    "done",
    "approved",
    "edited",
    "rejected",
    "expired",
    "stopped",
]

/** A list of keys: the facts a condition could not read, or the nodes a walk went through. */
type KeyList = { readonly keys: ReadonlyArray<string> }

const keyListShape: ZodType<KeyList> = z.object({ keys: z.array(z.string().max(MAX_ID)).max(MAX_ENTRIES) })

/** The facts as read from real records. */
type FactsJson = { readonly [key: string]: JsonValue }

type GraphDecisionFields = {
    readonly agentId: FieldDef<"uuid", false>
    readonly workItemId: FieldDef<"uuid", true>
    readonly dedupeKey: FieldDef<"text", true>
    readonly road: FieldDef<"enum", false>
    readonly mode: FieldDef<"enum", false>
    readonly gateVerdict: FieldDef<"enum", true>
    readonly unread: FieldDef<"jsonb", false> & { readonly shape: ZodType<KeyList> }
    readonly unjudged: FieldDef<"text", true>
    readonly subjectType: FieldDef<"text", true>
    readonly subjectId: FieldDef<"text", true>
    readonly versionId: FieldDef<"uuid", false>
    readonly turnId: FieldDef<"uuid", true>
    readonly wakeId: FieldDef<"uuid", true>
    readonly action: FieldDef<"text", false>
    readonly path: FieldDef<"jsonb", false> & { readonly shape: ZodType<KeyList> }
    readonly facts: FieldDef<"jsonb", false> & { readonly shape: ZodType<FactsJson> }
    readonly branchKey: FieldDef<"text", false>
    readonly outcome: FieldDef<"enum", false>
    readonly approvalRequestId: FieldDef<"uuid", true>
    readonly closedAs: FieldDef<"enum", true>
    readonly shadowDiff: FieldDef<"bool", false>
}

const graphDecisionFields: GraphDecisionFields = {
    agentId: field.uuid(),
    workItemId: field.uuid({ nullable: true }),
    dedupeKey: field.text({ maxLength: MAX_ID, nullable: true }),
    road: field.enum({ of: DECISION_ROADS, default: { literal: "work" } }),
    mode: field.enum({ of: GRAPH_MODES, default: { literal: "shadow" } }),
    gateVerdict: field.enum({ of: DECISION_GATE_VERDICTS, nullable: true }),
    unread: field.jsonb({ shape: keyListShape }),
    unjudged: field.text({ maxLength: MAX_BODY, nullable: true }),
    subjectType: field.text({ maxLength: MAX_ID, nullable: true }),
    subjectId: field.text({ maxLength: MAX_ID, nullable: true }),
    versionId: field.uuid(),
    turnId: field.uuid({ nullable: true }),
    wakeId: field.uuid({ nullable: true }),
    action: field.text({ maxLength: MAX_ID }),
    path: field.jsonb({ shape: keyListShape }),
    facts: field.jsonb({ shape: boundedRecord }),
    branchKey: field.text({ maxLength: MAX_ID }),
    outcome: field.enum({ of: DECISION_OUTCOMES }),
    approvalRequestId: field.uuid({ nullable: true }),
    closedAs: field.enum({ of: DECISION_CLOSED_AS, nullable: true }),
    shadowDiff: field.bool({ default: { literal: false } }),
}

/**
 * What a graph decided for one work item (or one run that left none): the version, the path, the facts as read, the branch and the
 * outcome. One record for each work item, or for each dedupe key when there is no item, written once however often it is retried.
 */
export const agentGraphDecisionEntity: EntityDefinition<GraphDecisionFields> = defineEntity({
    name: "agent.graph-decision",
    dataKind: "agent-graph-decision",
    fields: graphDecisionFields,
    indexes: [
        { name: "agent_recent", on: ["agentId", { desc: "createdAt" }, { desc: "id" }] },
        { name: "request", on: ["approvalRequestId", "id"] },
        { name: "work_item", on: ["workItemId", "id"] },
        { name: "recent", on: [{ desc: "updatedAt" }, { desc: "id" }] },
    ],
    constraints: [
        {
            kind: "unique",
            name: "work_item_key",
            on: ["workItemId"],
            where: { op: "notNull", field: "workItemId" },
            refusal: "decision-recorded",
        },
        {
            kind: "unique",
            name: "dedupe_key_key",
            on: ["dedupeKey"],
            where: { op: "notNull", field: "dedupeKey" },
            refusal: "decision-recorded",
        },
        {
            kind: "check",
            name: "once_check",
            expr: {
                op: "or",
                of: [
                    { op: "notNull", field: "workItemId" },
                    { op: "notNull", field: "dedupeKey" },
                ],
            },
            refusal: "decision-unkeyed",
        },
    ],
    matchKeys: [
        { name: "work_item", on: ["workItemId"] },
        { name: "dedupe", on: ["dedupeKey"] },
    ],
    view: true,
})
