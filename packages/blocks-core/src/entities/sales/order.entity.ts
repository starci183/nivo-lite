import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"
import { z } from "zod"
import type { ZodType } from "zod"

import { MAX_BODY, MAX_LINE } from "../../bounds"

/** The most lines one order holds. */
const MAX_ORDER_LINES = 200

/** What an order is for: its lines. */
type OrderItems = {
    readonly lines: ReadonlyArray<{ readonly name: string; readonly quantity: number; readonly unitPriceVnd: number }>
}

const orderItemsShape: ZodType<OrderItems> = z.object({
    lines: z
        .array(
            z.object({
                name: z.string().max(MAX_LINE),
                quantity: z.number().int().min(0).max(1_000_000),
                unitPriceVnd: z.number().int().min(0).max(1_000_000_000_000),
            }),
        )
        .max(MAX_ORDER_LINES),
})

/** The statuses an order goes through. */
export const ORDER_STATUSES: readonly [string, ...Array<string>] = [
    "draft",
    "confirmed",
    "invoiced",
    "paid",
    "cancelled",
]

type OrderFields = {
    readonly orderNo: FieldDef<"sequence", false>
    readonly items: FieldDef<"jsonb", false> & { readonly shape: ZodType<OrderItems> }
    readonly note: FieldDef<"text", false>
    readonly amountVnd: FieldDef<"money_vnd", true>
    readonly status: FieldDef<"enum", false>
    readonly confirmedBy: FieldDef<"text", true>
    readonly confirmedAt: FieldDef<"timestamptz", true>
}

const orderFields: OrderFields = {
    orderNo: field.sequence({ format: "DH-{yyyy}{mm}{dd}-{n:4}", resets: "day" }),
    items: field.jsonb({ nullable: false, shape: orderItemsShape }),
    note: field.text({ nullable: false, maxLength: MAX_BODY, default: "empty" }),
    amountVnd: field.moneyVnd({ nullable: true }),
    status: field.enum({ nullable: false, of: ORDER_STATUSES, default: { literal: "draft" } }),
    confirmedBy: field.text({ maxLength: MAX_LINE, nullable: true }),
    confirmedAt: field.timestamptz({ nullable: true }),
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
