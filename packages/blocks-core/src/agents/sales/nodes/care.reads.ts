import { TOOL, type ToolId } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ENTRIES, MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { itemsTextOf } from "./order-lines.policy"
import { paymentStateOf } from "./care.policy"
import { contextFactsOf, valueOrCannot } from "../../../shared/nodes/tool-answers"
import { readOrder } from "./sales-order"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { SALES_LEAD_ENTITY } from "../../../shared/entities/sales-entity-names"

/**
 * The reads care makes through tools (contract C0: `nivo.tool.order.get`, `nivo.tool.lead.care.get`,
 * `nivo.tool.contact.get`, `nivo.tool.lead.order.list`). Their answers are not specified yet: each
 * schema below is the SMALLEST shape the care nodes read, listed in `ASSUMPTIONS-C.md`. A refusal is a fact the node reads; an answer
 * that does not have the shape is an integrity failure (`cannot`), never guessed around.
 */

const id = z.string().min(1).max(MAX_ID)
const text = z.string().max(MAX_LINE)

/** One line of an order as the read answers it. */
export type CareOrderLine = {
    /** What was bought. */
    readonly name: string
    /** How many. */
    readonly qty: number
}

const lineSchema: NodeSchema<CareOrderLine> = z.object({ name: text, qty: z.number().int().positive() })

/** The order a care step is about. */
export type CareOrder = {
    /** The id of the order. */
    readonly id: string
    /** The order number the customer and the team read. */
    readonly orderNo: string
    /** Where the order stands (for example paid, shipped, delivered). */
    readonly status: string
    /** The lead the order belongs to; null when it is not tied to one. */
    readonly leadId: string | null
    /** The lines of the order. */
    readonly items: ReadonlyArray<CareOrderLine>
    /** When the order was shipped (ISO time); null while it has not been. */
    readonly shippedAt: string | null
    /** When the customer confirmed receipt (ISO time); null while unconfirmed. */
    readonly confirmedAt: string | null
    /** The delivery facts of the order: who receives it and where. */
    readonly delivery: CareDelivery
}

/** Who receives an order and where. */
type CareDelivery = {
    /** The delivery address; null when none was given. */
    readonly address: string | null
    /** The name of the person who receives it; null when none was given. */
    readonly recipientName: string | null
    /** The phone of the person who receives it; null when none was given. */
    readonly recipientPhone: string | null
    /** When it is to be delivered (ISO time); null when no time was given. */
    readonly deliveryAt: string | null
}

/** What `nivo.tool.order.get { orderId }` answers: the order. */
export type CareOrderAnswer = {
    /** The order that was read. */
    readonly order: CareOrder
}

/** The order a care step is about (`nivo.tool.order.get { orderId }` -> `{ order }`). */
export const orderAnswerSchema: NodeSchema<CareOrderAnswer> = z.object({
    order: z.object({
        id,
        orderNo: text,
        status: text,
        leadId: id.nullable(),
        items: z.array(lineSchema).max(MAX_ENTRIES),
        shippedAt: z.string().max(40).nullable(),
        confirmedAt: z.string().max(40).nullable(),
        delivery: z.object({
            address: text.nullable(),
            recipientName: text.nullable(),
            recipientPhone: text.nullable(),
            deliveryAt: text.nullable(),
        }),
    }),
})

/** What care knows of the customer: the opt-out, the receiver they named, their dates. */
export type CareFacts = {
    /** The lead whose care facts these are. */
    readonly leadId: string
    /** True when the customer asked not to be contacted for care messages. */
    readonly optedOut: boolean
    /** Who receives what the customer buys (a name); null when not known. */
    readonly recipient: string | null
    /** The dates the customer wants to be reminded of. */
    readonly occasions: ReadonlyArray<{
        readonly occasionId: string
        readonly label: string
        readonly month: number
        readonly day: number
        readonly year: number | null
    }>
}

