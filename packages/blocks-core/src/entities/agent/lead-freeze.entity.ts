import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { ZodType } from "zod"

import { MAX_ID, MAX_LINE } from "../../bounds"
import { boundedRecord } from "../../json.schema"

/**
 * Where the freeze of one customer stands: `frozen` while a run of theirs failed for good and waits for the owner, `retrying` while the
 * owner's "Thử lại" runs the failed run again, `released` once the retry succeeded or the owner skipped the turn.
 */
export const LEAD_FREEZE_STATUSES: readonly [string, ...Array<string>] = ["frozen", "retrying", "released"]

/** The events recorded while the customer was frozen, in the order they came: `{ events: [...] }`. */
type FreezePending = { readonly [key: string]: JsonValue }

type LeadFreezeFields = {
    readonly key: FieldDef<"text", false>
    readonly leadId: FieldDef<"uuid", true>
    readonly conversationId: FieldDef<"uuid", true>
    readonly status: FieldDef<"enum", false>
    readonly frozenRunId: FieldDef<"uuid", true>
    readonly agentId: FieldDef<"uuid", true>
    readonly frozenAt: FieldDef<"timestamptz", true>
    readonly frozenReason: FieldDef<"text", true>
    readonly stepKey: FieldDef<"text", true>
    readonly stepTitle: FieldDef<"text", true>
    readonly customerName: FieldDef<"text", true>
    readonly workItemId: FieldDef<"uuid", true>
    readonly episode: FieldDef<"int", false>
    readonly failures: FieldDef<"int", false>
    readonly heldBy: FieldDef<"text", true>
    readonly releasedAt: FieldDef<"timestamptz", true>
    readonly releasedBy: FieldDef<"text", true>
    readonly releaseReason: FieldDef<"text", true>
    readonly pending: FieldDef<"jsonb", false> & { readonly shape: ZodType<FreezePending> }
}

const leadFreezeFields: LeadFreezeFields = {
    key: field.text({ maxLength: MAX_ID }),
    leadId: field.uuid({ nullable: true }),
    conversationId: field.uuid({ nullable: true }),
    status: field.enum({ of: LEAD_FREEZE_STATUSES, default: { literal: "frozen" } }),
    frozenRunId: field.uuid({ nullable: true }),
    agentId: field.uuid({ nullable: true }),
    frozenAt: field.timestamptz({ nullable: true }),
    frozenReason: field.text({ maxLength: MAX_LINE, nullable: true }),
    stepKey: field.text({ maxLength: MAX_ID, nullable: true }),
    stepTitle: field.text({ maxLength: MAX_LINE, nullable: true }),
    customerName: field.text({ maxLength: MAX_LINE, nullable: true }),
    workItemId: field.uuid({ nullable: true }),
    episode: field.int({ default: { literal: 0 } }),
    failures: field.int({ default: { literal: 0 } }),
    heldBy: field.text({ maxLength: MAX_LINE, nullable: true }),
    releasedAt: field.timestamptz({ nullable: true }),
    releasedBy: field.text({ maxLength: MAX_ID, nullable: true }),
    releaseReason: field.text({ maxLength: MAX_ID, nullable: true }),
    pending: field.jsonb({ shape: boundedRecord }),
}

/**
 * The freeze of one customer (a lead, else the conversation of a customer who is not a lead yet): a run of theirs failed for good, so no
 * new run starts for them in any lane until the owner retries the run or skips the turn. One record per customer, kept across freezes:
 * `episode` counts them. What reached the customer while frozen is kept in `pending` and replayed in order on release. Written by the
 * lead-freezes capability only; the record version is the fence of every write.
 */
export const agentLeadFreezeEntity: EntityDefinition<LeadFreezeFields> = defineEntity({
    name: "agent.lead-freeze",
    dataKind: "agent-lead-freeze",
    fields: leadFreezeFields,
    indexes: [
        { name: "key_lookup", on: ["key", "id"] },
        { name: "status_frozen", on: ["status", "frozenAt", "id"] },
        { name: "run", on: ["frozenRunId", "id"] },
        { name: "lead", on: ["leadId", "id"] },
    ],
    constraints: [{ kind: "unique", name: "freeze_key", on: ["key"], refusal: "lead-freeze-taken" }],
    matchKeys: [{ name: "key", on: ["key"] }],
    view: true,
})
