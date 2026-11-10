import type { NodeContext } from "@nivo-lite/agent-sdk/node"
import type { DataRight } from "@nivo-lite/agent-sdk/rights"
import { atOf } from "../payment/payment.schemas"
import { orderAddressOf } from "./order-card.policy"
import { CARE_LIST_LIMIT, careFactsOf } from "./care.policy"
import type { CareFacts } from "./care.policy"

/** The order as care reads it. */
export interface CareOrder {
    /** The order. */
    readonly id: string
    /** The order number people read. */
    readonly orderNo: string
    /** What the order comes to in VND, or null while a price is missing. */
    readonly amountVnd: number | null
    /** Where the order stands (`confirmed`, `paid`, `cancelled`...). */
    readonly status: string
    /** The lines of the order as the record keeps them. */
    readonly items: unknown
    /** The customer, or null. */
    readonly leadId: string | null
    /** When the order shipped, or null while it has not. */
    readonly shippedAt: string | null
    /** When the order was confirmed, or null. */
    readonly confirmedAt: string | null
}

/** The customer as care reads it. */
export interface CareLead {
    /** The customer. */
    readonly id: string
    /** The name the customer gave. */
    readonly contactName: string
}

/** The data kind of a customer's lead memory: the facts the consult learned live there, never on the record. */
const MEMORY_KIND = "agent-lead-memory"

/** The key of a customer's facts entry in lead memory (`<subject>|<namespace>|<node>`, as the memory writes it). */
export const careFactsKeyOf = (leadId: string): string => `lead:${leadId}|$lead|$facts`

/** The rights care reads with: the order, and the customer, workspace wide (a timer wake serves no turn). */
export const CARE_RIGHTS: ReadonlyArray<DataRight> = [
    {
        kind: "order",
        access: "read",
        scope: "workspace",
        fields: ["id", "orderNo", "amountVnd", "status", "items", "leadId", "shippedAt", "confirmedAt"],
    },
    { kind: "sales-lead", access: "read", scope: "workspace", fields: ["id", "contactName"] },
    { kind: MEMORY_KIND, access: "read", scope: "workspace", fields: ["id", "entryKey", "output"] },
]

const ORDER_FIELDS = ["id", "orderNo", "amountVnd", "status", "items", "leadId", "shippedAt", "confirmedAt"] as const

/** The fields of an order that say how THIS delivery goes, as the customer settled it in the consult. */
const DELIVERY_FIELDS = ["id", "recipientName", "recipientPhone", "deliveryAddress", "deliveryAt", "note"] as const

/**
 * The rights of the care that speaks about the delivery of a paid order (the thank-you, the care plan): the care rights, and the delivery
 * fields of the order.
 */
export const DELIVERY_CARE_RIGHTS: ReadonlyArray<DataRight> = [
    ...CARE_RIGHTS,
    { kind: "order", access: "read", scope: "workspace", fields: [...DELIVERY_FIELDS] },
]

/** How the delivery of one order goes, read from the order: the truth for this delivery, over anything lead memory remembers. */
export interface CareDelivery {
    /** Where it is delivered; null when the order holds none. */
    readonly address: string | null
    /** Who receives it, when the customer named someone; null otherwise. */
    readonly recipientName: string | null
    /** The phone of the person who receives it, or null. */
    readonly recipientPhone: string | null
    /** The day and time window in the customer's words, or null. */
    readonly deliveryAt: string | null
}

const textOrNullOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null)

/** The delivery of the order as its record holds it; every member null when the order cannot be read. */
export const careDeliveryOf = async (context: Reader, orderId: string): Promise<CareDelivery> => {
    const [row] = await context.data.read<Readonly<Record<string, unknown>>>("order", {
        where: { id: orderId },
        fields: [...DELIVERY_FIELDS],
        limit: 1,
    })
    const address = row === undefined ? "" : orderAddressOf(row)
    return {
        address: address === "" ? null : address,
        recipientName: textOrNullOf(row?.recipientName),
        recipientPhone: textOrNullOf(row?.recipientPhone),
        deliveryAt: textOrNullOf(row?.deliveryAt),
    }
}
const LEAD_FIELDS = ["id", "contactName"] as const

type Reader = Pick<NodeContext, "data">

/** The order, or undefined when it cannot be read. */
export const careOrderOf = async (context: Reader, orderId: string): Promise<CareOrder | undefined> =>
    (
        await context.data.read<CareOrder>("order", {
            where: { id: orderId },
            fields: [...ORDER_FIELDS],
            limit: 1,
        })
    )[0]

/** When the order shipped, or null while it has not. */
export const shippedAtOf = (order: CareOrder): Date | null =>
    typeof order.shippedAt === "string" && !Number.isNaN(Date.parse(order.shippedAt)) ? new Date(order.shippedAt) : null

/** The customer, or undefined when there is none. */
export const careLeadOf = async (context: Reader, leadId: string | null): Promise<CareLead | undefined> =>
    leadId === null
        ? undefined
        : (
              await context.data.read<CareLead>("sales-lead", {
                  where: { id: leadId },
                  fields: [...LEAD_FIELDS],
                  limit: 1,
              })
          )[0]

/** A customer's facts entry of lead memory as an example store holds it: what the consult learned, under `output.value`. */
export const careMemoryRowOf = (
    leadId: string,
    facts: Readonly<Record<string, unknown>>,
): { readonly id: string; readonly entryKey: string; readonly output: { readonly value: Readonly<Record<string, unknown>> } } => ({
    id: `memory-${leadId}`,
    entryKey: careFactsKeyOf(leadId),
    output: { value: facts },
})

/** A member of a record, or undefined. */
const memberOf = (value: unknown, name: string): unknown =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? Reflect.get(value, name) : undefined

/**
 * What care knows about the customer: the facts the consult learned, read from the customer's lead memory (its facts entry, by key);
 * nothing known for no customer or one with no memory. Lead memory names the receiver `recipientName`.
 */
export const careFactsOfLead = async (context: Reader, leadId: string | null | undefined): Promise<CareFacts> => {
    if (leadId === null || leadId === undefined) return careFactsOf(undefined)
    const [entry] = await context.data.read<Readonly<Record<string, unknown>>>(MEMORY_KIND, {
        where: { entryKey: careFactsKeyOf(leadId) },
        fields: ["output"],
        limit: 1,
    })
    const value: unknown = memberOf(entry?.output, "value")
    if (typeof value !== "object" || value === null) return careFactsOf(undefined)
    return careFactsOf({ ...value, recipient: memberOf(value, "recipientName") })
}

/**
 * The customer's paid orders, the newest first: read among the customer's latest orders (the index of an order is its customer and its
 * time, so a read pinned on the status too is one no index serves), the paid ones kept.
 */
export const carePaidOrdersOf = async (context: Reader, leadId: string): Promise<ReadonlyArray<CareOrder>> => {
    const rows = await context.data.read<CareOrder>("order", {
        where: { leadId },
        fields: [...ORDER_FIELDS],
        limit: CARE_LIST_LIMIT,
    })
    return rows.filter((row) => row.status === "paid").toSorted(
        (left, right) => (typeof right.confirmedAt === "string" ? atOf(right.confirmedAt) : 0) - (typeof left.confirmedAt === "string" ? atOf(left.confirmedAt) : 0),
    )
}
