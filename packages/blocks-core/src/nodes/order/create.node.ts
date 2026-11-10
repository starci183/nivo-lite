import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import { exampleGrantOf } from "../sales/consult.grant"
import type { NodeSchema } from "../node-schema.types"
import { nodeGoalOf } from "../node-ui"
import { DRAFT_LINES_MAX, draftLineSchema } from "../sales/consult.draft"
import type { DraftLine } from "../sales/consult.draft"

/** The order draft the consult settled, and the conversation to say a holding line in. */
export interface CreateOrderInput {
    /** The customer the order is for. */
    readonly leadId: string
    /** The catalogue items and how many of each. */
    readonly items: ReadonlyArray<DraftLine>
    /** Where to deliver. */
    readonly address: string
    /** The name of the person who receives the delivery; null or absent when it is the customer (an older workflow passes none). */
    readonly recipientName?: string | null | undefined
    /** The phone number of the person who receives the delivery. */
    readonly recipientPhone: string
    /** The day and the time window of the delivery, in the customer's words. */
    readonly deliveryAt: string
    /** The customer's conversation. */
    readonly conversationId: string
}

/** The order the step recorded and confirmed. */
export interface CreateOrderOutput {
    /** The order. */
    readonly orderId: string
    /** Its number, as the customer and the team see it. */
    readonly orderNo: string
}

/** The id of the step, which names its goal in the messages catalog. */
const ID = "sales.create-order"

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<CreateOrderInput> = z.object({
    leadId: z.string().min(1).max(MAX_ID),
    items: z.array(draftLineSchema).min(1).max(DRAFT_LINES_MAX),
    address: z.string().min(1).max(MAX_LINE),
    recipientName: z.string().min(1).max(MAX_LINE).nullable().optional(),
    recipientPhone: z.string().min(1).max(MAX_LINE),
    deliveryAt: z.string().min(1).max(MAX_LINE),
    conversationId: z.string().min(1).max(MAX_ID),
})

const output: NodeSchema<CreateOrderOutput> = z.object({
    orderId: z.string().min(1).max(MAX_ID).describe(`The id of the order ${TOOL.orderRecord} answered`),
    orderNo: z.string().min(1).max(MAX_ID).describe(`The order number in the facts ${TOOL.orderRecord} answered`),
})

/** How the agent of the step behaves: the guidance of the goal, never a line it must say. */
const GUIDANCE = [
    `Call ${TOOL.orderRecord} with \`leadId\`, \`address\`, \`recipientPhone\`, \`deliveryAt\`, \`recipientName\` (only when given) and ` +
        "`items` as given (each line as `catalogueItemId` and `qty`), nothing added. Prices, the total and the order number are the tool's facts.",
    "Compare the total it answered (`amountVnd`) with the shop's approval threshold it answered (`thresholdVnd`; `waitsOwner` " +
        "says whether the total reaches it). Below it, " +
        `call ${TOOL.orderConfirm} with the order id. At or above it, confirm only when the founder's answers to this step approve the ` +
        `order; otherwise tell the customer in one short holding message (${TOOL.customerMessageSend}, in their language) that the shop ` +
        "is checking the order, and answer `confused` with the question for the founder, naming the order number, its total and the " +
        "threshold (\"Đơn DH-1 6.000.000đ vượt ngưỡng 5.000.000đ, duyệt không?\"). The step runs again with the founder's answer.",
    `Once the order is confirmed, when the policy's \`autoWon\` is true, move the customer's deal to \`won\` with ${TOOL.leadStageUpdate} ` +
        "(`leadId`, `stage`), unless the confirmation's `dealStage` is already `won` or is `lost`: a lost deal is the shop's to reopen.",
    "A refusal of a tool is a fact: do not work around it, say you cannot finish and why.",
    "Never confirm the order, a price, a payment or a delivery to the customer yourself.",
].join("\n")

