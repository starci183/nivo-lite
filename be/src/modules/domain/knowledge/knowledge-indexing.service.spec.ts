import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "@modules/domain/knowledge-sources"
import { KnowledgeSourcesService, MAX_SOURCE_CHARS, StoredNote } from "@modules/domain/knowledge-sources"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { DocumentsError, DocumentsErrorCode } from "@modules/integrations/documents"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeIndexingService } from "./knowledge-indexing.service"
import { SourceReaderService } from "./source-reader.service"
import { UsageMeterService } from "./usage-meter.service"

const WS = "11111111-1111-4111-8111-111111111111"
const run = { sourceId: "s1", workspaceId: WS }
const TABLE_WITHOUT_ROWS = "|---|---|\n|---|---|\n|---|---|"

const sourceOf = builder<SourceRecord>({
    id: "s1",
    workspaceId: WS,
    module: "chatbot",
    installationId: null,
    kind: "text",
    topic: null,
    visibility: "internal",
    title: "Hours",
    content: "Open 8 to 21",
    status: "queued",
    storagePath: null,
    sourceUrl: null,
    createdBy: "u1",
    updatedAt: "2026-10-12T10:00:00.000Z",
})

const build = async (source: SourceRecord | null = sourceOf()) => {
    const sources = mock<KnowledgeSourcesService>()
    const chunks = mock<KnowledgeChunksService>()
    const reader = mock<SourceReaderService>()
    const embeddings = mock<EmbeddingService>()
    const usage = mock<UsageMeterService>()
    const logger = mock<Logger>()
    sources.sourceOf.mockResolvedValue(source)
    reader.read.mockResolvedValue({ kind: "ok", value: { text: source?.content ?? "", title: null } })
    embeddings.configured.mockReturnValue(true)
    embeddings.model.mockReturnValue("m1")
    embeddings.embed.mockResolvedValue([[0.5, 1]])
    chunks.embeddedOf.mockResolvedValue([])
    usage.blockedBy.mockResolvedValue(false)
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeIndexingService,
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: SourceReaderService, useValue: reader },
            { provide: EmbeddingService, useValue: embeddings },
            { provide: UsageMeterService, useValue: usage },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeIndexingService), sources, chunks, reader, embeddings, usage, logger }
}

describe("KnowledgeIndexingService", () => {
    describe("index", () => {
        it("skips a source that is gone and one that is past indexing or closed", async () => {
            await expect((await build(null)).service.index(run)).resolves.toBe("skipped")

            for (const status of ["ready", "extracting_facts", "failed", "blocked_credits"]) {
                const closed = await build(sourceOf({ status }))
                await expect(closed.service.index(run)).resolves.toBe("skipped")
                expect(closed.sources.begin).not.toHaveBeenCalled()
            }
        })

        it("reads, embeds and stores a text source, then hands it on to the reading of its facts", async () => {
            const { service, sources, chunks, embeddings } = await build()

            await expect(service.index(run)).resolves.toBe("indexed")

            expect(sources.begin).toHaveBeenCalledWith(WS, "s1")
            expect(sources.startIndexing).toHaveBeenCalledWith(WS, "s1", "Open 8 to 21", "Hours")
            expect(embeddings.embed).toHaveBeenCalledWith(
                { workspaceId: WS, texts: ["Open 8 to 21"], timeoutMs: 20_000 },
                expect.any(Function),
            )
            expect(chunks.replace).toHaveBeenCalledWith({
                workspaceId: WS,
                sourceId: "s1",
                module: "chatbot",
                visibility: "internal",
                installationId: null,
                model: "m1",
                drafts: [{ text: "Open 8 to 21", vector: "[0.5,1]" }],
            })
            expect(sources.finishIndexing).toHaveBeenCalledWith(WS, "s1", null, 1)
        })

        it("takes the title the reader found", async () => {
            const { service, sources, reader } = await build()
            reader.read.mockResolvedValue({ kind: "ok", value: { text: " Page ", title: "Page title" } })

            await service.index(run)

            expect(sources.startIndexing).toHaveBeenCalledWith(WS, "s1", "Page", "Page title")
        })

        it("reports the embedding progress of the passages", async () => {
            const { service, sources, embeddings } = await build()
            embeddings.embed.mockImplementation(async (_request, progress) => {
                await progress?.(1, 4)
                await progress?.(4, 4)
                return [[1]]
            })

            await service.index(run)

            expect(sources.advance).toHaveBeenCalledWith(WS, "s1", 38.75)
            expect(sources.advance).toHaveBeenCalledWith(WS, "s1", 80)
        })
    })
})

