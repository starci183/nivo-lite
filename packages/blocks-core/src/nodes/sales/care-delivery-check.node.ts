import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import { itemsTextOf, orderLinesOf } from "../payment/payment-request.policy"
import { nodeGoalOf } from "../node-ui"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { CARE_RIGHTS, careFactsOfLead, careLeadOf, careOrderOf, shippedAtOf } from "./care.data"
import type { CareOrder } from "./care.data"
import {
    SHIP_WAITS_MAX,
    afterMinutes,
    dayAfter,
    isDue,
    paymentStateOf,
    shipAttemptOf,
    shipSuffixOf,
} from "./care.policy"
import { CARE_VOICE, agentAnswer, arm } from "./care.steps"

const ID = "sales.care-delivery-check"
const DAY_MINUTES = 24 * 60

/** What the check-in is given: the timer that woke it and the language. */
export interface CareDeliveryCheckInput {
    /** The order that was delivered (`= trigger.ref`). */
    readonly orderId: string
    /** `ship0`, `ship1`... while the delivery day is not known and the check-in waits for the shipment (`= trigger.suffix`), or null. */
    readonly suffix: string | null
    /** The moment the check-in is really due (`= trigger.dueAt`), or null. */
    readonly dueAt: string | null
    /** The language of the message. */
    readonly locale: NodeLocale
}

