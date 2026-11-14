import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { CLOCK_TICK_TRIGGER as realClock, TIMER_DUE_TRIGGER as realTimer } from "./engine-time.triggers"

const SUBJECT = Symbol("engine-time.triggers")
type Subject = { clock: typeof realClock; timer: typeof realTimer }

const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: { clock: realClock, timer: realTimer } }] }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NO_ACCOUNT = { connectionId: null }

describe("the clock's trigger", () => {
    it("is the engine's clock verb, received from the clock, with no key (every slot its own run)", async () => {
        const { clock } = await buildSubject()

        expect([clock.provider, clock.verb, clock.via, clock.key, clock.settle]).toEqual([PROVIDER.nivo, TRIGGER.clockTick, "clock", { by: "none" }, null])
    })

    it("translates a slot into one event under the slot's old once-key, purely, and fits its schemas", async () => {
        const { clock } = await buildSubject()
        const slot = { triggerId: "t-1", slot: "1762850000000", probeKey: "accounting_close" }

        const event = clock.translate(slot, NO_ACCOUNT)
        expect(event).toEqual({ id: "t-1:1762850000000", data: { triggerId: "t-1", slotMs: 1_762_850_000_000, probeKey: "accounting_close" } })
        expect(clock.translate(slot, NO_ACCOUNT)).toEqual(event)
        expect(event?.subject).toBeUndefined()
        expect(clock.raw.safeParse(slot).success).toBe(true)
        expect(clock.data.safeParse(event?.data).success).toBe(true)
    })

    it("drops a slot that names no row or no instant", async () => {
        const { clock } = await buildSubject()

        expect(clock.translate({ triggerId: "", slot: "1" }, NO_ACCOUNT)).toBeNull()
        expect(clock.translate({ triggerId: "t-1", slot: "soon" }, NO_ACCOUNT)).toBeNull()
    })
})

describe("the timer's trigger", () => {
    it("is the engine's timer verb, keyed by the timer's task", async () => {
        const { timer } = await buildSubject()

        expect([timer.provider, timer.verb, timer.via, timer.key]).toEqual([PROVIDER.nivo, TRIGGER.timerDue, "clock", { by: "data", member: "taskId" }])
    })

    it("translates a due timer into one event under the timer's old once-key, with its ref, its data and the moment", async () => {
        const { timer } = await buildSubject()
        const due = { taskId: "task-1", ref: "pay-1", data: { kind: "payment-reminder" }, dueAt: "2026-11-14T02:00:00.000Z" }

        const event = timer.translate(due, NO_ACCOUNT)
        expect(event).toEqual({
            id: `timer:task-1:${String(Date.parse("2026-11-14T02:00:00.000Z"))}`,
            data: { taskId: "task-1", ref: "pay-1", data: { kind: "payment-reminder" }, dueAt: "2026-11-14T02:00:00.000Z" },
        })
        expect(timer.translate(due, NO_ACCOUNT)).toEqual(event)
        expect(timer.data.safeParse(event?.data).success).toBe(true)
    })

    it("carries who pressed run now, an empty data record when the arm gave none, and drops a timer with no ref or instant", async () => {
        const { timer } = await buildSubject()

        expect(timer.translate({ taskId: "task-1", ref: "r", dueAt: "2026-11-14T02:00:00.000Z", runNowBy: "m-1" }, NO_ACCOUNT)?.data).toEqual({
            taskId: "task-1",
            ref: "r",
            data: {},
            dueAt: "2026-11-14T02:00:00.000Z",
            runNowBy: "m-1",
        })
        expect(timer.translate({ taskId: "task-1", ref: "", dueAt: "2026-11-14T02:00:00.000Z" }, NO_ACCOUNT)).toBeNull()
        expect(timer.translate({ taskId: "task-1", ref: "r", dueAt: "later" }, NO_ACCOUNT)).toBeNull()
    })
})
