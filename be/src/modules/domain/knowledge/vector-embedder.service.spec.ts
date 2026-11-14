import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EmbeddingService } from "./embedding.service"
import { UsageMeterService } from "./usage-meter.service"
import { VectorEmbedderService } from "./vector-embedder.service"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async () => {
    const embeddings = mock<EmbeddingService>()
    const usage = mock<UsageMeterService>()
    embeddings.configured.mockReturnValue(true)
    embeddings.model.mockReturnValue("text-embedding-3-small@1536")
    usage.blockedBy.mockResolvedValue(false)
    const moduleRef = await Test.createTestingModule({
        providers: [
            VectorEmbedderService,
            { provide: EmbeddingService, useValue: embeddings },
            { provide: UsageMeterService, useValue: usage },
        ],
    }).compile()
    return { embedder: moduleRef.get(VectorEmbedderService), embeddings, usage }
}

describe("VectorEmbedderService", () => {
    it("tells whether the deployment can embed and under which model new vectors are made", async () => {
        const { embedder } = await build()

        expect(embedder.configured()).toBe(true)
        expect(embedder.model()).toBe("text-embedding-3-small@1536")
    })

    it("embeds the texts of the workspace that pays after the credit check", async () => {
        const { embedder, embeddings, usage } = await build()
        embeddings.embed.mockResolvedValue([[0.5, 1]])

        await expect(embedder.embed(WS, ["a"])).resolves.toEqual({ kind: "vectors", vectors: [[0.5, 1]] })

        expect(usage.blockedBy).toHaveBeenCalledWith(WS, "embedding", true)
        expect(embeddings.embed).toHaveBeenCalledWith({ workspaceId: WS, texts: ["a"], timeoutMs: 20_000 })
    })

    it("answers blocked, without a call, when the credit pool is empty", async () => {
        const { embedder, embeddings, usage } = await build()
        usage.blockedBy.mockResolvedValue(true)

        await expect(embedder.embed(WS, ["a"])).resolves.toEqual({ kind: "blocked" })

        expect(embeddings.embed).not.toHaveBeenCalled()
    })

    it("answers failed when the provider gives no vectors", async () => {
        const { embedder, embeddings } = await build()
        embeddings.embed.mockResolvedValue(null)

        await expect(embedder.embed(WS, ["a"])).resolves.toEqual({ kind: "failed" })
    })
})
