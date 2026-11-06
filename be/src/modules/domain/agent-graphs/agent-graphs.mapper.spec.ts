import { Test } from "@nestjs/testing"
import {
    decisionEngineRow,
    graphEngineRow,
    proposalEngineRow,
    sourceEngineRow,
    versionEngineRow,
} from "@tests/fixtures/builders/agent-graph-records.builder"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import {
    chunksOf,
    decisionRecordOf,
    graphRecordOf,
    jsonOf,
    proposalRecordOf,
    sourceRecordOf,
    versionRecordOf,
} from "./agent-graphs.mapper"

const SUBJECT = Symbol("agent-graphs.mapper")

/** The mappers as Nest hands them out. */
interface MapperSubject {
    readonly jsonOf: typeof jsonOf
    readonly chunksOf: typeof chunksOf
}

const buildSubject = async (): Promise<MapperSubject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { jsonOf, chunksOf } }],
    }).compile()
    return moduleRef.get<MapperSubject>(SUBJECT)
}

const unreadable = (read: () => unknown): unknown => {
    try {
        read()
        return null
    } catch (cause) {
        return cause instanceof AgentGraphsError ? cause.code : cause
    }
}

describe("the record mappers", () => {
    it("reads a graph with the version of the record as its fence, and a null for an absent nullable", () => {
        expect(graphRecordOf(graphEngineRow({ modeSetBy: undefined, modeSetAt: "2026-11-02T00:00:00.000Z" }))).toEqual({
            id: "graph-1",
            workspaceId: "ws-1",
            fence: "4",
            agentId: "agent-1",
            installationId: "inst-1",
            draft: { nodes: [] },
            draftRev: 3,
            activeVersionId: "version-1",
            mode: "enforced",
            modeSetBy: null,
            modeSetAt: new Date("2026-11-02T00:00:00.000Z"),
        })
    })

    it("reads a version with its number, its time and its kind", () => {
        expect(versionRecordOf(versionEngineRow())).toEqual({
            id: "version-1",
            workspaceId: "ws-1",
            agentId: "agent-1",
            number: 2,
            document: { nodes: [] },
            documentHash: "hash",
            contextVersionId: null,
            changeKind: "edit",
            note: "",
            publishedBy: "member-1",
            publishedAt: new Date("2026-11-01T01:00:00.000Z"),
        })
    })

    it("reads a source, a proposal with its evidence as a list, and a decision with its keys as lists", () => {
        expect(sourceRecordOf(sourceEngineRow())).toMatchObject({ workspaceId: "ws-1", kind: "brain", ref: "fact-1" })
        expect(proposalRecordOf(proposalEngineRow())).toMatchObject({
            id: "p1",
            fence: "4",
            evidence: ["d0"],
            createdAt: new Date("2026-11-01T01:00:00.000Z"),
        })
        expect(decisionRecordOf(decisionEngineRow({ unread: { keys: ["a"] } }))).toMatchObject({
            unread: ["a"],
            path: ["decide", "middle"],
            updatedAt: new Date("2026-11-01T01:00:00.000Z"),
            gateVerdict: "ask",
        })
    })

    it("refuses a record that is not the shape its entity declares", () => {
        expect(unreadable(() => graphRecordOf(graphEngineRow({ mode: "loud" })))).toBe(
            AgentGraphsErrorCode.RecordUnreadable,
        )
        expect(unreadable(() => decisionRecordOf(decisionEngineRow({ path: ["decide"] })))).toBe(
            AgentGraphsErrorCode.RecordUnreadable,
        )
    })
})

describe("the record mappers on a field that is not what its entity declares", () => {
    it.each([
        ["a draft revision that is not a number", () => graphRecordOf(graphEngineRow({ draftRev: "3" }))],
        ["a draft that is not an object", () => graphRecordOf(graphEngineRow({ draft: "x" }))],
        ["an agent that is not text", () => graphRecordOf(graphEngineRow({ agentId: undefined }))],
        ["a flag that is not a boolean", () => proposalRecordOf(proposalEngineRow({ widens: "yes" }))],
        ["evidence that is not a list", () => proposalRecordOf(proposalEngineRow({ evidence: { ids: "d0" } }))],
        ["evidence holding a number", () => proposalRecordOf(proposalEngineRow({ evidence: { ids: [1] } }))],
        ["a fact that is not a scalar", () => decisionRecordOf(decisionEngineRow({ facts: { a: { b: 1 } } }))],
        ["an outcome nobody knows", () => decisionRecordOf(decisionEngineRow({ outcome: "dance" }))],
        ["a closing nobody knows", () => decisionRecordOf(decisionEngineRow({ closedAs: "lost" }))],
    ])("refuses %s", (_name, read) => {
        expect(unreadable(read)).toBe(AgentGraphsErrorCode.RecordUnreadable)
    })

    it("reads an absent nullable enum and an absent time as null", () => {
        expect(decisionRecordOf(decisionEngineRow({ gateVerdict: undefined, closedAs: undefined })).closedAs).toBeNull()
        expect(graphRecordOf(graphEngineRow({ modeSetAt: undefined })).modeSetAt).toBeNull()
    })
})

describe("jsonOf", () => {
    it("keeps plain JSON and leaves out an undefined member, at every depth", async () => {
        const { jsonOf } = await buildSubject()
        expect(jsonOf({ a: 1, b: { c: ["x", null, { d: true, gone: undefined }] }, gone: undefined })).toEqual({
            a: 1,
            b: { c: ["x", null, { d: true }] },
        })
    })

    it("refuses what JSON cannot hold, and a value that is not an object", async () => {
        const { jsonOf } = await buildSubject()
        expect(unreadable(() => jsonOf({ run: () => 1 }))).toBe(AgentGraphsErrorCode.RecordUnreadable)
        expect(unreadable(() => jsonOf([1]))).toBe(AgentGraphsErrorCode.RecordUnreadable)
    })
})

describe("chunksOf", () => {
    it("cuts a list into runs of at most the size, in order, and a list of none into none", async () => {
        const { chunksOf } = await buildSubject()
        expect(chunksOf([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
        expect(chunksOf([], 2)).toEqual([])
    })
})
