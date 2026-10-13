import { isDay, isTime } from "./input-text.policy"

describe("input text policy", () => {
    it.each([
        ["2026-10-13", true],
        ["2028-02-29", true],
        ["2026-02-29", false],
        ["2026-02-30", false],
        ["2026-13-01", false],
        ["2026-00-01", false],
        ["2026-10-00", false],
        ["2026-1-01", false],
        ["13/10/2026", false],
        ["2026-10-13T00:00:00Z", false],
        ["", false],
    ])("validates calendar day %s as %s", (input, expected) => {
        expect(isDay(input)).toBe(expected)
    })

    it.each([
        ["00:00", true],
        ["09:05", true],
        ["19:59", true],
        ["23:59", true],
        ["24:00", false],
        ["12:60", false],
        ["9:05", false],
        ["09:5", false],
        ["09:05:00", false],
        [" 09:05", false],
        ["", false],
    ])("validates clock text %s as %s", (input, expected) => {
        expect(isTime(input)).toBe(expected)
    })
})
