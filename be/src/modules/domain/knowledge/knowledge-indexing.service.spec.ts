import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    INDEXING_WS,
    MANY,
    TABLE_WITHOUT_ROWS,
    legacy,
    sourceOf,
    stored,
} from "@tests/fixtures/builders/knowledge-indexing.builder"
import { KnowledgeChunksService, chunkPassages } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesError, KnowledgeSourcesErrorCode } from "@modules/domain/knowledge-sources"
import { KnowledgeSourcesService, MAX_SOURCE_CHARS, StoredNote } from "@modules/domain/knowledge-sources"
import { SourcePartsService, partsOf } from "@modules/domain/knowledge-sources"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { DocumentsError, DocumentsErrorCode } from "@modules/integrations/documents"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { CancelTimer, Timer } from "@modules/platform/retry"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeIndexingService } from "./knowledge-indexing.service"
import { KnowledgeErrorCode } from "./errors/knowledge.error"
import { EMBED_BATCH } from "./knowledge.contracts"
import { KNOWLEDGE_OPTIONS } from "./knowledge.decorators"
import { SourceReaderService } from "./source-reader.service"
import { UnchangedSourceService } from "./unchanged-source.service"
import { UsageMeterService } from "./usage-meter.service"

const WS = INDEXING_WS
const run = { sourceId: "s1", workspaceId: WS }
/** Lets the pending promise chain of the service run. */
const flush = async (): Promise<void> => {
    for (let turn = 0; turn < 20; turn += 1) await Promise.resolve()
}

const build = async (source: SourceRecord | null = sourceOf(), indexChunkDelayMs = 0) => {
    const sources = mock<KnowledgeSourcesService>()
    const parts = mock<SourcePartsService>()
    const chunks = mock<KnowledgeChunksService>()
    const reader = mock<SourceReaderService>()
    const embeddings = mock<EmbeddingService>()
    const usage = mock<UsageMeterService>()
    const unchanged = mock<UnchangedSourceService>()
    const logger = mock<Logger>()
    const timer = mock<Timer>()
    const waiting: Array<{ readonly callback: () => void; readonly delayMs: number }> = []
    timer.schedule.mockImplementation((callback: () => void, delayMs: number): CancelTimer => {
        waiting.push({ callback, delayMs })
        return () => undefined
    })
    sources.sourceOf.mockResolvedValue(source)
    reader.read.mockResolvedValue({ kind: "ok", value: { text: source?.content ?? "", title: null } })
    embeddings.configured.mockReturnValue(true)
    embeddings.model.mockReturnValue("m1")
    embeddings.embed.mockResolvedValue([[0.5, 1]])
    chunks.embeddedOf.mockResolvedValue([])
    unchanged.holdsWhole.mockResolvedValue(false)
    unchanged.keep.mockResolvedValue("skipped")
    usage.blockedBy.mockResolvedValue(false)
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeIndexingService,
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: SourcePartsService, useValue: parts },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: SourceReaderService, useValue: reader },
            { provide: UnchangedSourceService, useValue: unchanged },
            { provide: EmbeddingService, useValue: embeddings },
            { provide: UsageMeterService, useValue: usage },
            { provide: LOGGER, useValue: logger },
            { provide: KNOWLEDGE_OPTIONS, useValue: { driveAccess: Symbol("drive"), indexChunkDelayMs } },
            { provide: TIMER, useValue: timer },
        ],
    }).compile()
    return {
        service: moduleRef.get(KnowledgeIndexingService),
        sources,
        parts,
        chunks,
        reader,
        unchanged,
        embeddings,
        usage,
        logger,
        held: { waiting },
    }
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
            expect(embeddings.embed).toHaveBeenCalledWith({
                workspaceId: WS,
                texts: ["Open 8 to 21"],
                timeoutMs: 20_000,
            })
            expect(chunks.arrange).toHaveBeenCalledWith({ workspaceId: WS, sourceId: "s1", moves: [], count: 1 })
            expect(chunks.keep).toHaveBeenCalledWith({
                workspaceId: WS,
                sourceId: "s1",
                module: "chatbot",
                visibility: "internal",
                installationId: null,
                model: "m1",
                drafts: [{ text: "Open 8 to 21", vector: "[0.5,1]", order: 0 }],
            })
            expect(sources.finishIndexing).toHaveBeenCalledWith(WS, "s1", null, 1)
        })

        it("moves through the stages chunk, embed and store in order", async () => {
            const { service, sources } = await build()

            await service.index(run)

            expect(sources.enterStage.mock.calls.map(([, , change]) => change.stage)).toEqual([
                "chunk",
                "embed",
                "store",
            ])
            expect(sources.enterStage).toHaveBeenCalledWith(WS, "s1", {
                stage: "embed",
                done: 0,
                total: 1,
                progress: 25,
            })
            expect(sources.enterStage).toHaveBeenCalledWith(WS, "s1", {
                stage: "store",
                done: 1,
                total: 1,
                progress: 80,
            })
        })
    })
})