/** What care knows of the customer (`nivo.tool.lead.care.get { leadId }`): the opt-out, the receiver they named, their dates. */
export const careAnswerSchema: NodeSchema<CareFacts> = z.object({
    leadId: id,
    optedOut: z.boolean(),
    recipient: text.nullable(),
    occasions: z.array(
        z.object({
            occasionId: id,
            label: text,
            month: z.number().int().min(1).max(12),
            day: z.number().int().min(1).max(31),
            year: z.number().int().nullable(),
        }),
    ).max(MAX_ENTRIES),
})

/** One fact of the profile read: the customer's id and the name they gave, when they gave one. */
export type ProfileFact = {
    /** The id of the profile fact. */
    readonly id: string
    /** The customer name the profile gives; null or absent when unknown. */
    readonly name?: string | null | undefined
}

/**
 * The customer as care names them: `nivo.tool.contact.get {}` (a context read locked to the run's contact) answers
 * `{ notice, source, asOf, facts: [{ id, name, ... }] }`; care reads the first fact's `name`.
 */
export const profileFactSchema: NodeSchema<ProfileFact> = z.object({ id, name: text.nullable().optional() })

/** How many of the customer's latest orders the occasion step looks among for the last paid one. */
export const RECENT_ORDERS_MAX = 20

/** One of the customer's latest orders, as the occasion step reads it. */
export type LeadOrderFact = {
    /** The id of the order. */
    readonly id: string
    /** The order number the customer and the team read. */
    readonly orderNo: string
    /** Where the order stands. */
    readonly status: string
    /** The lines of the order. */
    readonly items: ReadonlyArray<CareOrderLine>
}

/**
 * One of the customer's latest orders: `nivo.tool.lead.order.list { limit }` (a context read locked to the run's customer) answers
 * `{ notice, source, asOf, facts: [{ id, orderNo, status, items, ... }] }`, newest first.
 */
export const leadOrderFactSchema: NodeSchema<LeadOrderFact> = z.object({
    id,
    orderNo: text,
    status: text,
    items: z.array(lineSchema).max(MAX_ENTRIES),
})

/** A read that went through, or the refusal the tool answered. */
export type Read<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly refusal: string }

/** Calls a read tool and checks its answer has the shape the node reads; a business refusal comes back as a fact. */
export const readOf = async <S extends z.ZodType>(
    context: Pick<NodeContext, "tools" | "fail">,
    tool: ToolId,
    args: JsonObject,
    answer: S,
): Promise<Read<z.output<S>>> => {
    const answered = await context.tools.call(tool, args)
    if (!answered.ok) return { ok: false, refusal: answered.refusal }
    const parsed = answer.safeParse(answered.value)
    if (!parsed.success) return context.fail({ kind: "cannot", why: `${tool} answered a shape care cannot read` })
    return { ok: true, value: parsed.data }
}

/** The order, or null when the read refused it (gone, not this workspace's). */
export const careOrderOf = async (
    context: Pick<NodeContext, "tools" | "fail">,
    orderId: string,
): Promise<CareOrder | null> => {
    const read = await readOf(context, TOOL.orderGet, { orderId }, orderAnswerSchema)
    return read.ok ? read.value.order : null
}

/** What care knows of the customer; a refused read (no such customer) leaves the step nothing to do, as an opt-out does. */
export const careFactsOf = async (
    context: Pick<NodeContext, "tools" | "fail">,
    leadId: string,
): Promise<CareFacts | null> => {
    const read = await readOf(context, TOOL.leadCareGet, { leadId }, careAnswerSchema)
    return read.ok ? read.value : null
}

/** The facts of a context read that have the shape the node reads; a fact of another shape is not this node's. */
export const contextFactsShaped = <S extends z.ZodType>(value: unknown, fact: S): ReadonlyArray<z.output<S>> =>
    contextFactsOf(value).flatMap((entry) => {
        const parsed = fact.safeParse(entry)
        return parsed.success ? [parsed.data] : []
    })

