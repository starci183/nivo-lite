import { Test } from "@nestjs/testing"
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

        expect(latestMissedSlot(missed, new Date("2026-11-10T03:30:00.000Z"), "every_15m")).toEqual(missed)
    })

    it("takes the slot just before the next one when many were missed", async () => {
        const { latestMissedSlot } = await buildSubject()

        expect(
            latestMissedSlot(new Date("2026-11-07T03:00:00.000Z"), new Date("2026-11-10T03:00:00.000Z"), "daily_at"),
        ).toEqual(new Date("2026-11-09T03:00:00.000Z"))
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