describe("KnowledgeIndexingService", () => {
    describe("index", () => {
        it("stores passages for keyword search only when there are no vectors", async () => {
            const { service, sources, chunks, embeddings } = await build()
            embeddings.embed.mockResolvedValue(null)

            await expect(service.index(run)).resolves.toBe("indexed")

            expect(chunks.replace).toHaveBeenCalledWith(
                expect.objectContaining({ drafts: [{ text: "Open 8 to 21", vector: null }] }),
            )
            expect(sources.finishIndexing).toHaveBeenCalledWith(WS, "s1", StoredNote.KeywordOnly, 1)
        })
    })
})

describe("KnowledgeIndexingService", () => {
    describe("index", () => {
        it("stores a passage the provider gave no vector for without one", async () => {
            const { service, chunks, embeddings } = await build()
            embeddings.embed.mockResolvedValue([])

            await service.index(run)

            expect(chunks.replace).toHaveBeenCalledWith(
                expect.objectContaining({ drafts: [{ text: "Open 8 to 21", vector: null }] }),
            )
        })

        it("keeps the stored passages when they are already the embedded passages of the text", async () => {
            const { service, sources, chunks, embeddings } = await build()
            chunks.embeddedOf.mockResolvedValue([{ order: 0, text: "Open 8 to 21", model: "m1" }])

            await expect(service.index(run)).resolves.toBe("indexed")

            expect(embeddings.embed).not.toHaveBeenCalled()
            expect(chunks.replace).not.toHaveBeenCalled()
            expect(sources.finishIndexing).toHaveBeenCalledWith(WS, "s1", null, 1)
        })

        it.each([
            ["another text", [{ order: 0, text: "Other", model: "m1" }]],
            ["another model", [{ order: 0, text: "Open 8 to 21", model: "m0" }]],
            ["another order", [{ order: 1, text: "Open 8 to 21", model: "m1" }]],
            ["another count", []],
        ])("embeds again when the stored passages differ (%s)", async (_name, have) => {
            const { service, chunks, embeddings } = await build()
            chunks.embeddedOf.mockResolvedValue(have)

            await service.index(run)

            expect(embeddings.embed).toHaveBeenCalled()
        })

        it("embeds again without looking when embeddings are not configured", async () => {
            const { service, chunks, embeddings } = await build()
            embeddings.configured.mockReturnValue(false)

            await service.index(run)

            expect(chunks.embeddedOf).not.toHaveBeenCalled()
        })

        it("stores a large document without vectors and waits when the workspace has no credits left", async () => {
            const content = Array.from({ length: 60 }, (_, i) => `Paragraph ${i} ${"y".repeat(700)}`).join("\n\n")
            const { service, sources, usage, embeddings, chunks } = await build(sourceOf({ content }))
            usage.blockedBy.mockResolvedValue(true)

            await expect(service.index(run)).resolves.toBe("blocked")

            expect(usage.blockedBy).toHaveBeenCalledWith(WS, "embedding", true)
            expect(embeddings.embed).not.toHaveBeenCalled()
            const drafts = chunks.replace.mock.calls[0]?.[0].drafts ?? []
            expect(drafts.length).toBeGreaterThan(1)
            expect(drafts.every((draft) => draft.vector === null)).toBe(true)
            expect(sources.blockIndexing).toHaveBeenCalledWith(WS, "s1", StoredNote.NoCreditsForIndex, drafts.length)
            expect(sources.finishIndexing).not.toHaveBeenCalled()
        })
    })
})

