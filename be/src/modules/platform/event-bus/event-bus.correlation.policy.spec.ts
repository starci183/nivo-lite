import { Test } from "@nestjs/testing"
import { isCorrelationId } from "./event-bus.correlation.policy"

const SUBJECT = Symbol("event-bus.correlation.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isCorrelationId } }],
    }).compile()
    return moduleRef.get<{ isCorrelationId: typeof isCorrelationId }>(SUBJECT)
}

describe("event-bus.correlation.policy", () => {
    it("accepts header-safe identities", async () => {
        const subject = await build()

        expect(subject.isCorrelationId("req-1")).toBe(true)
        expect(subject.isCorrelationId("A.b_c:d-9")).toBe(true)
    })

    it("accepts the longest bounded identity and refuses one character more", async () => {
        const subject = await build()

        expect(subject.isCorrelationId("a".repeat(128))).toBe(true)
        expect(subject.isCorrelationId("a".repeat(129))).toBe(false)
    })

    it("refuses the empty text", async () => {
        const subject = await build()

        expect(subject.isCorrelationId("")).toBe(false)
    })

    it("refuses characters that are not header-safe", async () => {
        const subject = await build()

        expect(subject.isCorrelationId("a b")).toBe(false)
        expect(subject.isCorrelationId("a\r\nb")).toBe(false)
        expect(subject.isCorrelationId(String.fromCharCode(233))).toBe(false)
    })

    it("refuses what is not text", async () => {
        const subject = await build()

        expect(subject.isCorrelationId(undefined)).toBe(false)
        expect(subject.isCorrelationId(null)).toBe(false)
        expect(subject.isCorrelationId(12)).toBe(false)
    })
})
