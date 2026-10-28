import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { AiRouterService, ChatCompletion, EmbeddingsResponse, RouterEvents, Usage } from "@starci/ai-router"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AiPoolClient } from "./ai-pool.client"
import { AI_POOL_OPTIONS, AI_POOL_ROUTER } from "./ai-pool.decorators"
import { AiPoolLogEvent } from "./ai-pool.log-events"
import type { AiPoolOptions } from "./ai-pool.options"

const ROUTING = {
    requestId: "r-1",
    provider: "deepseek",
    key: "DEEPSEEK_API_KEY",
    model: "deepseek-chat",
    attempts: 1,
    latencyMs: 9,
}

const KEYED: AiPoolOptions = {
    chat: [
        {
            id: "deepseek",
            baseUrl: "https://deepseek.test/v1",
            keys: [{ alias: "deepseek-1", secret: new Secret("sk-a") }],
            model: "deepseek-chat",
            smartModel: null,
        },
        {
            id: "openrouter",
            baseUrl: "https://openrouter.test/v1",
            keys: [{ alias: "openrouter-1", secret: new Secret("sk-or") }],
            model: "deepseek/deepseek-chat",
            smartModel: null,
        },
    ],
    embedding: {
        id: "embeddings",
        baseUrl: "https://embeddings.test/v1",
        keys: [{ alias: "embeddings-1", secret: new Secret("sk-e") }],
        model: "embed-model",
        smartModel: null,
    },
}

/** The pool parsed from an environment with no AI key at all. */
const KEYLESS: AiPoolOptions = {
    chat: [
        { id: "deepseek", baseUrl: "https://deepseek.test/v1", keys: [], model: "deepseek-chat", smartModel: null },
        {
            id: "openrouter",
            baseUrl: "https://openrouter.test/v1",
            keys: [],
            model: "deepseek/deepseek-chat",
            smartModel: null,
        },
    ],
    embedding: {
        id: "embeddings",
        baseUrl: "https://embeddings.test/v1",
        keys: [],
        model: "embed-model",
        smartModel: null,
    },
}

/** OpenRouter adds the cost to the usage it reports. */
type ReportedUsage = Usage & { readonly cost?: number }

const completion = (content: string | null, usage?: ReportedUsage): ChatCompletion => ({
    id: "c-1",
    object: "chat.completion",
    created: 0,
    model: "deepseek-chat",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    ...(usage === undefined ? {} : { usage }),
    routing: ROUTING,
})

/** A router failure as `@starci/ai-router` throws it: a class, a status and where it went, never a key value. */
const routerFailure = (errorClass: string): Readonly<Record<string, unknown>> => ({
    message: "every lane failed",
    errorClass,
    status: 429,
    provider: "deepseek",
    key: "DEEPSEEK_API_KEY",
    model: "deepseek-chat",
    attempts: [{}, {}],
})

const build = async (overrides: Partial<AiPoolOptions> = {}) => {
    const options = builder<AiPoolOptions>(KEYED)(overrides)
    const router = mock<AiRouterService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiPoolClient,
            { provide: AI_POOL_OPTIONS, useValue: options },
            { provide: AI_POOL_ROUTER, useValue: router },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(AiPoolClient), router, logger }
}

/** The client as the app composes it with no AI key at all: an empty pool and no router. */
const buildKeyless = async () => {
    const options = builder<AiPoolOptions>(KEYLESS)()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiPoolClient,
            { provide: AI_POOL_OPTIONS, useValue: options },
            { provide: AI_POOL_ROUTER, useValue: null },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(AiPoolClient), logger }
}

