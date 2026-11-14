import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { refused } from "../tool-answers"
import { SENT_VIA_ZALO } from "./care.examples"
import { CARE_VOICE, careMessageSchema, refusalSchema, sendToContact } from "./care.steps"

/** The order a credit names whose amount is not the order's total, and the credit's amount. */
export interface PaymentShortInput {
    /** The order's customer, or null (then no one is asked: the team is told after the match). */
    readonly contactId: string | null
    /** The order's code, which the credit's content contains. */
    readonly orderNo: string
    /** The order's total, VND, or null when the record keeps none. */
    readonly orderAmountVnd: number | null
    /** What came in, VND. */
    readonly creditAmountVnd: number
    /** The language the shop writes in. */
    readonly locale: NodeLocale
}

/** What the question came to. */
export interface PaymentShortOutput {
    /** True when the question reached the customer. */
    readonly sent: boolean
    /** The send's refusal when it did not, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<PaymentShortInput> = z.object({
    contactId: z.string().min(1).max(MAX_ID).nullable(),
    orderNo: z.string().min(1).max(MAX_ID),
    orderAmountVnd: z.number().int().min(0).nullable(),
    creditAmountVnd: z.number().int(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<PaymentShortOutput> = z.object({
    sent: z.boolean().describe("True when the question reached the customer."),
    refusal: refusalSchema,
})

/** How the agent of the step writes: the guidance of the goal, never a line it must say. */
const GUIDANCE = [
    "A transfer naming order `orderNo` came in, but its amount `creditAmountVnd` is not the order's total `orderAmountVnd`. Tell the " +
        "customer in ONE short message both amounts exactly as given and ask how they want to settle it; the order is NOT paid yet. Never " +
        "compute a difference, promise a refund or confirm the order.",
    CARE_VOICE,
].join("\n")

/** The question of the examples, as the agent writes it. */
const ASKED = "Hi Lan, we received 3,000 VND for order DH-20261113-0001, whose total is 4,500 VND. How would you like to settle it?"

/**
 * `sales.payment-short` (Hoi khach ve khoan chuyen lech): a credit names one of the customer's orders but its amount is not the order's
 * total (the graph compared both exactly): the agent asks the customer how to settle it, in its own words, with both amounts as they are;
 * the step sends it to the order's customer. The order stays unpaid; the team is told after the match. A side step (`blocking: false`):
 * a question that cannot reach the customer is a fact in the output.
 */
export const salesPaymentShortNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.payment-short",
    title: bilingualOf("nodeSalesPaymentShortTitle"),
    description: { vi: "H\u1ecfi kh\u00e1ch c\u00e1ch x\u1eed l\u00fd khi kho\u1ea3n chuy\u1ec3n \u0111\u00fang m\u00e3 \u0111\u01a1n nh\u01b0ng s\u1ed1 ti\u1ec1n kh\u00f4ng kh\u1edbp. \u0110\u01a1n v\u1eabn ch\u01b0a thanh to\u00e1n.", en: "Asks the customer how to settle a transfer that names their order but has a different amount. The order stays unpaid." },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, context) => {
        const contactId = given.contactId
        if (contactId === null) return { sent: false, refusal: null }
        const message = await context.agent.run({
            goal: `${messageOf("en", "nodeSalesPaymentShortGoal")}\n${GUIDANCE}`,
            input: {
                orderNo: given.orderNo,
                orderAmountVnd: given.orderAmountVnd,
                creditAmountVnd: given.creditAmountVnd,
                locale: given.locale,
            },
            output: careMessageSchema,
            tools: [],
            maxTurns: 1,
        })
        return sendToContact(context, contactId, message.text)
    },
    examples: [
        {
            name: "a transfer naming the order with another amount: the customer is asked how to settle it, both amounts as they are",
            params: {},
            input: { contactId: "contact-1", orderNo: "DH-20261113-0001", orderAmountVnd: 4500, creditAmountVnd: 3000, locale: "en" },
            agent: [{ answer: { text: ASKED } }],
            tools: [{ id: TOOL.customerMessageSend, args: { contactId: "contact-1", text: ASKED }, answer: SENT_VIA_ZALO }],
            output: { sent: true, refusal: null },
        },
        {
            name: "a customer the channel cannot reach is a fact in the output",
            params: {},
            input: { contactId: "contact-1", orderNo: "DH-20261113-0001", orderAmountVnd: 4500, creditAmountVnd: 3000, locale: "en" },
            agent: [{ answer: { text: ASKED } }],
            tools: [{ id: TOOL.customerMessageSend, args: { contactId: "contact-1", text: ASKED }, answer: refused("outside_window") }],
            output: { sent: false, refusal: "outside_window" },
        },
        {
            name: "an order with no customer asks no one: the team is told after the match",
            params: {},
            input: { contactId: null, orderNo: "DH-20261113-0001", orderAmountVnd: 4500, creditAmountVnd: 3000, locale: "en" },
            output: { sent: false, refusal: null },
        },
    ],
})
