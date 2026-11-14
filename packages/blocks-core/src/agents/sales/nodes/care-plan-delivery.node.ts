import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { defineTemplateNode, type NodeContext, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { nodeGoalOf } from "../../../shared/nodes/node-ui"
import { ARMED, CARE_OPEN, EXAMPLE_AT, ORDER_O1, personReadsOf } from "./care.examples"
import { SHIP_FIRST_LOOK_MINUTES, afterMinutes, dayAfter, deliveryCheckAtOf, deliveryDayOf } from "./care.policy"
import { careOrderOf, orderPersonOf, type CareOrder } from "./care.reads"
import { armCare, careTimerArgsOf } from "./care.steps"
import { answered, refused } from "../../../shared/nodes/tool-answers"

const ID = "sales.care-plan-delivery"

/** What the delivery plan is given: the paid order. */
export interface CarePlanDeliveryInput {
    /** The order that was paid (`= trigger.orderId`). */
    readonly orderId: string
}

/** What the delivery plan armed. */
export interface CarePlanDeliveryOutput {
    /** The order, echoed. */
    readonly orderId: string
    /** When the check-in after delivery is looked at (ISO), or null when nothing was armed. */
    readonly checkAt: string | null
    /** True when no delivery day is known and the check-in will look for the shipment first. */
    readonly waitsForShipment: boolean
    /** True when a person declined arming the check-in on its card: nothing was armed; the graph ends `declined`. */
    readonly declined: boolean
}

const input: NodeSchema<CarePlanDeliveryInput> = z.object({ orderId: z.string().max(MAX_ID).min(1) })

const output: NodeSchema<CarePlanDeliveryOutput> = z.object({
    orderId: z.string().max(MAX_ID).describe("The id of the paid order, as given."),
    checkAt: z.string().max(40).nullable().describe("When the check-in after delivery is looked at (ISO), or null."),
    waitsForShipment: z.boolean().describe("True when the check-in first waits for the order to ship."),
    declined: z.boolean().describe("True when a person declined arming the check-in on its card: no check-in was armed."),
})

/** The calendar day the customer's delivery words name. */
interface DeliveryReading {
    readonly deliverOn: string | null
}

const readingSchema: z.ZodType<DeliveryReading> = z.object({
    deliverOn: z
        .string()
        .max(20)
        .nullable()
        .describe("The day as YYYY-MM-DD in Vietnam time, or null when the words name no day."),
})

const READING =
    "Read the delivery time the customer gave and answer the calendar day it means, as YYYY-MM-DD in Vietnam time, counting from `today`. " +
    'Answer null unless the words name a day ("tomorrow", "Saturday", "the 20th"); never guess.'

/** When to look at the check-in, and whether a delivery day stands behind it. */
interface DeliveryCheck {
    readonly dueAt: string
    readonly known: boolean
}

/**
 * The moment of the check-in: the day after the order shipped; else the morning after the day the ORDER's delivery words name (read by the
 * agent, then format- and range-checked in code); else two days on, looking for the shipment first.
 */
const deliveryCheckOf = async (context: NodeContext, order: CareOrder): Promise<DeliveryCheck> => {
    if (order.shippedAt !== null) return { dueAt: dayAfter(order.shippedAt), known: true }
    const words = order.delivery.deliveryAt
    const reading =
        words === null
            ? null
            : await context.agent.run({
                  goal: `${nodeGoalOf(ID, "en")} ${READING}`,
                  input: { deliveryAt: words, today: context.run.day },
                  output: readingSchema,
                  tools: [],
                  maxTurns: 1,
              })
    const day = deliveryDayOf(reading?.deliverOn ?? null, context.run.at)
    return day === null
        ? { dueAt: afterMinutes(context.run.at, SHIP_FIRST_LOOK_MINUTES), known: false }
        : { dueAt: deliveryCheckAtOf(day), known: true }
}

/**
 * `sales.care-plan-delivery` (Hen hoi tham sau giao): arms ONE timer, the check-in after delivery (`nivo.tool.timer.arm`, kind
 * `delivery-check`, ref the order). The moment is exact arithmetic on the order's instants and `ctx.run.at`; "today" is the run's own day
 * (`ctx.run.day`, the workspace's calendar day); only the reading of the customer's delivery WORDS as a day is the agent's (`ctx.agent.run`, no tool). With no day known the timer carries
 * `data.shipWaits: 0` so the check-in looks for the shipment first. Nothing is armed for a customer who asked to be left alone.
 */
export const salesCarePlanDeliveryNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: { key: "nodeSalesCarePlanDeliveryTitle" },
    description: { vi: "H\u1eb9n m\u1ed9t l\u1ea7n h\u1ecfi th\u0103m kh\u00e1ch sau ng\u00e0y giao h\u00e0ng. Kh\u00f4ng h\u1eb9n cho kh\u00e1ch \u0111\u00e3 d\u1eb7n \u0111\u1eebng l\u00e0m phi\u1ec1n.", en: "Schedules one check-in with the customer after the delivery day. Schedules nothing for a customer who asked to be left alone." },
    tools: [TOOL.orderGet, TOOL.leadCareGet],
    mode: "auto",
    accounts: [],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const none: CarePlanDeliveryOutput = { orderId: given.orderId, checkAt: null, waitsForShipment: false, declined: false }
        const order = await careOrderOf(context, given.orderId)
        if (order === null) return none
        const person = await orderPersonOf(context, order.id)
        if (person === null || person.optedOut) return none
        const check = await deliveryCheckOf(context, order)
        const arm = await armCare(context, {
            kind: "delivery-check",
            ref: order.id,
            dueAt: check.dueAt,
            ...(check.known ? {} : { data: { shipWaits: 0 } }),
        })
        if (arm.declined) return { orderId: order.id, checkAt: null, waitsForShipment: false, declined: true }
        return { orderId: order.id, checkAt: check.dueAt, waitsForShipment: !check.known, declined: false }
    },
    examples: [
        {
            name: "arms the check-in the morning after the delivery day the ORDER's words name",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1" },
            tools: [
                {
                    id: TOOL.orderGet,
                    args: { orderId: "o1" },
                    answer: answered({ order: withDeliveryAt("tomorrow afternoon") }),
                },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "delivery-check", ref: "o1", dueAt: "1970-01-03T02:00:00.000Z" }),
                    answer: ARMED,
                },
            ],
            agent: [{ answer: { deliverOn: "1970-01-02" } }],
            output: { orderId: "o1", checkAt: "1970-01-03T02:00:00.000Z", waitsForShipment: false, declined: false },
        },
        {
            name: "with no day named it looks two days on and waits for the shipment first",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1" },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({
                        kind: "delivery-check",
                        ref: "o1",
                        dueAt: "1970-01-03T00:00:00.000Z",
                        data: { shipWaits: 0 },
                    }),
                    answer: ARMED,
                },
            ],
            output: { orderId: "o1", checkAt: "1970-01-03T00:00:00.000Z", waitsForShipment: true, declined: false },
        },
        {
            name: "words the agent reads as no day are the same as no day named",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1" },
            tools: [
                {
                    id: TOOL.orderGet,
                    args: { orderId: "o1" },
                    answer: answered({ order: withDeliveryAt("khi n\u00e0o ti\u1ec7n") }),
                },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({
                        kind: "delivery-check",
                        ref: "o1",
                        dueAt: "1970-01-03T00:00:00.000Z",
                        data: { shipWaits: 0 },
                    }),
                    answer: ARMED,
                },
            ],
            agent: [{ answer: { deliverOn: null } }],
            output: { orderId: "o1", checkAt: "1970-01-03T00:00:00.000Z", waitsForShipment: true, declined: false },
        },
        {
            name: "an order that already shipped is looked at the day after the shipment, no reading needed",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1" },
            tools: [
                {
                    id: TOOL.orderGet,
                    args: { orderId: "o1" },
                    answer: answered({
                        order: { ...withDeliveryAt("tomorrow"), shippedAt: "1970-01-01T08:00:00.000Z" },
                    }),
                },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "delivery-check", ref: "o1", dueAt: "1970-01-02T08:00:00.000Z" }),
                    answer: ARMED,
                },
            ],
            output: { orderId: "o1", checkAt: "1970-01-02T08:00:00.000Z", waitsForShipment: false, declined: false },
        },
        {
            name: "a customer who asked to be left alone gets no check-in armed",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1" },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered({ ...CARE_OPEN, optedOut: true })),
            ],
            output: { orderId: "o1", checkAt: null, waitsForShipment: false, declined: false },
        },
        {
            name: "late evening in Vietnam the agent counts from the run's own day, already the next one in UTC terms",
            params: {},
            at: "2026-11-12T18:30:00.000Z",
            day: "2026-11-13",
            input: { orderId: "o1" },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: withDeliveryAt("tomorrow") }) },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "delivery-check", ref: "o1", dueAt: "2026-11-15T02:00:00.000Z" }),
                    answer: ARMED,
                },
            ],
            agent: [{ answer: { deliverOn: "2026-11-14" } }],
            output: { orderId: "o1", checkAt: "2026-11-15T02:00:00.000Z", waitsForShipment: false, declined: false },
        },
        {
            name: "a check-in the schedule tool refuses ends the step, never reported as armed",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1" },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({
                        kind: "delivery-check",
                        ref: "o1",
                        dueAt: "1970-01-03T00:00:00.000Z",
                        data: { shipWaits: 0 },
                    }),
                    answer: refused("invalid_arguments"),
                },
            ],
            failure: { kind: "cannot", why: "nivo.tool.timer.arm refused: invalid_arguments" },
        },
        {
            name: "a person declines the check-in's timer: nothing is armed and the step says declined",
            params: {},
            at: EXAMPLE_AT,
            input: { orderId: "o1" },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER_O1 }) },
                ...personReadsOf(answered(CARE_OPEN)),
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({
                        kind: "delivery-check",
                        ref: "o1",
                        dueAt: "1970-01-03T00:00:00.000Z",
                        data: { shipWaits: 0 },
                    }),
                    answer: refused("declined"),
                },
            ],
            output: { orderId: "o1", checkAt: null, waitsForShipment: false, declined: true },
        },
    ],
})

/** The example order with the customer's delivery words set (the examples run at `EXAMPLE_AT`, 1970-01-01). */
function withDeliveryAt(deliveryAt: string): JsonObject {
    return { ...ORDER_O1, delivery: { ...ORDER_O1.delivery, deliveryAt } }
}
