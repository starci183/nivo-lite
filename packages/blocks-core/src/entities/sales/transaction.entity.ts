import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_ID, MAX_LINE } from "../../bounds"
import { SALES_ORDER_ENTITY, SALES_TRANSACTION_ENTITY } from "./sales-entity-names"

/** Whether a transaction is tied to what it paid, or the owner called it other income. */
export const TRANSACTION_STATUSES: readonly [string, ...Array<string>] = [
    "unmatched",
    "matched",
    "needs_review",
    "other_income",
]

type TransactionFields = {
    readonly channel: FieldDef<"enum", false>
    readonly direction: FieldDef<"enum", false>
    readonly amountVnd: FieldDef<"money_vnd", false>
    readonly reference: FieldDef<"text", true>
    readonly payer: FieldDef<"text", true>
    readonly orderId: FieldDef<"uuid", true>
    readonly invoiceId: FieldDef<"uuid", true>
    readonly externalRef: FieldDef<"text", true>
    readonly account: FieldDef<"text", true>
    readonly connectionId: FieldDef<"uuid", true>
    readonly occurredAt: FieldDef<"timestamptz", false>
    readonly status: FieldDef<"enum", false>
}

const transactionFields: TransactionFields = {
    channel: field.enum({ of: ["bank", "cash", "card", "ewallet"], default: { literal: "bank" } }),
    direction: field.enum({ of: ["credit", "debit"], default: { literal: "credit" } }),
    amountVnd: field.moneyVnd(),
    reference: field.text({ maxLength: MAX_LINE, nullable: true }),
    payer: field.text({ maxLength: MAX_LINE, nullable: true }),
    orderId: field.uuid({ nullable: true }),
    /** The accounting invoice the movement paid: an EXTERNAL id of another agent's record (no relation, no include, no cascade). */
    invoiceId: field.uuid({ nullable: true }),
    externalRef: field.text({ maxLength: MAX_ID, nullable: true }),
    account: field.text({ maxLength: MAX_ID, nullable: true }),
    /** The connected account (bank feed connection) the movement arrived on: a fact for the books, not a matching rule. */
    connectionId: field.uuid({ nullable: true }),
    occurredAt: field.timestamptz({ default: "now" }),
    status: field.enum({ of: TRANSACTION_STATUSES, default: { literal: "unmatched" } }),
}

/** One money movement of a workspace. Graph node kind `bank-transaction`. */
export const transactionEntity: EntityDefinition<TransactionFields> = defineEntity({
    name: SALES_TRANSACTION_ENTITY,
    dataKind: "bank-transaction",
    fields: transactionFields,
    relations: {
        order: { kind: "toOne", target: SALES_ORDER_ENTITY },
    },
    indexes: [
        { name: "key", on: ["id"] },
        { name: "amount_recent", on: ["amountVnd", { desc: "createdAt" }, { desc: "id" }] },
        { name: "status_recent", on: ["status", { desc: "createdAt" }, { desc: "id" }] },
        { name: "occurred", on: [{ desc: "occurredAt" }, { desc: "id" }] },
        { name: "status_occurred", on: ["status", { desc: "occurredAt" }, { desc: "id" }] },
        { name: "direction_occurred", on: ["direction", { desc: "occurredAt" }, { desc: "id" }] },
        { name: "direction_status_occurred", on: ["direction", "status", { desc: "occurredAt" }, { desc: "id" }] },
        { name: "invoice", on: ["invoiceId", { desc: "id" }] },
        // An order may be paid by several credits (a customer who pays in parts, D-MX-3): the order's credits, not one credit per order.
        // A second settlement of a paid order is refused by the settle rule (the order no longer waits) and the order's version.
        { name: "order", on: ["orderId", { desc: "id" }] },
    ],
    constraints: [
        {
            kind: "unique",
            name: "external_ref_key",
            on: ["externalRef"],
            where: { op: "notNull", field: "externalRef" },
            refusal: "transaction-already-recorded",
        },
        {
            kind: "check",
            name: "amount_chk",
            expr: { op: "gte", field: "amountVnd", value: 0 },
            refusal: "transaction-amount-negative",
        },
    ],
    matchKeys: [{ name: "external_ref", on: ["externalRef"] }],
})
