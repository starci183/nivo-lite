import { FakeClock } from "@starci/jest-preset"
import { isRecord } from "./record.policy"

describe("isRecord", () => {
    it.each([{}, { key: "value" }, [], ["value"], new Map<string, string>(), new Set<string>()])(
        "accepts a non-null object: %p",
        (value) => {
            expect(isRecord(value)).toBe(true)
        },
    )

    it("accepts a date object", () => {
        const clock = new FakeClock("2026-10-13T00:00:00.000Z")

        expect(isRecord(clock.now())).toBe(true)
    })

    it.each([undefined, null, false, true, 0, 42, NaN, "", "value", Symbol("value"), () => undefined])(
        "refuses a value that is not a non-null object: %p",
        (value) => {
            expect(isRecord(value)).toBe(false)
        },
    )
})