/** The name the customer gave, or null (the run's customer: the read takes no id). */
export const customerNameOf = async (context: Pick<NodeContext, "tools">): Promise<string | null> => {
    const answered = await context.tools.call(TOOL.contactGet, {})
    if (!answered.ok) return null
    return contextFactsShaped(answered.value, profileFactSchema)[0]?.name ?? null
}

/** The customer's last paid order among their latest, or null when none of them is paid (an exact status reading). */
export const lastPaidOrderOf = async (context: Pick<NodeContext, "tools">): Promise<LeadOrderFact | null> => {
    const answered = await context.tools.call(TOOL.leadOrderList, { limit: RECENT_ORDERS_MAX })
    if (!answered.ok) return null
    return (
        contextFactsShaped(answered.value, leadOrderFactSchema).find(
            (order) => paymentStateOf(order.status) === "paid",
        ) ?? null
    )
}

/** The items of an order as one line the agent reads (`2 x tea boxes, 1 x card`). */
export const itemsLineOf = (items: CareOrder["items"]): string => itemsTextOf(items)

/** One page of the sale records of a contact (`nivo.tool.record.list` on `blocks-core.sales.lead`). */
const saleLeadPageShape = z.object({ records: z.array(z.object({ id })).max(1) })

/**
 * The sale's own record of the person (`blocks-core.sales.lead` keyed by `contactId`), or null when the sale keeps none for them yet: the
 * record the consult stage and the occasions are kept on. A refused or unreadable list stops the node (`cannot`).
 */
export const saleLeadOf = async (context: Pick<NodeContext, "tools" | "fail">, contactId: string): Promise<string | null> => {
    const page = saleLeadPageShape.safeParse(
        valueOrCannot(context, TOOL.recordList, await context.tools.call(TOOL.recordList, saleLeadListOf(contactId))),
    )
    if (!page.success) return context.fail({ kind: "cannot", why: `${TOOL.recordList} answered an unknown shape` })
    return page.data.records[0]?.id ?? null
}

/** The record list of the sale record of one contact (the type's `contact_key` serves it). */
export const saleLeadListOf = (contactId: string): JsonObject => ({
    type: SALES_LEAD_ENTITY,
    where: { op: "eq", field: "contactId", value: contactId },
    limit: 1,
})

/** The person an order is for and whether they asked care to leave them alone. */
export interface OrderPerson {
    /** The order's contact. */
    readonly contactId: string
    /** True when the sale's record of the person says they opted out of care. */
    readonly optedOut: boolean
}

/**
 * The person of an order (its `contactId`, from the sale's own order record) and care's opt-out, kept on the sale's record of the person
 * (`blocks-core.sales.lead` by `contactId`); null when the order has no person, or care cannot be read for them (nothing to do, as an
 * opt-out). A person the sale keeps no record of has not opted out.
 */
export const orderPersonOf = async (context: Pick<NodeContext, "tools" | "fail">, orderId: string): Promise<OrderPerson | null> => {
    const { contactId } = await readOrder(context, orderId)
    if (contactId === null) return null
    const leadId = await saleLeadOf(context, contactId)
    if (leadId === null) return { contactId, optedOut: false }
    const facts = await careFactsOf(context, leadId)
    return facts === null ? null : { contactId, optedOut: facts.optedOut }
}

/** The contact of the sale's record of a person (`nivo.tool.record.get` on `blocks-core.sales.lead`), or null when it names none. */
export const leadContactOf = async (context: Pick<NodeContext, "tools" | "fail">, leadId: string): Promise<string | null> => {
    const answer = leadRecordShape.safeParse(
        valueOrCannot(context, TOOL.recordGet, await context.tools.call(TOOL.recordGet, { type: SALES_LEAD_ENTITY, id: leadId })),
    )
    if (!answer.success) return context.fail({ kind: "cannot", why: `${TOOL.recordGet} answered a customer of an unknown shape` })
    return answer.data.record.values.contactId ?? null
}

const leadRecordShape = z.object({ record: z.object({ values: z.object({ contactId: id.nullish() }) }) })
