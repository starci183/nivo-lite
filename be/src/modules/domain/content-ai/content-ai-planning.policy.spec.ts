import { Test } from "@nestjs/testing"
import {
    vnToIso as realVnToIso,
    isPlanChannel as realIsPlanChannel,
    parseMonth as realParseMonth,
    vietnamClock as realVietnamClock,
    monthRange as realMonthRange,
    eventsForMonth as realEventsForMonth,
    slotsForMonth as realSlotsForMonth,
    groupSlots as realGroupSlots,
    pillarQuota as realPillarQuota,
    themeSequence as realThemeSequence,
    pinHolidays as realPinHolidays,
    planSlots as realPlanSlots,
} from "./content-ai-planning.policy"
import type { PlanCadence, PlanEvent, PlanPillar, PlanSlot } from "./content-ai-planning.policy"
import { ContentAiError, ContentAiErrorCode } from "./errors/content-ai.error"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("content-ai-planning.policy")

type Subject = Pick<
    typeof import("./content-ai-planning.policy"),
    | "isPlanChannel"
    | "parseMonth"
    | "vietnamClock"
    | "monthRange"
    | "eventsForMonth"
    | "slotsForMonth"
    | "groupSlots"
    | "pillarQuota"
    | "themeSequence"
    | "pinHolidays"
    | "planSlots"
>

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isPlanChannel: realIsPlanChannel,
                    parseMonth: realParseMonth,
                    vietnamClock: realVietnamClock,
                    monthRange: realMonthRange,
                    eventsForMonth: realEventsForMonth,
                    slotsForMonth: realSlotsForMonth,
                    groupSlots: realGroupSlots,
                    pillarQuota: realPillarQuota,
                    themeSequence: realThemeSequence,
                    pinHolidays: realPinHolidays,
                    planSlots: realPlanSlots,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const FIRST: PlanPillar = { id: "first", name: "First", description: "Advice", weight: 2, active: true }

const SECOND: PlanPillar = { id: "second", name: "Second", description: "Stories", weight: 1, active: true }

const CADENCE: PlanCadence = { channel: "facebook", postsPerWeek: 1, days: [1], time: "08:00" }

const holiday = (key: string, date: string, leadDays?: number): PlanEvent => ({
    key,
    date,
    name: key,
    angle: "Appreciation",
    ...(leadDays === undefined ? {} : { leadDays }),
})

const slot = (n: number, date: string): PlanSlot => ({
    n,
    at: `${date}T01:00:00.000Z`,
    channels: ["facebook"],
})

describe("content AI planning policy", () => {
    it.each(["facebook", "zalo", "tiktok", "instagram"])("accepts the %s channel", async (channel) => {
        const subject = await build()

        expect(subject.isPlanChannel(channel)).toBe(true)
    })
    it.each(["Facebook", "", null, 3, {}])("rejects unsupported channel %p", async (channel) => {
        const subject = await build()

        expect(subject.isPlanChannel(channel)).toBe(false)
    })
    it.each([
        ["2020-01", { y: 2020, m: 1 }],
        ["2100-12", { y: 2100, m: 12 }],
        ["2026-06", { y: 2026, m: 6 }],
    ])("parses the supported month %s", async (month, expected) => {
        const subject = await build()

        expect(subject.parseMonth(month)).toEqual(expected)
    })
    it.each(["2026-1", " 2026-01", "2026-01-01", "2026-00", "2026-13", "2019-01", "2101-01"])(
        "rejects invalid month %s",
        async (month) => {
            const subject = await build()

            expect(subject.parseMonth(month)).toBeNull()
        },
    )
    it("converts Vietnam wall clock fields and month boundaries across years", async () => {
        const subject = await build()

        expect(realVnToIso(2027, 1, 1, 0, 15)).toBe("2026-12-31T17:15:00.000Z")
        expect(subject.vietnamClock(new Date("2026-12-31T17:15:00.000Z"))).toEqual({
            y: 2027,
            m: 1,
            day: 1,
            h: 0,
            min: 15,
            dow: 5,
        })
        expect(subject.monthRange(2026, 12)).toEqual({
            from: "2026-11-30T17:00:00.000Z",
            to: "2026-12-31T17:00:00.000Z",
        })
    })
})

describe("content AI planning policy", () => {
    it("includes fixed and lunar events in chronological order with their full editorial metadata", async () => {
        const subject = await build()

        expect(subject.eventsForMonth(2026, 2)).toEqual([
            {
                key: "valentine",
                date: "2026-02-14",
                name: "Valentine's Day 14/2",
                angle: "Gifts and experiences for couples, with advance booking reminders.",
                leadDays: 10,
            },
            {
                key: "tet",
                date: "2026-02-17",
                name: "Tet",
                angle: "Holiday opening hours, wishes, suitable products or services, and advance booking reminders.",
                leadDays: 30,
            },
            {
                key: "women_day",
                date: "2026-03-08",
                name: "International Women's Day 8/3",
                angle: "Appreciation and gift ideas. Mention offers only when the shop actually has them.",
                leadDays: 10,
            },
        ])
    })
})

