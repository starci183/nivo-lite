import { ENTITIES_PORT, type EntitiesApi, type ListedRecord } from "@nivo-lite/agent-sdk/entity/port"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    PLUGIN_TOOLS,
    type PluginToolAudience,
    type PluginToolCall,
    type PluginToolJson,
    type PluginToolResult,
    type PluginTools,
} from "@nivo-lite/agent-sdk/plugin-tools"
import { q, type FilterExpr, type Query } from "@nivo-lite/agent-sdk/query"
import { defineService, type ServiceDefinition } from "@nivo-lite/agent-sdk/service"
import { claimEntity } from "../../../entities/sales/claim.entity"
import { orderEntity } from "../../../entities/sales/order.entity"
import { SALES_CLAIM_ENTITY, SALES_ORDER_ENTITY } from "../../../entities/sales/sales-entity-names"
import { orderAddressOf } from "../../../nodes/sales/order-card.policy"
import { AWAITING_PAYMENT_STATUSES } from "../../../rules/sales/order-status"
import { SALES_MODULE_KEY } from "../declaration"
import { leadCareOf } from "./lead-care.policy"
import {
    LEAD_CARE_GET_SCHEMA,
    LEAD_ORDER_LIST_SCHEMA,
    ORDER_GET_SCHEMA,
    ORDER_OPEN_LIST_SCHEMA,
    PAYMENT_CLAIM_LIST_SCHEMA,
} from "./sales-tools.schema"
import { CLAIMS, OPEN_ORDERS, ORDER_ROWS } from "./sales-tools.limits"

/** The entity of an order, and of what a customer said they paid. */
const ORDER: string = SALES_ORDER_ENTITY
const CLAIM: string = SALES_CLAIM_ENTITY

/** The field of an order that names the person who bought: proved against the order's own declaration. */
const ORDER_CONTACT_FIELD = "contactId" satisfies keyof (typeof orderEntity)["fields"]

/** The field of a claim that names the person who paid: proved against the claim's own declaration. */
const CLAIM_CONTACT_FIELD = "contactId" satisfies keyof (typeof claimEntity)["fields"]

/** The claims that still wait for a settlement (as the payment effects read them). */
const CLAIM_WAITING: ReadonlyArray<string> = ["open", "escalated"]

/** The fields of an order every audience reads in `order.open.list`. */
const ORDER_FIELDS = [
    "orderNo",
    "status",
    "amountVnd",
    ORDER_CONTACT_FIELD,
    "items",
    "note",
    "recipientName",
    "recipientPhone",
    "deliveryAddress",
    "deliveryAt",
    "confirmedAt",
    "shippedAt",
] as const

/** The fields of an order every audience reads in `lead.order.list`: what it is, where it stands and how its delivery goes. */
const ORDER_PUBLIC_FIELDS = [
    "orderNo",
    "status",
    "amountVnd",
    "itemsText",
    "recipientName",
    "recipientPhone",
    "deliveryAddress",
    "deliveryAt",
    "confirmedAt",
    "shippedAt",
    "carrier",
    "trackingCode",
] as const

/** The fields of an order only the shop's own agents read. */
const ORDER_INTERNAL_FIELDS = ["note", "confirmedBy"] as const

/** The source name a `lead.order.list` answer carries. */
const LEAD_SOURCE = "nivo.lead"

/** The fields of an order a `lead.order.list` read selects for an audience. */
export const orderFieldsOf = (audience: PluginToolAudience): ReadonlyArray<string> =>
    audience === "customer" ? [...ORDER_PUBLIC_FIELDS] : [...ORDER_PUBLIC_FIELDS, ...ORDER_INTERNAL_FIELDS]

/** The default and the most of a list's page size. */
interface LimitBounds {
    /** The count used when none is wanted. */
    readonly fallback: number
    /** The most a caller may ask. */
    readonly max: number
}

/** A wanted count bounded by a list's default and its most. */
export const boundedLimitOf = (wanted: number | undefined, bounds: LimitBounds): number =>
    Math.max(1, Math.min(bounds.max, wanted ?? bounds.fallback))

/** The latest orders of one person (the contact), newest first: served by the index `contact_recent` (contact, created, id). */
export const ordersQueryOf = (contactId: string, fields: ReadonlyArray<string>, limit: number): Query => ({
    from: ORDER,
    select: [...fields],
    where: { op: "eq", field: ORDER_CONTACT_FIELD, value: contactId },
    order: [
        ["createdAt", "desc"],
        ["id", "desc"],
    ],
    page: { size: limit },
})

/** The newest first order of a list read. */
const NEWEST_FIRST: Query["order"] = [
    ["createdAt", "desc"],
    ["id", "desc"],
]

/** A text member, or null. */
const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** A whole number member, or null. */
const numberOf = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null)

/** A time member as ISO text, or null. */
const timeOf = (value: unknown): string | null => (value instanceof Date ? value.toISOString() : textOf(value))

