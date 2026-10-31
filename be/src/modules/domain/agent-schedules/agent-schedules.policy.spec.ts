import { Test } from "@nestjs/testing"
import type { AgentTriggerPreset } from "@modules/domain/agent-work"
import {
    MIN_PERIOD_MINUTES,
    isMissed,
    latestMissedSlot,
    offsetMinutesOf,
    periodMsOf,
    scheduleOf,
    triggersOfModule,
    wakeKeyOf,
} from "./agent-schedules.policy"

const SUBJECT = Symbol("agent-schedules.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isMissed,
                    latestMissedSlot,
                    offsetMinutesOf,
                    periodMsOf,
                    scheduleOf,
                    triggersOfModule,
                    wakeKeyOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        isMissed: typeof isMissed
        latestMissedSlot: typeof latestMissedSlot
        offsetMinutesOf: typeof offsetMinutesOf
        periodMsOf: typeof periodMsOf
        scheduleOf: typeof scheduleOf
        triggersOfModule: typeof triggersOfModule
        wakeKeyOf: typeof wakeKeyOf
    }>(SUBJECT)
}

const slotted = (
    preset: AgentTriggerPreset,
    over: Partial<Parameters<typeof scheduleOf>[0]> = {},
): Parameters<typeof latestMissedSlot>[2] => ({ ...clock(over), preset })

const clock = (over: Partial<Parameters<typeof scheduleOf>[0]> = {}): Parameters<typeof scheduleOf>[0] => ({
    kind: "schedule",
    preset: "daily_at",
    atTime: "08:00",
    timeZone: "Asia/Ho_Chi_Minh",
    ...over,
})

// "x" spreads to minute 0, "agent-9" to 6 and "agent-1" to 13.
describe("offsetMinutesOf", () => {
    it("spreads an agent over the first quarter hour, the same minute every time", async () => {
        const { offsetMinutesOf } = await buildSubject()

        expect(offsetMinutesOf("x")).toBe(0)
        expect(offsetMinutesOf("agent-9")).toBe(6)
        expect(offsetMinutesOf("agent-1")).toBe(13)
        expect(offsetMinutesOf("agent-1")).toBe(offsetMinutesOf("agent-1"))
    })
})

describe("scheduleOf", () => {
    it("fires every quarter hour on the agent's spread minute", async () => {
        const { scheduleOf } = await buildSubject()

        expect(scheduleOf(clock({ preset: "every_15m", atTime: null }), "agent-9")).toEqual({
            pattern: "6,21,36,51 * * * *",
            tz: "Asia/Ho_Chi_Minh",
        })
    })

    it("fires hourly on the spread minute", async () => {
        const { scheduleOf } = await buildSubject()

        expect(scheduleOf(clock({ preset: "hourly", atTime: null }), "agent-9")?.pattern).toBe("6 * * * *")
    })

    it("adds the spread minute to the owner's time of day", async () => {
        const { scheduleOf } = await buildSubject()

        expect(scheduleOf(clock(), "agent-1")).toEqual({ pattern: "13 8 * * *", tz: "Asia/Ho_Chi_Minh" })
        expect(scheduleOf(clock({ preset: "weekdays_at", atTime: "17:30" }), "x")?.pattern).toBe("30 17 * * 1-5")
    })

    it("moves a weekday time pushed past midnight to the next day", async () => {
        const { scheduleOf } = await buildSubject()

        expect(scheduleOf(clock({ preset: "weekdays_at", atTime: "23:55" }), "agent-1")?.pattern).toBe("8 0 * * 2-6")
        expect(scheduleOf(clock({ atTime: "23:55" }), "agent-1")?.pattern).toBe("8 0 * * *")
    })

    it("answers nothing for an event, a missing preset or a daily time that is not HH:MM", async () => {
        const { scheduleOf } = await buildSubject()

        expect(scheduleOf(clock({ kind: "event", preset: null }), "x")).toBeNull()
        expect(scheduleOf(clock({ preset: null }), "x")).toBeNull()
        expect(scheduleOf(clock({ atTime: null }), "x")).toBeNull()
        expect(scheduleOf(clock({ atTime: "8am" }), "x")).toBeNull()
    })
})

describe("periodMsOf", () => {
    it("is never under the fifteen minute floor", async () => {
        const { periodMsOf } = await buildSubject()

        for (const preset of ["every_15m", "hourly", "daily_at", "weekdays_at"] as const) {
            expect(periodMsOf(preset)).toBeGreaterThanOrEqual(MIN_PERIOD_MINUTES * 60_000)
        }
        expect(periodMsOf("hourly")).toBe(3_600_000)
    })
})

