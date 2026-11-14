import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../bounds"
import { bilingualOf, messageOf } from "../../messages/catalog"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { SENT_VIA_ZALO } from "./care.examples"
import { CARE_VOICE, refusalSchema, sendToContact } from "./care.steps"

/** The customer's message while the order waits for its money, and the order it may be about. */
export interface OrderTalkInput {
    /** The customer. */
    readonly contactId: string | null
    /** What the customer just wrote (the event the sale's payment wait took). */
    readonly text: string
    /** The order's code. */
    readonly orderNo: string
    /** The order's total, VND. */
    readonly amountVnd: number | null
    /** The language the shop writes in. */
    readonly locale: NodeLocale
}

/** Where the message goes: answered here (`about`), or not about the order (`off`: the sale gives it back). */
export type OrderTalkTopic = "about" | "off"

/** What the step came to. */
export interface OrderTalkOutput {
    /** `about`: the message was about the order and was answered; `off`: it was about something else, nothing was said. */
    readonly topic: OrderTalkTopic
    /** True when the answer reached the customer. */
    readonly sent: boolean
    /** The send's refusal when it did not, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<OrderTalkInput> = z.object({
    contactId: z.string().min(1).max(MAX_ID).nullable(),
    text: z.string().max(MAX_BODY),
    orderNo: z.string().min(1).max(MAX_ID),
    amountVnd: z.number().int().min(0).nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<OrderTalkOutput> = z.object({
    topic: z.enum(["about", "off"]).describe("about: the message is about this order and was answered; off: it is about something else"),
    sent: z.boolean().describe("True when the answer reached the customer."),
    refusal: refusalSchema,
})

/** What the model decides: whether the message is about the order, and the answer when it is. MEANING is the model's, never a word list. */
const decision = z.object({
    topic: z.enum(["about", "off"]).describe("about: the message is about this order (its items, total, payment or delivery); off: anything else"),
    reply: z.string().max(MAX_BODY).nullable().describe("The one short answer to the customer when topic is about, from the order facts given; null when off"),
})

const GUIDANCE = [
    "Answer only from the order facts given (`orderNo`, `amountVnd`): never invent a price, a date or a promise, and never confirm a payment: the bank's credit confirms it.",
    CARE_VOICE,
].join("\n")

const ABOUT = "Your order DH-20261113-0001 is 4,500 VND; please put DH-20261113-0001 as the transfer content."

/**
 * `sales.order-talk` (Trao doi ve don): the customer wrote while their order waits for its money. The model reads the message against the
 * order and decides by MEANING whether it is about the order (`context.agent.run`, no word list); when it is, it writes one short answer
 * and the step sends it to the customer; when it is not, nothing is said and the sale gives the message back (`handBack`) so the next
 * waiter, else the front desk, takes it. Routed by `topic`.
 */
export const salesOrderTalkNode: TemplateNode<typeof input, typeof output, NodeSchema<Record<string, never>>, OrderTalkTopic> = defineTemplateNode({
    id: "sales.order-talk",
    title: bilingualOf("nodeSalesOrderTalkTitle"),
    description: {
        vi: "Khi đơn đang chờ tiền mà khách nhắn: hiểu tin nhắn có nói về đơn không; có thì trả lời ngắn từ thông tin đơn, không thì trả tin nhắn lại.",
        en: "When the customer writes while the order waits for its money: decides whether the message is about the order; if so answers briefly from the order, else gives it back.",
    },
    tools: [TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    routes: { by: "topic", names: ["about", "off"] },
    run: async (given, context) => {
        const decided = await context.agent.run({
            goal: `${messageOf("en", "nodeSalesOrderTalkGoal")}\n${GUIDANCE}`,
            input: { message: given.text, orderNo: given.orderNo, amountVnd: given.amountVnd, locale: given.locale },
            output: decision,
            tools: [],
            maxTurns: 1,
        })
        if (decided.topic === "off" || decided.reply === null || decided.reply.trim() === "") return { topic: "off", sent: false, refusal: null }
        if (given.contactId === null) return context.fail({ kind: "cannot", why: "an answer about the order was reached with no customer" })
        const said = await sendToContact(context, given.contactId, decided.reply)
        return { topic: "about", sent: said.sent, refusal: said.refusal }
    },
    examples: [
        {
            name: "a question about the order's total is answered from the order and sent",
            params: {},
            input: { contactId: "contact-1", text: "how much was it again?", orderNo: "DH-20261113-0001", amountVnd: 4500, locale: "en" },
            agent: [{ answer: { topic: "about", reply: ABOUT } }],
            tools: [{ id: TOOL.customerMessageSend, args: { contactId: "contact-1", text: ABOUT }, answer: SENT_VIA_ZALO }],
            output: { topic: "about", sent: true, refusal: null },
        },
        {
            name: "a message about something else is not answered here: the sale gives it back",
            params: {},
            input: { contactId: "contact-1", text: "do you also do weddings?", orderNo: "DH-20261113-0001", amountVnd: 4500, locale: "en" },
            agent: [{ answer: { topic: "off", reply: null } }],
            output: { topic: "off", sent: false, refusal: null },
        },
    ],
})
