import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { bilingualOf, messageOf } from "../../../shared/messages/catalog"
import type { NodeLocale, NodeSchema } from "../../../shared/nodes/node-schema.types"
import { refused } from "../../../shared/nodes/tool-answers"
import { SENT_VIA_ZALO } from "./care.examples"
import { CARE_VOICE, careMessageSchema, refusalSchema, sendToContact } from "./care.steps"

/** The order that still waits for its money, and its customer. */
export interface PaymentRemindInput {
    /** The customer the reminder goes to; null only when the graph is wired wrongly (the graph checks it first). */
    readonly contactId: string | null
    /** The order's code. */
    readonly orderNo: string
    /** The order's total, VND, as the order keeps it; null when it keeps none. */
    readonly amountVnd: number | null
    /** The language the shop writes in. */
    readonly locale: NodeLocale
}

/** What the reminder came to. */
export interface PaymentRemindOutput {
    /** True when the reminder reached the customer. */
    readonly sent: boolean
    /** The send's refusal when it did not, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<PaymentRemindInput> = z.object({
    contactId: z.string().min(1).max(MAX_ID).nullable(),
    orderNo: z.string().min(1).max(MAX_ID),
    amountVnd: z.number().int().min(0).nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<PaymentRemindOutput> = z.object({
    sent: z.boolean().describe("True when the reminder reached the customer."),
    refusal: refusalSchema,
})

/** How the agent of the step writes: the guidance of the goal, never a line it must say. */
const GUIDANCE = [
    "Remind the customer gently, once, that order `orderNo` still waits for its transfer; name the total `amountVnd` exactly as given " +
        "(never another amount) and that the transfer content is the order code. If the customer already paid, they may ignore this.",
    CARE_VOICE,
].join("\n")

/** The reminder of the examples, as the agent writes it. */
const REMINDER = "Hi Lan, order DH-20261113-0001 (4,500 VND) still waits for your transfer, with DH-20261113-0001 as the content. Thank you!"

/**
 * `sales.payment-remind` (Nhac khach chuyen khoan): reminds the customer of an order that still waits for its money, once. The agent writes
 * the line from the order's code and total (no wording is coded); the step sends it to the customer (`nivo.tool.customer.message.send` by
 * the customer, the run has no conversation of its own). A refusal of the send (an opted-out customer, a closed window) is a fact in the
 * output, never a crash: the reminder is a courtesy, the order stays as it is.
 */
export const salesPaymentRemindNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.payment-remind",
    title: bilingualOf("nodeSalesPaymentRemindTitle"),
    description: { vi: "Nh\u1eafc kh\u00e1ch chuy\u1ec3n kho\u1ea3n cho \u0111\u01a1n c\u00f2n ch\u1edd ti\u1ec1n, m\u1ed9t l\u1ea7n.", en: "Reminds the customer once to pay an order that still waits for its money." },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const contactId = given.contactId
        if (contactId === null) return context.fail({ kind: "cannot", why: "the reminder was reached with no customer" })
        const message = await context.agent.run({
            goal: `${messageOf("en", "nodeSalesPaymentRemindGoal")}\n${GUIDANCE}`,
            input: { orderNo: given.orderNo, amountVnd: given.amountVnd, locale: given.locale },
            output: careMessageSchema,
            tools: [],
            // One message is the work; the second turn only serves an answer the agent loop refused (no turn shape, an output that does not fit):
            // the model reads why and writes again instead of the step stopping confused on one slip (P-FIX2 list; as `sales.order-talk`).
            maxTurns: 2,
        })
        return sendToContact(context, contactId, message.text)
    },
    examples: [
        {
            name: "an order that still waits for its money gets one gentle reminder with its code and exact total",
            params: {},
            input: { contactId: "contact-1", orderNo: "DH-20261113-0001", amountVnd: 4500, locale: "en" },
            agent: [{ answer: { text: REMINDER } }],
            tools: [{ id: TOOL.customerMessageSend, args: { contactId: "contact-1", text: REMINDER }, answer: SENT_VIA_ZALO }],
            output: { sent: true, refusal: null },
        },
        {
            name: "a customer the channel cannot reach is a fact in the output: the order stays as it is",
            params: {},
            input: { contactId: "contact-1", orderNo: "DH-20261113-0001", amountVnd: 4500, locale: "en" },
            agent: [{ answer: { text: REMINDER } }],
            tools: [
                { id: TOOL.customerMessageSend, args: { contactId: "contact-1", text: REMINDER }, answer: refused("outside_window") },
            ],
            output: { sent: false, refusal: "outside_window" },
        },
        {
            name: "reached with no customer (a wiring fault: the graph checks it first): nothing is written or sent",
            params: {},
            input: { contactId: null, orderNo: "DH-20261113-0001", amountVnd: 4500, locale: "en" },
            failure: { kind: "cannot", why: "the reminder was reached with no customer" },
        },
    ],
})