describe("KnowledgeIndexingService", () => {
    describe("index", () => {
        it("takes the title the reader found", async () => {
            const { service, sources, reader } = await build()
            reader.read.mockResolvedValue({ kind: "ok", value: { text: " Page ", title: "Page title" } })

            await service.index(run)

            expect(sources.startIndexing).toHaveBeenCalledWith(WS, "s1", "Page", "Page title")
        })

        it("embeds and stores the passages batch by batch and reports the count after each", async () => {
            const { service, sources, chunks, embeddings } = await build(sourceOf({ content: MANY }))
            embeddings.embed.mockImplementation((request) => Promise.resolve(request.texts.map(() => [1])))
            const total = chunkPassages(MANY).length

            await service.index(run)

            expect(embeddings.embed).toHaveBeenCalledTimes(Math.ceil(total / EMBED_BATCH))
            expect(chunks.keep).toHaveBeenCalledTimes(Math.ceil(total / EMBED_BATCH))
            expect(sources.advance).toHaveBeenLastCalledWith(WS, "s1", {
                stage: "embed",
                done: total,
                total,
                progress: 80,
            })
        })
    })
})

describe("KnowledgeIndexingService", () => {
    describe("index", () => {
        it("fails the batch into the queue retry when the provider gives no vectors, storing nothing keyword-only", async () => {
            const { service, sources, chunks, embeddings } = await build()
            embeddings.embed.mockResolvedValue(null)

            await expect(service.index(run)).rejects.toMatchObject({ code: KnowledgeErrorCode.EmbeddingUnavailable })

            expect(chunks.keep).not.toHaveBeenCalled()
            expect(sources.finishIndexing).not.toHaveBeenCalled()
            expect(sources.fail).not.toHaveBeenCalled()
        })
    })
})

describe("KnowledgeIndexingService", () => {
    describe("index", () => {
        it("stores a passage the provider gave no vector for without one", async () => {
            const { service, chunks, embeddings } = await build()
            embeddings.embed.mockResolvedValue([])

            await service.index(run)

            expect(chunks.keep).toHaveBeenCalledWith(
                expect.objectContaining({ drafts: [{ text: "Open 8 to 21", vector: null, order: 0 }] }),
            )
        })

        it("keeps the stored passages when they are already the embedded passages of the text", async () => {
            const { service, sources, chunks, embeddings } = await build()
            chunks.embeddedOf.mockResolvedValue([legacy("Open 8 to 21", 0)])

            await expect(service.index(run)).resolves.toBe("indexed")

            expect(embeddings.embed).not.toHaveBeenCalled()
            expect(chunks.keep).not.toHaveBeenCalled()
            expect(sources.finishIndexing).toHaveBeenCalledWith(WS, "s1", null, 1)
        })

        it.each([
            ["another text", [legacy("Other", 0)]],
            ["another model", [legacy("Open 8 to 21", 0, "m0")]],
            ["another order", [legacy("Open 8 to 21", 1)]],
            ["another count", []],
        ])("embeds again when the stored passages differ (%s)", async (_name, have) => {
            const { service, chunks, embeddings } = await build()
            chunks.embeddedOf.mockResolvedValue(have)

            await service.index(run)

            expect(embeddings.embed).toHaveBeenCalled()
        })

        it("stores keyword-only passages without looking when embeddings are not configured", async () => {
            const { service, sources, chunks, embeddings } = await build()
            embeddings.configured.mockReturnValue(false)

            await service.index(run)

            expect(chunks.embeddedOf).not.toHaveBeenCalled()
            expect(chunks.replace).toHaveBeenCalledWith(
                expect.objectContaining({ drafts: [{ text: "Open 8 to 21", vector: null }] }),
            )
            expect(sources.finishIndexing).toHaveBeenCalledWith(WS, "s1", StoredNote.KeywordOnly, 1)
        })

        it("stores a large document without vectors and waits when the workspace has no credits left", async () => {
            const content = Array.from({ length: 60 }, (_, i) => `Paragraph ${i} ${"y".repeat(700)}`).join("\n\n")
            const { service, sources, usage, embeddings, chunks } = await build(sourceOf({ content }))
            usage.blockedBy.mockResolvedValue(true)

            await expect(service.index(run)).resolves.toBe("blocked")

            expect(usage.blockedBy).toHaveBeenCalledWith(WS, "embedding", true)
            expect(embeddings.embed).not.toHaveBeenCalled()
            expect(chunks.replace).not.toHaveBeenCalled()
            const drafts = chunks.keep.mock.calls.flatMap(([write]) => write.drafts)
            expect(drafts.length).toBe(chunkPassages(content).length)
            expect(drafts.every((draft) => draft.vector === null)).toBe(true)
            expect(sources.blockIndexing).toHaveBeenCalledWith(WS, "s1", StoredNote.NoCreditsForIndex, drafts.length)
            expect(sources.finishIndexing).not.toHaveBeenCalled()
        })
    })
})

