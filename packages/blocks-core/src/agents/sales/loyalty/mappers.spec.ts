import { MEMBER_GOLD, SAMPLE_MEMBERS, SAMPLE_NOW, SAMPLE_PROGRAM } from "./fixtures/loyalty.data"
import { memberListRowOf } from "./mappers"

const NOW_MS = Date.parse(SAMPLE_NOW)
const CONFIG = SAMPLE_PROGRAM.config

describe("memberListRowOf", () => {
    it("draws a customer for the members list: the tier by name, the points, the spend, the last visit and the contact", () => {
        const row = memberListRowOf(MEMBER_GOLD, CONFIG, NOW_MS)

        expect(row).toMatchObject({
            id: "m-1",
            name: MEMBER_GOLD.name,
            contact: "84912345678",
            tierKey: "vang",
            points: 1450,
            lifetimeSpendVnd: 12_400_000,
            lastVisitAt: MEMBER_GOLD.lastVisitAt,
        })
        expect(row.tier).not.toBe("")
        expect(row.activity).toBe("active")
    })

    it("falls back on the e-mail for a customer with no phone, on nothing for one with neither, and names no tier the programme does not hold", () => {
        const byEmail = memberListRowOf({ ...MEMBER_GOLD, phone: null }, CONFIG, NOW_MS)
        const bare = memberListRowOf({ ...MEMBER_GOLD, phone: null, email: null, tierKey: "gone" }, CONFIG, NOW_MS)

        expect(byEmail.contact).toBe("lan@example.com")
        expect(bare.contact).toBe("")
        expect(bare.tier).toBe("")
    })

    it("tells a customer who went quiet from the active ones", () => {
        const activities = SAMPLE_MEMBERS.map((member) => memberListRowOf(member, CONFIG, NOW_MS).activity)

        expect(new Set(activities).size).toBeGreaterThan(1)
    })
})
