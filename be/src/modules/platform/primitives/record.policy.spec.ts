import { Test } from "@nestjs/testing"
import { FakeClock } from "@starci/jest-preset"
import { isRecord } from "./record.policy"
const SUBJECT = Symbol("record.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isRecord } }],
    }).compile()
    return moduleRef.get<typeof import("./record.policy")>(SUBJECT)
}

describe("isRecord", () => {
    it.each([{}, { key: "value" }, [], ["value"], new Map<string, string>(), new Set<string>()])(
        "accepts a non-null object: %p",
        async (value) => {
            const subject = await build()

            expect(subject.isRecord(value)).toBe(true)
        },
    )

    it("accepts a date object", async () => {
        const subject = await build()

        const clock = new FakeClock("2026-10-13T00:00:00.000Z")

        expect(subject.isRecord(clock.now())).toBe(true)
    })

    it.each([undefined, null, false, true, 0, 42, NaN, "", "value", Symbol("value"), () => undefined])(
        "refuses a value that is not a non-null object: %p",
        async (value) => {
            const subject = await build()

            expect(subject.isRecord(value)).toBe(false)
        },
    )
})
