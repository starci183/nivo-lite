import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import type { StaleChunk } from "@modules/domain/knowledge-chunks/knowledge-chunks.contracts"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeReembedService } from "./knowledge-reembed.service"
import { REEMBED_BATCH, REEMBED_MAX_BATCHES } from "./knowledge.contracts"
import { UsageMeterService } from "./usage-meter.service"

const WS = "11111111-1111-4111-8111-111111111111"

const stale = (count: number): Array<StaleChunk> =>
    Array.from({ length: count }, (_, i) => ({ id: `c${i}`, text: `text ${i}` }))

const build = async () => {
    const sources = mock<KnowledgeSourcesService>()
    const chunks = mock<KnowledgeChunksService>()
    const embeddings = mock<EmbeddingService>()
    const usage = mock<UsageMeterService>()
    embeddings.configured.mockReturnValue(true)
    embeddings.model.mockReturnValue("m1")
    usage.blockedBy.mockResolvedValue(false)
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeReembedService,
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: EmbeddingService, useValue: embeddings },
            { provide: UsageMeterService, useValue: usage },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeReembedService), sources, chunks, embeddings, usage }
}

describe("KnowledgeReembedService", () => {
    describe("request", () => {
        it("asks for the re-embedding with the model in use", async () => {
            const { service, sources } = await build()

            await service.request("u1", WS)

            expect(sources.requestReembed).toHaveBeenCalledWith("u1", WS, "m1")
        })
    })

    describe("reembed", () => {
        it("does nothing when the deployment cannot embed", async () => {
            const { service, embeddings } = await build()
            embeddings.configured.mockReturnValue(false)

            await expect(service.reembed(WS, "")).resolves.toBe("done")
        })

        it("refuses a model other than the one in use, and accepts the one in use or none", async () => {
            const { service, chunks } = await build()
            chunks.stale.mockResolvedValue([])

            await expect(service.reembed(WS, "other")).resolves.toBe("mismatch")
            await expect(service.reembed(WS, "m1")).resolves.toBe("done")
            await expect(service.reembed(WS, "")).resolves.toBe("done")
        })

        it("gives the stale passages their vectors and is done when a short batch ends the work", async () => {
            const { service, chunks, embeddings, usage } = await build()
            chunks.stale.mockResolvedValue(stale(2))
            embeddings.embed.mockResolvedValue([[1, 2]])

            await expect(service.reembed(WS, "")).resolves.toBe("done")

            expect(usage.blockedBy).toHaveBeenCalledWith(WS, "embedding", true)
            expect(chunks.stale).toHaveBeenCalledWith(WS, "m1", REEMBED_BATCH)
            expect(embeddings.embed).toHaveBeenCalledWith({
                workspaceId: WS,
                texts: ["text 0", "text 1"],
                timeoutMs: 30_000,
            })
            expect(chunks.setVectors).toHaveBeenCalledWith({
                workspaceId: WS,
                model: "m1",
                ids: ["c0", "c1"],
                vectors: ["[1,2]", "[]"],
            })
        })

        it("goes on with the next batch while batches are full, and stops when none is left", async () => {
            const { service, chunks, embeddings } = await build()
            chunks.stale.mockResolvedValueOnce(stale(REEMBED_BATCH)).mockResolvedValueOnce([])
            embeddings.embed.mockResolvedValue([])

            await expect(service.reembed(WS, "")).resolves.toBe("done")

            expect(embeddings.embed).toHaveBeenCalledTimes(1)
        })

        it("hands over to a follow-up job after the most batches one job does", async () => {
            const { service, chunks, embeddings } = await build()
            chunks.stale.mockResolvedValue(stale(REEMBED_BATCH))
            embeddings.embed.mockResolvedValue([])

            await expect(service.reembed(WS, "")).resolves.toBe("more")

            expect(embeddings.embed).toHaveBeenCalledTimes(REEMBED_MAX_BATCHES)
        })

        it("waits when the workspace has no credits left", async () => {
            const { service, usage, embeddings } = await build()
            usage.blockedBy.mockResolvedValue(true)

            await expect(service.reembed(WS, "")).resolves.toBe("blocked")

            expect(embeddings.embed).not.toHaveBeenCalled()
        })

        it("reports an embedding provider that fails, writing nothing", async () => {
            const { service, chunks, embeddings } = await build()
            chunks.stale.mockResolvedValue(stale(1))
            embeddings.embed.mockResolvedValue(null)

            await expect(service.reembed(WS, "")).resolves.toBe("unavailable")

            expect(chunks.setVectors).not.toHaveBeenCalled()
        })
    })
})
