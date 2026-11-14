import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { KnowledgeSourceEntity } from "./persistence/entities"
import { readingOf, toSourceRecord, toSourceSummary, toSourceDetail } from "./source-record.mapper"

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
    stage: null,
    stageDone: null,
    stageTotal: null,
    storagePath: null,
    sourceUrl: "https://x.test",
    origin: null,
    sizeBytes: 0,
    createdBy: "u1",
    contentHash: "hash",
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
            contentHash: "hash",
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
    sizeBytes: 0,
    origin: null,
    progress: 0,
    stage: null,
    stageDone: null,
    stageTotal: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    partCount: 1,
}

describe("toSourceSummary", () => {
    it("renames all the list columns and formats the stored instants", async () => {
        const subject = await buildSubject()

        expect(subject.toSourceSummary(rowOf())).toEqual(summary)
    })

    it("carries the origin a document came from", async () => {
        const subject = await buildSubject()

        expect(subject.toSourceSummary(rowOf({ origin: "google_drive" }))).toEqual({
            ...summary,
            origin: "google_drive",
        })
    })
})

describe("toSourceDetail", () => {
    it("includes the stored text with the source summary", async () => {
        const subject = await buildSubject()

        expect(subject.toSourceDetail(rowOf())).toEqual({ ...summary, content: "https://x.test", reading: null })
    })

    it("defaults a list row without text to empty content", async () => {
        const subject = await buildSubject()

        const { content, ...row } = rowOf()

        expect(content).toBe("https://x.test")
        expect(subject.toSourceDetail(row)).toEqual({ ...summary, content: "", reading: null })
    })
})

describe("readingOf", () => {
    it("answers a stored reading field by field, dropping warnings that are not ones and filling what is missing", () => {
        expect(
            readingOf({
                reader: "pdf",
                pageCount: 4,
                sheetCount: "x",
                transcribed: true,
                warnings: [
                    { code: "DOCUMENT_PAGE_UNREADABLE", place: "3", count: 1.5, message: "Trang 3 kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c." },
                    { code: 1 },
                    null,
                ],
                refusal: null,
                reason: null,
                readAt: "2026-11-11T10:00:00.000Z",
            }),
        ).toEqual({
            reader: "pdf",
            pageCount: 4,
            sheetCount: null,
            transcribed: true,
            warnings: [
                { code: "DOCUMENT_PAGE_UNREADABLE", place: "3", count: null, message: "Trang 3 kh\u00f4ng \u0111\u1ecdc \u0111\u01b0\u1ee3c." },
            ],
            refusal: null,
            reason: null,
            readAt: "2026-11-11T10:00:00.000Z",
            path: null,
        })
        expect(readingOf({ reader: "x", readAt: "t", warnings: "no" })).toMatchObject({
            warnings: [],
            transcribed: false,
        })
    })

    it("answers null for no reading or one without a reader or an instant", () => {
        expect(readingOf(null)).toBeNull()
        expect(readingOf(undefined)).toBeNull()
        expect(readingOf({ reader: "pdf" })).toBeNull()
        expect(readingOf("text")).toBeNull()
    })
})
