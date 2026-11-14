import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { salesAwaitingOrdersNode } from "./awaiting-orders.node"
import { salesCreditNoticeNode } from "./credit-notice.node"
import { salesCreditReadNode } from "./credit-read.node"
import { salesCreditTallyNode } from "./credit-tally.node"
import { salesOrderPaidNode } from "./order-paid.node"
import { salesOrderReadNode } from "./order-read.node"
import { salesPaidClaimNoticeNode } from "./paid-claim-notice.node"
import { salesPaidClaimReplyNode } from "./paid-claim-reply.node"
import { salesPaymentRemindNode } from "./payment-remind.node"
import { salesPaymentShortNode } from "./payment-short.node"
import { itemsTextOf, orderLineOf, orderTotalOf } from "./sales-order"

// The steps of the money in (sales.payment@1) and the payment reminder (sales.payment-reminder@6), each one feature, every one `auto`.
// `checkTemplateNode` runs every example of a node with no engine and checks its definition.

const STEPS: ReadonlyArray<TemplateNode> = [
    salesCreditReadNode,
    salesAwaitingOrdersNode,
    salesOrderPaidNode,
    salesPaymentShortNode,
    salesCreditTallyNode,
    salesCreditNoticeNode,
    salesPaidClaimReplyNode,
    salesPaidClaimNoticeNode,
    salesOrderReadNode,
    salesPaymentRemindNode,
]

describe.each(STEPS.map((step) => [step.id, step] as const))("%s", (_id, step) => {
    it("passes its definition checks and every example", async () => {
        expect(await checkTemplateNode(step)).toEqual([])
    })

    it("is automatic", () => {
        expect(step.mode).toBe("auto")
    })
})

describe("the money side holds no money logic", () => {
    it("reads the ONE credit the trigger names on the bank feed's account; the comparison is never the model's", () => {
        expect(salesCreditReadNode.tools).toEqual([TOOL.paymentCreditGet])
        expect(salesCreditReadNode.accounts).toEqual([PROVIDER.sepay, PROVIDER.casso, PROVIDER.payos])
        expect(salesCreditReadNode.model).toBeUndefined()
        expect(salesCreditNoticeNode.model).toBeUndefined()
        // The match is the graph's own expressions: the list, the paid write and the tally compare nothing and call no model.
        expect([salesAwaitingOrdersNode, salesOrderPaidNode, salesCreditTallyNode].map((step) => step.model)).toEqual([
            undefined,
            undefined,
            undefined,
        ])
        expect(salesPaidClaimNoticeNode.model).toBeUndefined()
    })

    it("tells the team in a side step; the customer who says they paid is answered by the agent, never confirmed", () => {
        expect(salesCreditNoticeNode.blocking).toBe(false)
        expect(salesPaidClaimNoticeNode.blocking).toBe(false)
        expect(salesPaidClaimReplyNode.tools).toEqual([TOOL.customerMessageSend])
    })
})

describe("an order's lines and total", () => {
    it("keep the price of one the customer was told and sum exactly", () => {
        const lines = [
            orderLineOf({ name: "small basket", quantity: 2, unitVnd: 2000 }),
            orderLineOf({ name: "card", quantity: 1, unitVnd: 500 }),
        ]
        expect(lines).toEqual([
            { name: "small basket", qty: 2, unitVnd: 2000, amountVnd: 4000 },
            { name: "card", qty: 1, unitVnd: 500, amountVnd: 500 },
        ])
        expect(orderTotalOf(lines)).toBe(4500)
        expect(itemsTextOf(lines)).toBe("2 x small basket, 1 x card")
    })
})
