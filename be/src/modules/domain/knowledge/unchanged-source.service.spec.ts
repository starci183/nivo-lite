import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesService, StoredNote, contentHashOf } from "@modules/domain/knowledge-sources"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { EmbeddingService } from "./embedding.service"
import { UnchangedSourceService } from "./unchanged-source.service"

const WS = "11111111-1111-4111-8111-111111111111"
const TEXT = "Open 8 to 21"

const sourceOf = builder<SourceRecord>({
    id: "s1",
    workspaceId: WS,
    module: null,
    installationId: null,
    kind: "text",
    topic: null,
    visibility: "internal",
    title: "Hours",
    content: TEXT,
    status: "queued",
    storagePath: null,
    sourceUrl: null,
    createdBy: "u1",
    contentHash: contentHashOf(TEXT),
    updatedAt: "2026-10-12T10:00:00.000Z",
})

const build = async () => {
    const sources = mock<KnowledgeSourcesService>()
    const chunks = mock<KnowledgeChunksService>()
    const embeddings = mock<EmbeddingService>()
    embeddings.configured.mockReturnValue(true)
    embeddings.model.mockReturnValue("m1")
    chunks.holds.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            UnchangedSourceService,
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: EmbeddingService, useValue: embeddings },
        ],
    }).compile()
    return { service: moduleRef.get(UnchangedSourceService), sources, chunks, embeddings }
}

describe("UnchangedSourceService", () => {
    describe("holdsWhole", () => {
        it("answers true for the finished text whose passages have vectors of the model in use", async () => {
            const { service, chunks } = await build()

            await expect(service.holdsWhole(sourceOf(), TEXT)).resolves.toBe(true)

            expect(chunks.holds).toHaveBeenCalledWith(WS, "s1", "m1")
        })

        it("answers false while the source records no finished text", async () => {
            const { service, chunks } = await build()

            await expect(service.holdsWhole(sourceOf({ contentHash: null }), TEXT)).resolves.toBe(false)

            expect(chunks.holds).not.toHaveBeenCalled()
        })

        it("answers false for another text than the finished one", async () => {
            const { service, chunks } = await build()

            await expect(service.holdsWhole(sourceOf(), "Open 9 to 21")).resolves.toBe(false)

            expect(chunks.holds).not.toHaveBeenCalled()
        })

        it("answers false when a reindex wrote other text over the text a file gave", async () => {
            const { service } = await build()

            await expect(service.holdsWhole(sourceOf({ content: "Replaced" }), TEXT)).resolves.toBe(false)
        })

        it("answers false when the passages lack vectors of the model in use", async () => {
            const { service, chunks } = await build()
            chunks.holds.mockResolvedValue(false)

            await expect(service.holdsWhole(sourceOf(), TEXT)).resolves.toBe(false)
        })

        it("asks only for passages when no embeddings are configured", async () => {
            const { service, chunks, embeddings } = await build()
            embeddings.configured.mockReturnValue(false)

            await expect(service.holdsWhole(sourceOf(), TEXT)).resolves.toBe(true)

            expect(chunks.holds).toHaveBeenCalledWith(WS, "s1", null)
        })

        it("treats an empty file as a text like any other", async () => {
            const { service } = await build()
            const empty = sourceOf({ content: "", contentHash: contentHashOf("") })

            await expect(service.holdsWhole(empty, "")).resolves.toBe(true)
        })
    })

    describe("keep", () => {
        it("makes the source ready with no note and skips", async () => {
            const { service, sources } = await build()

            await expect(service.keep(sourceOf())).resolves.toBe("skipped")

            expect(sources.keepIndexed).toHaveBeenCalledWith(WS, "s1", null)
        })

        it("writes the keyword-only note back when no embeddings are configured", async () => {
            const { service, sources, embeddings } = await build()
            embeddings.configured.mockReturnValue(false)

            await service.keep(sourceOf())

            expect(sources.keepIndexed).toHaveBeenCalledWith(WS, "s1", StoredNote.KeywordOnly)
        })
    })
})