describe("KnowledgeIndexingService", () => {
    describe("index", () => {
        it("keeps the vectors already paid for when a retry meets no credits, and stores only the missing passages", async () => {
            const { service, sources, usage, embeddings, chunks } = await build(sourceOf({ content: MANY }))
            const pieces = chunkPassages(MANY)
            chunks.embeddedOf.mockResolvedValue(pieces.slice(0, 10).map(stored))
            usage.blockedBy.mockResolvedValue(true)

            await expect(service.index(run)).resolves.toBe("blocked")

            expect(chunks.replace).not.toHaveBeenCalled()
            expect(embeddings.embed).not.toHaveBeenCalled()
            const orders = chunks.keep.mock.calls.flatMap(([write]) => write.drafts.map((draft) => draft.order))
            expect(orders).toEqual(pieces.map((_, order) => order).slice(10))
            expect(sources.blockIndexing).toHaveBeenCalledWith(WS, "s1", StoredNote.NoCreditsForIndex, pieces.length)
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

        it.each<[string, string, string]>([
            ["no text", "   ", StoredNote.Empty],
            ["text that makes no passage", TABLE_WITHOUT_ROWS, StoredNote.NoPassages],
        ])("closes a source with %s as failed", async (_name, text, note) => {
            const { service, sources, reader } = await build()
            reader.read.mockResolvedValue({ kind: "ok", value: { text, title: null } })

            await expect(service.index(run)).resolves.toBe("failed")

            expect(sources.fail).toHaveBeenCalledWith(WS, "s1", note)
        })

        it("keeps the first part of a text longer than a source may be and makes each later part a source", async () => {
            const { service, sources, parts, reader } = await build()
            const text = Array.from({ length: Math.ceil((MAX_SOURCE_CHARS * 1.5) / 11) }, () => "row | cell").join("\n")
            const [first = "", second = ""] = partsOf(text, MAX_SOURCE_CHARS)
            reader.read.mockResolvedValue({ kind: "ok", value: { text, title: null } })
            parts.splitLong.mockResolvedValue("Hours (1/2)")

            await expect(service.index(run)).resolves.toBe("indexed")

            expect(parts.splitLong).toHaveBeenCalledWith(WS, "s1", "Hours", [second])
            expect(sources.startIndexing).toHaveBeenCalledWith(WS, "s1", first, "Hours (1/2)")
            expect(sources.fail).not.toHaveBeenCalled()
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

    describe("a text the source holds whole", () => {
        it.each([
            ["file", 0],
            ["url", 1],
        ])("skips a %s, reading only what can change", async (kind, reads) => {
            const { service, reader, unchanged } = await build(sourceOf({ kind }))
            unchanged.holdsWhole.mockResolvedValue(true)

            await expect(service.index(run)).resolves.toBe("skipped")

            expect(reader.read).toHaveBeenCalledTimes(reads)
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

describe("KnowledgeIndexingService a passage that moved", () => {
    it("keeps its vector at the new order, is not embedded, and counts as done", async () => {
        const content = `${"n".repeat(500)}\n\n${"o".repeat(500)}`
        const { service, sources, chunks, embeddings } = await build(sourceOf({ content }))
        const [first, second] = chunkPassages(content)
        chunks.embeddedOf.mockResolvedValue([stored(second ?? "", 0)])

        await expect(service.index(run)).resolves.toBe("indexed")

        expect(chunks.arrange).toHaveBeenCalledWith(
            expect.objectContaining({ moves: [{ id: "c0", order: 1 }], count: 2 }),
        )
        expect(embeddings.embed.mock.calls.flatMap(([request]) => request.texts)).toEqual([first])
        expect(sources.enterStage).toHaveBeenCalledWith(WS, "s1", expect.objectContaining({ stage: "embed", done: 1 }))
    })
})

describe("KnowledgeIndexingService resume and pacing", () => {
    const unavailable = new DocumentsError({ code: DocumentsErrorCode.Unavailable })

    it("keeps the batches stored before a failure and embeds only the rest on the retry", async () => {
        const { service, chunks, embeddings } = await build(sourceOf({ content: MANY }))
        const pieces = chunkPassages(MANY)
        embeddings.embed
            .mockImplementationOnce((request) => Promise.resolve(request.texts.map(() => [1])))
            .mockRejectedValueOnce(unavailable)

        await expect(service.index(run)).rejects.toBe(unavailable)

        expect(chunks.keep).toHaveBeenCalledTimes(1)

        chunks.embeddedOf.mockResolvedValue(pieces.slice(0, EMBED_BATCH).map(stored))
        embeddings.embed.mockReset()
        embeddings.embed.mockImplementation((request) => Promise.resolve(request.texts.map(() => [1])))

        await expect(service.index(run)).resolves.toBe("indexed")

        const embedded = embeddings.embed.mock.calls.flatMap(([request]) => request.texts)
        expect(embedded).toEqual(pieces.slice(EMBED_BATCH))
        expect(chunks.keep.mock.calls.at(-1)?.[0].drafts.at(0)?.order).toBe(EMBED_BATCH * 2)
    })

    it("counts the passages kept from the failed run as done", async () => {
        const { service, sources, chunks } = await build(sourceOf({ content: MANY }))
        const pieces = chunkPassages(MANY)
        chunks.embeddedOf.mockResolvedValue(pieces.slice(0, 10).map(stored))

        await service.index(run)

        expect(sources.enterStage).toHaveBeenCalledWith(
            WS,
            "s1",
            expect.objectContaining({ stage: "embed", done: 10, total: pieces.length }),
        )
    })

    it("waits the demo delay between passages, one passage at a time, and not before the first", async () => {
        const content = ["a", "b", "c"].map((letter) => letter.repeat(700)).join("\n\n")
        const { service, embeddings, held } = await build(sourceOf({ content }), 10_000)
        const total = chunkPassages(content).length
        embeddings.embed.mockImplementation((request) => Promise.resolve(request.texts.map(() => [1])))

        const running = service.index(run)
        await flush()
        expect(embeddings.embed).toHaveBeenCalledTimes(1)
        expect(held.waiting.map((entry) => entry.delayMs)).toEqual([10_000])

        held.waiting.splice(0).forEach((entry) => entry.callback())
        await flush()
        expect(embeddings.embed).toHaveBeenCalledTimes(2)

        for (let left = total - 2; left > 0; left -= 1) {
            held.waiting.splice(0).forEach((entry) => entry.callback())
            await flush()
        }
        await expect(running).resolves.toBe("indexed")
        expect(embeddings.embed).toHaveBeenCalledTimes(total)
    })

    it("embeds as fast as the provider answers when no delay is asked", async () => {
        const { service, embeddings, held } = await build(sourceOf({ content: MANY }))
        embeddings.embed.mockImplementation((request) => Promise.resolve(request.texts.map(() => [1])))

        await expect(service.index(run)).resolves.toBe("indexed")
        expect(held.waiting).toEqual([])
    })
})
