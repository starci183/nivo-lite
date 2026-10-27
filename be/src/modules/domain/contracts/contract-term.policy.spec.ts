import { Test } from "@nestjs/testing"
import { addMonths, appendNoteLine, displayDayOf, nextTermOf } from "./contract-term.policy"

const SUBJECT = Symbol("contract-term.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { addMonths, appendNoteLine, displayDayOf, nextTermOf } }],
    }).compile()
    return moduleRef.get<typeof import("./contract-term.policy")>(SUBJECT)
}

describe("nextTermOf", () => {
    it.each([
        ["a yearly term ending on its anniversary", "2026-01-01", "2027-01-01", "2027-01-01", "2028-01-01"],
        ["a three-year term", "2024-03-15", "2027-03-15", "2027-03-15", "2030-03-15"],
        ["a monthly term", "2026-09-10", "2026-10-10", "2026-10-10", "2026-11-10"],
        ["a term of days", "2026-10-01", "2026-10-15", "2026-10-15", "2026-10-29"],
        ["a month-end term, clamped to the shorter month", "2025-12-31", "2026-01-31", "2026-01-31", "2026-02-28"],
        ["a yearly term ending the day before its anniversary", "2026-10-01", "2027-09-30", "2027-10-01", "2028-09-30"],
        ["a monthly term ending the day before", "2026-01-01", "2026-01-31", "2026-02-01", "2026-02-28"],
    ])("renews %s by its own length", async (_name, startsOn, endsOn, nextStart, nextEnd) => {
        const policy = await buildSubject()
        expect(policy.nextTermOf(startsOn, endsOn)).toEqual({ startsOn: nextStart, endsOn: nextEnd })
    })

    it.each([
        ["a missing start", null],
        ["an unreadable start", "someday"],
        ["a term of no length", "2027-01-01"],
        ["a start after the end", "2027-06-01"],
    ])("renews %s by one year", async (_name, startsOn) => {
        const policy = await buildSubject()
        expect(policy.nextTermOf(startsOn, "2027-01-01")).toEqual({ startsOn: "2027-01-01", endsOn: "2028-01-01" })
    })
})

describe("addMonths", () => {
    it("clamps a day the target month does not have, leap years included", async () => {
        const policy = await buildSubject()
        expect(policy.addMonths("2026-01-31", 1)).toBe("2026-02-28")
        expect(policy.addMonths("2028-01-31", 1)).toBe("2028-02-29")
        expect(policy.addMonths("2026-08-31", 13)).toBe("2027-09-30")
    })
})

describe("displayDayOf", () => {
    it("writes a day as DD/MM/YYYY", async () => {
        const policy = await buildSubject()
        expect(policy.displayDayOf("2027-03-05")).toBe("05/03/2027")
    })
})

describe("appendNoteLine", () => {
    it("starts an empty note with the line", async () => {
        const policy = await buildSubject()
        expect(policy.appendNoteLine("  ", "Renewed", 50)).toBe("Renewed")
    })

    it("adds the line under the existing note", async () => {
        const policy = await buildSubject()
        expect(policy.appendNoteLine("VIP customer\n", "Renewed", 50)).toBe("VIP customer\nRenewed")
    })

    it("keeps the newest characters when the note would grow past the bound", async () => {
        const policy = await buildSubject()
        expect(policy.appendNoteLine("abcdef", "XYZ", 6)).toBe("ef\nXYZ")
    })
})
