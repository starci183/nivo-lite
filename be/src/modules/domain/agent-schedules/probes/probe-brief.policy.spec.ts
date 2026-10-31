import { Test } from "@nestjs/testing"
import type { AgentGoalRecord, AgentTaskRecord } from "@modules/domain/agent-work"
import { dueBriefOf, dueWorkOf, listOf } from "./probe-brief.policy"

const SUBJECT = Symbol("probe-brief.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { dueBriefOf, dueWorkOf, listOf } }],
    }).compile()
    return moduleRef.get<{ dueBriefOf: typeof dueBriefOf; dueWorkOf: typeof dueWorkOf; listOf: typeof listOf }>(SUBJECT)
}

const NOW = new Date("2026-11-10T03:00:00.000Z")
const AT = (minutes: number): Date => new Date(NOW.getTime() + minutes * 60_000)

const task = (over: Partial<AgentTaskRecord> = {}): AgentTaskRecord => ({
    id: "task-1",
    agentId: "agent-1",
    goalId: null,
    dedupeKey: "chase",
    title: "Chase invoice 12",
    detail: "",
    status: "open",
    waitingOn: null,
    nextActionAt: AT(-5),
    workItemId: null,
    ...over,
})

const goal = (over: Partial<AgentGoalRecord> = {}): AgentGoalRecord => ({
    id: "goal-1",
    agentId: "agent-1",
    title: "Keep receivables under 30 days",
    detail: "",
    status: "active",
    source: "owner",
    dueAt: AT(-60),
    reviewedAt: null,
    ...over,
})

describe("dueWorkOf", () => {
    it("keeps an open task whose wake time has come", async () => {
        const { dueWorkOf } = await buildSubject()

        const due = dueWorkOf(
            [
                task(),
                task({ id: "later", nextActionAt: AT(5) }),
                task({ id: "unset", nextActionAt: null }),
                task({ id: "parked", status: "waiting" }),
            ],
            [],
            NOW,
        )

        expect(due.tasks.map((found) => found.id)).toEqual(["task-1"])
    })

    it("keeps an active goal that passed its date unreviewed, or reviewed before the date", async () => {
        const { dueWorkOf } = await buildSubject()

        const due = dueWorkOf(
            [],
            [
                goal(),
                goal({ id: "stale", reviewedAt: AT(-120) }),
                goal({ id: "reviewed", reviewedAt: AT(-30) }),
                goal({ id: "future", dueAt: AT(60) }),
                goal({ id: "undated", dueAt: null }),
                goal({ id: "paused", status: "paused" }),
            ],
            NOW,
        )

        expect(due.goals.map((found) => found.id)).toEqual(["goal-1", "stale"])
    })
})

describe("dueBriefOf", () => {
    it("names the tasks and the goals that are due", async () => {
        const { dueBriefOf } = await buildSubject()

        expect(dueBriefOf({ tasks: [task()], goals: [goal()] })).toBe(
            "Tasks due: Chase invoice 12. Goals past their date: Keep receivables under 30 days.",
        )
        expect(dueBriefOf({ tasks: [task()], goals: [] })).toBe("Tasks due: Chase invoice 12.")
        expect(dueBriefOf({ tasks: [], goals: [goal()] })).toBe(
            "Goals past their date: Keep receivables under 30 days.",
        )
    })
})

describe("listOf", () => {
    it("lists the first five names and counts the rest, cutting a long title", async () => {
        const { listOf } = await buildSubject()

        expect(listOf(["a", "b"])).toBe("a; b")
        expect(listOf(["a", "b", "c", "d", "e", "f", "g"])).toBe("a; b; c; d; e; and 2 more")
        expect(listOf(["x".repeat(100)])).toBe(`${"x".repeat(80)}...`)
    })
})