describe("AiPoolClient", () => {
    describe("without a key", () => {
        it("boots with no router, is not ready, answers null and subscribes nothing, but still names the model", async () => {
            const { client, logger } = await buildKeyless()

            client.onModuleInit()

            expect(client.chatReady()).toBe(false)
            expect(client.embeddingsReady()).toBe(false)
            expect(client.embeddingModel()).toBe("embed-model")
            await expect(client.chat({ messages: [], json: false, timeoutMs: 1000 })).resolves.toBeNull()
            await expect(client.embed({ input: ["a"], dimensions: 3, timeoutMs: 1000 })).resolves.toBeNull()
            expect(logger.warn).not.toHaveBeenCalled()
        })

        it("is not ready for chat while only the embeddings endpoint holds a key", async () => {
            const { client, router } = await build({ chat: [] })

            expect(client.chatReady()).toBe(false)
            expect(client.embeddingsReady()).toBe(true)
            await expect(client.chat({ messages: [], json: false, timeoutMs: 1000 })).resolves.toBeNull()
            expect(router.chat).not.toHaveBeenCalled()
        })
    })
})

describe("AiPoolClient", () => {
    describe("chat", () => {
        it("asks DeepSeek first with OpenRouter as the fallback, within one deadline, in JSON mode when asked", async () => {
            const { client, router } = await build()
            const usage = { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6, cost: 0.01 }
            router.chat.mockResolvedValue(completion('  {"a":1} ', usage))

            const answer = await client.chat({
                messages: [{ role: "user", content: "hi" }],
                json: true,
                timeoutMs: 20_000,
            })

            expect(answer).toEqual({
                text: '{"a":1}',
                model: "deepseek-chat",
                usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6, costUsd: 0.01 },
            })
            expect(router.chat).toHaveBeenCalledWith(
                {
                    messages: [{ role: "user", content: "hi" }],
                    temperature: 0,
                    response_format: { type: "json_object" },
                },
                {
                    policy: {
                        model: "deepseek-chat",
                        fallbacks: ["deepseek/deepseek-chat"],
                        providers: ["deepseek", "openrouter"],
                        timeoutMs: 20_000,
                        deadlineMs: 20_000,
                    },
                },
            )
        })

        it("sends no response format for text and reports missing usage as null", async () => {
            const { client, router } = await build()
            router.chat.mockResolvedValue(completion("plain"))

            const answer = await client.chat({ messages: [], json: false, timeoutMs: 1000 })

            expect(router.chat.mock.calls[0]?.[0]).not.toHaveProperty("response_format")
            expect(answer?.usage).toEqual({
                promptTokens: null,
                completionTokens: null,
                totalTokens: null,
                costUsd: null,
            })
        })

        it("answers null and logs where an empty answer came from", async () => {
            const { client, router, logger } = await build()
            router.chat.mockResolvedValue(completion(null))

            await expect(client.chat({ messages: [], json: false, timeoutMs: 1000 })).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(AiPoolLogEvent.ChatEmpty, {
                provider: "deepseek",
                model: "deepseek-chat",
            })
        })
    })
})

describe("AiPoolClient", () => {
    describe("chat failures", () => {
        it("answers null on a router failure such as no healthy key, logging class and lanes but no key or message", async () => {
            const { client, router, logger } = await build()
            router.chat.mockRejectedValue(routerFailure("no_candidate"))

            await expect(client.chat({ messages: [], json: false, timeoutMs: 1000 })).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(AiPoolLogEvent.ChatFailed, {
                errorClass: "no_candidate",
                status: 429,
                provider: "deepseek",
                key: "DEEPSEEK_API_KEY",
                model: "deepseek-chat",
                attempts: 2,
            })
            expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("sk-a")
            expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("every lane failed")
        })

        it("logs an unknown failure with empty fields", async () => {
            const { client, router, logger } = await build()
            router.chat.mockRejectedValue("boom")

            await expect(client.chat({ messages: [], json: false, timeoutMs: 1000 })).resolves.toBeNull()

            expect(logger.warn).toHaveBeenCalledWith(AiPoolLogEvent.ChatFailed, {
                errorClass: "unknown",
                status: null,
                provider: null,
                key: null,
                model: null,
                attempts: 0,
            })
        })
    })
})

