import { nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { paymentClaimAckNode } from "./claim-ack.node"
import { claimAckOf } from "./claim-ack.policy"

describe("payment.claim-ack", () => {
    it.each(paymentClaimAckNode.examples.map((each) => [each.name, each] as const))(
        "example: %s",
        async (_name, each) => {
            await expect(nodeExampleMismatches(paymentClaimAckNode, each, coreEffects)).resolves.toEqual([])
        },
    )

    it("records before it sends, so a reply never goes out for a claim that was not recorded", () => {
        const [example] = paymentClaimAckNode.examples
        expect(example.effects.map((effect) => (typeof effect === "string" ? effect : effect.kind))).toEqual([
            "payment-claim.record",
            "channel.send",
        ])
    })
})

describe("claimAckOf", () => {
    it.each(["vi", "en"] as const)("never says the money arrived (%s)", (locale) => {
        for (const reply of [claimAckOf(5000, locale), claimAckOf(null, locale)])
            expect(reply).not.toMatch(/nhận được|đã nhận|thành công|received|confirmed|successful/iu)
    })

    it("names the amount when the customer gave one", () => {
        expect(claimAckOf(1_500_000, "en")).toBe("We are checking your transaction of 1.500.000VND.")
    })
})
