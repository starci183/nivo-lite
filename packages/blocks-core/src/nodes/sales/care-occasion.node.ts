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
import { CARE_RIGHTS, careFactsOfLead, careLeadOf, carePaidOrdersOf } from "./care.data"
import { nextOccurrenceOf, occasionOfSuffix, occasionStandingOf } from "./care.policy"
import type { CareOccasion } from "./care.policy"
import { CARE_VOICE, agentAnswer, arm } from "./care.steps"

const ID = "sales.care-occasion"
const DAY_MS = 86_400_000

/** What the occasion step is given: the customer, which date, and the language. */
export interface CareOccasionInput {
    /** The customer (`= trigger.ref`). */
    readonly leadId: string
    /** Names the date among the customer's (`= trigger.suffix`), or null. */
    readonly suffix: string | null
    /** The language of the message. */
    readonly locale: NodeLocale
}

/** What the occasion step did. */
export interface CareOccasionOutput {
    /** The customer, echoed. */
    readonly leadId: string
    /** `sent` the suggestion went out; `later` the date is still far and the timer moved; `closed` nothing to do (no such date, no paid order, opted out). */
    readonly result: "sent" | "later" | "closed"
}

/** What the owner sets for the occasion step. */
export interface CareOccasionParams {
    /** How many days before a date the customer mentioned the shop writes. */
    readonly occasionLeadDays: number
}

const params: z.ZodType<CareOccasionParams, { occasionLeadDays?: number | undefined }> = z.object({
    occasionLeadDays: z.number().int().min(1).max(30).default(7),
})