const embeddings = (data: EmbeddingsResponse["data"]): EmbeddingsResponse => ({
    object: "list",
    data,
    model: "embed-model",
    usage: { prompt_tokens: 3, total_tokens: 3 },
    routing: { ...ROUTING, provider: "embeddings" },
})

/** Answers the pool refuses: another form, another size, another count. */
const UNEXPECTED_EMBEDDINGS: ReadonlyArray<[string, Array<string>, EmbeddingsResponse["data"]]> = [
    ["a base64 entry", ["a"], [{ object: "embedding", index: 0, embedding: "AAAA" }]],
    [
        "a short vector",
        ["a", "b"],
        [
            { object: "embedding", index: 0, embedding: [1] },
            { object: "embedding", index: 1, embedding: [2, 2] },
        ],
    ],
    ["one vector too few", ["a", "b"], [{ object: "embedding", index: 0, embedding: [1, 1] }]],
]

describe("AiPoolClient", () => {
    describe("embed", () => {
        it("asks the embeddings endpoint only, with the size, truncated texts and vectors back in text order", async () => {
            const { client, router } = await build()
            router.embeddings.mockResolvedValue(
                embeddings([
                    { object: "embedding", index: 1, embedding: [2, 2] },
                    { object: "embedding", index: 0, embedding: [1, 1] },
                ]),
            )

            const answer = await client.embed({ input: ["a".repeat(9000), "b"], dimensions: 2, timeoutMs: 5000 })

            expect(answer).toEqual({
                vectors: [
                    [1, 1],
                    [2, 2],
                ],
                usage: { promptTokens: 3, completionTokens: null, totalTokens: 3, costUsd: null },
            })
            const [request, options] = router.embeddings.mock.calls[0] ?? []
            expect(request).toMatchObject({ model: "embed-model", dimensions: 2 })
            expect(request?.input[0]).toHaveLength(8000)
            expect(options?.policy).toEqual({
                providers: ["embeddings"],
                allowFallback: false,
                timeoutMs: 5000,
                deadlineMs: 5000,
            })
        })

        it("asks nothing for no text", async () => {
            const { client, router } = await build()

            await expect(client.embed({ input: [], dimensions: 2, timeoutMs: 5000 })).resolves.toBeNull()
            expect(router.embeddings).not.toHaveBeenCalled()
        })

        it.each(UNEXPECTED_EMBEDDINGS)("refuses %s and logs the counts", async (_case, input, data) => {
            const { client, router, logger } = await build()
            router.embeddings.mockResolvedValue(embeddings(data))

            await expect(client.embed({ input, dimensions: 2, timeoutMs: 5000 })).resolves.toBeNull()
            expect(logger.warn).toHaveBeenCalledWith(AiPoolLogEvent.EmbeddingUnexpected, {
                expected: input.length,
                received: data.length,
            })
        })

        it("answers null and logs on a router failure", async () => {
            const { client, router, logger } = await build()
            router.embeddings.mockRejectedValue(routerFailure("auth"))

            await expect(client.embed({ input: ["a"], dimensions: 2, timeoutMs: 5000 })).resolves.toBeNull()
            expect(logger.warn).toHaveBeenCalledWith(
                AiPoolLogEvent.EmbeddingFailed,
                expect.objectContaining({ errorClass: "auth" }),
            )
        })
    })
})

/** Starts the client and answers the handler it subscribed for a router event. */
const subscribed = async () => {
    const built = await build()
    built.client.onModuleInit()
    const handler =
        <E extends keyof RouterEvents>(event: E) =>
        (payload: RouterEvents[E]): void => {
            const call = built.router.on.mock.calls.find(([name]) => name === event)
            call?.[1](payload)
        }
    return { ...built, handler }
}

const ATTEMPT = {
    type: "attempt",
    requestId: "r-1",
    operation: "chat",
    attempt: 1,
    provider: "deepseek",
    key: "DEEPSEEK_KEY_A",
    model: "deepseek-chat",
    latencyMs: 40,
} as const

