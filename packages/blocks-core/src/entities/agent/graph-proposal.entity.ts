import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import type { ZodType } from "zod"

import { MAX_BODY, MAX_ENTRIES, MAX_ID } from "../../bounds"
import { boundedRecord } from "../../json.schema"

/** What raised a proposal. */
export const PROPOSAL_KINDS: readonly [string, ...Array<string>] = [
    "conflict",
    "learned",
    "template_update",
    "gap",
    "contract",
]

/** Where a proposal stands. */
export const PROPOSAL_STATUSES: readonly [string, ...Array<string>] = ["open", "confirmed", "declined", "superseded"]

/** The change a proposal makes, as data. */
type ProposalPatchJson = { readonly [key: string]: JsonValue }

/** The ids and passages a proposal rests on. */
type ProposalEvidence = { readonly ids: ReadonlyArray<string> }

const proposalEvidenceShape: ZodType<ProposalEvidence> = z.object({
    ids: z.array(z.string().max(MAX_BODY)).max(MAX_ENTRIES),
})

type GraphProposalFields = {
    readonly agentId: FieldDef<"uuid", false>
    readonly dedupeKey: FieldDef<"text", false>
    readonly kind: FieldDef<"enum", false>
    readonly status: FieldDef<"enum", false>
    readonly baseVersionId: FieldDef<"uuid", true>
    readonly nodeKey: FieldDef<"text", true>
    readonly branchKey: FieldDef<"text", true>
    readonly patch: FieldDef<"jsonb", false> & { readonly shape: ZodType<ProposalPatchJson> }
    readonly widens: FieldDef<"bool", false>
    readonly evidence: FieldDef<"jsonb", false> & { readonly shape: ZodType<ProposalEvidence> }
    readonly decidedBy: FieldDef<"uuid", true>
    readonly decidedAt: FieldDef<"timestamptz", true>
    readonly resultVersionId: FieldDef<"uuid", true>
}

const graphProposalFields: GraphProposalFields = {
    agentId: field.uuid(),
    dedupeKey: field.text({ maxLength: MAX_ID }),
    kind: field.enum({ of: PROPOSAL_KINDS }),
    status: field.enum({ of: PROPOSAL_STATUSES, default: { literal: "open" } }),
    baseVersionId: field.uuid({ nullable: true }),
    nodeKey: field.text({ maxLength: MAX_ID, nullable: true }),
    branchKey: field.text({ maxLength: MAX_ID, nullable: true }),
    patch: field.jsonb({ shape: boundedRecord }),
    widens: field.bool({ default: { literal: false } }),
    evidence: field.jsonb({ shape: proposalEvidenceShape }),
    decidedBy: field.uuid({ nullable: true }),
    decidedAt: field.timestamptz({ nullable: true }),
    resultVersionId: field.uuid({ nullable: true }),
}

/**
 * A change to a graph that something proposed (a changed Brain rule, a streak of decisions, a newer template) and a person decides.
 * The same cause never raises two proposals of an agent.
 */
export const agentGraphProposalEntity: EntityDefinition<GraphProposalFields> = defineEntity({
    name: "agent.graph-proposal",
    dataKind: "agent-graph-proposal",
    fields: graphProposalFields,
    indexes: [
        { name: "agent_status", on: ["agentId", "status", { desc: "createdAt" }, { desc: "id" }] },
        { name: "agent_kind_status", on: ["agentId", "kind", "status", "id"] },
    ],
    constraints: [
        { kind: "unique", name: "agent_dedupe_key", on: ["agentId", "dedupeKey"], refusal: "proposal-raised" },
    ],
    matchKeys: [{ name: "agent_dedupe", on: ["agentId", "dedupeKey"] }],
    view: true,
})
