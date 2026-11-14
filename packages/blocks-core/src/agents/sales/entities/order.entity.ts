import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"
import { z, type ZodType } from "zod"
import { MAX_BODY, MAX_LINE } from "../../../shared/bounds"
import { ORDER_STATUSES } from "../rules/order-status"
import { SALES_ORDER_ENTITY } from "../../../shared/entities/sales-entity-names"

/** The most lines one order holds. */
const MAX_ORDER_LINES = 100

/** The largest quantity or amount a line holds. */
const MAX_LINE_NUMBER = 1_000_000_000_000

/**
 * Where the price of a line comes from, snapshotted with the line: a truth of the truth graph (`kind: "fact"`, the fact's id) or an item of
 * a CRM the package is bound to (`kind: "crm"`, the CRM's item id). The line keeps the price it was sold at; the source says where it was read.
 */
export type PriceSource = {
    /** Which catalogue the price was read from. */
    readonly kind: "fact" | "crm"
    /** The id of the fact, or of the CRM's item. */
    readonly id: string
}

/** The shape of a price source, as a draft line and an order line keep it. */
export const PRICE_SOURCE_SHAPE: z.ZodObject<
    { kind: z.ZodEnum<{ fact: "fact"; crm: "crm" }>; id: z.ZodString },
    z.core.$strip
> = z.object({
    kind: z.enum(["fact", "crm"]),
    id: z.string().min(1).max(MAX_LINE),
})

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
    /** Where the price of one was read (a truth or a CRM item), when the line was priced from one; absent for a price the agent read in a passage. */
    readonly priceSource?: PriceSource | undefined
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
                priceSource: PRICE_SOURCE_SHAPE.optional(),
            }),
        )
        .max(MAX_ORDER_LINES),
})

type OrderFields = {
    readonly orderNo: FieldDef<"sequence", false>
    readonly contactId: FieldDef<"contact", true>
    readonly items: FieldDef<"jsonb", false> & { readonly shape: ZodType<OrderItems> }
    readonly itemsText: FieldDef<"text", false>
    readonly note: FieldDef<"text", false>
    readonly recipientName: FieldDef<"text", true>
    readonly recipientPhone: FieldDef<"text", true>
    readonly deliveryAddress: FieldDef<"text", true>
    readonly deliveryAt: FieldDef<"text", true>
    readonly qrConnectionId: FieldDef<"uuid", true>
    readonly paidConnectionId: FieldDef<"uuid", true>
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
    /** The person who bought (the core contact). A deleted contact leaves the order in the books with no person (`clear`). */
    contactId: field.contact({ nullable: true, onContactDelete: "clear" }),
    items: field.jsonb({ shape: ORDER_ITEMS_SHAPE }),
    itemsText: field.text({ maxLength: MAX_BODY, searchable: true, default: "empty" }),
    note: field.text({ maxLength: MAX_BODY, searchable: true, default: "empty" }),
    /** The name of the person who receives the delivery, as the customer gave it; null when it is the customer. */
    recipientName: field.text({ maxLength: MAX_LINE, nullable: true }),
    /** Where the order is delivered, in the customer's words. Older orders kept it in `note`. */
    deliveryAddress: field.text({ maxLength: MAX_LINE, nullable: true }),
    /** The phone number of the person who receives the delivery, as the customer gave it. */
    recipientPhone: field.text({ maxLength: MAX_LINE, nullable: true }),
    /** The day and the time window of the delivery, in the customer's words (not an instant: "thu Bay 9-11h"). */
    deliveryAt: field.text({ maxLength: MAX_LINE, nullable: true }),
    /** The account the payment QR was drawn on (the shop's default receiving account at that moment). */
    qrConnectionId: field.uuid({ nullable: true }),
    /** The account the money that paid the order actually came into (the settling transaction's account). */
    paidConnectionId: field.uuid({ nullable: true }),
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
    name: SALES_ORDER_ENTITY,
    dataKind: "order",
    fields: orderFields,
    indexes: [
        { name: "key", on: ["id"] },
        { name: "recent", on: [{ desc: "createdAt" }, { desc: "id" }] },
        { name: "status_recent", on: ["status", { desc: "createdAt" }, { desc: "id" }] },
        { name: "contact_recent", on: ["contactId", { desc: "createdAt" }, { desc: "id" }] },
        { name: "contact_status_recent", on: ["contactId", "status", { desc: "createdAt" }, { desc: "id" }] },
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