describe("AiPoolClient", () => {
    describe("telemetry of attempts", () => {
        it("subscribes the four router events", async () => {
            const { router } = await subscribed()

            expect(router.on.mock.calls.map(([name]) => name)).toEqual([
                "attempt",
                "request",
                "breaker",
                "key-disabled",
            ])
        })

        it("logs a failed attempt, and a 429 as rate limited, by alias", async () => {
            const { handler, logger } = await subscribed()

            handler("attempt")({ ...ATTEMPT, outcome: "success" })
            handler("attempt")({ ...ATTEMPT, outcome: "failure", errorClass: "rate_limit", status: 429 })
            handler("attempt")({ ...ATTEMPT, outcome: "failure", errorClass: "transient", status: 503 })
            handler("attempt")({ ...ATTEMPT, outcome: "failure" })

            expect(logger.warn).toHaveBeenCalledTimes(3)
            expect(logger.warn).toHaveBeenNthCalledWith(1, AiPoolLogEvent.RateLimited, {
                provider: "deepseek",
                key: "DEEPSEEK_KEY_A",
                model: "deepseek-chat",
                errorClass: "rate_limit",
                status: 429,
                attempt: 1,
                latencyMs: 40,
            })
            expect(logger.warn).toHaveBeenNthCalledWith(
                2,
                AiPoolLogEvent.AttemptFailed,
                expect.objectContaining({ status: 503 }),
            )
            expect(logger.warn).toHaveBeenNthCalledWith(
                3,
                AiPoolLogEvent.AttemptFailed,
                expect.objectContaining({ errorClass: null, status: null }),
            )
        })
    })
})

const REQUEST = { type: "request", requestId: "r-1", operation: "chat", latencyMs: 90 } as const

describe("AiPoolClient", () => {
    describe("telemetry of calls, breakers and keys", () => {
        it("logs a call that succeeded after more than one attempt as a fallback", async () => {
            const { handler, logger } = await subscribed()
            const lane = { provider: "openrouter", key: "OPENROUTER_API_KEY", model: "deepseek/deepseek-chat" }

            handler("request")({ ...REQUEST, outcome: "success", attempts: 1 })
            handler("request")({ ...REQUEST, outcome: "failure", attempts: 3, errorClass: "no_candidate" })
            handler("request")({ ...REQUEST, outcome: "success", attempts: 2, ...lane })
            handler("request")({ ...REQUEST, outcome: "success", attempts: 2 })

            expect(logger.info).toHaveBeenCalledTimes(2)
            expect(logger.info).toHaveBeenNthCalledWith(1, AiPoolLogEvent.FellBack, {
                operation: "chat",
                attempts: 2,
                ...lane,
            })
            expect(logger.info).toHaveBeenNthCalledWith(
                2,
                AiPoolLogEvent.FellBack,
                expect.objectContaining({ provider: null, key: null, model: null }),
            )
        })

        it("logs breaker changes and disabled keys", async () => {
            const { handler, logger } = await subscribed()
            const breaker = { type: "breaker", provider: "deepseek" } as const

            handler("breaker")({ ...breaker, scope: "key", key: "k1", from: "closed", to: "open" })
            handler("breaker")({ ...breaker, scope: "provider", from: "open", to: "half-open" })
            handler("key-disabled")({
                type: "key-disabled",
                provider: "deepseek",
                key: "k1",
                reason: "auth",
                until: null,
            })

            expect(logger.warn).toHaveBeenNthCalledWith(1, AiPoolLogEvent.BreakerChanged, {
                scope: "key",
                provider: "deepseek",
                key: "k1",
                from: "closed",
                to: "open",
            })
            expect(logger.warn).toHaveBeenNthCalledWith(
                2,
                AiPoolLogEvent.BreakerChanged,
                expect.objectContaining({ key: null }),
            )
            expect(logger.warn).toHaveBeenNthCalledWith(3, AiPoolLogEvent.KeyDisabled, {
                provider: "deepseek",
                key: "k1",
                reason: "auth",
                until: null,
            })
        })
    })
})
