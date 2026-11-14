import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { nodeGoalOf } from "../node-ui"
import { CARE_OPEN, ORDER_O1, PROFILE_AN, SENT_VIA_ZALO } from "./care.examples"
import { careFactsOf, careOrderOf, customerNameOf, itemsLineOf, saleLeadListOf, saleLeadOf } from "./care.reads"
import { CARE_VOICE, careMessageSchema, refusalSchema, sendToContact } from "./care.steps"
import { answered, refused } from "../tool-answers"

const ID = "sales.after-sale"

/** What the thank-you is given: the paid order, its person and the language. */
export interface AfterSaleInput {
    /** The order that was paid (`= trigger.orderId`). */
    readonly orderId: string
    /** The person who bought (`= trigger.contactId`, the order's contact), or null when the order has none. */
    readonly contactId: string | null
    /** The language of the message. */
    readonly locale: NodeLocale
}

/** What the thank-you did. */
export interface AfterSaleOutput {
    /** The order, echoed for the steps that follow. */
    readonly orderId: string
    /** The order's code, as the order read answered it (what a team notice names). */
    readonly orderNo: string
    /** The person, echoed. */
    readonly contactId: string | null
    /** The sale's record of the person, for the steps that follow (the stage, the occasions); null when the sale keeps none for them. */
    readonly leadId: string | null
    /** True when the thank-you reached the customer. */
    readonly sent: boolean
    /** The send tool's refusal when it did not go out, else null (an opt-out is not a refusal: nothing was sent). */
    readonly refusal: string | null
}

