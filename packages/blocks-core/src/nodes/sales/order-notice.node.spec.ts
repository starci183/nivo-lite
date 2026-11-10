import { nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { paymentReceivedNoticeNode } from "../payment/received-notice.node"
import { salesOrderNoticeNode } from "./order-notice.node"
import { amountTextOf, orderSummaryOf, paymentSummaryOf } from "./order-notice.policy"

describe("sales.order-notice", () => {
    it.each(salesOrderNoticeNode.examples.map((each) => [each.name, each] as const))(
        "example: %s",
        async (_name, each) => {
            await expect(nodeExampleMismatches(salesOrderNoticeNode, each, coreEffects)).resolves.toEqual([])
        },
    )
})

describe("payment.received-notice", () => {
    it.each(paymentReceivedNoticeNode.examples.map((each) => [each.name, each] as const))(
        "example: %s",
        async (_name, each) => {
            await expect(nodeExampleMismatches(paymentReceivedNoticeNode, each, coreEffects)).resolves.toEqual([])
        },
    )
})

describe("the notices are side nodes", () => {
    it("never block the run: a failed notice is recorded and the customer's path goes on", () => {
        expect(salesOrderNoticeNode.blocking).toBe(false)
        expect(paymentReceivedNoticeNode.blocking).toBe(false)
    })
})

describe("the lines of the notices", () => {
    it("writes the order as one line and leaves out what is not known", () => {
        const facts = {
            orderNo: "DH-1",
            lines: [{ name: "Basket", qty: 1 }],
            amountVnd: 2000,
            customer: "An",
            address: "25 Nguyen Hue",
        }
        expect(orderSummaryOf(facts, "en")).toBe(
            "New order DH-1 · 1 x Basket · 2.000 VND · customer An · deliver to 25 Nguyen Hue",
        )
        expect(orderSummaryOf({ ...facts, amountVnd: null, customer: "", address: "" }, "en")).toBe(
            "New order DH-1 · 1 x Basket",
        )
    })

    it("writes the payment in both languages", () => {
        expect(paymentSummaryOf("DH-1", 2000, "vi")).toContain("DH-1")
        expect(paymentSummaryOf("DH-1", 2000, "en")).toBe("Received 2.000 VND for DH-1")
        expect(amountTextOf(1500000, "en")).toBe("1.500.000 VND")
    })
})