/** The lines of an order as the record keeps them (`items.lines`): name, quantity and money; a line that is not one is left out. */
const linesOf = (items: unknown): ReadonlyArray<PluginToolJson> => {
    const lines: unknown = typeof items === "object" && items !== null ? Reflect.get(items, "lines") : undefined
    if (!Array.isArray(lines)) return []
    return lines.flatMap((line: unknown) => {
        if (typeof line !== "object" || line === null) return []
        const name = textOf(Reflect.get(line, "name"))
        const qty = numberOf(Reflect.get(line, "qty"))
        if (name === null || qty === null) return []
        return [{ name, qty, unitVnd: numberOf(Reflect.get(line, "unitVnd")), amountVnd: numberOf(Reflect.get(line, "amountVnd")) }]
    })
}

/** The names a claim carries (`names.values`). */
const namesOf = (names: unknown): ReadonlyArray<string> => {
    const values: unknown = typeof names === "object" && names !== null ? Reflect.get(names, "values") : undefined
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : []
}

/** What a tool answered. */
const answered = (value: PluginToolJson): PluginToolResult => ({ ok: true, value })

/** The one-page query of the orders a filter selects, newest first. */
const ordersOf = (where: FilterExpr, limit: number): Query => ({
    from: ORDER,
    select: [...ORDER_FIELDS],
    where,
    order: NEWEST_FIRST,
    page: { size: limit },
})

/** The one-page query of the payment claims a filter selects, newest first, each with the order it names. */
const claimsOf = (where: FilterExpr, limit: number): Query => ({
    from: CLAIM,
    select: [CLAIM_CONTACT_FIELD, "conversationId", "amountVnd", "names", "body", "status", "claimedAt"],
    join: { order: [] },
    where,
    order: [
        ["claimedAt", "desc"],
        ["id", "desc"],
    ],
    page: { size: limit },
})

/** The care facts of the run's own customer, from their lead memory; refused for a run with no customer or an app with no memory. */
const care = async (input: PluginToolJson, call: PluginToolCall): Promise<PluginToolResult> => {
    LEAD_CARE_GET_SCHEMA.parse(input)
    const { leadId } = call
    if (leadId === null) return { ok: false, reason: "other_lead" }
    if (call.leadMemory === null) return { ok: false, reason: "not_served" }
    const found = leadCareOf(leadId, await call.leadMemory())
    return answered({ ...found, occasions: found.occasions.map((occasion) => ({ ...occasion })) })
}

/**
 * The sales reads, answered from the records with the same reach the nodes had through their data port, bounded. A read about a
 * customer follows the subject the engine fixed (the run's own customer): an order or a claim of another customer is refused
 * (`other_contact`) or answered without its customer (only the run's own customer, or the one of the order a credit's content names,
 * is ever addressable); a customer-facing run with no customer reads no order, claim or care fact.
 */