describe("content AI planning policy", () => {
    it("resolves nth-weekday events and upcoming events whose lead window crosses the month boundary", async () => {
        const subject = await build()

        expect(subject.eventsForMonth(2026, 5).map(({ key, date }) => ({ key, date }))).toEqual([
            { key: "mothers_day", date: "2026-05-10" },
            { key: "children_day", date: "2026-06-01" },
        ])
        expect(subject.eventsForMonth(2026, 11).map(({ key, date }) => ({ key, date }))).toEqual([
            { key: "double_11", date: "2026-11-11" },
            { key: "teachers_day", date: "2026-11-20" },
            { key: "black_friday", date: "2026-11-27" },
        ])
        expect(subject.eventsForMonth(2026, 12).map(({ key, date }) => ({ key, date }))).toEqual([
            { key: "double_12", date: "2026-12-12" },
            { key: "noel", date: "2026-12-24" },
            { key: "new_year", date: "2027-01-01" },
        ])
    })
    it("caps preparation at fourteen days and omits lunar occasions without a known date", async () => {
        const subject = await build()

        expect(subject.eventsForMonth(2026, 1).map(({ key, date }) => ({ key, date }))).toEqual([
            { key: "new_year", date: "2026-01-01" },
        ])
        expect(subject.eventsForMonth(2031, 2).map(({ key, date }) => ({ key, date }))).toEqual([
            { key: "valentine", date: "2031-02-14" },
            { key: "women_day", date: "2031-03-08" },
        ])
    })
    it("retains selected weekdays, includes the exact cutoff, removes disabled channels and sorts times", async () => {
        const subject = await build()

        expect(
            subject.slotsForMonth(
                2026,
                2,
                [
                    { ...CADENCE, channel: "zalo", days: [7], time: "09:30" },
                    { ...CADENCE, days: [7], time: "08:00" },
                    { ...CADENCE, channel: "tiktok", postsPerWeek: 0 },
                ],
                new Date("2026-02-15T01:00:00.000Z"),
            ),
        ).toEqual([
            { channel: "facebook", at: "2026-02-15T01:00:00.000Z" },
            { channel: "zalo", at: "2026-02-15T02:30:00.000Z" },
            { channel: "facebook", at: "2026-02-22T01:00:00.000Z" },
            { channel: "zalo", at: "2026-02-22T02:30:00.000Z" },
        ])
    })
    it.each([1, 1.5])("uses Wednesday defaults for a weekly cadence of %s", async (postsPerWeek) => {
        const subject = await build()

        expect(subject.slotsForMonth(2026, 2, [{ ...CADENCE, postsPerWeek, days: [] }], new Date(0))).toEqual([
            { channel: "facebook", at: "2026-02-04T01:00:00.000Z" },
            { channel: "facebook", at: "2026-02-11T01:00:00.000Z" },
            { channel: "facebook", at: "2026-02-18T01:00:00.000Z" },
            { channel: "facebook", at: "2026-02-25T01:00:00.000Z" },
        ])
    })
})

describe("content AI planning policy", () => {
    it("caps a frequency above seven at every weekday", async () => {
        const subject = await build()

        const result = subject.slotsForMonth(2026, 2, [{ ...CADENCE, postsPerWeek: 9, days: [] }], new Date(0))

        expect(result).toHaveLength(28)
        expect(result[0]).toEqual({ channel: "facebook", at: "2026-02-01T01:00:00.000Z" })
        expect(result.at(-1)).toEqual({ channel: "facebook", at: "2026-02-28T01:00:00.000Z" })
    })
})

describe("content AI planning policy", () => {
    it("groups equal instants, preserves channel order and numbers groups chronologically", async () => {
        const subject = await build()

        expect(
            subject.groupSlots([
                { channel: "tiktok", at: "2026-06-02T01:00:00.000Z" },
                { channel: "facebook", at: "2026-06-01T01:00:00.000Z" },
                { channel: "zalo", at: "2026-06-01T01:00:00.000Z" },
            ]),
        ).toEqual([
            { n: 1, at: "2026-06-01T01:00:00.000Z", channels: ["facebook", "zalo"] },
            { n: 2, at: "2026-06-02T01:00:00.000Z", channels: ["tiktok"] },
        ])
        expect(subject.groupSlots([])).toEqual([])
    })
    it("allocates whole posts by largest remainder and excludes inactive or nonpositive pillars", async () => {
        const subject = await build()

        expect(
            subject.pillarQuota(
                [
                    FIRST,
                    SECOND,
                    { ...FIRST, id: "inactive", active: false },
                    { ...FIRST, id: "zero", weight: 0 },
                    { ...FIRST, id: "negative", weight: -1 },
                ],
                5,
            ),
        ).toEqual([
            { pillar: FIRST, count: 3 },
            { pillar: SECOND, count: 2 },
        ])
        expect(subject.pillarQuota([FIRST], 0)).toEqual([])
        expect(subject.pillarQuota([FIRST], -1)).toEqual([])
        expect(subject.pillarQuota([{ ...FIRST, active: false }], 10)).toEqual([])
    })
    it("breaks equal remainders in input order and leaves exact quotas unchanged", async () => {
        const subject = await build()

        const equal = { ...SECOND, weight: 2 }

        expect(subject.pillarQuota([FIRST, equal], 1)).toEqual([
            { pillar: FIRST, count: 1 },
            { pillar: equal, count: 0 },
        ])
        expect(subject.pillarQuota([FIRST, SECOND], 3)).toEqual([
            { pillar: FIRST, count: 2 },
            { pillar: SECOND, count: 1 },
        ])
    })
})

