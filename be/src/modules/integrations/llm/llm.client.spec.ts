import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient, HttpResponse } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LlmClient } from "./llm.client"
import { LLM_EMBEDDING_DIMENSIONS } from "./llm.contracts"
import { LLM_OPTIONS } from "./llm.decorators"
import { LlmLogEvent } from "./llm.log-events"
import type { LlmOptions } from "./llm.options"

const optionsOf = builder<LlmOptions>({
    embedding: { apiKey: new Secret("embed-key"), baseUrl: "https://embed.test/v1", model: "embed-model" },
    chat: { apiKey: new Secret("chat-key"), baseUrl: "https://chat.test/v1", model: "chat-model" },
})

const vector = (seed: number): Array<number> => Array.from({ length: LLM_EMBEDDING_DIMENSIONS }, () => seed)

const answer = (body: unknown, status = 200): HttpResponse => ({
    status,
    headers: {},
    url: "",
    body: typeof body === "string" ? body : JSON.stringify(body),
})

const build = async (options: LlmOptions = optionsOf()) => {
    const http = mock<HttpClient>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LlmClient,
            { provide: LLM_OPTIONS, useValue: options },
            { provide: HTTP_CLIENT, useValue: http },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(LlmClient), http, logger }
}

const NO_EMBEDDING_KEY = optionsOf({
    embedding: { apiKey: null, baseUrl: "https://embed.test/v1", model: "embed-model" },
})
const NO_CHAT_KEY = optionsOf({ chat: { apiKey: null, baseUrl: "https://chat.test/v1", model: "chat-model" } })

