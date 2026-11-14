import type { BrandPillar } from "./brand"
import { channelMomentsOf, momentsOf, occasionsOfMonth, pillarQuota, planMonth, slotLineOf, themeSequence } from "./plan"

const pillar = (name: string, weight: number, active = true): BrandPillar => ({ name, description: "", weight, active })

describe("the month plan", () => {
    it("lays each channel's posts on its weekdays from the first day to the month's end", () => {
        const moments = channelMomentsOf("2026-11-25", [
            { channel: "facebook", postsPerWeek: 3, days: [2, 4, 6], time: "19:30" },
        ])
        expect(moments.map((moment) => moment.day)).toEqual(["2026-11-26", "2026-11-28"])
    })

    it("spreads a rhythm with no weekdays by its count", () => {
        const moments = channelMomentsOf("2026-11-23", [{ channel: "zalo", postsPerWeek: 1, days: [], time: "10:00" }])
        expect(moments.map((moment) => moment.day)).toEqual(["2026-11-25"])
    })

    it("lets channels posting at the same moment share one idea", () => {
        const moments = momentsOf([
            { channel: "facebook", day: "2026-11-26", time: "19:30" },
            { channel: "zalo", day: "2026-11-26", time: "19:30" },
            { channel: "zalo", day: "2026-11-27", time: "10:00" },
        ])
        expect(moments).toEqual([
            { n: 1, day: "2026-11-26", time: "19:30", channels: ["facebook", "zalo"] },
            { n: 2, day: "2026-11-27", time: "10:00", channels: ["zalo"] },
        ])
    })

    it("shares the posts by weight, the remainders to the largest fractions, skipping inactive themes", () => {
        const quota = pillarQuota([pillar("A", 3), pillar("B", 1), pillar("C", 5, false)], 5)
        expect(quota.map((share) => [share.pillar.name, share.count])).toEqual([
            ["A", 4],
            ["B", 1],
        ])
        expect(pillarQuota([], 5)).toEqual([])
    })

    it("never repeats a theme while another has posts left", () => {
        const a = pillar("A", 1)
        const b = pillar("B", 1)
        const sequence = themeSequence(
            [
                { pillar: a, count: 2 },
                { pillar: b, count: 2 },
            ],
            4,
        )
        expect(sequence.map((one) => one.name)).toEqual(["A", "B", "A", "B"])
    })

    it("finds the month's occasions and next month's whose preparation reaches into it", () => {
        expect(occasionsOfMonth("2026-11-01").map((occasion) => occasion.key)).toEqual([
            "double_11",
            "teachers_day",
            "black_friday",
        ])
        expect(occasionsOfMonth("2026-12-01").map((occasion) => occasion.key)).toEqual([
            "double_12",
            "noel",
            "new_year",
        ])
    })

    it("pins an occasion to the last post of its preparation days and names it in the slot line", () => {
        const plan = planMonth(
            "2026-11-16",
            [{ channel: "facebook", postsPerWeek: 3, days: [2, 4, 6], time: "19:30" }],
            [pillar("A", 1)],
        )
        const teachers = plan.slots.find((slot) => slot.occasion?.key === "teachers_day")
        expect(teachers?.day).toBe("2026-11-19")
        expect(teachers === undefined ? "" : slotLineOf(teachers)).toContain("on 2026-11-20")
    })

    it("plans nothing for a brand with no rhythm", () => {
        expect(planMonth("2026-11-16", [], [pillar("A", 1)]).slots).toEqual([])
    })
})