describe("latestMissedSlot", () => {
    it("keeps the remembered slot when it is the only one missed", async () => {
        const { latestMissedSlot } = await buildSubject()
        const missed = new Date("2026-11-10T03:15:00.000Z")

        expect(latestMissedSlot(missed, new Date("2026-11-10T03:30:00.000Z"), slotted("every_15m"), "x")).toEqual(
            missed,
        )
    })

    it("takes the slot just before the next one when many were missed", async () => {
        const { latestMissedSlot } = await buildSubject()

        expect(
            latestMissedSlot(
                new Date("2026-11-07T03:00:00.000Z"),
                new Date("2026-11-10T03:00:00.000Z"),
                slotted("daily_at"),
                "x",
            ),
        ).toEqual(new Date("2026-11-09T03:00:00.000Z"))
    })
})

describe("latestMissedSlot, a weekday preset", () => {
    // 08:00 in Ho Chi Minh is 01:00 UTC; agent "x" has no spread. 2026-11-13 is a Friday, 2026-11-16 a Monday.
    it("falls back to the Friday before a Monday, never the Sunday", async () => {
        const { latestMissedSlot } = await buildSubject()
        const friday = new Date("2026-11-13T01:00:00.000Z")

        expect(
            latestMissedSlot(
                new Date("2026-11-06T01:00:00.000Z"),
                new Date("2026-11-16T01:00:00.000Z"),
                slotted("weekdays_at"),
                "x",
            ),
        ).toEqual(friday)
    })

    it("steps back one day in the middle of the week", async () => {
        const { latestMissedSlot } = await buildSubject()

        expect(
            latestMissedSlot(
                new Date("2026-11-02T01:00:00.000Z"),
                new Date("2026-11-12T01:00:00.000Z"),
                slotted("weekdays_at"),
                "x",
            ),
        ).toEqual(new Date("2026-11-11T01:00:00.000Z"))
    })

    it("follows a time pushed past midnight, whose days are Tuesday to Saturday", async () => {
        const { latestMissedSlot } = await buildSubject()
        // 23:55 + spread 13 (agent-1) is 00:08 the next day: slots 00:08 local, Tue-Sat. Tuesday 2026-11-17 00:08 +07 is Monday 17:08 UTC.
        const saturday = new Date("2026-11-13T17:08:00.000Z")

        expect(
            latestMissedSlot(
                new Date("2026-11-01T17:08:00.000Z"),
                new Date("2026-11-16T17:08:00.000Z"),
                slotted("weekdays_at", { atTime: "23:55" }),
                "agent-1",
            ),
        ).toEqual(saturday)
    })

    it("keeps the local time across a change of offset", async () => {
        const { latestMissedSlot } = await buildSubject()
        // New York leaves daylight time on 2026-11-01: 08:00 is 12:00 UTC before and 13:00 UTC after. Monday 2026-11-02 08:00 EST.
        const slot = latestMissedSlot(
            new Date("2026-10-20T12:00:00.000Z"),
            new Date("2026-11-02T13:00:00.000Z"),
            slotted("weekdays_at", { timeZone: "America/New_York" }),
            "x",
        )

        expect(slot).toEqual(new Date("2026-10-30T12:00:00.000Z"))
    })

    it("treats a daily preset with no time as one day back", async () => {
        const { latestMissedSlot } = await buildSubject()

        expect(
            latestMissedSlot(
                new Date("2026-11-01T01:00:00.000Z"),
                new Date("2026-11-12T01:00:00.000Z"),
                slotted("weekdays_at", { atTime: null }),
                "x",
            ),
        ).toEqual(new Date("2026-11-11T01:00:00.000Z"))
    })
})

describe("isMissed", () => {
    it("is late by more than two minutes", async () => {
        const { isMissed } = await buildSubject()
        const now = new Date("2026-11-10T03:10:00.000Z")

        expect(isMissed(new Date("2026-11-10T03:07:00.000Z"), now)).toBe(true)
        expect(isMissed(new Date("2026-11-10T03:08:00.000Z"), now)).toBe(false)
    })
})

describe("wakeKeyOf", () => {
    it("keys the wake of a fact by its event and business key, so a replay is one wake", async () => {
        const { wakeKeyOf } = await buildSubject()

        expect(wakeKeyOf("bank_credit_booked", "tx-1")).toBe("bank_credit_booked:tx-1")
        expect(wakeKeyOf("bank_credit_booked", "tx-1")).toBe(wakeKeyOf("bank_credit_booked", "tx-1"))
    })
})

describe("triggersOfModule", () => {
    const catalog = [
        { key: "accounting", triggers: [{ key: "morning", preset: "daily_at" as const, atTime: "08:00" }] },
        { key: "chatbot" },
    ]

    it("answers the triggers a module declares, and none for a module that declares none or is not in the catalogue", async () => {
        const { triggersOfModule } = await buildSubject()

        expect(triggersOfModule(catalog, "accounting")).toEqual([
            { key: "morning", preset: "daily_at", atTime: "08:00" },
        ])
        expect(triggersOfModule(catalog, "chatbot")).toEqual([])
        expect(triggersOfModule(catalog, "unknown")).toEqual([])
    })
})
