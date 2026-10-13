import { dayText, instantOf, isoOf, isoOrNull, vndText } from "./format.policy"

describe("vndText", () => {
    it("writes an amount of dong with the thousands separator of Vietnam", () => {
        expect(vndText(350000).replace(/\s/gu, " ")).toBe("350.000 ₫")
    })

    it("writes nothing for a missing amount", () => {
        expect(vndText(null)).toBe("")
        expect(vndText(undefined)).toBe("")
    })
})

describe("instants", () => {
    it("reads a timestamp that came as text or as a date", () => {
        expect(instantOf("2026-10-12T10:00:00.000Z")).toBe(Date.parse("2026-10-12T10:00:00.000Z"))
        expect(instantOf(new Date("2026-10-12T10:00:00.000Z"))).toBe(Date.parse("2026-10-12T10:00:00.000Z"))
    })

    it("writes a timestamp as ISO text", () => {
        expect(isoOf("2026-10-12T10:00:00Z")).toBe("2026-10-12T10:00:00.000Z")
        expect(isoOf(new Date("2026-10-12T10:00:00.000Z"))).toBe("2026-10-12T10:00:00.000Z")
    })

    it("writes none for no timestamp", () => {
        expect(isoOrNull(null)).toBeNull()
        expect(isoOrNull("2026-10-12T10:00:00Z")).toBe("2026-10-12T10:00:00.000Z")
    })
})

describe("dayText", () => {
    it("turns an ISO day into dd/mm/yyyy", () => {
        expect(dayText("2026-10-12")).toBe("12/10/2026")
    })
})
