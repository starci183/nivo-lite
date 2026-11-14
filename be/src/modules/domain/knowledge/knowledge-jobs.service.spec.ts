import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { KnowledgeSourceCitesService, KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeErrorCode } from "./errors/knowledge.error"
import { KnowledgeIndexingService } from "./knowledge-indexing.service"
import { KnowledgeJobsService } from "./knowledge-jobs.service"
import { KnowledgeReembedService } from "./knowledge-reembed.service"
import { KnowledgeLogEvent } from "./knowledge.log-events"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async () => {
    const indexing = mock<KnowledgeIndexingService>()
    const reembedding = mock<KnowledgeReembedService>()
    const sources = mock<KnowledgeSourcesService>()
    const logger = mock<Logger>()
    const cites = mock<KnowledgeSourceCitesService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeJobsService,
            { provide: KnowledgeIndexingService, useValue: indexing },
            { provide: KnowledgeReembedService, useValue: reembedding },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: KnowledgeSourceCitesService, useValue: cites },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeJobsService), indexing, reembedding, sources, logger, cites }
}

describe("KnowledgeJobsService", () => {
    describe("index", () => {
        it("indexes the source of the payload", async () => {
            const { service, indexing } = await build()

            await service.index({ sourceId: "s1", workspaceId: WS })

            expect(indexing.index).toHaveBeenCalledWith({ sourceId: "s1", workspaceId: WS })
        })

        it("drops a payload without a source", async () => {
            const { service, indexing, logger } = await build()

            await expect(service.index({})).resolves.toBeUndefined()

            expect(indexing.index).not.toHaveBeenCalled()
            expect(logger.warn).toHaveBeenCalledWith(KnowledgeLogEvent.PayloadRefused, { job: "index" })
        })
    })

    describe("indexFailed", () => {
        it("closes the source with the cause", async () => {
            const { service, indexing } = await build()
            const cause = new Error("boom")

            await service.indexFailed({ sourceId: "s1", workspaceId: WS }, cause)

            expect(indexing.failSource).toHaveBeenCalledWith(WS, "s1", cause)
        })

        it("has no source to close for a payload without one", async () => {
            const { service, indexing } = await build()

            await service.indexFailed({}, new Error("boom"))

            expect(indexing.failSource).not.toHaveBeenCalled()
        })
    })
})

describe("KnowledgeJobsService", () => {
    describe("reembed", () => {
        it("embeds the stale passages with the model in use when none is named", async () => {
            const { service, reembedding, sources } = await build()
            reembedding.reembed.mockResolvedValue("done")

            await service.reembed({ workspaceId: WS })

            expect(reembedding.reembed).toHaveBeenCalledWith(WS, "")
            expect(sources.continueReembed).not.toHaveBeenCalled()
        })

        it("waits quietly when the workspace has no credits left", async () => {
            const { service, reembedding, sources } = await build()
            reembedding.reembed.mockResolvedValue("blocked")

            await expect(service.reembed({ workspaceId: WS, model: "m1" })).resolves.toBeUndefined()

            expect(reembedding.reembed).toHaveBeenCalledWith(WS, "m1")
            expect(sources.continueReembed).not.toHaveBeenCalled()
        })

        it("queues its own follow-up when it reached the batch limit", async () => {
            const { service, reembedding, sources } = await build()
            reembedding.reembed.mockResolvedValue("more")

            await service.reembed({ workspaceId: WS, model: "m1" })
            await service.reembed({ workspaceId: WS })

            expect(sources.continueReembed).toHaveBeenCalledWith(WS, "m1")
            expect(sources.continueReembed).toHaveBeenCalledWith(WS, "")
        })

        it("fails so the queue retries when the embeddings provider is unavailable", async () => {
            const { service, reembedding } = await build()
            reembedding.reembed.mockResolvedValue("unavailable")

            await expect(service.reembed({ workspaceId: WS })).rejects.toMatchObject({
                code: KnowledgeErrorCode.EmbeddingUnavailable,
            })
        })

        it("logs and drops a job for a model this deployment does not embed with", async () => {
            const { service, reembedding, logger } = await build()
            reembedding.reembed.mockResolvedValue("mismatch")

            await expect(service.reembed({ workspaceId: WS, model: "old" })).resolves.toBeUndefined()

            expect(logger.warn).toHaveBeenCalledWith(KnowledgeLogEvent.ModelMismatch, { workspaceId: WS, model: "old" })
        })

        it("drops a payload without a workspace", async () => {
            const { service, reembedding, logger } = await build()

            await expect(service.reembed({})).resolves.toBeUndefined()

            expect(reembedding.reembed).not.toHaveBeenCalled()
            expect(logger.warn).toHaveBeenCalledWith(KnowledgeLogEvent.PayloadRefused, { job: "reembed" })
        })
    })
})

describe("KnowledgeJobsService fair groups", () => {
    const cite = (firstPartId: string | null) => ({
        id: "p2",
        title: "R1",
        updatedAt: "2026-11-11T00:00:00.000Z",
        passages: 200,
        part: null,
        firstPartId,
    })

    it("groups the truths jobs of every part of a file under its document, and reads a source's document once", async () => {
        const { service, cites } = await build()
        cites.of.mockResolvedValue(new Map([["p2", cite("p1")]]))

        const first = await service.fairGroupOf({ sourceId: "p2", workspaceId: WS })
        const again = await service.fairGroupOf({ sourceId: "p2", workspaceId: WS })

        expect([first, again]).toEqual(["document:p1", "document:p1"])
        expect(cites.of).toHaveBeenCalledTimes(1)
        expect(cites.of).toHaveBeenCalledWith(WS, ["p2"])
    })

    it("groups a whole document under itself, and has no group for a source that is gone or a payload of another shape", async () => {
        const { service, cites } = await build()
        cites.of.mockResolvedValueOnce(new Map([["p2", cite(null)]])).mockResolvedValueOnce(new Map())

        expect(await service.fairGroupOf({ sourceId: "p2", workspaceId: WS })).toBe("document:p2")
        expect(await service.fairGroupOf({ sourceId: "gone", workspaceId: WS })).toBeNull()
        expect(await service.fairGroupOf({})).toBeNull()
    })

    it("puts every critique run in one group", async () => {
        const { service } = await build()

        await expect(service.critiqueGroupOf()).resolves.toBe("dossier.review")
    })
})