const input: NodeSchema<CareOccasionInput> = z.object({
    leadId: z.string().max(MAX_ID).min(1),
    suffix: z.string().max(MAX_LINE).nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<CareOccasionOutput> = z.object({
    leadId: z.string().max(MAX_ID).describe("The id of the customer, as given."),
    result: z
        .enum(["sent", "later", "closed"])
        .describe("`sent` when the suggestion was sent to the customer (the agent answers only this)."),
})

const GUIDANCE =
    "The customer's date (the occasion) is coming up. Write ONE gentle message: mention the occasion and suggest ordering something like " +
    "their last order for it. No pressure, no discount, no price. Send it with `customer.leadId` (the tool finds their conversation)."

/** The moment to write about a yearly date after the one just handled: the lead time before its next occurrence. */
const nextYearsWriteAt = (occasion: CareOccasion, on: string, leadDays: number): string | null => {
    const following = nextOccurrenceOf(occasion, new Date(Date.parse(on) + DAY_MS))
    return following === null ? null : new Date(following.getTime() - leadDays * DAY_MS).toISOString()
}

const EXAMPLE_GRANT: RightsGrant = {
    rights: [...CARE_RIGHTS, { kind: "message", access: "write", scope: "turn", fields: ["body"] }],
}

const LEAD = { id: "l1", contactName: "An" }

const ORDER = {
    id: "o1",
    orderNo: "DH-1",
    amountVnd: 2000,
    status: "paid",
    items: { lines: [{ name: "roses", qty: 1, unitVnd: 2000, amountVnd: 2000 }] },
    leadId: "l1",
    shippedAt: null,
    confirmedAt: "1969-12-20T00:00:00.000Z",
}

const SUGGESTION = "Her birthday is coming up. Would you like to see ideas like the roses you sent last time?"

/**
 * `sales.care-occasion` (Gợi ý đặt lại cho dịp): `occasionLeadDays` before a date the customer mentioned (a birthday, an anniversary), the
 * agent writes ONE gentle suggestion to order again, from the occasion and the customer's last paid order (`customer.message.send`). Timing is code
 * around it: a date still far away moves the timer, a yearly date arms next year once handled, a one-off date that has passed ends.
 * Nothing is written to a customer who asked to be left alone or who never paid an order.
 */
export const salesCareOccasionNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: ID,
    role: "output",
    title: bilingualOf("nodeSalesCareOccasionTitle"),
    params,
    input,
    output,
    rights: CARE_RIGHTS,
    effects: [TOOL.customerMessageSend, TOOL.careSchedule],
    requires: [TOOL.customerMessageSend],
    run: async (given, context) => {
        const closed: CareOccasionOutput = { leadId: given.leadId, result: "closed" }
        const suffix = given.suffix ?? ""
        const lead = await careLeadOf(context, given.leadId)
        const facts = careFactsOfLead(lead)
        const occasion = occasionOfSuffix(facts.occasions, suffix)
        if (lead === undefined || occasion === undefined || facts.optedOut) return closed
        const { occasionLeadDays } = context.params
        const standing = occasionStandingOf(occasion, context.now(), occasionLeadDays)
        if (standing.kind === "gone") return closed
        if (standing.kind === "later") {
            await arm(context, { kind: "occasion", ref: lead.id, suffix, dueAt: standing.writeAt })
            return { leadId: lead.id, result: "later" }
        }
        const [last] = await carePaidOrdersOf(context, lead.id)
        if (last === undefined) return closed
        const answer = await agentAnswer(context, {
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE} ${CARE_VOICE}`,
            input: {
                locale: given.locale,
                occasion: { label: occasion.label, on: standing.on.slice(0, 10) },
                lastOrder: { orderNo: last.orderNo, items: itemsTextOf(orderLinesOf(last.items)) },
                customer: { leadId: lead.id, name: lead.contactName, recipient: facts.recipient },
                careKind: "occasion",
            },
            output,
            maxTurns: 3,
            purpose: "occasion",
        })
        const next = occasion.year === null ? nextYearsWriteAt(occasion, standing.on, occasionLeadDays) : null
        if (next !== null) await arm(context, { kind: "occasion", ref: lead.id, suffix, dueAt: next })
        return answer
    },
    examples: [
        {
            name: "inside the lead time of a birthday the agent suggests ordering again, and next year is armed",
            params: { occasionLeadDays: 7 },
            input: { leadId: "l1", suffix: "birthday-1-5", locale: "en" },
            output: { leadId: "l1", result: "sent" },
            grant: EXAMPLE_GRANT,
            model: [
                { call: { tool: TOOL.customerMessageSend, args: { leadId: "l1", text: SUGGESTION } } },
                { done: { leadId: "l1", result: "sent" } },
            ],
            effects: [
                { kind: TOOL.customerMessageSend, payload: { leadId: "l1", text: SUGGESTION } },
                {
                    kind: TOOL.careSchedule,
                    payload: { kind: "occasion", ref: "l1", dueAt: "1970-12-28T17:00:00.000Z", suffix: "birthday-1-5" },
                },
            ],
            store: {
                order: [ORDER],
                "sales-lead": [
                    { ...LEAD, consultFacts: { recipient: "her", occasions: [{ label: "birthday", date: "01-05" }] } },
                ],
            },
        },
        {
            name: "a date still far away moves the timer to the lead time and sends nothing",
            params: { occasionLeadDays: 7 },
            input: { leadId: "l1", suffix: "birthday-6-1", locale: "en" },
            output: { leadId: "l1", result: "later" },
            grant: EXAMPLE_GRANT,
            effects: [
                {
                    kind: TOOL.careSchedule,
                    payload: { kind: "occasion", ref: "l1", dueAt: "1970-05-24T17:00:00.000Z", suffix: "birthday-6-1" },
                },
            ],
            store: { "sales-lead": [{ ...LEAD, consultFacts: { occasions: [{ label: "birthday", date: "06-01" }] } }] },
        },
        {
            name: "a customer who asked to be left alone gets no suggestion",
            params: {},
            input: { leadId: "l1", suffix: "birthday-1-5", locale: "en" },
            output: { leadId: "l1", result: "closed" },
            grant: EXAMPLE_GRANT,
            effects: [],
            store: {
                "sales-lead": [
                    { ...LEAD, consultFacts: { careOptOut: true, occasions: [{ label: "birthday", date: "01-05" }] } },
                ],
            },
        },
        {
            name: "a customer with no paid order has nothing to order again",
            params: {},
            input: { leadId: "l1", suffix: "birthday-1-5", locale: "en" },
            output: { leadId: "l1", result: "closed" },
            grant: EXAMPLE_GRANT,
            effects: [],
            store: {
                order: [],
                "sales-lead": [{ ...LEAD, consultFacts: { occasions: [{ label: "birthday", date: "01-05" }] } }],
            },
        },
    ],
})
