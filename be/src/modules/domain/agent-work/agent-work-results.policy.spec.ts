import { Test } from "@nestjs/testing"
import { contextOf, parseBegin, parseDue, parseFinish, parsePropose } from "./agent-work-results.policy"

const SUBJECT = Symbol("agent-work-results.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { contextOf, parseBegin, parseDue, parseFinish, parsePropose } }],
    }).compile()
    return moduleRef.get<typeof import("./agent-work-results.policy")>(SUBJECT)
}

const begun = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    result: "begun",
    workspaceId: "ws-1",
    fence: 4,
    turnId: "turn-1",
    wakeId: "wake-1",
    source: "tag",
    eventKey: "msg-1",
    context: { messageId: "msg-1", room: "sales", locale: "vi", lookupName: true, extra: "dropped" },
    actorMemberId: "member-1",
    attempts: 2,
    maxAttempts: 3,
    wakeCreatedAt: "2026-11-10T03:00:00.000Z",
    proposal: null,
    ...over,
})

describe("parseBegin", () => {
    it.each(["killed", "busy", "idle"])("reads the quiet answer %s", async (result) => {
        const { parseBegin } = await buildSubject()
        expect(parseBegin({ result }, "agent-1", "agent")).toEqual({ result, ended: [] })
    })

    it("reads a begun turn for the agent and scope it was asked about", async () => {
        const { parseBegin } = await buildSubject()
        expect(parseBegin(begun(), "agent-1", "agent")).toEqual({
            result: "begun",
            ended: [],
            turn: {
                workspaceId: "ws-1",
                agentId: "agent-1",
                scopeKey: "agent",
                fence: 4,
                turnId: "turn-1",
                wakeId: "wake-1",
                source: "tag",
                eventKey: "msg-1",
                context: { messageId: "msg-1", room: "sales", locale: "vi", lookupName: true },
                actorMemberId: "member-1",
                attempts: 2,
                maxAttempts: 3,
                wakeCreatedAt: new Date("2026-11-10T03:00:00.000Z"),
                proposal: null,
            },
        })
    })

    it("carries the proposal an earlier attempt stored and a wake nobody acts for", async () => {
        const { parseBegin } = await buildSubject()
        const answer = parseBegin(begun({ proposal: { reply: "hi" }, actorMemberId: null }), "agent-1", "agent")
        expect(answer).toMatchObject({ result: "begun", turn: { proposal: { reply: "hi" }, actorMemberId: null } })
    })

    it("reads the wakes begin ended: held by a switch or dead, each with its own ids", async () => {
        const { parseBegin } = await buildSubject()
        const ended = (state: string) => ({ ...begun(), state, result: undefined, fence: undefined, turnId: undefined })

        const answer = parseBegin({ result: "killed", ended: [ended("held"), ended("dead")] }, "agent-1", "agent")

        expect(answer).toMatchObject({
            result: "killed",
            ended: [
                {
                    state: "held",
                    wake: { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "agent", wakeId: "wake-1" },
                },
                { state: "dead", wake: { source: "tag", attempts: 2, maxAttempts: 3 } },
            ],
        })
    })

    it.each([
        ["a value that is not an object", "begun"],
        ["an ended list that is not a list", { result: "idle", ended: "none" }],
        ["an ended wake that is not an object", { result: "idle", ended: ["wake-1"] }],
        [
            "an ended wake in a state that is none of the two",
            { result: "idle", ended: [{ ...begun(), state: "done" }] },
        ],
        ["an ended wake with a field missing", { result: "idle", ended: [{ state: "held", wakeId: "wake-1" }] }],
        ["a word that is none of the four", { result: "later" }],
        ["a begun answer without its turn", { result: "begun" }],
        ["an unknown source", begun({ source: "robot" })],
        ["a date that does not parse", begun({ wakeCreatedAt: "not a date" })],
        ["a date that is not text", begun({ wakeCreatedAt: 5 })],
        ["an actor that is a number", begun({ actorMemberId: 7 })],
        ["a fence that is text", begun({ fence: "4" })],
    ])("refuses %s", async (_name, answer) => {
        const { parseBegin } = await buildSubject()

        expect(parseBegin(answer, "agent-1", "agent")).toBeNull()
    })
})

