import { Test } from "@nestjs/testing"
import {
    AGENT_SCOPE,
    RESTORE_WINDOW_MS,
    TASK_WAKE_MAX_MS,
    TASK_WAKE_MIN_MS,
    attemptBudgetOf,
    awaitsAnswer,
    boundedWakeAt,
    debounceMaxMsOf,
    debounceMsOf,
    burstFor,
    burstSourceOf,
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
                    debounceMaxMsOf,
                    debounceMsOf,
                    burstFor,
                    burstSourceOf,
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
    it("runs a customer before a tag, a tag before an internal event and an internal event before a schedule", async () => {
        const { priorityOf } = await buildSubject()

        expect(priorityOf("customer")).toBeLessThan(priorityOf("tag"))
        expect(priorityOf("tag")).toBeLessThan(priorityOf("internal"))
        expect(priorityOf("internal")).toBeLessThan(priorityOf("schedule"))
    })
})

describe("attemptBudgetOf", () => {
    it("gives a customer two attempts and every other source three", async () => {
        const { attemptBudgetOf } = await buildSubject()

        expect(attemptBudgetOf("customer")).toBe(2)
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
    it("locks a customer conversation by itself", async () => {
        const { scopeKeyOf } = await buildSubject()

        expect(scopeKeyOf("customer", { conversationId: "conv-1" })).toBe("conversation:conv-1")
    })

    it("locks the whole agent for a customer wake that names no conversation and for every other source", async () => {
        const { scopeKeyOf } = await buildSubject()

        expect(scopeKeyOf("customer", {})).toBe(AGENT_SCOPE)
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
    it("runs a customer or tag wake under a day old again", async () => {
        const { restoresHeldWake } = await buildSubject()
        const recent = new Date(NOW.getTime() - RESTORE_WINDOW_MS + 1000)

        expect(restoresHeldWake("customer", recent, NOW)).toBe(true)
        expect(restoresHeldWake("tag", recent, NOW)).toBe(true)
    })

    it("skips a wake that is a day old or older, and every background wake", async () => {
        const { restoresHeldWake } = await buildSubject()
        const old = new Date(NOW.getTime() - RESTORE_WINDOW_MS)

        expect(restoresHeldWake("customer", old, NOW)).toBe(false)
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
    it("is true for a customer only among the four built-in sources", async () => {
        const { awaitsAnswer } = await buildSubject()

        expect(["customer", "tag", "internal", "schedule"].map(awaitsAnswer)).toEqual([true, false, false, false])
    })
})

describe("burst window", () => {
    it("is six seconds unless the app root names another, and never below zero", async () => {
        const { debounceMsOf } = await buildSubject()

        expect([undefined, 5000, 0, -10].map(debounceMsOf)).toEqual([6000, 5000, 0, 0])
    })

    it("waits at most twenty seconds unless the app root names another, and never less than the window", async () => {
        const { debounceMaxMsOf } = await buildSubject()

        expect(debounceMaxMsOf(undefined, 6000)).toBe(20_000)
        expect(debounceMaxMsOf(12_000, 6000)).toBe(12_000)
        expect(debounceMaxMsOf(2000, 6000)).toBe(6000)
    })

    it("names a wake by the kind of tag a flow's trigger lists", async () => {
        const { burstSourceOf } = await buildSubject()

        expect(burstSourceOf({ source: "customer", context: { conversationId: "c1" }, actorMemberId: null })).toBe(
            "channel",
        )
        expect(burstSourceOf({ source: "tag", context: { authorUserId: "u1" }, actorMemberId: "m1" })).toBe(
            "chats-group",
        )
        expect(burstSourceOf({ source: "tag", context: { authorAgentId: "a1" }, actorMemberId: null })).toBe("agent")
        expect(burstSourceOf({ source: "internal", context: {}, actorMemberId: null })).toBe("system-event")
        expect(burstSourceOf({ source: "schedule", context: {}, actorMemberId: null })).toBe("schedule")
    })

    it("takes the window and the longest wait of the flow, else the app's, else the defaults, and never a wait below the window", async () => {
        const { burstFor } = await buildSubject()

        expect(burstFor({ windowMs: 4000, maxWaitMs: 9000 }, { debounceMs: 8000, debounceMaxMs: 30_000 })).toEqual({
            windowMs: 4000,
            maxWaitMs: 9000,
        })
        expect(burstFor({ windowMs: 4000, maxWaitMs: null }, { debounceMs: 8000, debounceMaxMs: 30_000 })).toEqual({
            windowMs: 4000,
            maxWaitMs: 30_000,
        })
        expect(burstFor({ windowMs: 0, maxWaitMs: null }, null)).toEqual({ windowMs: 0, maxWaitMs: 20_000 })
        expect(burstFor(null, { debounceMs: 8000 })).toEqual({ windowMs: 8000, maxWaitMs: 20_000 })
        expect(burstFor(null, null)).toEqual({ windowMs: 6000, maxWaitMs: 20_000 })
        expect(burstFor({ windowMs: 40_000, maxWaitMs: null }, null)).toEqual({ windowMs: 40_000, maxWaitMs: 40_000 })
    })
})