describe("KnowledgeIndexingService", () => {
    describe("index", () => {
        it("does not ask about credits for a small document", async () => {
            const { service, usage } = await build()

            await service.index(run)

            expect(usage.blockedBy).not.toHaveBeenCalled()
        })

        it("closes a source with no text as failed", async () => {
            const { service, sources, reader } = await build()
            reader.read.mockResolvedValue({ kind: "ok", value: { text: "   ", title: null } })

            await expect(service.index(run)).resolves.toBe("failed")

            expect(sources.fail).toHaveBeenCalledWith(WS, "s1", StoredNote.Empty)
        })

        it("closes a source with too much text as failed", async () => {
            const { service, sources, reader } = await build()
            reader.read.mockResolvedValue({
                kind: "ok",
                value: { text: "x".repeat(MAX_SOURCE_CHARS + 1), title: null },
            })

            await expect(service.index(run)).resolves.toBe("failed")

            expect(sources.fail).toHaveBeenCalledWith(WS, "s1", StoredNote.TooLong)
        })

        it("closes a source whose text makes no passage as failed", async () => {
            const { service, sources, reader } = await build()
            reader.read.mockResolvedValue({ kind: "ok", value: { text: TABLE_WITHOUT_ROWS, title: null } })

            await expect(service.index(run)).resolves.toBe("failed")

            expect(sources.fail).toHaveBeenCalledWith(WS, "s1", StoredNote.NoPassages)
        })

        it("closes a source the reader refuses with the code of the reason", async () => {
            const { service, sources, reader } = await build()
            reader.read.mockResolvedValue({ kind: "refused", code: StoredNote.FileMissing })

            await expect(service.index(run)).resolves.toBe("failed")

            expect(sources.fail).toHaveBeenCalledWith(WS, "s1", StoredNote.FileMissing)
        })

        it("closes a source whose page can never be read with the code of the reason", async () => {
            const { service, sources, reader, logger } = await build()
            reader.read.mockRejectedValue(new DocumentsError({ code: DocumentsErrorCode.NotPublic }))

            await expect(service.index(run)).resolves.toBe("failed")

            expect(sources.fail).toHaveBeenCalledWith(WS, "s1", DocumentsErrorCode.NotPublic)
            expect(logger.error).toHaveBeenCalled()
        })
    })
})

describe("KnowledgeIndexingService", () => {
    describe("index", () => {
        it("lets the queue retry a page or a storage that could not be reached", async () => {
            const { service, sources, reader } = await build()
            const down = new DocumentsError({ code: DocumentsErrorCode.Unavailable })
            reader.read.mockRejectedValue(down)

            await expect(service.index(run)).rejects.toBe(down)

            reader.read.mockRejectedValue(
                new KnowledgeSourcesError({ code: KnowledgeSourcesErrorCode.UploadUnavailable }),
            )
            await expect(service.index(run)).rejects.toMatchObject({
                code: KnowledgeSourcesErrorCode.UploadUnavailable,
            })

            expect(sources.fail).not.toHaveBeenCalled()
        })

        it("stores any other failure as unreadable", async () => {
            const { service, sources, reader } = await build()
            reader.read.mockRejectedValue(new Error("boom"))

            await expect(service.index(run)).resolves.toBe("failed")

            expect(sources.fail).toHaveBeenCalledWith(WS, "s1", StoredNote.Unreadable)
        })
    })

    describe("failSource", () => {
        it("closes the source with the code of the cause and logs it", async () => {
            const { service, sources, logger } = await build()

            await service.failSource(WS, "s1", new DocumentsError({ code: DocumentsErrorCode.Unavailable }))
            await service.failSource(WS, "s1", new Error("boom"))

            expect(sources.fail).toHaveBeenCalledWith(WS, "s1", DocumentsErrorCode.Unavailable)
            expect(sources.fail).toHaveBeenCalledWith(WS, "s1", StoredNote.Unreadable)
            expect(logger.error).toHaveBeenCalledTimes(2)
        })
    })

    describe("sourceForFacts", () => {
        it("gives the source that waits for its facts, and nothing otherwise", async () => {
            const waiting = await build(sourceOf({ status: "extracting_facts" }))
            await expect(waiting.service.sourceForFacts(WS, "s1")).resolves.toMatchObject({ id: "s1" })

            const other = await build(sourceOf({ status: "ready" }))
            await expect(other.service.sourceForFacts(WS, "s1")).resolves.toBeNull()

            const gone = await build(null)
            await expect(gone.service.sourceForFacts(WS, "s1")).resolves.toBeNull()
        })
    })
})