describe("contextOf", () => {
    it("keeps only the keys the contract names, each of its own kind", async () => {
        const { contextOf } = await buildSubject()
        expect(contextOf({ messageId: 7, room: "sales", locale: "de", lookupName: "yes", other: "x" })).toEqual({
            room: "sales",
        })
    })

    it("reads anything that is not an object as an empty context", async () => {
        const { contextOf } = await buildSubject()
        expect(contextOf(null)).toEqual({})
        expect(contextOf("text")).toEqual({})
    })
})

describe("parseFinish", () => {
    it("reads fenced and more", async () => {
        const { parseFinish } = await buildSubject()
        expect(parseFinish({ fenced: false, more: true })).toEqual({ fenced: false, more: true })
    })

    it.each([null, { fenced: true }, { fenced: "no", more: false }, { fenced: false, more: 1 }])(
        "refuses %j",
        async (answer) => {
            const { parseFinish } = await buildSubject()

            expect(parseFinish(answer)).toBeNull()
        },
    )
})

describe("parsePropose", () => {
    it.each(["stored", "fenced", "killed"])("reads %s", async (word) => {
        const { parsePropose } = await buildSubject()
        expect(parsePropose(word)).toBe(word)
    })

    it("refuses any other word", async () => {
        const { parsePropose } = await buildSubject()
        expect(parsePropose("maybe")).toBeNull()
        expect(parsePropose(undefined)).toBeNull()
    })
})

describe("parseDue", () => {
    const row = (over: Record<string, unknown> = {}) => ({
        due_kind: "wake",
        due_agent: "agent-1",
        due_workspace: "ws-1",
        due_scope: "agent",
        due_subject: null,
        due_at: new Date("2026-11-10T03:00:00.000Z"),
        ...over,
    })

    it("reads every kind of row with its subject and moment", async () => {
        const { parseDue } = await buildSubject()
        const rows = ["lease", "wake", "task", "trigger"].map((kind) =>
            row({
                due_kind: kind,
                due_subject: kind === "wake" ? null : "subject-1",
                due_at: "2026-11-10T03:00:00.000Z",
            }),
        )
        expect(parseDue(rows)?.map((due) => [due.kind, due.subjectId, due.at?.toISOString()])).toEqual([
            ["lease", "subject-1", "2026-11-10T03:00:00.000Z"],
            ["wake", null, "2026-11-10T03:00:00.000Z"],
            ["task", "subject-1", "2026-11-10T03:00:00.000Z"],
            ["trigger", "subject-1", "2026-11-10T03:00:00.000Z"],
        ])
    })

    it("reads a moment that is a date and one that is missing", async () => {
        const { parseDue } = await buildSubject()
        expect(parseDue([row(), row({ due_at: null })])?.map((due) => due.at)).toEqual([
            new Date("2026-11-10T03:00:00.000Z"),
            null,
        ])
    })

    it("reads no rows as no work", async () => {
        const { parseDue } = await buildSubject()
        expect(parseDue([])).toEqual([])
    })

    it.each([
        ["a row that is not an object", "x"],
        ["an unknown kind", row({ due_kind: "other" })],
        ["a subject that is a number", row({ due_subject: 3 })],
        ["an agent that is missing", row({ due_agent: undefined })],
        ["a workspace that is missing", row({ due_workspace: undefined })],
        ["a scope that is missing", row({ due_scope: undefined })],
    ])("refuses the whole read for %s", async (_name, bad) => {
        const { parseDue } = await buildSubject()

        expect(parseDue([row(), bad])).toBeNull()
    })
})
