import { expectedEffects, runExample } from "../node-examples.fixture"
import { paymentClaimAckNode } from "./claim-ack.node"
import { claimAckOf } from "./claim-ack.policy"

describe("payment.claim-ack", () => {
    it.each(paymentClaimAckNode.examples.map((example) => [example.name, example] as const))(
        "example: %s",
        async (_name, example) => {
            const run = await runExample(paymentClaimAckNode, example)
            expect(run.output).toEqual(example.output)
            expect(run.effects).toEqual(expectedEffects(example))
        },
    )

    it("records the claim on the turn when it has no subject", async () => {
        const [example] = paymentClaimAckNode.examples
        const run = await runExample(paymentClaimAckNode, example, { subject: null })
        expect(run.output).toMatchObject({ claim: { kind: "turn", id: "turn-1" } })
    })

    it("records before it sends, so a reply never goes out for a claim that was not recorded", async () => {
        const [example] = paymentClaimAckNode.examples
        const run = await runExample(paymentClaimAckNode, example)
        expect(run.effects.map((effect) => effect.kind)).toEqual(["payment-claim.record", "channel.send"])
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
