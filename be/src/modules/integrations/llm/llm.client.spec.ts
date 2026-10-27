import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LlmClient } from "./llm.client"
import { LLM_EMBEDDING_DIMENSIONS } from "./llm.contracts"
import type { LlmUsage } from "./llm.contracts"
import { LLM_POOL } from "./llm.decorators"
import { LlmLogEvent } from "./llm.log-events"
import type { LlmPool } from "./llm.port"

const USAGE: LlmUsage = { promptTokens: 10, completionTokens: 0, totalTokens: 10, costUsd: 0.001 }

const vector = (seed: number, length = LLM_EMBEDDING_DIMENSIONS): Array<number> => Array.from({ length }, () => seed)

const build = async (ready = true) => {
    const pool = mock<LlmPool>()
    pool.chatReady.mockReturnValue(ready)
    pool.embeddingsReady.mockReturnValue(ready)
    pool.embeddingModel.mockReturnValue("embed-model")
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [LlmClient, { provide: LLM_POOL, useValue: pool }, { provide: LOGGER, useValue: logger }],
    }).compile()
    return { client: moduleRef.get(LlmClient), pool, logger }
}

describe("LlmClient", () => {
    describe("embeddingsConfigured and embeddingModel", () => {
        it("reports the pool's embeddings key and the model new vectors are made with", async () => {
            const { client } = await build()

            expect(client.embeddingsConfigured()).toBe(true)
            expect(client.embeddingModel()).toBe("embed-model")
        })

        it("reports no key while the pool has none, and still names the model", async () => {
            const { client } = await build(false)

            expect(client.embeddingsConfigured()).toBe(false)
            expect(client.embeddingModel()).toBe("embed-model")
        })
    })
})

describe("LlmClient", () => {
    describe("embed", () => {
        it("asks the pool for the stored vector size and answers its vectors", async () => {
            const { client, pool } = await build()
            pool.embed.mockResolvedValue({ vectors: [vector(1), vector(2)], usage: USAGE })

            const embedding = await client.embed(["a", "b"], 5000)

            expect(embedding).toEqual({ vectors: [vector(1), vector(2)], usage: USAGE })
            expect(pool.embed).toHaveBeenCalledWith({
                input: ["a", "b"],
                dimensions: LLM_EMBEDDING_DIMENSIONS,
                timeoutMs: 5000,
            })
        })

        it("asks nothing for no text or without a key", async () => {
            const keyed = await build()
            const keyless = await build(false)

            await expect(keyed.client.embed([], 5000)).resolves.toBeNull()
            await expect(keyless.client.embed(["a"], 5000)).resolves.toBeNull()

            expect(keyed.pool.embed).not.toHaveBeenCalled()
            expect(keyless.pool.embed).not.toHaveBeenCalled()
        })

        it("answers null when the pool could not embed", async () => {
            const { client, pool } = await build()
            pool.embed.mockResolvedValue(null)

            await expect(client.embed(["a"], 5000)).resolves.toBeNull()
        })

        it.each([
            ["a short vector", [vector(1, 3), vector(2)]],
            ["one vector too few", [vector(1)]],
            ["an empty (base64) vector", [vector(1), []]],
        ])("refuses %s and logs the counts", async (_case, vectors) => {
            const { client, pool, logger } = await build()
            pool.embed.mockResolvedValue({ vectors, usage: USAGE })

            await expect(client.embed(["a", "b"], 5000)).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(LlmLogEvent.EmbeddingUnexpected, {
                expected: 2,
                received: vectors.length,
            })
        })
    })
})

describe("LlmClient", () => {
    describe("complete", () => {
        it("sends the rules and the question through the pool in text mode", async () => {
            const { client, pool } = await build()
            const completion = { text: "facts", model: "deepseek-chat", usage: USAGE }
            pool.chat.mockResolvedValue(completion)

            await expect(client.complete({ system: "rules", prompt: "doc", timeoutMs: 9000 })).resolves.toBe(completion)

            expect(pool.chat).toHaveBeenCalledWith({
                messages: [
                    { role: "system", content: "rules" },
                    { role: "user", content: "doc" },
                ],
                json: false,
                timeoutMs: 9000,
            })
        })

        it("answers null without a chat key and asks nothing", async () => {
            const { client, pool } = await build(false)

            await expect(client.complete({ system: "s", prompt: "p", timeoutMs: 1000 })).resolves.toBeNull()

            expect(pool.chat).not.toHaveBeenCalled()
        })

        it("answers null when no lane of the pool answered", async () => {
            const { client, pool } = await build()
            pool.chat.mockResolvedValue(null)

            await expect(client.complete({ system: "s", prompt: "p", timeoutMs: 1000 })).resolves.toBeNull()
        })
    })
})