describe("content AI planning policy", () => {
    it("avoids adjacent themes while another quota remains and stops when all quotas are exhausted", async () => {
        const subject = await build()

        expect(
            subject.themeSequence(
                [
                    { pillar: FIRST, count: 4 },
                    { pillar: SECOND, count: 2 },
                ],
                8,
            ),
        ).toEqual([FIRST, SECOND, FIRST, SECOND, FIRST, FIRST])
        expect(subject.themeSequence([], 2)).toEqual([])
        expect(subject.themeSequence([{ pillar: FIRST, count: 1 }], 0)).toEqual([])
    })
})

describe("content AI planning policy", () => {
    it("pins the last eligible lead slot, then the first following free slot, without reusing slots", async () => {
        const subject = await build()

        expect(
            subject.pinHolidays(
                [slot(1, "2026-06-02"), slot(2, "2026-06-06"), slot(3, "2026-06-08"), slot(4, "2026-06-11")],
                [holiday("first", "2026-06-10", 30), holiday("second", "2026-06-10"), holiday("third", "2026-06-10")],
            ),
        ).toEqual(
            new Map([
                [3, "first"],
                [4, "second"],
            ]),
        )
    })
    it("uses Vietnam dates for the inclusive occasion date, seven-day lead and two-day follow-up bounds", async () => {
        const subject = await build()

        expect(
            subject.pinHolidays(
                [
                    slot(1, "2026-06-02"),
                    slot(2, "2026-06-03"),
                    { n: 3, at: "2026-06-09T17:00:00.000Z", channels: ["facebook"] },
                    slot(4, "2026-06-12"),
                    slot(5, "2026-06-13"),
                ],
                [
                    holiday("on", "2026-06-10"),
                    holiday("before", "2026-06-10", 10),
                    holiday("after", "2026-06-10"),
                    holiday("outside", "2026-06-10"),
                ],
            ),
        ).toEqual(
            new Map([
                [3, "on"],
                [2, "before"],
                [4, "after"],
            ]),
        )
    })
    it("rejects invalid plan months with the domain input code", async () => {
        const subject = await build()

        const plan = () => subject.planSlots("2019-12", [CADENCE], [FIRST], new Date(0))

        expect(plan).toThrow(ContentAiError)
        expect(thrownBy(plan)).toEqual(objectLike({ code: ContentAiErrorCode.InvalidInput }))
    })
})

describe("content AI planning policy", () => {
    it("settles grouped future ideas, quotas, holidays and individual past-channel counts", async () => {
        const subject = await build()

        const plan = subject.planSlots(
            "2026-06",
            [CADENCE, { ...CADENCE, channel: "zalo" }],
            [FIRST, SECOND],
            new Date("2026-06-09T00:00:00.000Z"),
        )

        expect(plan.quota).toEqual([
            { pillar: FIRST, count: 2 },
            { pillar: SECOND, count: 1 },
        ])
        expect(plan.skippedPast).toBe(4)
        expect(plan.events.map(({ key, date }) => ({ key, date }))).toEqual([
            { key: "children_day", date: "2026-06-01" },
            { key: "family_day", date: "2026-06-28" },
        ])
        expect(plan.slots).toEqual([
            { n: 1, at: "2026-06-15T01:00:00.000Z", channels: ["facebook", "zalo"], pillar: FIRST, holiday: null },
            { n: 2, at: "2026-06-22T01:00:00.000Z", channels: ["facebook", "zalo"], pillar: SECOND, holiday: null },
            {
                n: 3,
                at: "2026-06-29T01:00:00.000Z",
                channels: ["facebook", "zalo"],
                pillar: FIRST,
                holiday: plan.events[1],
            },
        ])
    })
    it("omits otherwise valid future slots when no participating pillar can supply a theme", async () => {
        const subject = await build()

        expect(subject.planSlots("2026-07", [CADENCE], [], new Date(0))).toEqual({
            slots: [],
            events: [],
            quota: [],
            skippedPast: 0,
        })
    })
})
