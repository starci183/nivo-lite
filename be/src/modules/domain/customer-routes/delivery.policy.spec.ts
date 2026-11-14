import { DELIVERY_OUTCOME_UNKNOWN, heldVerdictOf, settledStateOf } from "./delivery.policy"

describe("heldVerdictOf", () => {
    it.each([
        ["delivered", "delivered"],
        ["claimed", "unknown"],
        ["unknown", "unknown"],
        ["refused", "send"],
    ] as const)("answers %s as %s", (state, verdict) => {
        expect(heldVerdictOf(state)).toBe(verdict)
    })
})

describe("settledStateOf", () => {
    it("keeps a definite refusal refused", () => {
        expect(settledStateOf("refused", "recipient_not_linked")).toBe("refused")
        expect(settledStateOf("refused", "delivery_rejected")).toBe("refused")
        expect(settledStateOf("refused", null)).toBe("refused")
    })

    it("turns a refusal whose reason leaves the outcome uncertain into unknown", () => {
        for (const reason of [DELIVERY_OUTCOME_UNKNOWN, "delivery_failed", "zalo_error"]) {
            expect(settledStateOf("refused", reason)).toBe("unknown")
        }
    })

    it("keeps an unknown outcome unknown whatever the reason", () => {
        expect(settledStateOf("unknown", null)).toBe("unknown")
        expect(settledStateOf("unknown", "recipient_not_linked")).toBe("unknown")
    })
})