const DRAFT = {
    leadId: "lead-1",
    items: [{ catalogueItemId: "c1", quantity: 2 }],
    address: "25 Nguyen Hue",
    recipientName: "Lan",
    recipientPhone: "0901 234 567",
    deliveryAt: "Saturday 9-11",
    conversationId: "conv-1",
} as const

/** The call that records the draft, as the agent makes it. */
const RECORD_CALL = {
    call: {
        tool: TOOL.orderRecord,
        args: {
            leadId: "lead-1",
            items: [{ catalogueItemId: "c1", qty: 2 }],
            address: "25 Nguyen Hue",
            recipientName: "Lan",
            recipientPhone: "0901 234 567",
            deliveryAt: "Saturday 9-11",
        },
    },
}

/** What the order tool answers about the draft it wrote: the true numbers are the tool's. */
const RECORDED_FACTS = {
    orderNo: "DH-1",
    status: "draft",
    amountVnd: 4000,
    lines: [{ name: "Small basket", qty: 2, unitVnd: 2000, amountVnd: 4000 }],
    recipientName: "Lan",
    recipientPhone: "0901 234 567",
    deliveryAddress: "25 Nguyen Hue",
    deliveryAt: "Saturday 9-11",
    waitsOwner: false,
    thresholdVnd: 5_000_000,
}

/** The call that confirms the recorded order. */
const CONFIRM_CALL = { call: { tool: TOOL.orderConfirm, args: { orderId: "order-1" } } }

/** The call that wins the customer's deal once the order is confirmed (the policy's `autoWon`). */
const WIN_CALL = { call: { tool: TOOL.leadStageUpdate, args: { leadId: "lead-1", stage: "won" } } }

/** The effects the agent of the step may call: its whole reach. */
const EFFECTS = [TOOL.orderRecord, TOOL.orderConfirm, TOOL.leadStageUpdate, TOOL.customerMessageSend]

const GRANT = exampleGrantOf([], EFFECTS)

/**
 * `sales.create-order` (Tạo đơn): an Agent + MCP step that records the order the consult settled and confirms it, through NIVO's own
 * order tools. The agent passes ids and quantities only; prices, the total and the order number are the tools' facts. The big-order
 * approval is policy the agent reasons on: at or above the threshold it confirms only with the founder's approval, else it says one
 * holding line to the customer and asks the founder (`confused`), so the step is not done (`requires`) and runs again with the answer.
 * Winning the customer's deal on the confirmed order is the policy's (`autoWon`), done here through `nivo.lead.stage.update`, never by the
 * order tool. The order is kept in lead memory.
 */
export const salesCreateOrderNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: ID,
    role: "output",
    title: bilingualOf("nodeSalesCreateOrderTitle"),
    params,
    input,
    output,
    facts: { lastOrderId: "orderId", lastOrderCode: "orderNo" },
    rights: [],
    effects: EFFECTS,
    requires: [TOOL.orderRecord, TOOL.orderConfirm],
    run: async (given, context) => {
        const decision = await context.agent.run({
            goal: `${nodeGoalOf(ID, "en")}\n${GUIDANCE}`,
            purpose: "create-order",
            input: given,
            output,
            maxTurns: 6,
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "records the settled draft and confirms it",
            params: {},
            grant: GRANT,
            input: DRAFT,
            output: { orderId: "order-1", orderNo: "DH-1" },
            effects: [TOOL.orderRecord, TOOL.orderConfirm, TOOL.leadStageUpdate],
            model: [RECORD_CALL, CONFIRM_CALL, WIN_CALL, { done: { orderId: "order-1", orderNo: "DH-1" } }],
            answers: {
                [TOOL.orderRecord]: [{ kind: "order", id: "order-1", facts: RECORDED_FACTS }],
                [TOOL.orderConfirm]: [
                    {
                        kind: "order",
                        id: "order-1",
                        facts: { orderNo: "DH-1", status: "confirmed", amountVnd: 4000, dealStage: "proposal" },
                    },
                ],
                [TOOL.leadStageUpdate]: [{ kind: "sales-lead", id: "lead-1", facts: { stage: "won", previousStage: "proposal" } }],
            },
        },
    ],
})