const input: NodeSchema<AfterSaleInput> = z.object({
    orderId: z.string().max(MAX_ID).min(1),
    contactId: z.string().max(MAX_ID).min(1).nullable(),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<AfterSaleOutput> = z.object({
    orderId: z.string().max(MAX_ID).describe("The id of the paid order, as given."),
    orderNo: z.string().max(MAX_ID).describe("The order's code, as the order read answered it."),
    contactId: z.string().max(MAX_ID).nullable().describe("The person, as given."),
    leadId: z.string().max(MAX_ID).nullable().describe("The sale's record of the person, or null when there is none."),
    sent: z
        .boolean()
        .describe(
            "True when the thank-you reached the customer; false when the customer opted out or the send was refused.",
        ),
    refusal: refusalSchema,
})

const GUIDANCE =
    "Thank the customer for paying the order (name its order number), then confirm how it is delivered from `order.delivery`: the address, " +
    "the recipient and the day and time exactly as the order holds them. The order is the truth for this delivery; never name another " +
    "address, recipient or time. Ask the customer for nothing: when the order holds no time or no address, thank and say the shop will " +
    "confirm it."

/** The paid order of the examples, as `nivo.tool.order.get` answers it. */
const PAID_ORDER = {
    ...ORDER_O1,
    items: [],
    delivery: {
        address: "25 Nguy\u1ec5n Hu\u1ec7",
        recipientName: null,
        recipientPhone: "0901 234 567",
        deliveryAt: "chi\u1ec1u mai",
    },
}

/** The sale's record of the person, as the record list answers it. */
const SALE_LEAD = {
    id: TOOL.recordList,
    args: saleLeadListOf("c1"),
    answer: answered({ records: [{ id: "l1", values: {} }], next: null }),
}

const THANKS =
    "Shop \u0111\u00e3 nh\u1eadn ti\u1ec1n \u0111\u01a1n DH-1, c\u1ea3m \u01a1n ch\u1ecb An nhi\u1ec1u! \u0110\u01a1n s\u1ebd giao t\u1edbi 25 Nguy\u1ec5n Hu\u1ec7 v\u00e0o chi\u1ec1u mai nh\u01b0 ch\u1ecb d\u1eb7n."

const THANKS_NO_TIME =
    "We received the payment for order DH-1, thank you! The shop will confirm the delivery time with you."

/**
 * `sales.after-sale` (Cam on khach): once the order is paid, the agent writes the thank-you that confirms the delivery address and time the
 * ORDER holds (`nivo.tool.order.get`; lead memory is never read for this delivery) and asks for nothing; the node sends it
 * (`nivo.tool.customer.message.send` to the person, by `contactId`). A customer who asked to be left alone (`nivo.tool.lead.care.get`, on
 * the sale's record of the person: `blocks-core.sales.lead` by `contactId`) gets
 * nothing: an exact check in code before the agent. The stage and the care that follow are the next nodes'.
 */
export const salesAfterSaleNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: bilingualOf("nodeSalesAfterSaleTitle"),
    description: { vi: "G\u1eedi kh\u00e1ch l\u1eddi c\u1ea3m \u01a1n sau khi \u0111\u01a1n \u0111\u00e3 thanh to\u00e1n, x\u00e1c nh\u1eadn \u0111\u1ecba ch\u1ec9 v\u00e0 gi\u1edd giao. Kh\u00f4ng g\u1eedi cho kh\u00e1ch \u0111\u00e3 d\u1eb7n \u0111\u1eebng l\u00e0m phi\u1ec1n.", en: "Sends the customer a thank-you once the order is paid, confirming the delivery address and time. Sends nothing to a customer who asked to be left alone." },
    tools: [TOOL.orderGet, TOOL.leadCareGet, TOOL.contactGet, TOOL.customerMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta],
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const order = await careOrderOf(context, given.orderId)
        if (order === null)
            return context.fail({ kind: "cannot", why: "the paid order cannot be read" }, { orderId: given.orderId })
        const { contactId } = given
        if (contactId === null) return { orderId: order.id, orderNo: order.orderNo, contactId, leadId: null, sent: false, refusal: null }
        const leadId = await saleLeadOf(context, contactId)
        const quiet: AfterSaleOutput = { orderId: order.id, orderNo: order.orderNo, contactId, leadId, sent: false, refusal: null }
        // The opt-out is care's, kept on the sale's record of the person: a person the sale keeps no record of has not opted out. Care
        // facts that cannot be read are never taken for an opt-out: the step stops for the engine's report (an unhandled case is never silent).
        if (leadId !== null) {
            const facts = await careFactsOf(context, leadId)
            if (facts === null) return context.fail({ kind: "cannot", why: "the care facts of the person cannot be read" }, { leadId })
            if (facts.optedOut) return quiet
        }
        const name = await customerNameOf(context)
        const message = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE} ${CARE_VOICE}`,
            input: {
                locale: given.locale,
                order: {
                    orderNo: order.orderNo,
                    status: order.status,
                    items: itemsLineOf(order.items),
                    delivery: order.delivery,
                },
                customer: { name },
            },
            output: careMessageSchema,
            tools: [],
            maxTurns: 1,
        })
        const sent = await sendToContact(context, contactId, message.text)
        return { orderId: order.id, orderNo: order.orderNo, contactId, leadId, ...sent }
    },
    examples: [
        {
            name: "thanks the customer and confirms the address and time the ORDER holds",
            params: {},
            input: { orderId: "o1", contactId: "c1", locale: "vi" },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: PAID_ORDER }) },
                SALE_LEAD,
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: answered(CARE_OPEN) },
                { id: TOOL.contactGet, args: {}, answer: PROFILE_AN },
                { id: TOOL.customerMessageSend, args: { contactId: "c1", text: THANKS }, answer: SENT_VIA_ZALO },
            ],
            agent: [{ answer: { text: THANKS } }],
            output: { orderId: "o1", orderNo: "DH-1", contactId: "c1", leadId: "l1", sent: true, refusal: null },
        },
        {
            name: "thanks without asking when the order holds no time: the shop will confirm it",
            params: {},
            input: { orderId: "o1", contactId: "c1", locale: "en" },
            tools: [
                {
                    id: TOOL.orderGet,
                    args: { orderId: "o1" },
                    answer: answered({
                        order: { ...PAID_ORDER, delivery: { ...PAID_ORDER.delivery, deliveryAt: null } },
                    }),
                },
                SALE_LEAD,
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: answered(CARE_OPEN) },
                { id: TOOL.contactGet, args: {}, answer: PROFILE_AN },
                { id: TOOL.customerMessageSend, args: { contactId: "c1", text: THANKS_NO_TIME }, answer: SENT_VIA_ZALO },
            ],
            agent: [{ answer: { text: THANKS_NO_TIME } }],
            output: { orderId: "o1", orderNo: "DH-1", contactId: "c1", leadId: "l1", sent: true, refusal: null },
        },
        {
            name: "a customer who asked to be left alone is not written to",
            params: {},
            input: { orderId: "o1", contactId: "c1", locale: "vi" },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: PAID_ORDER }) },
                SALE_LEAD,
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: answered({ ...CARE_OPEN, optedOut: true }) },
            ],
            output: { orderId: "o1", orderNo: "DH-1", contactId: "c1", leadId: "l1", sent: false, refusal: null },
        },
        {
            name: "care facts that cannot be read are never taken for an opt-out: the step stops for the engine's report",
            params: {},
            input: { orderId: "o1", contactId: "c1", locale: "vi" },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: PAID_ORDER }) },
                SALE_LEAD,
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: refused("not_found") },
            ],
            failure: { kind: "cannot", why: "the care facts of the person cannot be read" },
        },
        {
            name: "a send the tool refuses is reported in the output, never tried another way",
            params: {},
            input: { orderId: "o1", contactId: "c1", locale: "vi" },
            tools: [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: PAID_ORDER }) },
                SALE_LEAD,
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: answered(CARE_OPEN) },
                { id: TOOL.contactGet, args: {}, answer: PROFILE_AN },
                { id: TOOL.customerMessageSend, args: { contactId: "c1", text: THANKS }, answer: refused("no_channel_identity") },
            ],
            agent: [{ answer: { text: THANKS } }],
            output: { orderId: "o1", orderNo: "DH-1", contactId: "c1", leadId: "l1", sent: false, refusal: "no_channel_identity" },
        },
        {
            name: "an order that cannot be read stops the step for the engine's report",
            params: {},
            input: { orderId: "o9", contactId: "c1", locale: "vi" },
            tools: [{ id: TOOL.orderGet, args: { orderId: "o9" }, answer: refused("not_found") }],
            failure: { kind: "cannot", why: "the paid order cannot be read" },
        },
    ],
})
