import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import { z, type ZodType } from "zod"
import { MAX_BODY, MAX_LINE } from "../../bounds"

/** The most lines one order holds. */
const MAX_ORDER_LINES = 100

/** The largest quantity or amount a line holds. */
const MAX_LINE_NUMBER = 1_000_000_000_000

/** One line of an order: what was ordered, how many, at what price and what it comes to. */
export type OrderItemLine = {
    /** What was ordered. */
    readonly name: string
    /** How many. */
    readonly qty: number
    /** The price of one, VND. */
    readonly unitVnd: number
    /** What the line comes to, VND. */
    readonly amountVnd: number
}

/** The lines of an order, as a record keeps them (the text the lists show is a projection of these, kept in `itemsText`). */
export type OrderItems = {
    /** The lines, in the order the customer named them. */
    readonly lines: ReadonlyArray<OrderItemLine>
}

/** The shape of the lines of an order, which the sales reads parse a record's `items` with. */
export const ORDER_ITEMS_SHAPE: ZodType<OrderItems> = z.object({
    lines: z
        .array(
            z.object({
                name: z.string().min(1).max(MAX_LINE),
                qty: z.number().positive().max(MAX_LINE_NUMBER),
                unitVnd: z.number().int().min(0).max(MAX_LINE_NUMBER),
                amountVnd: z.number().int().min(0).max(MAX_LINE_NUMBER),
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
    "failed_system",
]

type OrderFields = {
    readonly orderNo: FieldDef<"sequence", false>
    readonly leadId: FieldDef<"uuid", true>
    readonly items: FieldDef<"jsonb", false> & { readonly shape: ZodType<OrderItems> }
    readonly itemsText: FieldDef<"text", false>
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
    items: field.jsonb({ shape: ORDER_ITEMS_SHAPE }),
    itemsText: field.text({ maxLength: MAX_BODY, searchable: true, default: "empty" }),
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
        { name: "key", on: ["id"] },
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
