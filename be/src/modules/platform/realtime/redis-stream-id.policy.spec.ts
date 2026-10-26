import { Test } from "@nestjs/testing"
import { compareStreamIds } from "./redis-stream-id.policy"

const SUBJECT: unique symbol = Symbol("realtime.redis-stream-id.policy")

const buildSubject = async () => {
    const functions = { compareStreamIds }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

describe("compareStreamIds", () => {
    it("orders by milliseconds first and by sequence within the same millisecond", async () => {
        const subject = await buildSubject()

        expect(subject.compareStreamIds("5-0", "6-0")).toBeLessThan(0)
        expect(subject.compareStreamIds("6-0", "5-9")).toBeGreaterThan(0)
        expect(subject.compareStreamIds("6-1", "6-2")).toBeLessThan(0)
        expect(subject.compareStreamIds("6-2", "6-2")).toBe(0)
    })

    it("compares numbers, not text, so a longer millisecond count is newer", async () => {
        const subject = await buildSubject()

        expect(subject.compareStreamIds("10-0", "9-0")).toBeGreaterThan(0)
    })

    it("reads an id without a sequence as sequence zero, and the empty id as the oldest", async () => {
        const subject = await buildSubject()

        expect(subject.compareStreamIds("7", "7-0")).toBe(0)
        expect(subject.compareStreamIds("", "0-0")).toBe(0)
    })
})
