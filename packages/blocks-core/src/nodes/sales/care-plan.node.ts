import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeContext, NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import type { NodeSchema } from "../node-schema.types"
import { DELIVERY_CARE_RIGHTS, careDeliveryOf, careFactsOfLead, careMemoryRowOf, careOrderOf, shippedAtOf } from "./care.data"
import type { CareOrder } from "./care.data"
import {
    afterMinutes,
    dayAfter,
    deliveryCheckAtOf,
    deliveryDayOf,
    occasionStandingOf,
    occasionSuffixOf,
    schedulable,
    shipSuffixOf,
} from "./care.policy"
import { arm } from "./care.steps"

/** What the care plan is given: the paid order. */
export interface CarePlanInput {
    /** The order that was paid (`= trigger.orderId`). */
    readonly orderId: string
}

/** What the care plan armed. */
export interface CarePlanOutput {
    /** The order, echoed. */
    readonly orderId: string
    /** When the check-in after delivery is looked at, or null when nothing was armed. */
    readonly checkAt: string | null
    /** How many occasion reminders were armed. */
    readonly occasions: number
}

/** What the owner sets for the care that follows a sale. */
export interface CarePlanParams {
    /** How many days before a date the customer mentioned the shop writes a gentle suggestion to order again. */
    readonly occasionLeadDays: number
}

const params: z.ZodType<CarePlanParams, { occasionLeadDays?: number | undefined }> = z.object({
    occasionLeadDays: z.number().int().min(1).max(30).default(7),
})

const input: NodeSchema<CarePlanInput> = z.object({ orderId: z.string().max(MAX_ID).min(1) })

const output: NodeSchema<CarePlanOutput> = z.object({
    orderId: z.string().max(MAX_ID).describe("The id of the paid order, as given."),
    checkAt: z.string().max(40).nullable().describe("When the check-in after delivery is looked at (ISO), or null."),
    occasions: z.number().int().min(0).describe("How many occasion reminders were armed."),
})

/** The calendar day the customer's delivery words name. */
interface DeliveryReading {
    readonly deliverOn: string | null
}

const readingSchema: z.ZodType<DeliveryReading> = z.object({
    deliverOn: z.string().max(20).nullable().describe("The day as YYYY-MM-DD in Vietnam time, or null when the words name no day."),
})

const READING_INSTRUCTIONS =
    "Read the delivery time the customer gave and answer the calendar day it means, as YYYY-MM-DD in Vietnam time, counting from `today`. " +
    'Answer null unless the words name a day ("tomorrow", "Saturday", "the 20th"); never guess.'

const FALLBACK_CHECK_MINUTES = 2 * 24 * 60

type Context = NodeContext<typeof params>

/** When to look at the check-in, and whether the delivery day behind it is known. */
interface DeliveryCheck {
    /** The moment: the morning after the shipment or the delivery day, else two days on. */
    readonly dueAt: string
    /** False when no day is known and the order has not shipped: the check-in then waits for the shipment (`ship0`). */
    readonly known: boolean
}

/** The delivery day the customer's words name; a model that cannot tell leaves it unknown, which the shipment wait covers. */
const deliveryDayRead = async (context: Context, deliveryAt: string | null, now: Date): Promise<string | null> => {
    if (deliveryAt === null) return null
    const decision = await context.model.decide(readingSchema, {
        purpose: "care-plan-delivery-day",
        instructions: READING_INSTRUCTIONS,
        input: { deliveryAt, today: now.toISOString().slice(0, 10) },
    })
    return decision.kind === "answer" ? deliveryDayOf(decision.value.deliverOn, now) : null
}

/**
 * When to look in after the delivery: the day after it shipped; else the morning after the delivery day of the ORDER (the time the
 * customer settled for this order: the one home of it); else a wait for the shipment.
 */
const deliveryCheckOf = async (context: Context, order: CareOrder): Promise<DeliveryCheck> => {
    const shipped = shippedAtOf(order)
    if (shipped !== null) return { dueAt: dayAfter(shipped), known: true }
    const now = context.now()
    const day = await deliveryDayRead(context, (await careDeliveryOf(context, order.id)).deliveryAt, now)
    return day === null
        ? { dueAt: afterMinutes(now, FALLBACK_CHECK_MINUTES), known: false }
        : { dueAt: deliveryCheckAtOf(day), known: true }
}

