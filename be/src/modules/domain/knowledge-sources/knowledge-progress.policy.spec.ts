import { Test } from "@nestjs/testing"
import {
    columnsOf as realColumns,
    embedPercent as realEmbedPercent,
    knowledgeProgressTopic as realTopic,
    progressOfRow as realProgress,
} from "./knowledge-progress.policy"

const SUBJECT = Symbol("knowledge-progress.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [
            {
                provide: SUBJECT,
                useValue: {
                    columnsOf: realColumns,
                    embedPercent: realEmbedPercent,
                    knowledgeProgressTopic: realTopic,
                    progressOfRow: realProgress,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./knowledge-progress.policy")>(SUBJECT)
}

const frame = {
    id: "progress:1",
    kind: "progress",
    sourceId: "s1",
    status: "indexing",
    progress: 40,
    stage: "embed",
    done: 2,
    total: 5,
    error: null,
    chunkCount: 0,
    at: "2026-10-31T10:00:00.000Z",
}

describe("knowledgeProgressTopic", () => {
    it("names the channel of one member in one workspace, the workspace in lower case", async () => {
        const { knowledgeProgressTopic } = await buildSubject()
        expect(knowledgeProgressTopic("u1", "WS-1").name).toBe("knowledge-progress:u1:ws-1")
    })

    it("isolates another member and another workspace", async () => {
        const { knowledgeProgressTopic } = await buildSubject()
        expect(knowledgeProgressTopic("u1", "ws").name).not.toBe(knowledgeProgressTopic("u2", "ws").name)
        expect(knowledgeProgressTopic("u1", "a").name).not.toBe(knowledgeProgressTopic("u1", "b").name)
    })

    it("accepts a progress frame and refuses anything else", async () => {
        const { knowledgeProgressTopic } = await buildSubject()
        const topic = knowledgeProgressTopic("u1", "ws-1")
        expect(topic.accepts(frame)).toBe(true)
        expect(topic.accepts({ ...frame, stage: null, done: null, total: null })).toBe(true)
        expect(topic.accepts({ ...frame, stage: "upload" })).toBe(false)
        expect(topic.accepts({ ...frame, kind: "snapshot" })).toBe(false)
        expect(topic.accepts({ ...frame, id: 3 })).toBe(false)
        expect(topic.accepts({ ...frame, progress: "40" })).toBe(false)
        expect(topic.accepts(null)).toBe(false)
        expect(topic.accepts("progress")).toBe(false)
    })
})

describe("progressOfRow", () => {
    it("names the state of the row for the stream", async () => {
        const { progressOfRow } = await buildSubject()
        expect(
            progressOfRow({
                id: "s1",
                status: "indexing",
                progress: 40,
                stage: "embed",
                stageDone: 2,
                stageTotal: 5,
                error: null,
                chunkCount: 0,
                updatedAt: new Date("2026-10-31T10:00:00.000Z"),
            }),
        ).toEqual({
            sourceId: "s1",
            status: "indexing",
            progress: 40,
            stage: "embed",
            done: 2,
            total: 5,
            error: null,
            chunkCount: 0,
            at: "2026-10-31T10:00:00.000Z",
        })
    })
})

describe("embedPercent", () => {
    it("fills 25 to 80 while the passages get their vectors", async () => {
        const { embedPercent } = await buildSubject()
        expect(embedPercent(0, 4)).toBe(25)
        expect(embedPercent(1, 4)).toBe(38.75)
        expect(embedPercent(4, 4)).toBe(80)
        expect(embedPercent(0, 0)).toBe(25)
    })
})

describe("columnsOf", () => {
    it("writes only the columns the change names", async () => {
        const { columnsOf } = await buildSubject()
        expect(columnsOf({})).toEqual({})
        expect(columnsOf({ status: "failed", error: "CODE", stage: null, done: null, total: null })).toEqual({
            status: "failed",
            error: "CODE",
            stage: null,
            stageDone: null,
            stageTotal: null,
        })
        expect(columnsOf({ stage: "embed", done: 3, total: 9, chunkCount: 9, contentHash: "hash" })).toEqual({
            stage: "embed",
            stageDone: 3,
            stageTotal: 9,
            chunkCount: 9,
            contentHash: "hash",
        })
    })

    it("rounds and clamps the progress bar inside 0 to 100", async () => {
        const { columnsOf } = await buildSubject()
        expect(columnsOf({ progress: 42.4 })).toEqual({ progress: 42 })
        expect(columnsOf({ progress: -3 })).toEqual({ progress: 0 })
        expect(columnsOf({ progress: 140 })).toEqual({ progress: 100 })
    })
})
