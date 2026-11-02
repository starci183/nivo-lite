import { Test } from "@nestjs/testing"
import {
    parseClaim,
    parseCommit,
    parseCompensationClaim,
    parseCompensationCommit,
    parseDue,
    parseEffect,
    parseStep,
} from "./db-results.policy"

const SUBJECT = Symbol("db-results.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    parseClaim,
                    parseCommit,
                    parseCompensationClaim,
                    parseCompensationCommit,
                    parseDue,
                    parseEffect,
                    parseStep,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./db-results.policy")>(SUBJECT)
}

const stepRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    stepId: "s-1",
    runId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    seq: 2,
    stepKey: "door",
    nodeKey: "node-door",
    kind: "door",
    effect: { kind: "compensable", compensation: "close_item" },
    input: { a: 1 },
    status: "running",
    attempt: 1,
    maxAttempts: 3,
    deadlineMs: 1000,
    fence: 4,
    result: null,
    earlier: { turn: { reply: "hi" }, bad: "x" },
    ...over,
})

describe("parseEffect", () => {
    it("reads the three effects", async () => {
        const { parseEffect } = await buildSubject()
        expect(parseEffect({ kind: "read" })).toEqual({ kind: "read" })
        expect(parseEffect({ kind: "pivot" })).toEqual({ kind: "pivot" })
        expect(parseEffect({ kind: "compensable", compensation: "undo" })).toEqual({
            kind: "compensable",
            compensation: "undo",
        })
    })

    it("refuses what is not an effect", async () => {
        const { parseEffect } = await buildSubject()
        expect(parseEffect(null)).toBeNull()
        expect(parseEffect({ kind: "compensable" })).toBeNull()
        expect(parseEffect({ kind: "other" })).toBeNull()
    })
})

describe("parseStep", () => {
    it("reads a step with the results of the steps before it, leaving out what is not a result", async () => {
        const { parseStep } = await buildSubject()
        expect(parseStep(stepRow())).toMatchObject({
            stepKey: "door",
            runId: "run-1",
            status: "running",
            fence: 4,
            result: null,
            earlier: { turn: { reply: "hi" } },
        })
        expect(parseStep(stepRow({ result: { ok: 1 }, earlier: null }))).toMatchObject({
            result: { ok: 1 },
            earlier: {},
        })
    })

    it("refuses a row that lacks a field or carries a status it does not know", async () => {
        const { parseStep } = await buildSubject()
        expect(parseStep(null)).toBeNull()
        expect(parseStep(stepRow({ status: "weird" }))).toBeNull()
        expect(parseStep(stepRow({ fence: "4" }))).toBeNull()
        expect(parseStep(stepRow({ effect: {} }))).toBeNull()
        expect(parseStep(stepRow({ input: "x" }))).toBeNull()
    })
})

describe("parseClaim", () => {
    it("reads a claimed, exhausted or expired-wait step with the step", async () => {
        const { parseClaim } = await buildSubject()
        expect(parseClaim({ result: "claimed", step: stepRow() })?.kind).toBe("claimed")
        expect(parseClaim({ result: "exhausted", step: stepRow() })?.kind).toBe("exhausted")
        expect(parseClaim({ result: "waiting_expired", step: stepRow() })?.kind).toBe("waiting_expired")
    })

    it("refuses a step claim whose step cannot be read", async () => {
        const { parseClaim } = await buildSubject()
        expect(parseClaim({ result: "claimed", step: {} })).toBeNull()
    })

    it("reads the stored answer of a done step, or nothing", async () => {
        const { parseClaim } = await buildSubject()
        expect(parseClaim({ result: "done", answer: { a: 1 } })).toEqual({ kind: "done", answer: { a: 1 } })
        expect(parseClaim({ result: "done", answer: null })).toEqual({ kind: "done", answer: null })
    })

    it("reads the pause of a held step", async () => {
        const { parseClaim } = await buildSubject()
        expect(parseClaim({ result: "later", retryAfterMs: 500 })).toEqual({ kind: "later", retryAfterMs: 500 })
        expect(parseClaim({ result: "later" })).toBeNull()
    })

    it("reads the plain answers and refuses anything else", async () => {
        const { parseClaim } = await buildSubject()
        for (const kind of ["busy", "closed", "idle", "gone"]) {
            expect(parseClaim({ result: kind })).toEqual({ kind })
        }
        expect(parseClaim({ result: "other" })).toBeNull()
        expect(parseClaim({ result: 1 })).toBeNull()
        expect(parseClaim("busy")).toBeNull()
    })
})

describe("parseCompensationClaim", () => {
    it("reads a claimed undo with its step", async () => {
        const { parseCompensationClaim } = await buildSubject()
        expect(parseCompensationClaim({ result: "claimed", step: stepRow() })?.kind).toBe("claimed")
        expect(parseCompensationClaim({ result: "claimed", step: {} })).toBeNull()
    })

    it("reads the plain answers and refuses anything else", async () => {
        const { parseCompensationClaim } = await buildSubject()
        expect(parseCompensationClaim({ result: "finished" })).toEqual({ kind: "finished" })
        expect(parseCompensationClaim({ result: "busy" })).toEqual({ kind: "busy" })
        expect(parseCompensationClaim({ result: "closed" })).toEqual({ kind: "closed" })
        expect(parseCompensationClaim({ result: "x" })).toBeNull()
        expect(parseCompensationClaim(null)).toBeNull()
    })
})

describe("parseCommit and parseCompensationCommit", () => {
    it("read the words the functions answer and nothing else", async () => {
        const { parseCommit, parseCompensationCommit } = await buildSubject()
        expect(parseCommit("ok")).toBe("ok")
        expect(parseCommit("fenced")).toBe("fenced")
        expect(parseCommit("dead")).toBeNull()
        expect(parseCompensationCommit("dead")).toBe("dead")
        expect(parseCompensationCommit("ok")).toBe("ok")
        expect(parseCompensationCommit("fenced")).toBe("fenced")
        expect(parseCompensationCommit(1)).toBeNull()
    })
})

describe("parseDue", () => {
    const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
        due_kind: "expired",
        due_run: "run-1",
        due_workspace: "ws-1",
        due_agent: "agent-1",
        due_step: "door",
        due_fence: "3",
        due_at: new Date("2026-11-01T10:00:00Z"),
        ...over,
    })

    it("reads the rows of the sweep, with the moment as a date", async () => {
        const { parseDue } = await buildSubject()
        expect(parseDue([row(), row({ due_kind: "unspoken", due_at: "2026-11-01T10:01:00Z", due_step: "" })])).toEqual([
            {
                kind: "expired",
                runId: "run-1",
                workspaceId: "ws-1",
                agentId: "agent-1",
                stepKey: "door",
                fence: 3,
                at: new Date("2026-11-01T10:00:00Z"),
            },
            {
                kind: "unspoken",
                runId: "run-1",
                workspaceId: "ws-1",
                agentId: "agent-1",
                stepKey: "",
                fence: 3,
                at: new Date("2026-11-01T10:01:00Z"),
            },
        ])
    })

    it("refuses a result that is not a list of known rows", async () => {
        const { parseDue } = await buildSubject()
        expect(parseDue("x")).toBeNull()
        expect(parseDue([row({ due_kind: "weird" })])).toBeNull()
        expect(parseDue([row({ due_run: 1 })])).toBeNull()
        expect(parseDue([null])).toBeNull()
        expect(parseDue([row({ due_at: 5 })])).toBeNull()
        expect(parseDue([])).toEqual([])
    })
})
