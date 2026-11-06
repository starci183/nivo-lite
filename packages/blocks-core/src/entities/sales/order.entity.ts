import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import { MAX_BODY, MAX_LINE } from "../../bounds"

/** The statuses an order goes through. */
export const ORDER_STATUSES: readonly [string, ...Array<string>] = [
    "draft",
    "confirmed",
    "invoiced",
    "paid",
    "cancelled",
    "failed_system",
]

type OrderFields = {
    readonly orderNo: FieldDef<"sequence", false>
    readonly leadId: FieldDef<"uuid", true>
    readonly items: FieldDef<"text", false>
    readonly note: FieldDef<"text", false>
    readonly amountVnd: FieldDef<"money_vnd", true>
    readonly status: FieldDef<"enum", false>
    readonly confirmedBy: FieldDef<"text", true>
    readonly confirmedAt: FieldDef<"timestamptz", true>
    readonly shippedAt: FieldDef<"timestamptz", true>
    readonly carrier: FieldDef<"text", true>
    readonly trackingCode: FieldDef<"text", true>
}

const orderFields: OrderFields = {
    orderNo: field.sequence({ format: "DH-{yyyy}{mm}{dd}-{n:4}", resets: "day" }),
    leadId: field.uuid({ nullable: true }),
    items: field.text({ maxLength: MAX_BODY, searchable: true, default: "empty" }),
    note: field.text({ maxLength: MAX_BODY, searchable: true, default: "empty" }),
    amountVnd: field.moneyVnd({ nullable: true }),
    status: field.enum({ of: ORDER_STATUSES, default: { literal: "draft" } }),
    confirmedBy: field.text({ maxLength: MAX_LINE, nullable: true }),
    confirmedAt: field.timestamptz({ nullable: true }),
    shippedAt: field.timestamptz({ nullable: true }),
    carrier: field.text({ maxLength: MAX_LINE, nullable: true }),
    trackingCode: field.text({ maxLength: MAX_LINE, nullable: true }),
}

/** One sales order of a workspace. Graph node kind `order`. */
export const orderEntity: EntityDefinition<OrderFields> = defineEntity({
    name: "sales.order",
    dataKind: "order",
    fields: orderFields,
    relations: { lead: { kind: "toOne", target: "sales.lead" } },
    indexes: [
        { name: "recent", on: [{ desc: "createdAt" }, { desc: "id" }] },
        { name: "status_recent", on: ["status", { desc: "createdAt" }, { desc: "id" }] },
        { name: "lead_recent", on: ["leadId", { desc: "createdAt" }, { desc: "id" }] },
        { name: "amount", on: [{ desc: "amountVnd" }, { desc: "id" }] },
        { name: "status_amount", on: ["status", { desc: "amountVnd" }, { desc: "id" }] },
    ],
    constraints: [
        { kind: "unique", name: "order_no_key", on: ["orderNo"], refusal: "order-no-taken" },
        {
            kind: "check",
            name: "amount_chk",
            expr: {
                op: "or",
                of: [
                    { op: "isNull", field: "amountVnd" },
                    { op: "gte", field: "amountVnd", value: 0 },
                ],
            },
            refusal: "order-amount-negative",
        },
    ],
})
