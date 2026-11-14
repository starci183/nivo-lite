import { Test } from "@nestjs/testing"
import { graphRow, proposalRow, sourceRow, versionRow } from "@tests/fixtures/builders/agent-graph-records.builder"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import {
    chunksOf,
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
        expect(graphRecordOf(graphRow({ modeSetBy: undefined, modeSetAt: "2026-11-02T00:00:00.000Z" }))).toEqual({
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
        expect(versionRecordOf(versionRow())).toEqual({
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

    it("reads a source and a proposal with its evidence as a list", () => {
        expect(sourceRecordOf(sourceRow())).toMatchObject({ workspaceId: "ws-1", kind: "brain", ref: "fact-1" })
        expect(proposalRecordOf(proposalRow())).toMatchObject({
            id: "p1",
            fence: "4",
            evidence: ["d0"],
            createdAt: new Date("2026-11-01T01:00:00.000Z"),
        })
    })

    it("refuses a record that is not the shape its entity declares", () => {
        expect(unreadable(() => graphRecordOf(graphRow({ mode: "loud" })))).toBe(
            AgentGraphsErrorCode.RecordUnreadable,
        )
    })
})

describe("the record mappers on a field that is not what its entity declares", () => {
    it.each([
        ["a draft revision that is not a number", () => graphRecordOf(graphRow({ draftRev: "3" }))],
        ["a draft that is not an object", () => graphRecordOf(graphRow({ draft: "x" }))],
        ["an agent that is not text", () => graphRecordOf(graphRow({ agentId: undefined }))],
        ["a flag that is not a boolean", () => proposalRecordOf(proposalRow({ widens: "yes" }))],
        ["evidence that is not a list", () => proposalRecordOf(proposalRow({ evidence: { ids: "d0" } }))],
        ["evidence holding a number", () => proposalRecordOf(proposalRow({ evidence: { ids: [1] } }))],
    ])("refuses %s", (_name, read) => {
        expect(unreadable(read)).toBe(AgentGraphsErrorCode.RecordUnreadable)
    })

    it("reads an absent time as null", () => {
        expect(graphRecordOf(graphRow({ modeSetAt: undefined })).modeSetAt).toBeNull()
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
