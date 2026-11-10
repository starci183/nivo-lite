import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import { TOOL } from "../../vocabulary/tool-ids"
import { itemsTextOf, orderLinesOf } from "../payment/payment-request.policy"
import { nodeGoalOf } from "../node-ui"
import type { NodeLocale, NodeSchema } from "../node-schema.types"
import { CARE_RIGHTS, careLeadOf, careOrderOf } from "./care.data"
import { paymentStateOf } from "./care.policy"
import { agentAnswer } from "./care.steps"

const ID = "sales.unpaid-notice"

/** What the notice is given: the order the 24-hour timer woke for, and the language of the team chat. */
export interface UnpaidNoticeInput {
    /** The order still unpaid (`= trigger.ref`). */
    readonly orderId: string
    /** The language the team reads. */
    readonly locale: NodeLocale
}

/** What the notice did. */
export interface UnpaidNoticeOutput {
    /** The order, echoed. */
    readonly orderId: string
    /** `told` the team was told; `settled` nothing to tell (the order was paid, cancelled or is gone). */
    readonly result: "told" | "settled"
}

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<UnpaidNoticeInput> = z.object({
    orderId: z.string().max(MAX_ID).min(1),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<UnpaidNoticeOutput> = z.object({
    orderId: z.string().max(MAX_ID).describe("The id of the order, as given."),
    result: z.enum(["told", "settled"]).describe("`told` when the team was told (the agent answers only this)."),
})

const GUIDANCE =
    "Tell the team on the team chat, in one short `message.text` with intent `ask`, in the team's language (`locale`), that the order is " +
    "still unpaid a day after its QR and one reminder: name the order number and the customer, and ask whether to keep or cancel it. " +
    "Do not write to the customer."

const EXAMPLE_GRANT: RightsGrant = { rights: CARE_RIGHTS }

const ORDER = {
    id: "o1",
    orderNo: "DH-1",
    amountVnd: 300_000,
    status: "confirmed",
    items: { lines: [] },
    leadId: "l1",
    shippedAt: null,
}

const NOTICE = {
    kind: "message.text",
    intent: "ask",
    title: "Đơn DH-1 chưa thanh toán",
    text: "Chị An chưa chuyển khoản đơn DH-1 sau một ngày và một lần nhắc. Giữ đơn hay huỷ ạ?",
}

/**
 * `sales.unpaid-notice` (Báo đội đơn chưa trả): a day after the QR, an order still unpaid is told to the team on /chat by the agent, in its
 * own words (`agent-message.post`); the team decides to keep or cancel it. No work item, nothing to the customer. A side step
 * (`blocking: false`). An order paid or cancelled in the meantime is not told: a guard in code.
 */
export const salesUnpaidNoticeNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: ID,
    role: "output",
    title: bilingualOf("nodeSalesUnpaidNoticeTitle"),
    params,
    input,
    output,
    rights: CARE_RIGHTS,
    effects: [TOOL.teamMessagePost],
    requires: [TOOL.teamMessagePost],
    blocking: false,
    run: async (given, context) => {
        const order = await careOrderOf(context, given.orderId)
        if (order === undefined || paymentStateOf(order.status) !== "open") return { orderId: given.orderId, result: "settled" }
        const lead = await careLeadOf(context, order.leadId)
        return agentAnswer(context, {
            goal: `${nodeGoalOf(ID, "en")} ${GUIDANCE}`,
            input: {
                locale: given.locale,
                order: { orderId: order.id, orderNo: order.orderNo, items: itemsTextOf(orderLinesOf(order.items)) },
                customer: lead === undefined ? null : { name: lead.contactName },
            },
            output,
            maxTurns: 3,
            purpose: "unpaid-notice",
        })
    },
    examples: [
        {
            name: "an order unpaid a day after its QR is told to the team, who decide",
            params: {},
            input: { orderId: "o1", locale: "vi" },
            output: { orderId: "o1", result: "told" },
            grant: EXAMPLE_GRANT,
            model: [{ call: { tool: TOOL.teamMessagePost, args: NOTICE } }, { done: { orderId: "o1", result: "told" } }],
            effects: [{ kind: TOOL.teamMessagePost, payload: NOTICE }],
            store: { order: [ORDER], "sales-lead": [{ id: "l1", contactName: "An" }] },
        },
        {
            name: "an order paid in the meantime is not told",
            params: {},
            input: { orderId: "o1", locale: "vi" },
            output: { orderId: "o1", result: "settled" },
            grant: EXAMPLE_GRANT,
            effects: [],
            store: { order: [{ ...ORDER, status: "paid" }] },
        },
    ],
})
