import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LLM } from "@modules/integrations/llm"
import type { LlmPort, LlmUsage } from "@modules/integrations/llm"
import { EmbeddingService } from "./embedding.service"
import { UsageMeterService } from "./usage-meter.service"

const USAGE: LlmUsage = { promptTokens: 3, completionTokens: 0, totalTokens: 3, costUsd: null }

const build = async () => {
    const llm = mock<LlmPort>()
    llm.embeddingModel.mockReturnValue("embed-model")
    llm.embeddingsConfigured.mockReturnValue(true)
    const usage = mock<UsageMeterService>()
    const moduleRef = await Test.createTestingModule({
        providers: [EmbeddingService, { provide: LLM, useValue: llm }, { provide: UsageMeterService, useValue: usage }],
    }).compile()
    return { service: moduleRef.get(EmbeddingService), llm, usage }
}

const texts = (count: number): Array<string> => Array.from({ length: count }, (_, index) => `t${index}`)

describe("EmbeddingService", () => {
    it("tells whether embeddings are configured and which model they use", async () => {
        const { service } = await build()

        expect(service.configured()).toBe(true)
        expect(service.model()).toBe("embed-model")
    })

    it("embeds in batches of 32, meters every batch and reports the progress", async () => {
        const { service, llm, usage } = await build()
        llm.embed.mockImplementation((batch) =>
            Promise.resolve({ vectors: batch.map((_, index) => [index]), usage: USAGE }),
        )
        const progress = jest.fn(() => Promise.resolve())

        const vectors = await service.embed({ workspaceId: "ws-1", texts: texts(40), timeoutMs: 5000 }, progress)

        expect(vectors).toHaveLength(40)
        expect(llm.embed).toHaveBeenCalledTimes(2)
        expect(llm.embed).toHaveBeenCalledWith(texts(40).slice(0, 32), 5000)
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
        const { service, llm, usage } = await build()
        llm.embed.mockResolvedValue({ vectors: [[1]], usage: USAGE })

        await expect(service.embed({ workspaceId: null, texts: ["a"], timeoutMs: 5000 })).resolves.toEqual([[1]])

        expect(usage.record).not.toHaveBeenCalled()
    })

    it("works without a progress callback", async () => {
        const { service, llm } = await build()
        llm.embed.mockResolvedValue({ vectors: [[1]], usage: USAGE })

        await expect(service.embed({ workspaceId: "ws-1", texts: ["a"], timeoutMs: 5000 })).resolves.toEqual([[1]])
    })

    it("answers null for no texts and when a batch cannot be embedded", async () => {
        const { service, llm } = await build()
        llm.embed.mockResolvedValue(null)

        await expect(service.embed({ workspaceId: "ws-1", texts: [], timeoutMs: 5000 })).resolves.toBeNull()
        await expect(service.embed({ workspaceId: "ws-1", texts: ["a"], timeoutMs: 5000 })).resolves.toBeNull()
    })
})
