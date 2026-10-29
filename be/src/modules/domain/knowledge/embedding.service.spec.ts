import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AI } from "@modules/integrations/ai"
import type { AiService, AiUsage } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EmbeddingService } from "./embedding.service"
import { UsageMeterService } from "./usage-meter.service"

const USAGE: AiUsage = { promptTokens: 3, completionTokens: 0, totalTokens: 3, costUsd: null }

const build = async () => {
    const ai = mock<AiService>()
    ai.embeddingModel.mockReturnValue("embed-model")
    ai.available.mockReturnValue(true)
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
        expect(service.model()).toBe("embed-model")
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
            model: "embed-model",
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
