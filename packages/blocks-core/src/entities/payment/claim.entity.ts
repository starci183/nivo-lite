import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import { z, type ZodType } from "zod"

import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"

/** The most names a claim keeps. */
const MAX_CLAIM_NAMES = 20

/** The names a customer gave when saying they paid. */
type ClaimNames = { readonly values: ReadonlyArray<string> }

const claimNamesShape: ZodType<ClaimNames> = z.object({
    values: z.array(z.string().max(MAX_LINE)).max(MAX_CLAIM_NAMES),
})

/** Where a claim stands. */
export const CLAIM_STATUSES: readonly [string, ...Array<string>] = ["open", "settled", "escalated", "withdrawn"]

type ClaimFields = {
    readonly code: FieldDef<"text", true>
    readonly leadId: FieldDef<"uuid", true>
    readonly conversationId: FieldDef<"uuid", true>
    readonly amountVnd: FieldDef<"money_vnd", true>
    readonly names: FieldDef<"jsonb", false> & { readonly shape: ZodType<ClaimNames> }
    readonly body: FieldDef<"text", false>
    readonly status: FieldDef<"enum", false>
    readonly claimedAt: FieldDef<"timestamptz", false>
    readonly settledTransactionId: FieldDef<"uuid", true>
    readonly dedupeKey: FieldDef<"text", false>
}

const claimFields: ClaimFields = {
    code: field.text({ maxLength: MAX_ID, nullable: true }),
    leadId: field.uuid({ nullable: true }),
    conversationId: field.uuid({ nullable: true }),
    amountVnd: field.moneyVnd({ nullable: true }),
    names: field.jsonb({ shape: claimNamesShape }),
    body: field.text({ maxLength: MAX_BODY }),
    status: field.enum({ of: CLAIM_STATUSES, default: { literal: "open" } }),
    claimedAt: field.timestamptz({ default: "now" }),
    settledTransactionId: field.uuid({ nullable: true }),
    dedupeKey: field.text({ maxLength: MAX_ID }),
}

/** What a customer said about paying an order. Graph node kind `payment-claim`. */
export const claimEntity: EntityDefinition<ClaimFields> = defineEntity({
    name: "payment.claim",
    dataKind: "payment-claim",
    fields: claimFields,
    relations: {
        order: { kind: "toOne", target: "sales.order" },
        conversation: { kind: "toOne", target: "chat.conversation" },
    },
    indexes: [
        { name: "key", on: ["id"] },
        { name: "status_recent", on: ["status", { desc: "createdAt" }, { desc: "id" }] },
        { name: "status_claimed", on: ["status", { desc: "claimedAt" }, { desc: "id" }] },
        { name: "lead_claimed", on: ["leadId", { desc: "claimedAt" }, { desc: "id" }] },
        { name: "conversation_claimed", on: ["conversationId", { desc: "claimedAt" }, { desc: "id" }] },
    ],
    constraints: [
        { kind: "unique", name: "dedupe_key", on: ["dedupeKey"], refusal: "claim-already-recorded" },
        {
            kind: "unique",
            name: "settled_transaction_key",
            on: ["settledTransactionId"],
            where: { op: "notNull", field: "settledTransactionId" },
            refusal: "transaction-already-settled",
        },
        {
            kind: "check",
            name: "amount_chk",
            expr: {
                op: "or",
                of: [
                    { op: "isNull", field: "amountVnd" },
                    { op: "gt", field: "amountVnd", value: 0 },
                ],
            },
            refusal: "claim-amount-not-positive",
        },
    ],
})
