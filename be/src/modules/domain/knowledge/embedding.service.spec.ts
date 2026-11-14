import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AI } from "@modules/integrations/ai"
import type { AiService, AiUsage } from "@modules/integrations/ai"
import { LOGGER, withWorkScope, workInScope } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PHI_SHIP_VI } from "@tests/fixtures/i18n/knowledge-spec.messages"
import { EmbeddingService } from "./embedding.service"
import { UsageMeterService } from "./usage-meter.service"

const USAGE: AiUsage = { promptTokens: 3, completionTokens: 0, totalTokens: 3, costUsd: null }

const build = async () => {
    const ai = mock<AiService>()
    ai.embeddingModel.mockReturnValue("text-embedding-3-small@1536")
    ai.available.mockReturnValue(true)
    ai.embeddingsServed.mockReturnValue(true)
    const usage = mock<UsageMeterService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            EmbeddingService,
            { provide: AI, useValue: ai },
            { provide: LOGGER, useValue: logger },
            { provide: UsageMeterService, useValue: usage },
        ],
    }).compile()
    return { service: moduleRef.get(EmbeddingService), ai, usage, logger }
}

/** A vector of the stored size. */
const vector = (seed: number): Array<number> => Array.from({ length: 1536 }, () => seed)

const texts = (count: number): Array<string> => Array.from({ length: count }, (_, index) => `t${index}`)

describe("EmbeddingService", () => {
    it("tells whether embeddings are configured and which model they use", async () => {
        const { service } = await build()

        expect(service.configured()).toBe(true)
        expect(service.model()).toBe("text-embedding-3-small@1536")
    })

    it("is not configured once the gateway answered that it does not serve embeddings (no OpenAI key in its pool)", async () => {
        const { service, ai } = await build()
        ai.embeddingsServed.mockReturnValue(false)

        expect(service.configured()).toBe(false)
    })

    it("embeds in batches of 32, meters every batch and reports the progress", async () => {
        const { service, ai, usage } = await build()
        ai.embed.mockImplementation(({ input }) =>
            Promise.resolve({ vectors: input.map((_, index) => vector(index)), usage: USAGE }),
        )
        const progress = jest.fn(() => Promise.resolve())

        const vectors = await service.embed({ workspaceId: "ws-1", texts: texts(40), timeoutMs: 5000 }, progress)

        expect(vectors).toHaveLength(40)
        expect(ai.embed).toHaveBeenCalledTimes(2)
        expect(ai.embed).toHaveBeenCalledWith({
            input: texts(40).slice(0, 32),
            dimensions: 1536,
            timeoutMs: 5000,
        })
        expect(usage.record).toHaveBeenCalledTimes(2)
        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "embedding",
            module: "knowledge",
            model: "text-embedding-3-small@1536",
            usage: USAGE,
            promptChars: 86,
        })
        expect(progress.mock.calls).toEqual([
            [32, 40],
            [40, 40],
        ])
    })

    it("does not meter work done for the platform itself", async () => {
        const { service, ai, usage } = await build()
        ai.embed.mockResolvedValue({ vectors: [vector(1)], usage: USAGE })

        await expect(service.embed({ workspaceId: null, texts: ["a"], timeoutMs: 5000 })).resolves.toEqual([vector(1)])

        expect(usage.record).not.toHaveBeenCalled()
    })

    it("works without a progress callback", async () => {
        const { service, ai } = await build()
        ai.embed.mockResolvedValue({ vectors: [vector(1)], usage: USAGE })

        await expect(service.embed({ workspaceId: "ws-1", texts: ["a"], timeoutMs: 5000 })).resolves.toEqual([
            vector(1),
        ])
    })

})

describe("EmbeddingService: refusals", () => {
    it("refuses a count or a size of vectors other than asked, and logs it", async () => {
        const { service, ai, usage, logger } = await build()
        ai.embed.mockResolvedValueOnce({ vectors: [[1]], usage: USAGE })
        ai.embed.mockResolvedValueOnce({ vectors: [], usage: USAGE })

        await expect(service.embed({ workspaceId: "ws-1", texts: ["a"], timeoutMs: 5000 })).resolves.toBeNull()
        await expect(service.embed({ workspaceId: "ws-1", texts: ["a"], timeoutMs: 5000 })).resolves.toBeNull()

        expect(usage.record).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledTimes(2)
    })

    it("answers null for no texts and when a batch cannot be embedded", async () => {
        const { service, ai } = await build()
        ai.embed.mockResolvedValue(null)

        await expect(service.embed({ workspaceId: "ws-1", texts: [], timeoutMs: 5000 })).resolves.toBeNull()
        await expect(service.embed({ workspaceId: "ws-1", texts: ["a"], timeoutMs: 5000 })).resolves.toBeNull()
    })
})

describe("EmbeddingService: the credit pool and the step booked", () => {
    it("checks the credit pool before every batch and stops at an empty pool: no call, nothing booked", async () => {
        const { service, ai, usage } = await build()
        ai.embed.mockImplementation(({ input }) =>
            Promise.resolve({ vectors: input.map((_, index) => vector(index)), usage: USAGE }),
        )
        usage.blockedBy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

        await expect(service.embed({ workspaceId: "ws-1", texts: texts(40), timeoutMs: 5000 })).resolves.toBeNull()

        expect(usage.blockedBy).toHaveBeenNthCalledWith(1, "ws-1", "embedding", true)
        expect(ai.embed).toHaveBeenCalledTimes(1)
        expect(usage.record).toHaveBeenCalledTimes(1)
    })

    it("books a document's batches as its `index` step and a query as `search`", async () => {
        const { service, ai, usage } = await build()
        ai.embed.mockImplementation(({ input }) =>
            Promise.resolve({ vectors: input.map((_, index) => vector(index)), usage: USAGE }),
        )
        const steps: Array<unknown> = []
        usage.record.mockImplementation(() => {
            steps.push(workInScope())
            return Promise.resolve()
        })

        await withWorkScope({ kind: "document_read", ref: "source:s1" }, () =>
            service.embed({ workspaceId: "ws-1", texts: texts(2), timeoutMs: 5000 }),
        )
        await service.embed({ workspaceId: "ws-1", texts: [PHI_SHIP_VI], timeoutMs: 5000, step: "search" })

        expect(steps).toEqual([
            { kind: "document_read", ref: "source:s1", stepKey: "index", agentId: null },
            { kind: "knowledge_search", ref: null, stepKey: "search", agentId: null },
        ])
    })
})
