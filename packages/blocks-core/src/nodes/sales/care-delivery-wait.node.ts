import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import type { NodeSchema } from "../node-schema.types"
import { ARMED, CARE_OPEN, EXAMPLE_AT, ORDER_O1, personReadsOf } from "./care.examples"
import { SHIP_NEXT_LOOK_MINUTES, SHIP_WAITS_MAX, afterMinutes, dayAfter, isDue, paymentStateOf } from "./care.policy"
import { careOrderOf, itemsLineOf, orderPersonOf } from "./care.reads"
import { armCare, careTimerArgsOf } from "./care.steps"
import { answered, refused } from "../tool-answers"

/** The routes of the wait: ask now, the timer moved, nothing to ask, or a person declined moving the timer. */
export const DELIVERY_WAIT_ROUTES = ["due", "later", "closed", "declined"] as const

/** What the wait is given: the timer that woke it. */
export interface CareDeliveryWaitInput {
    /** The order that was delivered (`= trigger.ref`). */
    readonly orderId: string
    /** The moment the check-in is really due (`= trigger.dueAt`), or null. */
    readonly dueAt: string | null
    /** How many looks for the shipment this timer is (`= trigger.data.shipWaits`), or null when the delivery day was known. */
    readonly shipWaits: number | null
}

/** What the check-in asks about, handed on when it is due. */
export interface DeliveryDue {
    /** The person to ask (the order's contact). */
    readonly contactId: string
    /** The order number people read. */
    readonly orderNo: string
    /** What they bought, as one line. */
    readonly items: string
    /** Who the purchase was for, as the order holds it, or null. */
    readonly recipient: string | null
}

/** Where the check-in stands. */
export interface CareDeliveryWaitOutput {
    /** The order, echoed. */
    readonly orderId: string
    /** `due` ask now; `later` the timer was moved (once); `closed` nothing to ask (not paid, opted out, never shipped); `declined` a person declined moving the timer on its card. */
    readonly route: (typeof DELIVERY_WAIT_ROUTES)[number]
    /** What to ask about, on `due`; null otherwise. */
    readonly due: DeliveryDue | null
}

const input: NodeSchema<CareDeliveryWaitInput> = z.object({
    orderId: z.string().max(MAX_ID).min(1),
    dueAt: z.string().max(40).nullable(),
    shipWaits: z.number().int().min(0).max(SHIP_WAITS_MAX).nullable(),
})

const output: NodeSchema<CareDeliveryWaitOutput> = z.object({
    orderId: z.string().max(MAX_ID).describe("The id of the order, as given."),
    route: z.enum(DELIVERY_WAIT_ROUTES).describe("`due` ask now; `later` the timer moved; `closed` nothing to ask; `declined` a person declined moving the timer."),
    due: z
        .object({
            contactId: z.string().max(MAX_ID),
            orderNo: z.string().max(MAX_LINE),
            items: z.string().max(MAX_LINE),
            recipient: z.string().max(MAX_LINE).nullable(),
        })
        .nullable()
        .describe("What the check-in asks about, on `due`; null otherwise."),
})

/**
 * `sales.care-delivery-wait` (Cho den luc hoi tham): exact timing, so code, no AI. Woken by the delivery-check timer, it routes `due`,
 * `later` or `closed`. Nothing is asked about an order that is not paid or of a customer who asked to be left alone. A timer that woke
 * early is armed again for its real moment. A check-in with no known delivery day looks for the shipment: once it shipped, it is due the
 * day after; while it has not, ONE re-arm a day on with `data.shipWaits + 1`, at most `SHIP_WAITS_MAX` looks, then it stops quietly. The
 * count rides on the timer (no loop in the node: each wake is one run, each run arms at most once).
 */
export const salesCareDeliveryWaitNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.care-delivery-wait",
    title: { key: "nodeSalesCareDeliveryWaitTitle" },
    description: { vi: "Ch\u1edd \u0111\u00fang l\u00fac \u0111\u1ec3 h\u1ecfi th\u0103m sau giao h\u00e0ng: ch\u01b0a t\u1edbi th\u00ec h\u1eb9n l\u1ea1i, kh\u00f4ng h\u1ecfi \u0111\u01a1n ch\u01b0a tr\u1ea3 ti\u1ec1n ho\u1eb7c kh\u00e1ch \u0111\u00e3 d\u1eb7n \u0111\u1eebng l\u00e0m phi\u1ec1n.", en: "Waits for the right moment to check in after delivery: books it again if it is early, and never asks about an unpaid order or a customer who asked to be left alone." },
    tools: [TOOL.orderGet, TOOL.leadCareGet],
    mode: "auto",
    accounts: [],
    input,
    output,
    routes: { by: "route", names: DELIVERY_WAIT_ROUTES },
    run: async (given, context) => {
        const closed: CareDeliveryWaitOutput = { orderId: given.orderId, route: "closed", due: null }
        const later: CareDeliveryWaitOutput = { orderId: given.orderId, route: "later", due: null }
        const declined: CareDeliveryWaitOutput = { orderId: given.orderId, route: "declined", due: null }
        const at = context.run.at
        const order = await careOrderOf(context, given.orderId)
        if (order === null || paymentStateOf(order.status) !== "paid") return closed
        const person = await orderPersonOf(context, order.id)
        if (person === null || person.optedOut) return closed
        if (given.shipWaits !== null && order.shippedAt === null) {
            if (given.shipWaits + 1 >= SHIP_WAITS_MAX) return closed
            const look = await armCare(context, {
                kind: "delivery-check",
                ref: order.id,
                dueAt: afterMinutes(at, SHIP_NEXT_LOOK_MINUTES),
                data: { shipWaits: given.shipWaits + 1 },
            })
            return look.declined ? declined : later
        }
        const target = given.shipWaits !== null && order.shippedAt !== null ? dayAfter(order.shippedAt) : given.dueAt
        if (!isDue(target, at)) {
            const move = await armCare(context, {
                kind: "delivery-check",
                ref: order.id,
                dueAt: target ?? afterMinutes(at, SHIP_NEXT_LOOK_MINUTES),
            })
            return move.declined ? declined : later
        }
        return {
            orderId: order.id,
            route: "due",
            due: {
                contactId: person.contactId,
                orderNo: order.orderNo,
                items: itemsLineOf(order.items),
                recipient: order.delivery.recipientName,
            },
        }
    },
    examples: [
        {
            name: "the morning after delivery the check-in is due",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1", dueAt: "1970-01-01T00:00:00.000Z", shipWaits: null },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered(CARE_OPEN)),
            ],
            output: {
                orderId: "o1",
                route: "due",
                due: { contactId: "c1", orderNo: "DH-1", items: "2 x tea boxes", recipient: null },
            },
        },
        {
            name: "a timer that woke early is moved to its real moment and nothing is asked",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1", dueAt: "1970-01-20T00:00:00.000Z", shipWaits: null },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "delivery-check", ref: "o1", dueAt: "1970-01-20T00:00:00.000Z" }),
                    answer: ARMED,
                },
            ],
            output: { orderId: "o1", route: "later", due: null },
        },
        {
            name: "an order that has not shipped yet waits one more day, when the delivery day was not known",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1", dueAt: null, shipWaits: 0 },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({
                        kind: "delivery-check",
                        ref: "o1",
                        dueAt: "1970-01-02T00:00:00.000Z",
                        data: { shipWaits: 1 },
                    }),
                    answer: ARMED,
                },
            ],
            output: { orderId: "o1", route: "later", due: null },
        },
        {
            name: "after three looks for the shipment it stops quietly",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1", dueAt: null, shipWaits: 2 },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered(CARE_OPEN)),
            ],
            output: { orderId: "o1", route: "closed", due: null },
        },
        {
            name: "an order that shipped while the check-in looked for it is due the day after the shipment",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1", dueAt: null, shipWaits: 1 },
            tools: [
                {
                    id: TOOL.orderGet,
                    args: { orderId: "o1" },
                    answer: answered({ order: { ...ORDER_O1, shippedAt: "1969-12-31T00:00:00.000Z" } }),
                },
                ...personReadsOf(answered(CARE_OPEN)),
            ],
            output: {
                orderId: "o1",
                route: "due",
                due: { contactId: "c1", orderNo: "DH-1", items: "2 x tea boxes", recipient: null },
            },
        },
        {
            name: "a customer who asked to be left alone is not asked",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1", dueAt: "1970-01-01T00:00:00.000Z", shipWaits: null },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered({ ...CARE_OPEN, optedOut: true })),
            ],
            output: { orderId: "o1", route: "closed", due: null },
        },
        {
            name: "an order that is not paid is not asked about",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1", dueAt: "1970-01-01T00:00:00.000Z", shipWaits: null },
            tools: [
                {
                    id: TOOL.orderGet,
                    args: { orderId: "o1" },
                    answer: answered({ order: { ...ORDER_O1, status: "cancelled" } }),
                },
            ],
            output: { orderId: "o1", route: "closed", due: null },
        },
        {
            name: "a move of the timer the schedule tool refuses ends the step, never reported as re-armed",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1", dueAt: "1970-01-20T00:00:00.000Z", shipWaits: null },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "delivery-check", ref: "o1", dueAt: "1970-01-20T00:00:00.000Z" }),
                    answer: refused("invalid_arguments"),
                },
            ],
            failure: { kind: "cannot", why: "nivo.tool.timer.arm refused: invalid_arguments" },
        },
        {
            name: "a person declines moving an early timer: nothing is moved, nothing is asked, the step routes declined",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1", dueAt: "1970-01-20T00:00:00.000Z", shipWaits: null },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "delivery-check", ref: "o1", dueAt: "1970-01-20T00:00:00.000Z" }),
                    answer: refused("declined"),
                },
            ],
            output: { orderId: "o1", route: "declined", due: null },
        },
    ],
})
