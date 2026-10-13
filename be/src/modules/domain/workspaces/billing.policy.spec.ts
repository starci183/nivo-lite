import { extendedPaidUntil } from "./billing.policy"

const NOW = new Date("2026-10-12T00:00:00.000Z")

describe("billing policy", () => {
    describe("extendedPaidUntil", () => {
        it("counts from now when there is no subscription", () => {
            expect(extendedPaidUntil(null, NOW, 30).toISOString()).toBe("2026-11-11T00:00:00.000Z")
        })

        it("counts from now when the subscription lapsed", () => {
            expect(extendedPaidUntil(new Date("2026-10-01T00:00:00.000Z"), NOW, 1).toISOString()).toBe(
                "2026-10-13T00:00:00.000Z",
            )
        })

        it("counts from the current end while the subscription runs", () => {
            expect(extendedPaidUntil(new Date("2026-12-01T00:00:00.000Z"), NOW, 10).toISOString()).toBe(
                "2026-12-11T00:00:00.000Z",
            )
        })
    })
})
