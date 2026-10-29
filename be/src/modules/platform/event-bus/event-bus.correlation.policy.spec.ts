import { isCorrelationId } from "./event-bus.correlation.policy"

describe("event-bus.correlation.policy", () => {
    it("accepts header-safe identities", () => {
        expect(isCorrelationId("req-1")).toBe(true)
        expect(isCorrelationId("A.b_c:d-9")).toBe(true)
    })

    it("accepts the longest bounded identity and refuses one character more", () => {
        expect(isCorrelationId("a".repeat(128))).toBe(true)
        expect(isCorrelationId("a".repeat(129))).toBe(false)
    })

    it("refuses the empty text", () => {
        expect(isCorrelationId("")).toBe(false)
    })

    it("refuses characters that are not header-safe", () => {
        expect(isCorrelationId("a b")).toBe(false)
        expect(isCorrelationId("a\r\nb")).toBe(false)
        expect(isCorrelationId("é")).toBe(false)
    })

    it("refuses what is not text", () => {
        expect(isCorrelationId(undefined)).toBe(false)
        expect(isCorrelationId(null)).toBe(false)
        expect(isCorrelationId(12)).toBe(false)
    })
})
