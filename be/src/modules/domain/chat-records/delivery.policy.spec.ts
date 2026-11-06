import { Test } from "@nestjs/testing"
import { CHAT_DELIVERY_UNKNOWN, heldClaimOf, mayClaim } from "./delivery.policy"

/** The members of the subject under test. */
interface Subject {
    readonly mayClaim: typeof mayClaim
    readonly heldClaimOf: typeof heldClaimOf
}

const SUBJECT = Symbol("delivery.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { mayClaim, heldClaimOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("mayClaim", () => {
    it("grants a send to a message that was never tried or failed with a definite refusal", async () => {
        const policy = await build()
        expect(policy.mayClaim({ deliveryStatus: null, deliveryError: null })).toBe(true)
        expect(policy.mayClaim({ deliveryStatus: "failed", deliveryError: "blocked" })).toBe(true)
    })

    it("holds a delivered message and every uncertain failure", async () => {
        const policy = await build()
        expect(policy.mayClaim({ deliveryStatus: "sent", deliveryError: null })).toBe(false)
        const held = [CHAT_DELIVERY_UNKNOWN, "delivery_failed", "zalo_error"].map((error) =>
            policy.mayClaim({ deliveryStatus: "failed", deliveryError: error }),
        )
        expect(held).toEqual([false, false, false])
    })
})

describe("heldClaimOf", () => {
    it("tells a delivered message from an attempt of unknown outcome", async () => {
        const policy = await build()
        expect(policy.heldClaimOf({ deliveryStatus: "sent", deliveryError: null })).toBe("acknowledged")
        expect(policy.heldClaimOf({ deliveryStatus: "failed", deliveryError: CHAT_DELIVERY_UNKNOWN })).toBe("ambiguous")
    })
})