const salesToolsOf = (entities: EntitiesApi, context: RunContext): PluginTools => {
    /** The listed records (row and joins) of several one-page queries. */
    const listedOf = async (queries: ReadonlyArray<Query>): Promise<ReadonlyArray<ListedRecord>> => {
        const pages = await Promise.all(queries.map((query) => entities.list(query)))
        return pages.flatMap((page) => page.rows)
    }

    /** One order: refused when it is not there, or is another customer's than the run's own (or the run faces a customer it has none of). */
    const order = async (input: PluginToolJson, call: PluginToolCall): Promise<PluginToolResult> => {
        const { orderId } = ORDER_GET_SCHEMA.parse(input)
        const row = await entities.get(ORDER, orderId)
        if (row === null) return { ok: false, reason: "not_found" }
        const contactId = textOf(row.data[ORDER_CONTACT_FIELD])
        const own = call.contactId !== null && contactId === call.contactId
        if (call.contactId !== null && !own) return { ok: false, reason: "other_contact" }
        if (call.audience === "customer" && !own) return { ok: false, reason: "other_contact" }
        const address = orderAddressOf(row.data)
        return answered({
            order: {
                id: row.id,
                orderNo: textOf(row.data.orderNo),
                status: textOf(row.data.status),
                amountVnd: numberOf(row.data.amountVnd),
                contactId,
                leadId: own ? call.leadId : null,
                items: linesOf(row.data.items),
                confirmedAt: timeOf(row.data.confirmedAt),
                shippedAt: timeOf(row.data.shippedAt),
                delivery: {
                    address: address === "" ? null : address,
                    recipientName: textOf(row.data.recipientName),
                    recipientPhone: textOf(row.data.recipientPhone),
                    deliveryAt: textOf(row.data.deliveryAt),
                },
                createdAt: row.createdAt,
            },
        })
    }

    /**
     * The orders that wait for money, newest first: the run's own customer's when it faces a customer (none without one), else the
     * shop's (each awaiting status read on its own index, merged). An order names its customer only when it is the run's own.
     */
    const openOrders = async (input: PluginToolJson, call: PluginToolCall): Promise<PluginToolResult> => {
        const limit = boundedLimitOf(ORDER_OPEN_LIST_SCHEMA.parse(input).limit, OPEN_ORDERS)
        if (call.audience === "customer" && call.contactId === null) return answered({ orders: [] })
        const queries: ReadonlyArray<Query> =
            call.audience === "customer" && call.contactId !== null
                ? [ordersOf(q.and(q.eq(ORDER_CONTACT_FIELD, call.contactId), q.in("status", [...AWAITING_PAYMENT_STATUSES])), limit)]
                : AWAITING_PAYMENT_STATUSES.map((status) => ordersOf(q.eq("status", status), limit))
        const rows = (await listedOf(queries))
            .map((listed) => listed.row)
            .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
            .slice(0, limit)
        return answered({
            orders: rows.map((row) => {
                const contactId = textOf(row.data[ORDER_CONTACT_FIELD])
                const own = call.contactId !== null && contactId === call.contactId
                return {
                    orderId: row.id,
                    orderNo: textOf(row.data.orderNo),
                    amountVnd: numberOf(row.data.amountVnd),
                    status: textOf(row.data.status),
                    confirmedAt: timeOf(row.data.confirmedAt),
                    contactId: own ? contactId : null,
                    leadId: own ? call.leadId : null,
                }
            }),
        })
    }

    /**
     * The claims that still wait for money, newest first: the run's own customer's when it serves one; else, for an internal run only,
     * the shop's open claims without their customer or conversation (a claim never makes a customer addressable).
     */
    const claims = async (input: PluginToolJson, call: PluginToolCall): Promise<PluginToolResult> => {
        const limit = boundedLimitOf(PAYMENT_CLAIM_LIST_SCHEMA.parse(input).limit, CLAIMS)
        const { contactId } = call
        if (contactId === null && call.audience === "customer") return answered({ claims: [] })
        const queries: ReadonlyArray<Query> =
            contactId === null
                ? CLAIM_WAITING.map((status) => claimsOf(q.eq("status", status), limit))
                : [claimsOf(q.eq(CLAIM_CONTACT_FIELD, contactId), limit * 2)]
        const rows = (await listedOf(queries))
            .filter((listed) => CLAIM_WAITING.includes(String(listed.row.data.status)))
            .toSorted((left, right) => String(right.row.data.claimedAt).localeCompare(String(left.row.data.claimedAt)))
            .slice(0, limit)
        return answered({
            claims: rows.map(({ row, joined }) => ({
                claimId: row.id,
                amountVnd: numberOf(row.data.amountVnd),
                names: namesOf(row.data.names),
                words: textOf(row.data.body),
                claimedAt: timeOf(row.data.claimedAt),
                status: textOf(row.data.status),
                orderId: joined["order"]?.id ?? null,
                contactId: contactId === null ? null : textOf(row.data[CLAIM_CONTACT_FIELD]),
                leadId: contactId === null ? null : call.leadId,
                conversationId: contactId === null ? null : textOf(row.data.conversationId),
            })),
        })
    }

    /** The latest orders of the call's person, newest first, with the fields of the audience; none for a run with no person. */
    const leadOrders = async (input: PluginToolJson, call: PluginToolCall): Promise<PluginToolResult> => {
        const limit = boundedLimitOf(LEAD_ORDER_LIST_SCHEMA.parse(input).limit, ORDER_ROWS)
        const { contactId } = call
        const fields = contactId === null ? [] : orderFieldsOf(call.audience)
        const rows =
            contactId === null ? [] : (await entities.list(ordersQueryOf(contactId, fields, limit))).rows.map((listed) => listed.row)
        return answered({
            notice: call.readNotice,
            source: LEAD_SOURCE,
            asOf: context.now.toISOString(),
            facts: rows.map((row) =>
                Object.fromEntries([
                    ["id", row.id],
                    ...fields.map((name): [string, unknown] => [name, row.data[name] ?? null]),
                    ["createdAt", row.createdAt],
                ]),
            ),
        })
    }

    return {
        call: async (id, input, call) => {
            if (id === TOOL.orderGet) return order(input, call)
            if (id === TOOL.orderOpenList) return openOrders(input, call)
            if (id === TOOL.paymentClaimList) return claims(input, call)
            if (id === TOOL.leadCareGet) return care(input, call)
            if (id === TOOL.leadOrderList) return leadOrders(input, call)
            throw new Error(`the sales module serves no tool ${id}`)
        },
    }
}

/**
 * The sales tools the engine runs for the sales module: the engine reads the order and claim records, the care facts and the latest
 * orders of a customer through this service and knows no entity, status or field of them (contract `PLUGIN_TOOLS`).
 */
export const SALES_TOOLS_SERVICE: ServiceDefinition<PluginTools, { readonly entities: typeof ENTITIES_PORT }> = defineService({
    id: "blocks-core.sales.plugin-tools",
    moduleKey: SALES_MODULE_KEY,
    contract: PLUGIN_TOOLS,
    ports: { entities: ENTITIES_PORT },
    build: ({ entities }, context) => salesToolsOf(entities, context),
})