const EXAMPLE_GRANT: RightsGrant = { rights: DELIVERY_CARE_RIGHTS }

const ORDER = { id: "o1", orderNo: "DH-1", amountVnd: 2000, status: "paid", items: { lines: [] }, leadId: "l1", shippedAt: null }

/**
 * `sales.care-plan` (Hẹn chăm sóc): timing, so code. After the thank-you it arms the care that follows a sale: the check-in the morning
 * after delivery (the delivery day read from the customer's words; when they named none, looked at two days on, waiting for the order to
 * ship), and for each date the customer mentioned (a birthday, an anniversary) a reminder `occasionLeadDays` before it. A customer who
 * asked to be left alone gets no care armed.
 */
export const salesCarePlanNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "sales.care-plan",
    role: "output",
    title: bilingualOf("nodeSalesCarePlanTitle"),
    params,
    input,
    output,
    rights: DELIVERY_CARE_RIGHTS,
    effects: [TOOL.careSchedule],
    run: async (given, context) => {
        const none: CarePlanOutput = { orderId: given.orderId, checkAt: null, occasions: 0 }
        const order = await careOrderOf(context, given.orderId)
        if (order === undefined) return none
        const facts = await careFactsOfLead(context, order.leadId)
        if (facts.optedOut) return none
        const check = await deliveryCheckOf(context, order)
        await arm(context, { kind: "delivery-check", ref: order.id, suffix: check.known ? "" : shipSuffixOf(0), dueAt: check.dueAt })
        const now = context.now()
        const ahead = facts.occasions.flatMap((occasion) => {
            const standing = occasionStandingOf(occasion, now, context.params.occasionLeadDays)
            return standing.kind === "later" && schedulable(standing.writeAt, now)
                ? [{ suffix: occasionSuffixOf(occasion), dueAt: standing.writeAt }]
                : []
        })
        const leadId = order.leadId
        if (leadId !== null) {
            for (const one of ahead) await arm(context, { kind: "occasion", ref: leadId, ...one })
        }
        return { orderId: order.id, checkAt: check.dueAt, occasions: leadId === null ? 0 : ahead.length }
    },
    examples: [
        {
            name: "arms the check-in the morning after the delivery day the customer named",
            params: {},
            input: { orderId: "o1" },
            output: { orderId: "o1", checkAt: "1970-01-03T02:00:00.000Z", occasions: 0 },
            grant: EXAMPLE_GRANT,
            model: [{ answer: { deliverOn: "1970-01-02" } }],
            effects: [
                { kind: TOOL.careSchedule, payload: { kind: "delivery-check", ref: "o1", dueAt: "1970-01-03T02:00:00.000Z" } },
            ],
            store: {
                order: [{ ...ORDER, deliveryAt: "tomorrow afternoon" }],
                "sales-lead": [{ id: "l1", contactName: "An" }], "agent-lead-memory": [careMemoryRowOf("l1", { deliveryAt: "next week" })],
            },
        },
        {
            name: "with no day named it waits for the shipment, and arms a reminder a week before a date the customer mentioned",
            params: { occasionLeadDays: 7 },
            input: { orderId: "o1" },
            output: { orderId: "o1", checkAt: "1970-01-03T00:00:00.000Z", occasions: 1 },
            grant: EXAMPLE_GRANT,
            effects: [
                {
                    kind: TOOL.careSchedule,
                    payload: { kind: "delivery-check", ref: "o1", dueAt: "1970-01-03T00:00:00.000Z", suffix: "ship0" },
                },
                {
                    kind: TOOL.careSchedule,
                    payload: { kind: "occasion", ref: "l1", dueAt: "1970-01-24T17:00:00.000Z", suffix: "birthday-2-1" },
                },
            ],
            store: {
                order: [ORDER],
                "sales-lead": [{ id: "l1", contactName: "An" }], "agent-lead-memory": [careMemoryRowOf("l1", { occasions: [{ label: "birthday", date: "02-01" }] })],
            },
        },
        {
            name: "a customer who asked to be left alone gets no care armed",
            params: {},
            input: { orderId: "o1" },
            output: { orderId: "o1", checkAt: null, occasions: 0 },
            grant: EXAMPLE_GRANT,
            effects: [],
            store: { order: [ORDER], "sales-lead": [{ id: "l1", contactName: "An" }], "agent-lead-memory": [careMemoryRowOf("l1", { careOptOut: true })] },
        },
    ],
})
