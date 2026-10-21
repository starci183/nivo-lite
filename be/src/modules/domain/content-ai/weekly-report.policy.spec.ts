import { Test } from "@nestjs/testing"
import {
    bestDayOf,
    isCacheFresh,
    isWeeklyPostDue,
    lastWeekStart,
    weekBounds,
    weekDays,
    weeklyReportOf,
} from "./weekly-report.policy"

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
        const report = weeklyReportOf(
            "2026-10-12",
            [
                row("facebook", "2026-10-12", 10, 200, 3),
                row("zalo", "2026-10-12", 4, 50, 2),
                row("facebook", "2026-10-18", 6),
                row("facebook", "2026-10-06", 8, 100, 0),
                row("facebook", "2026-09-01", 99),
            ],
            [],
        )

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
        const report = weeklyReportOf("2026-10-12", [], [])

        expect(report.channels).toEqual([])
        expect(report.days).toHaveLength(7)
        expect(report.posts).toEqual([])
        expect(report.postCount).toBe(0)
        expect(report.suggestion).toBeNull()
        expect(bestDayOf(report)).toBeNull()
    })

    it("keeps the first best day on a tie and ignores zero days", () => {
        const report = weeklyReportOf(
            "2026-10-12",
            [row("facebook", "2026-10-13", 5), row("zalo", "2026-10-14", 5), row("zalo", "2026-10-15", 0)],
            [],
        )

        expect(bestDayOf(report)).toEqual({ day: "2026-10-13", channel: "facebook" })
    })
})

const post = (id: string, publishedAt: string, engagements: number, message = `Post ${id}`) => ({
    id,
    channel: "facebook",
    message,
    publishedAt,
    engagements,
    href: id === "p1" ? "https://facebook.com/p1" : null,
})

describe("weeklyReportOf / posts", () => {
    it("ranks the posts of the Vietnam week by engagements, then the newest, and keeps the top four", () => {
        const report = weeklyReportOf(
            "2026-10-12",
            [],
            [
                post("p1", "2026-10-18T02:00:00.000Z", 356, "  Relax at HAKUEN \n15 second video\n#spa"),
                post("p2", "2026-10-17T02:00:00.000Z", 284),
                post("p3", "2026-10-15T11:00:00.000Z", 241),
                post("p4", "2026-10-14T02:00:00.000Z", 138),
                post("p5", "2026-10-13T02:00:00.000Z", 138),
                post("early", "2026-10-11T16:59:00.000Z", 999),
                post("late", "2026-10-18T17:00:00.000Z", 999),
                post("bad", "not a date", 999),
            ],
        )

        expect(report.postCount).toBe(5)
        expect(report.posts.map((entry) => entry.id)).toEqual(["p1", "p2", "p3", "p4"])
        expect(report.posts[0]).toEqual({
            id: "p1",
            channel: "facebook",
            title: "Relax at HAKUEN",
            publishedAt: "2026-10-18T02:00:00.000Z",
            engagements: 356,
            href: "https://facebook.com/p1",
        })
        expect(report.posts[3]?.href).toBeNull()
    })

    it("counts a post published at Monday 00:00 in Vietnam into the week", () => {
        const report = weeklyReportOf("2026-10-12", [], [post("p1", "2026-10-11T17:00:00.000Z", 1)])

        expect(report.posts.map((entry) => entry.id)).toEqual(["p1"])
    })
})

describe("isCacheFresh", () => {
    const NOW = new Date("2026-10-20T07:00:00.000Z")

    it("keeps extras computed after the week ended (Vietnam midnight of its next Monday)", () => {
        expect(isCacheFresh("2026-10-18T17:00:00.000Z", "2026-10-19", NOW)).toBe(true)
        expect(isCacheFresh("2026-10-18T16:59:00.000Z", "2026-10-19", NOW)).toBe(false)
    })

    it("keeps extras of a running week for an hour, and never extras not computed yet", () => {
        expect(isCacheFresh("2026-10-20T06:01:00.000Z", "2026-10-26", NOW)).toBe(true)
        expect(isCacheFresh("2026-10-20T06:00:00.000Z", "2026-10-26", NOW)).toBe(false)
        expect(isCacheFresh(null, "2026-10-19", NOW)).toBe(false)
    })
})

describe("isWeeklyPostDue", () => {
    it("is due from Monday 08:00 Vietnam time on, through the rest of the week", () => {
        expect(isWeeklyPostDue(new Date("2026-10-19T00:59:59.000Z"))).toBe(false)
        expect(isWeeklyPostDue(new Date("2026-10-19T01:00:00.000Z"))).toBe(true)
        expect(isWeeklyPostDue(new Date("2026-10-25T16:59:00.000Z"))).toBe(true)
    })
})

const SUBJECT = Symbol("weekly-report.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    bestDayOf,
                    isCacheFresh,
                    isWeeklyPostDue,
                    lastWeekStart,
                    weekBounds,
                    weekDays,
                    weeklyReportOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./weekly-report.policy")>(SUBJECT)
}

describe("weekly-report policy module", () => {
    it("is provided to Nest as a value", async () => {
        const built = await buildSubject()

        expect(built.bestDayOf).toBe(bestDayOf)
    })
})