describe("LlmClient", () => {
    describe("embeddingsConfigured and embeddingModel", () => {
        it("reports a configured key and the model new vectors are made with", async () => {
            const { client } = await build()

            expect(client.embeddingsConfigured()).toBe(true)
            expect(client.embeddingModel()).toBe("embed-model")
        })

        it("reports no key", async () => {
            const { client } = await build(NO_EMBEDDING_KEY)

            expect(client.embeddingsConfigured()).toBe(false)
        })
    })

    describe("embed", () => {
        it("sends one batch and answers the vectors in the order of the texts with the reported usage", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(
                answer({
                    data: [
                        { index: 1, embedding: vector(2) },
                        { index: 0, embedding: vector(1) },
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10, cost: 0.001 },
                }),
            )

            const embedding = await client.embed(["a".repeat(9000), "b"], 5000)

            expect(embedding?.vectors[0]?.[0]).toBe(1)
            expect(embedding?.vectors[1]?.[0]).toBe(2)
            expect(embedding?.usage).toEqual({
                promptTokens: 10,
                completionTokens: 0,
                totalTokens: 10,
                costUsd: 0.001,
            })
            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "https://embed.test/v1/embeddings",
                headers: { Authorization: "Bearer embed-key", "X-Title": "NIVO OS" },
                body: {
                    model: "embed-model",
                    input: ["a".repeat(8000), "b"],
                    dimensions: LLM_EMBEDDING_DIMENSIONS,
                },
                read: "text",
                timeoutMs: 5000,
            })
        })

        it("reads rows without an index as the first and reports missing usage as absent", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({ data: [{ embedding: vector(3) }] }))

            const embedding = await client.embed(["a"], 5000)

            expect(embedding?.vectors).toHaveLength(1)
            expect(embedding?.usage).toEqual({
                promptTokens: null,
                completionTokens: null,
                totalTokens: null,
                costUsd: null,
            })
        })

        it("sorts missing and non-numeric indexes as zero before positive indexes", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(
                answer({
                    data: [
                        { index: 2, embedding: vector(2) },
                        { embedding: vector(3) },
                        { index: "1", embedding: vector(4) },
                    ],
                }),
            )

            await expect(client.embed(["a", "b", "c"], 5000)).resolves.toEqual({
                vectors: [vector(3), vector(4), vector(2)],
                usage: { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null },
            })
        })

        it("rejects a non-numeric entry in a vector of the required dimensions", async () => {
            const { client, http, logger } = await build()
            http.request.mockResolvedValue(answer({ data: [{ embedding: ["x", ...vector(1).slice(1)] }] }))

            await expect(client.embed(["a"], 5000)).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(LlmLogEvent.EmbeddingFailed, { reason: "unexpected-shape" })
        })

        it("reads only usage numbers that are valid", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(
                answer({
                    data: [{ embedding: vector(3) }],
                    usage: { prompt_tokens: "x", completion_tokens: -1, total_tokens: null, cost: 0 },
                }),
            )

            const embedding = await client.embed(["a"], 5000)

            expect(embedding?.usage).toEqual({
                promptTokens: null,
                completionTokens: null,
                totalTokens: null,
                costUsd: 0,
            })
        })

        it("treats a usage that is not an object as absent", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({ data: [{ embedding: vector(3) }], usage: 5 }))

            await expect(client.embed(["a"], 5000)).resolves.toMatchObject({
                usage: { promptTokens: null, costUsd: null },
            })
        })

        it("answers null without a key and without texts, and calls nothing", async () => {
            const keyless = await build(NO_EMBEDDING_KEY)
            const { client, http } = await build()

            await expect(keyless.client.embed(["a"], 5000)).resolves.toBeNull()
            await expect(client.embed([], 5000)).resolves.toBeNull()

            expect(keyless.http.request).not.toHaveBeenCalled()
            expect(http.request).not.toHaveBeenCalled()
        })

        it("answers null and logs a refusal with a short body when the provider fails", async () => {
            const { client, http, logger } = await build()
            http.request.mockResolvedValue(answer("x".repeat(500), 429))

            await expect(client.embed(["a"], 5000)).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(LlmLogEvent.EmbeddingRefused, {
                status: 429,
                body: "x".repeat(200),
            })
        })

        it("logs an empty body for a refusal that carries none as text", async () => {
            const { client, http, logger } = await build()
            http.request.mockResolvedValue({ status: 500, headers: {}, url: "", body: undefined })

            await expect(client.embed(["a"], 5000)).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(LlmLogEvent.EmbeddingRefused, { status: 500, body: "" })
        })

        it("answers null and logs the cause when the call throws", async () => {
            const { client, http, logger } = await build()
            const failure = new Error("timeout")
            http.request.mockRejectedValue(failure)

            await expect(client.embed(["a"], 5000)).resolves.toBeNull()

            expect(logger.error).toHaveBeenCalledWith(LlmLogEvent.EmbeddingFailed, failure)
        })

        it.each([
            ["a body that is not JSON", "<html>"],
            ["a body that is not text", undefined],
            ["a body that is not an object", "5"],
            ["no data array", {}],
            ["fewer rows than texts", { data: [] }],
            ["a row that is not an object", { data: ["x"] }],
            ["a row with no embedding array", { data: [{ index: 0 }] }],
            ["a non-numeric entry", { data: [{ index: 0, embedding: ["x"] }] }],
            ["a vector of the wrong size", { data: [{ index: 0, embedding: [1, 2, 3] }] }],
        ])("answers null for %s", async (_name, body) => {
            const { client, http, logger } = await build()
            http.request.mockResolvedValue(
                body === undefined ? { status: 200, headers: {}, url: "", body } : answer(body),
            )

            await expect(client.embed(["a"], 5000)).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(LlmLogEvent.EmbeddingFailed, { reason: "unexpected-shape" })
        })

        it("logs that a body was not JSON", async () => {
            const { client, http, logger } = await build()
            http.request.mockResolvedValue(answer("<html>"))

            await client.embed(["a"], 5000)

            expect(logger.error).toHaveBeenCalledWith(LlmLogEvent.BodyUnreadable, expect.any(SyntaxError))
        })
    })

    describe("complete", () => {
        const request = { system: "rules", prompt: "question", timeoutMs: 5000 }

        it("answers the trimmed text, the model that answered and the usage", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(
                answer({
                    model: "answering-model",
                    choices: [{ message: { content: "  an answer \n" } }],
                    usage: { prompt_tokens: 7, completion_tokens: 3 },
                }),
            )

            await expect(client.complete(request)).resolves.toEqual({
                text: "an answer",
                model: "answering-model",
                usage: { promptTokens: 7, completionTokens: 3, totalTokens: null, costUsd: null },
            })

            expect(http.request).toHaveBeenCalledWith({
                method: "POST",
                url: "https://chat.test/v1/chat/completions",
                headers: { Authorization: "Bearer chat-key", "X-Title": "NIVO OS" },
                body: {
                    model: "chat-model",
                    temperature: 0,
                    messages: [
                        { role: "system", content: "rules" },
                        { role: "user", content: "question" },
                    ],
                },
                read: "text",
                timeoutMs: 5000,
            })
        })

        it("names the configured model when the provider does not", async () => {
            const { client, http } = await build()
            http.request.mockResolvedValue(answer({ choices: [{ message: { content: "ok" } }] }))

            await expect(client.complete(request)).resolves.toMatchObject({ model: "chat-model" })
        })

        it("answers null without a key and calls nothing", async () => {
            const { client, http } = await build(NO_CHAT_KEY)

            await expect(client.complete(request)).resolves.toBeNull()

            expect(http.request).not.toHaveBeenCalled()
        })

        it("answers null and logs a refusal when the provider fails", async () => {
            const { client, http, logger } = await build()
            http.request.mockResolvedValue(answer("busy now", 503))

            await expect(client.complete(request)).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(LlmLogEvent.CompletionRefused, { status: 503, body: "busy now" })
        })

        it("answers null and logs the cause when the call throws", async () => {
            const { client, http, logger } = await build()
            const failure = new Error("offline")
            http.request.mockRejectedValue(failure)

            await expect(client.complete(request)).resolves.toBeNull()

            expect(logger.error).toHaveBeenCalledWith(LlmLogEvent.CompletionFailed, failure)
        })

        it.each([
            ["a body that is not JSON", "<html>"],
            ["a body that is not an object", "5"],
            ["no choices", {}],
            ["a choice that is not an object", { choices: ["x"] }],
            ["a choice with no message", { choices: [{}] }],
            ["a message with no text", { choices: [{ message: { content: 5 } }] }],
            ["a blank text", { choices: [{ message: { content: "   " } }] }],
        ])("answers null for %s", async (_name, body) => {
            const { client, http, logger } = await build()
            http.request.mockResolvedValue(answer(body))

            await expect(client.complete(request)).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(LlmLogEvent.CompletionFailed, { reason: "empty-answer" })
        })
    })
})
