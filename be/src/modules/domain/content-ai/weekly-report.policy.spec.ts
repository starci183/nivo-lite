import { Test } from "@nestjs/testing"
import * as subject from "./weekly-report.policy"

const { bestDayOf, lastWeekStart, weekBounds, weekDays, weeklyReportOf } = subject

const row = (channel: string, day: string, engagements: number, reach = 100, messages = 1) => ({
    channel,
    day,
    reach,
    engagements,
    messages,
})

describe("lastWeekStart", () => {
    it("is the Monday of the last complete Vietnam week", () => {
        // Monday 2026-10-19 10:00 in Vietnam.
        expect(lastWeekStart(new Date("2026-10-19T03:00:00.000Z"))).toBe("2026-10-12")
        // Sunday 2026-10-18 23:30 in Vietnam is still in the week of the 12th.
        expect(lastWeekStart(new Date("2026-10-18T16:30:00.000Z"))).toBe("2026-10-05")
    })
})

describe("weekDays and weekBounds", () => {
    it("lists the seven days and the neighbouring week starts", () => {
        expect(weekDays("2026-10-12")).toEqual([
            "2026-10-12",
            "2026-10-13",
            "2026-10-14",
            "2026-10-15",
            "2026-10-16",
            "2026-10-17",
            "2026-10-18",
        ])
        expect(weekBounds("2026-10-12")).toEqual({ previousStart: "2026-10-05", nextStart: "2026-10-19" })
    })
})

describe("weeklyReportOf", () => {
    it("sums this week against the week before and charts engagements per day and channel", () => {
        const report = weeklyReportOf("2026-10-12", [
            row("facebook", "2026-10-12", 10, 200, 3),
            row("zalo", "2026-10-12", 4, 50, 2),
            row("facebook", "2026-10-18", 6),
            row("facebook", "2026-10-06", 8, 100, 0),
            row("facebook", "2026-09-01", 99),
        ])

        expect(report.weekEnd).toBe("2026-10-18")
        expect(report.channels).toEqual(["facebook", "zalo"])
        expect(report.reach).toEqual({ value: 350, previous: 100, changePct: 250 })
        expect(report.engagements).toEqual({ value: 20, previous: 8, changePct: 150 })
        expect(report.messages).toEqual({ value: 6, previous: 0, changePct: null })
        expect(report.days[0]).toEqual({
            day: "2026-10-12",
            byChannel: { facebook: 10, zalo: 4 },
            channels: [
                { channel: "facebook", value: 10 },
                { channel: "zalo", value: 4 },
            ],
        })
        expect(report.days[1]?.byChannel).toEqual({ facebook: 0, zalo: 0 })
        expect(bestDayOf(report)).toEqual({ day: "2026-10-12", channel: "facebook" })
    })

    it("is an empty week without rows", () => {
        const report = weeklyReportOf("2026-10-12", [])

        expect(report.channels).toEqual([])
        expect(report.days).toHaveLength(7)
        expect(bestDayOf(report)).toBeNull()
    })

    it("keeps the first best day on a tie and ignores zero days", () => {
        const report = weeklyReportOf("2026-10-12", [
            row("facebook", "2026-10-13", 5),
            row("zalo", "2026-10-14", 5),
            row("zalo", "2026-10-15", 0),
        ])

        expect(bestDayOf(report)).toEqual({ day: "2026-10-13", channel: "facebook" })
    })
})

const SUBJECT = Symbol("weekly-report.policy")
const POLICY = { bestDayOf, lastWeekStart, weekBounds, weekDays, weeklyReportOf }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: POLICY }],
    }).compile()
    return moduleRef.get<typeof import("./weekly-report.policy")>(SUBJECT)
}

describe("weekly-report policy module", () => {
    it("is provided to Nest as a value", async () => {
        const built = await buildSubject()

        expect(built.bestDayOf).toBe(bestDayOf)
    })
})
