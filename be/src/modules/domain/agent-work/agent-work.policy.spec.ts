import { Test } from "@nestjs/testing"
import {
    AGENT_SCOPE,
    RESTORE_WINDOW_MS,
    TASK_WAKE_MAX_MS,
    TASK_WAKE_MIN_MS,
    attemptBudgetOf,
    awaitsAnswer,
    boundedWakeAt,
    burstFor,
    priorityOf,
    restoresHeldWake,
    retryWaitOf,
    scopeKeyOf,
    wakeProgressOf,
} from "./agent-work.policy"

const SUBJECT = Symbol("agent-work.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    attemptBudgetOf,
                    awaitsAnswer,
                    boundedWakeAt,
                    burstFor,
                    priorityOf,
                    restoresHeldWake,
                    retryWaitOf,
                    scopeKeyOf,
                    wakeProgressOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./agent-work.policy")>(SUBJECT)
}

const NOW = new Date("2026-11-10T03:00:00.000Z")

describe("priorityOf", () => {
    it("runs a pipeline event before a tag, a tag before an internal event and an internal event before a schedule", async () => {
        const { priorityOf } = await buildSubject()

        expect(priorityOf("trigger")).toBeLessThan(priorityOf("tag"))
        expect(priorityOf("tag")).toBeLessThan(priorityOf("internal"))
        expect(priorityOf("internal")).toBeLessThan(priorityOf("schedule"))
    })
})

describe("attemptBudgetOf", () => {
    it("gives every built-in source three attempts", async () => {
        const { attemptBudgetOf } = await buildSubject()

        expect(attemptBudgetOf("trigger")).toBe(3)
        expect(attemptBudgetOf("tag")).toBe(3)
        expect(attemptBudgetOf("internal")).toBe(3)
        expect(attemptBudgetOf("schedule")).toBe(3)
    })
})

describe("retryWaitOf", () => {
    it("waits one, five and fifteen minutes after the first, second and third failure", async () => {
        const { retryWaitOf } = await buildSubject()

        expect([1, 2, 3].map(retryWaitOf)).toEqual([60, 300, 900])
    })

    it("keeps the longest wait for later attempts and the shortest for an attempt below one", async () => {
        const { retryWaitOf } = await buildSubject()

        expect(retryWaitOf(9)).toBe(900)
        expect(retryWaitOf(0)).toBe(60)
    })
})

describe("scopeKeyOf", () => {
    it("locks the whole agent for every built-in source, a conversation named or not (a pipeline wake names its own key)", async () => {
        const { scopeKeyOf } = await buildSubject()

        expect(scopeKeyOf("trigger", { conversationId: "conv-1" })).toBe(AGENT_SCOPE)
        expect(scopeKeyOf("tag", { conversationId: "conv-1" })).toBe(AGENT_SCOPE)
        expect(scopeKeyOf("internal", {})).toBe(AGENT_SCOPE)
        expect(scopeKeyOf("schedule", {})).toBe(AGENT_SCOPE)
    })
})

describe("boundedWakeAt", () => {
    it("keeps a wake time inside the window as it was asked", async () => {
        const { boundedWakeAt } = await buildSubject()
        const asked = new Date(NOW.getTime() + 60 * 60_000)

        expect(boundedWakeAt(asked, NOW)).toEqual(asked)
    })

    it("pulls a wake time that is too soon, or already past, to five minutes ahead", async () => {
        const { boundedWakeAt } = await buildSubject()
        const earliest = new Date(NOW.getTime() + TASK_WAKE_MIN_MS)

        expect(boundedWakeAt(new Date(NOW.getTime() + 1000), NOW)).toEqual(earliest)
        expect(boundedWakeAt(new Date(NOW.getTime() - 1000), NOW)).toEqual(earliest)
    })

    it("pushes a wake time beyond a week back to seven days ahead", async () => {
        const { boundedWakeAt } = await buildSubject()

        expect(boundedWakeAt(new Date(NOW.getTime() + 30 * 24 * 60 * 60_000), NOW)).toEqual(
            new Date(NOW.getTime() + TASK_WAKE_MAX_MS),
        )
    })
})

describe("restoresHeldWake", () => {
    it("runs a pipeline or tag wake under a day old again", async () => {
        const { restoresHeldWake } = await buildSubject()
        const recent = new Date(NOW.getTime() - RESTORE_WINDOW_MS + 1000)

        expect(restoresHeldWake("trigger", recent, NOW)).toBe(true)
        expect(restoresHeldWake("tag", recent, NOW)).toBe(true)
    })

    it("skips a wake that is a day old or older, and every background wake", async () => {
        const { restoresHeldWake } = await buildSubject()
        const old = new Date(NOW.getTime() - RESTORE_WINDOW_MS)

        expect(restoresHeldWake("trigger", old, NOW)).toBe(false)
        expect(restoresHeldWake("internal", NOW, NOW)).toBe(false)
        expect(restoresHeldWake("schedule", NOW, NOW)).toBe(false)
    })
})

describe("wakeProgressOf", () => {
    it("tells waiting, running, done and failed wakes in the words of a job", async () => {
        const { wakeProgressOf } = await buildSubject()

        expect(wakeProgressOf("pending")).toBe("queued")
        expect(wakeProgressOf("held")).toBe("queued")
        expect(wakeProgressOf("running")).toBe("running")
        expect(wakeProgressOf("done")).toBe("done")
        expect(wakeProgressOf("skipped")).toBe("done")
        expect(wakeProgressOf("dead")).toBe("failed")
        expect(wakeProgressOf("failed")).toBe("failed")
    })
})

describe("a source the table does not know", () => {
    it("has no priority or budget, does not restore and does not await an answer", async () => {
        const { priorityOf, attemptBudgetOf, restoresHeldWake, awaitsAnswer } = await buildSubject()

        expect(() => priorityOf("unrecorded")).toThrow()
        expect(() => attemptBudgetOf("unrecorded")).toThrow()
        expect(restoresHeldWake("unrecorded", NOW, NOW)).toBe(false)
        expect(awaitsAnswer("unrecorded")).toBe(false)
    })
})

describe("awaitsAnswer", () => {
    it("is false for every built-in source (only an inbound adapter may declare it)", async () => {
        const { awaitsAnswer } = await buildSubject()

        expect(["trigger", "tag", "internal", "schedule"].map(awaitsAnswer)).toEqual([false, false, false, false])
    })
})

describe("burstFor: the settle time of a wake, from its source's declaration", () => {
    it("keeps the declared window and longest wait, never a wait below the window, and a window never below zero", async () => {
        const { burstFor } = await buildSubject()

        expect(burstFor({ windowMs: 6000, maxWaitMs: 20_000 })).toEqual({ windowMs: 6000, maxWaitMs: 20_000 })
        expect(burstFor({ windowMs: 4000, maxWaitMs: null })).toEqual({ windowMs: 4000, maxWaitMs: 4000 })
        expect(burstFor({ windowMs: 40_000, maxWaitMs: 9000 })).toEqual({ windowMs: 40_000, maxWaitMs: 40_000 })
        expect(burstFor({ windowMs: -5, maxWaitMs: null })).toEqual({ windowMs: 0, maxWaitMs: 0 })
    })
})
