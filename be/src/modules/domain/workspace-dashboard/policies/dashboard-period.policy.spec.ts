import { Test } from "@nestjs/testing"
import {
    chunksOf as realChunksOf,
    dayKeyOf as realDayKeyOf,
    startOfVietnamDay as realStartOfVietnamDay,
    windowOf as realWindowOf,
} from "./dashboard-period.policy"

/** Noon in Vietnam on 9 November 2026. */
const NOW = new Date("2026-11-09T05:00:00.000Z")

const SUBJECT = Symbol("dashboard-period.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    chunksOf: realChunksOf,
                    dayKeyOf: realDayKeyOf,
                    startOfVietnamDay: realStartOfVietnamDay,
                    windowOf: realWindowOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        chunksOf: typeof realChunksOf
        dayKeyOf: typeof realDayKeyOf
        startOfVietnamDay: typeof realStartOfVietnamDay
        windowOf: typeof realWindowOf
    }>(SUBJECT)
}

describe("startOfVietnamDay", () => {
    it("is 17:00 UTC of the day before for any instant of the Vietnam day", async () => {
        const policy = await build()

        expect(policy.startOfVietnamDay(NOW).toISOString()).toBe("2026-11-08T17:00:00.000Z")
        expect(policy.startOfVietnamDay(new Date("2026-11-08T17:00:00.000Z")).toISOString()).toBe(
            "2026-11-08T17:00:00.000Z",
        )
        expect(policy.startOfVietnamDay(new Date("2026-11-08T16:59:59.999Z")).toISOString()).toBe(
            "2026-11-07T17:00:00.000Z",
        )
    })
})

describe("dayKeyOf", () => {
    it("names the Vietnam calendar day of a day's first instant", async () => {
        const policy = await build()

        expect(policy.dayKeyOf(new Date("2026-11-08T17:00:00.000Z"))).toBe("2026-11-09")
    })
})

describe("windowOf", () => {
    it("today: the one Vietnam day, yesterday before it, and the last seven days on the chart", async () => {
        const policy = await build()

        const window = policy.windowOf("today", NOW)

        expect(window.from.toISOString()).toBe("2026-11-08T17:00:00.000Z")
        expect(window.to.toISOString()).toBe("2026-11-09T17:00:00.000Z")
        expect(window.previousFrom.toISOString()).toBe("2026-11-07T17:00:00.000Z")
        expect(window.days.map((day) => day.day)).toEqual([
            "2026-11-03",
            "2026-11-04",
            "2026-11-05",
            "2026-11-06",
            "2026-11-07",
            "2026-11-08",
            "2026-11-09",
        ])
    })

    it("seven days: today and the six before, the seven before them as the comparison", async () => {
        const policy = await build()

        const window = policy.windowOf("last_7_days", NOW)

        expect(window.from.toISOString()).toBe("2026-11-02T17:00:00.000Z")
        expect(window.previousFrom.toISOString()).toBe("2026-10-26T17:00:00.000Z")
        expect(window.days).toHaveLength(7)
        expect(window.days[0]?.from.toISOString()).toBe(window.from.toISOString())
        expect(window.days[6]?.to.toISOString()).toBe(window.to.toISOString())
    })

    it("thirty days: thirty chart days", async () => {
        const policy = await build()

        const window = policy.windowOf("last_30_days", NOW)

        expect(window.days).toHaveLength(30)
        expect(window.days[0]?.day).toBe("2026-10-11")
    })

    it("this month: from the first of the Vietnam month, compared with as many days before it", async () => {
        const policy = await build()

        const window = policy.windowOf("this_month", NOW)

        expect(window.from.toISOString()).toBe("2026-10-31T17:00:00.000Z")
        expect(window.previousFrom.toISOString()).toBe("2026-10-22T17:00:00.000Z")
        expect(window.days.map((day) => day.day)[0]).toBe("2026-11-01")
        expect(window.days).toHaveLength(9)
    })

    it("this month draws the last seven days at the start of the month", async () => {
        const policy = await build()

        const window = policy.windowOf("this_month", new Date("2026-11-02T05:00:00.000Z"))

        expect(window.from.toISOString()).toBe("2026-10-31T17:00:00.000Z")
        expect(window.days).toHaveLength(7)
        expect(window.days[0]?.day).toBe("2026-10-27")
    })

    it("this month keeps every day once the month is longer than a week", async () => {
        const policy = await build()

        const window = policy.windowOf("this_month", new Date("2026-11-20T05:00:00.000Z"))

        expect(window.days).toHaveLength(20)
        expect(window.days[0]?.day).toBe("2026-11-01")
    })
})

describe("chunksOf", () => {
    it("splits in order into runs of at most the size", async () => {
        const policy = await build()

        expect(policy.chunksOf([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
        expect(policy.chunksOf([], 2)).toEqual([])
    })
})
