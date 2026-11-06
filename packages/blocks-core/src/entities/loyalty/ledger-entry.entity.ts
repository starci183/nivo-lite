import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID, MAX_LINE } from "../../bounds"

/** Why points moved. */
export const LEDGER_KINDS: readonly [string, ...Array<string>] = ["earn", "redeem", "expire", "adjust"]

type LedgerEntryFields = {
    readonly memberId: FieldDef<"uuid", false>
    readonly kind: FieldDef<"enum", false>
    readonly points: FieldDef<"int", false>
    readonly amountVnd: FieldDef<"money_vnd", true>
    readonly evidence: FieldDef<"text", true>
    readonly by: FieldDef<"text", false>
    readonly expiresAt: FieldDef<"timestamptz", true>
    readonly occurredAt: FieldDef<"timestamptz", false>
    readonly ref: FieldDef<"text", false>
    readonly rewardId: FieldDef<"uuid", true>
}

const ledgerEntryFields: LedgerEntryFields = {
    memberId: field.uuid(),
    kind: field.enum({ of: LEDGER_KINDS }),
    points: field.int(),
    amountVnd: field.moneyVnd({ nullable: true }),
    evidence: field.text({ maxLength: 2_000, nullable: true }),
    by: field.text({ maxLength: MAX_LINE }),
    expiresAt: field.timestamptz({ nullable: true }),
    occurredAt: field.timestamptz({ default: "now" }),
    ref: field.text({ maxLength: MAX_ID }),
    rewardId: field.uuid({ nullable: true }),
}

/** One entry of the append-only points ledger of a customer. A repeat of its `ref` changes nothing. Graph node kind `loyalty-ledger`. */
export const loyaltyLedgerEntryEntity: EntityDefinition<LedgerEntryFields> = defineEntity({
    name: "loyalty.ledger-entry",
    dataKind: "loyalty-ledger",
    fields: ledgerEntryFields,
    relations: { member: { kind: "toOne", target: "loyalty.member", required: true, onDelete: "cascade" } },
    indexes: [
        { name: "member_occurred", on: ["memberId", { desc: "occurredAt" }, { desc: "id" }] },
        { name: "member_kind", on: ["memberId", "kind", "id"] },
        { name: "occurred", on: [{ desc: "occurredAt" }, { desc: "id" }] },
        { name: "kind_occurred", on: ["kind", { desc: "occurredAt" }, { desc: "id" }] },
        { name: "ref", on: ["ref", "id"] },
        { name: "reward", on: ["rewardId", "id"] },
    ],
    constraints: [{ kind: "unique", name: "ref_key", on: ["ref"], refusal: "ledger-ref-posted" }],
    matchKeys: [{ name: "ref", on: ["ref"] }],
})
