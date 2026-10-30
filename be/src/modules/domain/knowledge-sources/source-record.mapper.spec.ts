import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { KnowledgeSourceEntity } from "./persistence/entities"
import { toSourceRecord, toSourceSummary, toSourceDetail } from "./source-record.mapper"

const SUBJECT = Symbol("source-record.mapper")
type Subject = {
    toSourceRecord: typeof toSourceRecord
    toSourceSummary: typeof toSourceSummary
    toSourceDetail: typeof toSourceDetail
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    toSourceRecord,
                    toSourceSummary,
                    toSourceDetail,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const rowOf = builder<KnowledgeSourceEntity>({
    id: "s1",
    workspaceId: "w1",
    module: null,
    installationId: null,
    kind: "url",
    topic: "t",
    tags: [],
    visibility: "public",
    title: "Title",
    content: "https://x.test",
    status: "queued",
    error: null,
    chunkCount: 0,
    progress: 0,
    storagePath: null,
    sourceUrl: "https://x.test",
    origin: null,
    sizeBytes: 0,
    createdBy: "u1",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-02T00:00:00.000Z"),
})

describe("toSourceRecord", () => {
    it("renames the columns the jobs read", async () => {
        const subject = await buildSubject()

        expect(subject.toSourceRecord(rowOf())).toEqual({
            id: "s1",
            workspaceId: "w1",
            module: null,
            installationId: null,
            kind: "url",
            topic: "t",
            visibility: "public",
            title: "Title",
            content: "https://x.test",
            status: "queued",
            storagePath: null,
            sourceUrl: "https://x.test",
            createdBy: "u1",
            updatedAt: "2026-10-02T00:00:00.000Z",
        })
    })
})

describe("toSourceRecord instants", () => {
    it("answers updatedAt as an ISO string", async () => {
        const subject = await buildSubject()

        const record = subject.toSourceRecord(
            Object.assign(rowOf(), { updatedAt: new Date("2026-10-02T00:00:00.000Z") }),
        )

        expect(record.updatedAt).toBe("2026-10-02T00:00:00.000Z")
    })
})

const summary = {
    id: "s1",
    workspaceId: "w1",
    module: null,
    installationId: null,
    kind: "url",
    topic: "t",
    tags: [],
    visibility: "public",
    title: "Title",
    status: "queued",
    error: null,
    chunkCount: 0,
    progress: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
}

describe("toSourceSummary", () => {
    it("renames all the list columns and formats the stored instants", async () => {
        const subject = await buildSubject()

        expect(subject.toSourceSummary(rowOf())).toEqual(summary)
    })
})

describe("toSourceDetail", () => {
    it("includes the stored text with the source summary", async () => {
        const subject = await buildSubject()

        expect(subject.toSourceDetail(rowOf())).toEqual({ ...summary, content: "https://x.test" })
    })

    it("defaults a list row without text to empty content", async () => {
        const subject = await buildSubject()

        const { content, ...row } = rowOf()

        expect(content).toBe("https://x.test")
        expect(subject.toSourceDetail(row)).toEqual({ ...summary, content: "" })
    })
})
