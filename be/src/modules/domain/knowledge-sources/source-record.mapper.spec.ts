import { builder } from "@starci/jest-preset"
import type { KnowledgeSourcesRow } from "./persistence/knowledge-sources.rows"
import { toSourceDetail, toSourceRecord, toSourceSummary } from "./source-record.mapper"

const rowOf = builder<KnowledgeSourcesRow>({
    id: "s1",
    workspace_id: "w1",
    module: null,
    installation_id: null,
    kind: "url",
    topic: "t",
    tags: [],
    visibility: "public",
    title: "Title",
    content: "https://x.test",
    status: "queued",
    error: null,
    chunk_count: 0,
    progress: 0,
    storage_path: null,
    source_url: "https://x.test",
    origin: null,
    created_by: "u1",
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-02T00:00:00.000Z",
})

describe("toSourceRecord", () => {
    it("renames the columns the jobs read", () => {
        expect(toSourceRecord(rowOf())).toEqual({
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
    it("renames all the list columns and formats the stored instants", () => {
        expect(toSourceSummary(rowOf())).toEqual(summary)
    })
})

describe("toSourceDetail", () => {
    it("includes the stored text with the source summary", () => {
        expect(toSourceDetail(rowOf())).toEqual({ ...summary, content: "https://x.test" })
    })

    it("defaults a list row without text to empty content", () => {
        const { content, ...row } = rowOf()

        expect(content).toBe("https://x.test")
        expect(toSourceDetail(row)).toEqual({ ...summary, content: "" })
    })
})