/** What the check-in did. */
export interface CareDeliveryCheckOutput {
    /** The order, echoed. */
    readonly orderId: string
    /** `asked` the question went out; `later` not time yet (the timer moved); `closed` nothing to ask (order not paid, customer opted out, never shipped). */
    readonly result: "asked" | "later" | "closed"
}

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<CareDeliveryCheckInput> = z.object({
    orderId: z.string().max(MAX_ID).min(1),
    suffix: z.string().max(MAX_LINE).nullable(),
    dueAt: z.string().max(MAX_LINE).nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<CareDeliveryCheckOutput> = z.object({
    orderId: z.string().max(MAX_ID).describe("The id of the order, as given."),
    result: z
        .enum(["asked", "later", "closed"])
        .describe("`asked` when the question was sent to the customer (the agent answers only this)."),
})

const GUIDANCE =
    "Ask the customer, in one short message, whether the order reached them well and whether they are happy with it; name what they " +
    "bought. Do not offer anything. Send it with `customer.leadId` (the tool finds their conversation)."

/** What a check-in whose delivery day was not known waits for: nothing, the shipment (a day more), the morning after it, or nothing more. */
type ShipWait =
    | { readonly kind: "none" }
    | { readonly kind: "gone" }
    | { readonly kind: "again" }
    | { readonly kind: "until"; readonly at: string }

const shipWaitOf = (order: CareOrder, attempt: number | null): ShipWait => {
    if (attempt === null) return { kind: "none" }
    const shipped = shippedAtOf(order)
    if (shipped === null) return { kind: attempt + 1 >= SHIP_WAITS_MAX ? "gone" : "again" }
    return { kind: "until", at: dayAfter(shipped) }
}

const EXAMPLE_GRANT: RightsGrant = {
    rights: [...CARE_RIGHTS, { kind: "message", access: "write", scope: "turn", fields: ["body"] }],
}

const ORDER = {
    id: "o1",
    orderNo: "DH-1",
    amountVnd: 300_000,
    status: "paid",
    items: { lines: [{ name: "tea boxes", qty: 2, unitVnd: 150_000, amountVnd: 300_000 }] },
    leadId: "l1",
    shippedAt: null,
}

const STORE = {
    order: [ORDER],
    "sales-lead": [{ id: "l1", contactName: "An", consultFacts: {} }],
}

const DUE = { orderId: "o1", suffix: null, dueAt: "1970-01-01T00:00:00.000Z", locale: "en" } as const

const QUESTION = "Did the tea boxes reach you well, and are you happy with them?"

/**
 * `sales.care-delivery-check` (Hỏi thăm khách): the morning after delivery the agent asks the customer, in one message, how the order
 * went (`customer.message.send`). Timing is code before it: a timer that woke early moves to its real moment, and a check-in whose delivery day was not
 * known waits a day at a time, at most three, for the order to ship. Nothing is asked about an order that is not paid or of a customer who
 * asked to be left alone. A complaint in the reply reaches the front desk, which reads every customer message.
 */
export const salesCareDeliveryCheckNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: ID,
    role: "output",
    title: bilingualOf("nodeSalesCareDeliveryCheckTitle"),
    params,
    input,
    output,
    rights: CARE_RIGHTS,
    effects: [TOOL.customerMessageSend, TOOL.careSchedule],
    requires: [TOOL.customerMessageSend],
    run: async (given, context) => {
        const closed: CareDeliveryCheckOutput = { orderId: given.orderId, result: "closed" }
        const later: CareDeliveryCheckOutput = { orderId: given.orderId, result: "later" }
        const suffix = given.suffix ?? ""
        const now = context.now()
        const order = await careOrderOf(context, given.orderId)
        if (order === undefined || paymentStateOf(order.status) !== "paid") return closed
        const lead = await careLeadOf(context, order.leadId)
        if (careFactsOfLead(lead).optedOut) return closed
        const attempt = shipAttemptOf(suffix)
        const waiting = shipWaitOf(order, attempt)
        if (waiting.kind === "gone") return closed
        if (waiting.kind === "again") {
            const next = shipSuffixOf((attempt ?? 0) + 1)
            await arm(context, { kind: "delivery-check", ref: order.id, suffix: next, dueAt: afterMinutes(now, DAY_MINUTES) })
            return later
        }
        const target = waiting.kind === "until" ? waiting.at : given.dueAt
        if (!isDue(target, now)) {
            await arm(context, {
                kind: "delivery-check",
                ref: order.id,
                suffix: waiting.kind === "until" ? "" : suffix,
                dueAt: target ?? afterMinutes(now, DAY_MINUTES),
            })
            return later
        }
        return agentAnswer(context, {
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE} ${CARE_VOICE}`,
            input: {
                locale: given.locale,
                order: { orderId: order.id, orderNo: order.orderNo, items: itemsTextOf(orderLinesOf(order.items)) },
                customer:
                    lead === undefined
                        ? null
                        : { leadId: lead.id, name: lead.contactName, recipient: careFactsOfLead(lead).recipient },
                careKind: "delivery-check",
            },
            output,
            maxTurns: 3,
            purpose: "delivery-check",
        })
    },
    examples: [
        {
            name: "the morning after delivery the agent asks how the order went",
            params: {},
            input: DUE,
            output: { orderId: "o1", result: "asked" },
            grant: EXAMPLE_GRANT,
            model: [
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { leadId: "l1", text: QUESTION },
                    },
                },
                { done: { orderId: "o1", result: "asked" } },
            ],
            effects: [
                { kind: TOOL.customerMessageSend, payload: { leadId: "l1", text: QUESTION } },
            ],
            store: STORE,
        },
        {
            name: "a timer that woke early is moved to its real moment and nothing is asked",
            params: {},
            input: { ...DUE, dueAt: "1970-01-20T00:00:00.000Z" },
            output: { orderId: "o1", result: "later" },
            grant: EXAMPLE_GRANT,
            effects: [
                { kind: TOOL.careSchedule, payload: { kind: "delivery-check", ref: "o1", dueAt: "1970-01-20T00:00:00.000Z" } },
            ],
            store: STORE,
        },
        {
            name: "an order that has not shipped yet waits one more day, when the delivery day was not known",
            params: {},
            input: { ...DUE, suffix: "ship0", dueAt: null },
            output: { orderId: "o1", result: "later" },
            grant: EXAMPLE_GRANT,
            effects: [
                {
                    kind: TOOL.careSchedule,
                    payload: { kind: "delivery-check", ref: "o1", dueAt: "1970-01-02T00:00:00.000Z", suffix: "ship1" },
                },
            ],
            store: STORE,
        },
        {
            name: "after three days of waiting for the shipment it stops quietly",
            params: {},
            input: { ...DUE, suffix: "ship2", dueAt: null },
            output: { orderId: "o1", result: "closed" },
            grant: EXAMPLE_GRANT,
            effects: [],
            store: STORE,
        },
        {
            name: "a customer who asked to be left alone is not asked",
            params: {},
            input: DUE,
            output: { orderId: "o1", result: "closed" },
            grant: EXAMPLE_GRANT,
            effects: [],
            store: { ...STORE, "sales-lead": [{ id: "l1", contactName: "An", consultFacts: { careOptOut: true } }] },
        },
    ],
})
