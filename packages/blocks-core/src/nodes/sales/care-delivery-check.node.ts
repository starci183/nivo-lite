import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { nodeGoalOf } from "../node-ui"
import type { DeliveryDue } from "./care-delivery-wait.node"
import { PROFILE_AN, SENT_VIA_ZALO } from "./care.examples"
import { customerNameOf } from "./care.reads"
import { CARE_VOICE, careMessageSchema, refusalSchema, sendToContact } from "./care.steps"
import { refused } from "../tool-answers"

const ID = "sales.care-delivery-check"

/** What the check-in is given: what the wait found due, and the language. */
export interface CareDeliveryCheckInput {
    /** The order, echoed (`= steps.wait.output.orderId`). */
    readonly orderId: string
    /** What to ask about (`= steps.wait.output.due`); null only when wired wrongly. */
    readonly due: DeliveryDue | null
    /** The language of the message. */
    readonly locale: NodeLocale
}

/** What the check-in did. */
export interface CareDeliveryCheckOutput {
    /** The order, echoed. */
    readonly orderId: string
    /** True when the question reached the customer. */
    readonly sent: boolean
    /** The send tool's refusal when it did not, else null. */
    readonly refusal: string | null
}

const input: NodeSchema<CareDeliveryCheckInput> = z.object({
    orderId: z.string().max(MAX_ID).min(1),
    due: z
        .object({
            contactId: z.string().max(MAX_ID).min(1),
            orderNo: z.string().max(MAX_LINE),
            items: z.string().max(MAX_LINE),
            recipient: z.string().max(MAX_LINE).nullable(),
        })
        .nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<CareDeliveryCheckOutput> = z.object({
    orderId: z.string().max(MAX_ID).describe("The id of the order, as given."),
    sent: z.boolean().describe("True when the question reached the customer."),
    refusal: refusalSchema,
})

const GUIDANCE =
    "Ask the customer, in one short message, whether the order reached them well and whether they are happy with it; name what they " +
    "bought. Do not offer anything."

/** What the wait handed on, in the examples. */
const DUE: DeliveryDue = { contactId: "c1", orderNo: "DH-1", items: "2 x tea boxes", recipient: null }

const QUESTION = "Did the tea boxes reach you well, and are you happy with them?"

/**
 * `sales.care-delivery-check` (Hoi tham khach): the morning after delivery, the agent writes ONE question on how the order went and the
 * node sends it (`nivo.tool.customer.message.send`). The timing and the guards are `sales.care-delivery-wait`'s, before it. A complaint in the
 * reply reaches the front desk, which reads every customer message.
 */
export const salesCareDeliveryCheckNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: bilingualOf("nodeSalesCareDeliveryCheckTitle"),
    description: { vi: "S\u00e1ng h\u00f4m sau khi giao, g\u1eedi kh\u00e1ch m\u1ed9t c\u00e2u h\u1ecfi th\u0103m \u0111\u01a1n h\u00e0ng th\u1ebf n\u00e0o.", en: "The morning after delivery, sends the customer one question on how the order went." },
    tools: [TOOL.contactGet, TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const due = given.due
        if (due === null) return context.fail({ kind: "cannot", why: "the check-in was reached with nothing due" })
        const name = await customerNameOf(context)
        const message = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE} ${CARE_VOICE}`,
            input: {
                locale: given.locale,
                order: { orderNo: due.orderNo, items: due.items },
                customer: { name, recipient: due.recipient },
            },
            output: careMessageSchema,
            tools: [],
            maxTurns: 1,
        })
        return { orderId: given.orderId, ...(await sendToContact(context, due.contactId, message.text)) }
    },
    examples: [
        {
            name: "the morning after delivery the agent asks how the order went",
            params: {},
            input: { orderId: "o1", due: DUE, locale: "en" },
            tools: [
                { id: TOOL.contactGet, args: {}, answer: PROFILE_AN },
                { id: TOOL.customerMessageSend, args: { contactId: "c1", text: QUESTION }, answer: SENT_VIA_ZALO },
            ],
            agent: [{ answer: { text: QUESTION } }],
            output: { orderId: "o1", sent: true, refusal: null },
        },
        {
            name: "a send the tool refuses is reported in the output, never tried another way",
            params: {},
            input: { orderId: "o1", due: DUE, locale: "en" },
            tools: [
                { id: TOOL.contactGet, args: {}, answer: PROFILE_AN },
                {
                    id: TOOL.customerMessageSend,
                    args: { contactId: "c1", text: QUESTION },
                    answer: refused("no_channel_identity"),
                },
            ],
            agent: [{ answer: { text: QUESTION } }],
            output: { orderId: "o1", sent: false, refusal: "no_channel_identity" },
        },
    ],
})
