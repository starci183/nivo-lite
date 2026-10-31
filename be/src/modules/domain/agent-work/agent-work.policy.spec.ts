import { Test } from "@nestjs/testing"
import {
    AGENT_SCOPE,
    RESTORE_WINDOW_MS,
    TASK_WAKE_MAX_MS,
    TASK_WAKE_MIN_MS,
    attemptBudgetOf,
    backgroundCapSpent,
    boundedWakeAt,
    breakerOpen,
    isBackground,
    priorityOf,
    restoresHeldWake,
    retryWaitOf,
    scopeKeyOf,
} from "./agent-work.policy"

const SUBJECT = Symbol("agent-work.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    attemptBudgetOf,
                    backgroundCapSpent,
                    boundedWakeAt,
                    breakerOpen,
                    isBackground,
                    priorityOf,
                    restoresHeldWake,
                    retryWaitOf,
                    scopeKeyOf,
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

describe("isBackground", () => {
    it("is true for the sources nobody waits on", async () => {
        const { isBackground } = await buildSubject()

        expect(isBackground("customer")).toBe(false)
        expect(isBackground("tag")).toBe(false)
        expect(isBackground("internal")).toBe(true)
        expect(isBackground("schedule")).toBe(true)
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

describe("backgroundCapSpent", () => {
    it("is spent when today's count reached the cap", async () => {
        const { backgroundCapSpent } = await buildSubject()

        expect(backgroundCapSpent({ backgroundDay: "2026-11-10", backgroundTurns: 5 }, 5, "2026-11-10")).toBe(true)
    })

    it("is not spent under the cap, or when the count belongs to another day or to no day", async () => {
        const { backgroundCapSpent } = await buildSubject()

        expect(backgroundCapSpent({ backgroundDay: "2026-11-10", backgroundTurns: 4 }, 5, "2026-11-10")).toBe(false)
        expect(backgroundCapSpent({ backgroundDay: "2026-11-09", backgroundTurns: 99 }, 5, "2026-11-10")).toBe(false)
        expect(backgroundCapSpent({ backgroundDay: null, backgroundTurns: 0 }, 5, "2026-11-10")).toBe(false)
    })
})

describe("breakerOpen", () => {
    it("is open until the moment it names", async () => {
        const { breakerOpen } = await buildSubject()

        expect(breakerOpen(new Date(NOW.getTime() + 1), NOW)).toBe(true)
        expect(breakerOpen(NOW, NOW)).toBe(false)
    })

    it("is closed when it was never opened", async () => {
        const { breakerOpen } = await buildSubject()

        expect(breakerOpen(null, NOW)).toBe(false)
    })
})
